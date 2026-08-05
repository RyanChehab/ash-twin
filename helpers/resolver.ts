import type { DbClient } from './db-client';
import type { Event, EventCriteria } from '../types/event';
import type { Category, CategoryCriteria } from '../types/category';
import type { EventSelector, CategorySelector } from '../types/selectors';


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
      const { where, params } = this.buildEventCriteriaWhere(selector as EventCriteria);
      row = await this.queryEvent(where, params);
    } else {
      throw new Error(`Unrecognized event selector: ${JSON.stringify(selector)}`);
    }

    if (!row) throw new Error(`Event not found: ${JSON.stringify(selector)}`);
    return row;
  }

  private async queryEvent(where: string, params: unknown[]): Promise<Event | null> {
    const sql = `
      SELECT
        e.id         AS id,
        e.event_name AS title,
        e.status     AS status,
        e.event_date AS date
      FROM events e
      ${where ? 'WHERE ' + where : ''}
      ORDER BY e.id DESC
      LIMIT 1
    `;
    return await this.db.one<Event>(sql, params);
  }

  private buildEventCriteriaWhere(c: EventCriteria): { where: string; params: unknown[] } {
    const parts: string[] = [];
    const params: unknown[] = [];

    if (c.status) {
      parts.push('e.status = ?');
      params.push(c.status);
    }

    if (c.hasCategory) {
      const { sql, params: p } = this.buildCategoryExists(c.hasCategory);
      parts.push(sql);
      params.push(...p);
    }

    return { where: parts.join(' AND '), params };
  }

  private buildCategoryExists(cond: CategoryCriteria): { sql: string; params: unknown[] } {
    const { where, params } = this.buildCategoryCriteriaWhere(cond, 'c');
    return {
      sql: `EXISTS (SELECT 1 FROM category c WHERE c.category_event_id = e.id${where ? ' AND ' + where : ''})`,
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

    // Per-channel published shortcuts
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
      // Full Category ref — re-fetch by id for fresh state
      row = await this.queryCategory('c.category_id = ?', [selector.id]);
    } else if (typeof selector === 'object') {
      // Criteria case
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
      LIMIT 1
    `;
    return await this.db.one<Category>(sql, params);
  }
}
