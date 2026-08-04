import type { Page } from '@playwright/test';
import type { TenantConfig } from '../types/tenant';
import type { DbClient } from '../helpers/db-client';
import type { Event, FindEventCriteria } from '../types/event';
import { AdminEventsPage } from '../pages/admin/admin-events-page';
import { AdminEventFormPage } from '../pages/admin/admin-event-form-page';

export class Admin {
  constructor(
    private page: Page,
    private tenant: TenantConfig,
    private db: DbClient,
  ) {}

  /**
   * Locate an existing event in the tenant DB matching criteria.
   * Prefer this over createEvent when the test just needs *an* event to exist.
   */
  async findEvent(criteria: FindEventCriteria = {}): Promise<Event | null> {
    const where: string[] = [];
    if (criteria.status === 'published')  where.push("e.status = 'published'");
    if (criteria.status === 'draft')      where.push("e.status = 'draft'");
    if (criteria.status === 'paused')     where.push("e.status = 'paused'");
    if (criteria.isSeated === true)       where.push("e.is_seated = 1");
    if (criteria.isSeated === false)      where.push("e.is_seated = 0");
    if (criteria.hasCapacity === true)    where.push("(e.capacity IS NULL OR e.capacity > 0)");

    const sql = `
      SELECT e.id AS id, e.event_name AS title
      FROM events e
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY e.id DESC
      LIMIT 1
    `;
    const row = await this.db.one<{ id: number; title: string } & import('mysql2').RowDataPacket>(sql);
    return row ? { id: row.id, title: row.title } : null;
  }

  /**
   * Drive the admin UI to create a new event.
   * Throws with the captured error message if the save reports validation failure.
   */
  async createEvent(payload: Partial<Event> = {}): Promise<Event> {
    const title = payload.title ?? `e2e-event-${Date.now()}`;

    const list = new AdminEventsPage(this.page);
    await list.open();
    await list.clickAdd();

    const form = new AdminEventFormPage(this.page);
    await form.fillTitle(title);
    if (payload.capacity !== undefined && payload.capacity !== null) {
      await form.fillCapacity(payload.capacity);
    }
    await form.save();

    if (await form.hasError()) {
      throw new Error(`createEvent failed: ${await form.errorSummary()}`);
    }

    const row = await this.db.one<{ id: number; title: string } & import('mysql2').RowDataPacket>(
      'SELECT id, event_name AS title FROM events WHERE event_name = ? ORDER BY id DESC LIMIT 1',
      [title],
    );
    if (!row) throw new Error(`Event "${title}" was submitted but not found in DB after save`);

    return { id: row.id, title: row.title };
  }
}
