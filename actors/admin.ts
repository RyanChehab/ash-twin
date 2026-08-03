import type { Page } from '@playwright/test';
import type { TenantConfig } from '../types/tenant';
import type { DbClient } from '../helpers/db-client';
import type { EventPayload, FindEventCriteria } from '../types/payloads';
import type { EventRef } from '../types/references';
import { findEvent as dbFindEvent } from '../helpers/event-finder';
import { AdminEventsPage } from '../pages/admin/admin-events-page';
import { AdminEventFormPage } from '../pages/admin/admin-event-form-page';
import { unique } from '../helpers/unique';

export class Admin {
  constructor(
    private page: Page,
    private tenant: TenantConfig,
    private db: DbClient,
  ) {}

  /** Locate an existing event in the tenant DB matching criteria. Prefer this over createEvent. */
  async findEvent(criteria: FindEventCriteria = {}): Promise<EventRef | null> {
    return await dbFindEvent(this.db, criteria);
  }

  /**
   * Drive the admin UI to create a new event.
   * Throws with the captured error message if the save reports validation failure.
   */
  async createEvent(payload: Partial<EventPayload> = {}): Promise<EventRef> {
    const title = payload.title ?? unique.name('e2e-event');

    const list = new AdminEventsPage(this.page);
    await list.open();
    await list.clickAdd();

    const form = new AdminEventFormPage(this.page);
    await form.fillTitle(title);
    if (payload.capacity !== undefined) await form.fillCapacity(payload.capacity);
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
