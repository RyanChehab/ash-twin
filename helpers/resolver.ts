import type { DbClient } from './db-client';
import type { Event, EventCriteria, EventRep } from '../types/event';
import type { Category, CategoryCriteria } from '../types/category';
import type { AddonCriteria } from '../types/addon';
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

  /**
   * Translate an `EventCriteria` into a WHERE clause. The resolver has no
   * defaults — every predicate is gated on a criterion being set explicitly.
   * Curated preset combinations live in `helpers/event-presets.ts` so tests
   * can reference `events.normal`, `events.presale`, etc. instead of hand-
   * rolling criteria at each call site.
   */
  private buildEventCriteriaWhere(
    c: EventCriteria,
  ): { where: string; params: unknown[]; orderBy: string } {
    const parts: string[] = [];
    const params: unknown[] = [];

    // Core selection
    if (c.status) {
      parts.push('e.event_status = ?');
      params.push(c.status);
    }

    if (c.rep) {
      if (c.rep === 'main-or-unique') {
        parts.push(`e.event_rep IN ('main', ?)`);
        params.push(REP_DB_UNIQUE);
      } else if (c.rep === 'sub-or-unique') {
        parts.push(`e.event_rep IN ('sub', ?)`);
        params.push(REP_DB_UNIQUE);
      } else {
        parts.push('e.event_rep = ?');
        params.push(repToDb(c.rep));
      }
    }

    if (c.model) {
      parts.push('e.event_model = ?');
      params.push(c.model);
    }

    // Visibility flags — each one only applied when explicitly set.
    if (c.webshop === true)  parts.push('e.event_webshop = 1');
    if (c.webshop === false) parts.push('e.event_webshop = 0');

    if (c.inViewWindow === true) {
      parts.push('(e.event_view_begin IS NULL OR e.event_view_begin < NOW())');
      parts.push('(e.event_view_end   IS NULL OR e.event_view_end   > NOW())');
    }
    if (c.inViewWindow === false) {
      parts.push('(e.event_view_begin >= NOW() OR e.event_view_end <= NOW())');
    }

    if (c.isFuture === true)  parts.push('(e.event_date IS NULL OR e.event_date >= CURDATE())');
    if (c.isFuture === false) parts.push('e.event_date < CURDATE()');

    if (c.parentViewable === true) {
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
    }

    if (c.isPresale === true)  parts.push('e.event_presales = 1');
    if (c.isPresale === false) parts.push('(e.event_presales = 0 OR e.event_presales IS NULL)');

    if (c.isPrivate === true)  parts.push('e.event_is_private = 1');
    if (c.isPrivate === false) parts.push('(e.event_is_private = 0 OR e.event_is_private IS NULL)');

    if (c.requiresNationalId === true)  parts.push('e.event_nationalid = 1');
    if (c.requiresNationalId === false) parts.push('(e.event_nationalid = 0 OR e.event_nationalid IS NULL)');

    if (c.requiresLogin === true)  parts.push('e.event_requires_login = 1');
    if (c.requiresLogin === false) parts.push('(e.event_requires_login = 0 OR e.event_requires_login IS NULL)');

    if (c.hasAddons) {
      const { sql, params: p } = this.buildAddonExistsForEvent(c.hasAddons);
      parts.push(`EXISTS (${sql})`);
      params.push(...p);
    }
    if (c.hasNoAddons) {
      const { sql, params: p } = this.buildAddonExistsForEvent(c.hasNoAddons);
      parts.push(`NOT EXISTS (${sql})`);
      params.push(...p);
    }

    // Nested category filter — becomes an EXISTS subquery on `category`.
    if (c.hasCategory) {
      const { sql, params: p } = this.buildCategoryExistsForEvent(c.hasCategory);
      parts.push(sql);
      params.push(...p);
    }

    // Sub events want date-forward ordering (surface the next upcoming date first).
    const orderBy = (c.rep === 'sub' || c.rep === 'sub-or-unique')
      ? 'e.event_date ASC, e.event_time ASC, e.event_id ASC'
      : 'e.event_id DESC';

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

  /**
   * Build the body of an addon-existence subquery. Emits everything after
   * `EXISTS (` and before `)` — the caller decides whether the outer clause
   * is `EXISTS` or `NOT EXISTS`. The subquery joins `addonlink` → `event`
   * (the addon row) and optionally `category` (via `hasCategory`).
   */
  private buildAddonExistsForEvent(cond: AddonCriteria): { sql: string; params: unknown[] } {
    const clauses: string[] = ['al.addonlink_event_id = e.event_id'];
    const params: unknown[] = [];

    // Identity / link predicates on `addonlink`
    if (cond.addonId !== undefined) {
      clauses.push('al.addonlink_addon_id = ?');
      params.push(cond.addonId);
    }
    if (cond.eventId !== undefined) {
      clauses.push('al.addonlink_event_id = ?');
      params.push(cond.eventId);
    }
    if (cond.categoryId !== undefined) {
      clauses.push('al.addonlink_category_id = ?');
      params.push(cond.categoryId);
    }

    // Addon row (event where event_addon = 1) predicates
    if (cond.status) {
      clauses.push('ae.event_status = ?');
      params.push(cond.status);
    }
    if (cond.webshop === true)  clauses.push('ae.event_webshop = 1');
    if (cond.webshop === false) clauses.push('ae.event_webshop = 0');

    if (cond.showOnCheckout === true)  clauses.push('ae.event_show_on_checkout = 1');
    if (cond.showOnCheckout === false) clauses.push('ae.event_show_on_checkout = 0');

    if (cond.stockShared === true)  clauses.push('ae.event_stock_shared = 1');
    if (cond.stockShared === false) clauses.push('ae.event_stock_shared = 0');

    if (cond.minPrice !== undefined) {
      clauses.push('ae.event_current_price >= ?');
      params.push(cond.minPrice);
    }
    if (cond.maxPrice !== undefined) {
      clauses.push('ae.event_current_price <= ?');
      params.push(cond.maxPrice);
    }
    if (cond.orderLimit !== undefined) {
      clauses.push('ae.event_order_limit = ?');
      params.push(cond.orderLimit);
    }

    // Optional join into the addon's category to filter by category shape.
    let categoryJoin = '';
    if (cond.hasCategory) {
      categoryJoin = 'JOIN category ac ON ac.category_event_id = ae.event_id';
      const { where, params: catParams } = this.buildCategoryCriteriaWhere(cond.hasCategory, 'ac');
      if (where) clauses.push(where);
      params.push(...catParams);
    }

    return {
      sql: `
        SELECT 1
        FROM addonlink al
        JOIN event ae ON ae.event_id = al.addonlink_addon_id
        ${categoryJoin}
        WHERE ${clauses.join(' AND ')}
      `,
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
