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
      row = await this.queryEvent('e.id = ?', [selector]);
    } else if (typeof selector === 'string') {
      row = await this.queryEvent('e.event_name = ?', [selector]);
    } else if (typeof selector === 'object' && 'id' in selector && 'title' in selector) {
      row = await this.queryEvent('e.id = ?', [selector.id]);
    } else if (typeof selector === 'object') {
      const { where, params, orderBy } = this.buildEventCriteriaWhere(selector as EventCriteria);
      row = await this.queryEvent(where, params, orderBy);
    } else {
      throw new Error(`Unrecognized event selector: ${JSON.stringify(selector)}`);
    }

    if (!row) throw new Error(`Event not found: ${JSON.stringify(selector)}`);
    return row;
  }

  /**
   * Given a main event id, return the next upcoming sub (earliest date >= today).
   * Used by WebCustomer as a fallback when the actor gets a main event with no
   * matching-sub context (e.g. a criteria-less lookup that returned a main).
   */
  async nextSub(mainId: number): Promise<Event> {
    const sql = `
      SELECT
        e.id            AS id,
        e.event_name    AS title,
        e.status        AS status,
        e.event_date    AS date,
        e.event_time    AS time,
        e.event_rep     AS rep,
        e.event_main_id AS mainId
      FROM events e
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
    orderBy: string = 'e.id DESC',
  ): Promise<Event | null> {
    const sql = `
      SELECT
        e.id            AS id,
        e.event_name    AS title,
        e.status        AS status,
        e.event_date    AS date,
        e.event_time    AS time,
        e.event_rep     AS rep,
        e.event_main_id AS mainId
      FROM events e
      ${where ? 'WHERE ' + where : ''}
      ORDER BY ${orderBy}
      LIMIT 1
    `;
    const row = await this.db.one<Event>(sql, params);
    return row ? this.hydrateEventRow(row) : null;
  }

  /** Translate DB rep value 'main,sub' → 'unique' after read. */
  private hydrateEventRow(row: Event): Event {
    return { ...row, rep: repFromDb(row.rep as unknown as string) };
  }

  private buildEventCriteriaWhere(
    c: EventCriteria,
  ): { where: string; params: unknown[]; orderBy: string } {
    const parts: string[] = [];
    const params: unknown[] = [];

    // Rep filter: pick a context-aware default
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

    if (c.status) {
      parts.push('e.status = ?');
      params.push(c.status);
    }

    if (c.hasCategory) {
      const { sql, params: p } = this.buildCategoryExistsForEvent(c.hasCategory);
      parts.push(sql);
      params.push(...p);
    }

    // When targeting subs (which have real dates), skip past events and prefer
    // the closest upcoming performance. Uniques with dates get the same treatment.
    let orderBy = 'e.id DESC';
    if (rep === 'sub' || rep === 'sub-or-unique') {
      parts.push('(e.event_date IS NULL OR e.event_date >= CURDATE())');
      orderBy = 'e.event_date ASC, e.event_time ASC, e.id ASC';
    }

    return { where: parts.join(' AND '), params, orderBy };
  }

  /**
   * EXISTS subquery on the events row itself (not spanning subs, since when
   * hasCategory is used we target sub-or-unique — the rows that actually
   * carry categories).
   */
  private buildCategoryExistsForEvent(cond: CategoryCriteria): { sql: string; params: unknown[] } {
    const { where, params } = this.buildCategoryCriteriaWhere(cond, 'c');
    const tail = where ? ' AND ' + where : '';
    return {
      sql: `EXISTS (SELECT 1 FROM category c WHERE c.category_event_id = e.id${tail})`,
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
