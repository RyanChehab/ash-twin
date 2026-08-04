import type { DbClient } from './db-client';
import type { Event } from '../types/event';
import type { EventSelector } from '../types/selectors';

/**
 * Resolver — turns a test's abstract selector into a concrete domain object.
 * 
 * Returns the full Event, or throws if nothing matches:
 *   - "Event not found: <selector>"           — the query ran but returned zero rows
 *   - "Unrecognized event selector: <value>"  — the selector shape wasn't a valid case
 */
export class Resolver {
  constructor(private db: DbClient) {}

  async event(selector: EventSelector): Promise<Event> {
    let row: Event | null;

    if (typeof selector === 'number') {
      row = await this.queryEvent('e.id = ?', [selector]);
    } else if (typeof selector === 'string') {
      row = await this.queryEvent('e.event_name = ?', [selector]);
    } else if (typeof selector === 'object' && 'id' in selector && 'title' in selector) {
      row = await this.queryEvent('e.id = ?', [selector.id]);
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
      WHERE ${where}
      LIMIT 1
    `;
    return await this.db.one<Event>(sql, params);
  }
}
