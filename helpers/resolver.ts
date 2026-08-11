import type { DbClient } from './db-client';
import type { Event, EventCriteria, EventRep } from '../types/event';
import type { Category, CategoryCriteria } from '../types/category';
import type { EventSelector, CategorySelector } from '../types/selectors';

// ── DB ↔ domain rep value mapping ──────────────────────────────────────────
// SquareMaze stores 'main,sub' for standalone (unique) events. We alias to
// 'unique' in the domain type for clarity.
const REP_DB_UNIQUE = 'main,sub';

function repToDb(rep: EventRep): string {
  return rep === 'unique' ? REP_DB_UNIQUE : rep;
}

function repFromDb(v: string | null | undefined): EventRep | undefined {
  if (v === REP_DB_UNIQUE) return 'unique';
  if (v === 'main' || v === 'sub') return v;
  return undefined;
}

export class Resolver {
  constructor(private db: DbClient) {}

  // ── Events ──────────────────────────────────────────────────────────────

  async event(selector: EventSelector): Promise<Event> {
    let row: Event | null;

    if (typeof selector === 'number') {
      row = await this.queryEvent('e.event_id = ?', [selector]);
    } else if (typeof selector === 'string') {
      row = await this.queryEvent('e.event_name = ?', [selector]);
    } else if (typeof selector === 'object' && 'id' in selector && 'title' in selector) {
      row = await this.queryEvent('e.event_id = ?', [selector.id]);
    } else if (typeof selector === 'object') {
      const { where, params, orderBy } = this.buildEventCriteriaWhere(selector as EventCriteria);
      row = await this.queryEvent(where, params, orderBy);
    } else {
      throw new Error(`Unrecognized event selector: ${JSON.stringify(selector)}`);
    }

    if (!row) throw new Error(`Event not found: ${JSON.stringify(selector)}`);
    return row;
  }

  async nextSub(mainId: number): Promise<Event> {
    const sql = `
      SELECT
        e.event_id      AS id,
        e.event_name    AS title,
        e.event_type    AS type,
        e.event_status  AS status,
        e.event_date    AS date,
        e.event_time    AS time,
        e.event_rep     AS rep,
        e.event_model   AS model,
        e.event_main_id AS mainId
      FROM event e
      WHERE e.event_main_id = ?
        AND e.event_date >= CURDATE()
      ORDER BY e.event_date ASC, e.event_time ASC
      LIMIT 1
    `;
    const row = await this.db.one<Event>(sql, [mainId]);
    if (!row) throw new Error(`No upcoming sub events for main ${mainId}`);
    return this.hydrateEventRow(row);
  }

  private async queryEvent(
    where: string,
    params: unknown[],
    orderBy: string = 'e.event_id DESC',
  ): Promise<Event | null> {
    const sql = `
      SELECT
        e.event_id      AS id,
        e.event_name    AS title,
        e.event_type    AS type,
        e.event_status  AS status,
        e.event_date    AS date,
        e.event_time    AS time,
        e.event_rep     AS rep,
        e.event_model   AS model,
        e.event_main_id AS mainId
      FROM event e
      ${where ? 'WHERE ' + where : ''}
      ORDER BY ${orderBy}
      LIMIT 1
    `;
    const row = await this.db.one<Event>(sql, params);
    return row ? this.hydrateEventRow(row) : null;
  }

  private hydrateEventRow(row: Event): Event {
    return { ...row, rep: repFromDb(row.rep as unknown as string) };
  }

  private buildEventCriteriaWhere(
    c: EventCriteria,
  ): { where: string; params: unknown[]; orderBy: string } {
    const parts: string[] = [];
    const params: unknown[] = [];

    const rep = c.rep ?? (c.hasCategory ? 'sub-or-unique' : 'main-or-unique');
    if (rep === 'main-or-unique') {
      parts.push(`e.event_rep IN ('main', ?)`);
      params.push(REP_DB_UNIQUE);
    } else if (rep === 'sub-or-unique') {
      parts.push(`e.event_rep IN ('sub', ?)`);
      params.push(REP_DB_UNIQUE);
    } else {
      parts.push('e.event_rep = ?');
      params.push(repToDb(rep));
    }

    // Always filter by event_model. The `event` table also holds season passes,
    // vouchers, products (F&B), and ebooks. Default to real 'event' rows only;
    // callers can explicitly target other kinds via `model:`.
    parts.push('e.event_model = ?');
    params.push(c.model ?? 'event');

    // Safety net: real events should have a non-null event_type for URL building.
    parts.push("e.event_type IS NOT NULL AND e.event_type != ''");

    // Only browsable events. Mirrors Event::viewable() + Event::availableOnWeb():
    //   - listed for sale on web
    //   - inside the view window (begin/end may be NULL = open-ended)
    //   - event_date has not passed (NULL date is fine — evergreen)
    parts.push('e.event_webshop = 1');
    parts.push('(e.event_view_begin IS NULL OR e.event_view_begin < NOW())');
    parts.push('(e.event_view_end   IS NULL OR e.event_view_end   > NOW())');
    parts.push('(e.event_date       IS NULL OR e.event_date       >= CURDATE())');

    // A sub is only reachable if its parent main is itself browsable. Otherwise
    // we'd return e.g. a pub sub whose unpub main renders an empty page.
    parts.push(`(
      e.event_main_id IS NULL
      OR EXISTS (
        SELECT 1 FROM event m
        WHERE m.event_id = e.event_main_id
          AND m.event_status  = 'pub'
          AND m.event_webshop = 1
          AND (m.event_view_begin IS NULL OR m.event_view_begin < NOW())
          AND (m.event_view_end   IS NULL OR m.event_view_end   > NOW())
      )
    )`);
    
    const addonExists = `EXISTS (
      SELECT 1 FROM addonlink al
      JOIN event    ae ON ae.event_id         = al.addonlink_addon_id
      JOIN category ac ON ac.category_event_id = ae.event_id
      WHERE al.addonlink_event_id = e.event_id
        AND ae.event_status  = 'pub'
        AND ae.event_webshop = 1
        AND ac.category_web  = 1
    )`;
    parts.push(c.hasAddons === true ? addonExists : `NOT ${addonExists}`);

    if (c.status) {
      parts.push('e.event_status = ?');
      params.push(c.status);
    }

    if (c.hasCategory) {
      const { sql, params: p } = this.buildCategoryExistsForEvent(c.hasCategory);
      parts.push(sql);
      params.push(...p);
    }

    let orderBy = 'e.event_id DESC';
    if (rep === 'sub' || rep === 'sub-or-unique') {
      // Date-forward ordering — surfaces the next upcoming date first.
      orderBy = 'e.event_date ASC, e.event_time ASC, e.event_id ASC';
    }

    return { where: parts.join(' AND '), params, orderBy };
  }

  private buildCategoryExistsForEvent(cond: CategoryCriteria): { sql: string; params: unknown[] } {
    const { where, params } = this.buildCategoryCriteriaWhere(cond, 'c');
    const tail = where ? ' AND ' + where : '';
    return {
      sql: `EXISTS (SELECT 1 FROM category c WHERE c.category_event_id = e.event_id${tail})`,
      params,
    };
  }

  private buildCategoryCriteriaWhere(
    cond: CategoryCriteria,
    alias: string,
  ): { where: string; params: unknown[] } {
    const parts: string[] = [];
    const params: unknown[] = [];

    if (cond.eventId !== undefined) {
      parts.push(`${alias}.category_event_id = ?`);
      params.push(cond.eventId);
    }

    if (cond.numbering === 'seated') {
      parts.push(`${alias}.category_numbering != 'none'`);
    } else if (cond.numbering) {
      parts.push(`${alias}.category_numbering = ?`);
      params.push(cond.numbering);
    }

    if (cond.soldout === true)  parts.push(`${alias}.category_free = 0`);
    if (cond.soldout === false) parts.push(`${alias}.category_free > 0`);

    if (cond.webPublished) parts.push(`${alias}.category_web = 1`);
    if (cond.posPublished) parts.push(`${alias}.category_pos = 1`);
    if (cond.b2bPublished) parts.push(`${alias}.category_b2b = 1`);

    if (cond.name !== undefined) {
      parts.push(`${alias}.category_name = ?`);
      params.push(cond.name);
    }
    if (cond.minPrice !== undefined) {
      parts.push(`${alias}.category_price >= ?`);
      params.push(cond.minPrice);
    }
    if (cond.maxPrice !== undefined) {
      parts.push(`${alias}.category_price <= ?`);
      params.push(cond.maxPrice);
    }
    if (cond.mode !== undefined) {
      parts.push(`${alias}.category_mode = ?`);
      params.push(cond.mode);
    }
    return { where: parts.join(' AND '), params };
  }

  // ── Categories ──────────────────────────────────────────────────────────

  async category(selector: CategorySelector): Promise<Category> {
    let row: Category | null;

    if (typeof selector === 'number') {
      row = await this.queryCategory('c.category_id = ?', [selector]);
    } else if (typeof selector === 'object' && 'id' in selector && 'eventId' in selector) {
      row = await this.queryCategory('c.category_id = ?', [selector.id]);
    } else if (typeof selector === 'object') {
      const { where, params } = this.buildCategoryCriteriaWhere(selector as CategoryCriteria, 'c');
      row = await this.queryCategory(where || '1=1', params);
    } else {
      throw new Error(`Unrecognized category selector: ${JSON.stringify(selector)}`);
    }

    if (!row) throw new Error(`Category not found: ${JSON.stringify(selector)}`);
    return { ...row, isSeated: row.numbering !== undefined && row.numbering !== 'none' };
  }

  private async queryCategory(where: string, params: unknown[]): Promise<Category | null> {
    const sql = `
      SELECT
        c.category_id        AS id,
        c.category_event_id  AS eventId,
        c.category_name      AS name,
        c.category_price     AS price,
        c.category_size      AS size,
        c.category_free      AS free,
        c.category_numbering AS numbering,
        c.category_mode      AS mode,
        c.category_web       AS webStatus,
        c.category_pos       AS posStatus
      FROM category c
      WHERE ${where}
      ORDER BY c.category_id DESC
      LIMIT 1
    `;
    return await this.db.one<Category>(sql, params);
  }
}
