import type { DbClient } from './db-client';
import type { EventRef } from '../types/references';
import type { FindEventCriteria } from '../types/payloads';

interface EventRow {
  id: number;
  title: string;
}

/**
 * Locates an existing event in the tenant DB matching the given criteria.
 * Prefer this over creating a new event when a test only needs *an* event to exist.
 *
 * The exact column names (event_name, is_seated, etc.) are placeholders and
 * should be verified against SquareMaze's real events table schema before running.
 */
export async function findEvent(db: DbClient, criteria: FindEventCriteria = {}): Promise<EventRef | null> {
  const where: string[] = [];
  const params: unknown[] = [];

  if (criteria.status === 'published') where.push("e.status = 'published'");
  if (criteria.status === 'draft')     where.push("e.status = 'draft'");

  if (criteria.isSeated === true)  where.push("e.is_seated = 1");
  if (criteria.isSeated === false) where.push("e.is_seated = 0");

  if (criteria.hasCapacity === true) where.push("(e.capacity IS NULL OR e.capacity > 0)");

  const sql = `
    SELECT e.id AS id, e.event_name AS title
    FROM events e
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY e.id DESC
    LIMIT 1
  `;

  const row = await db.one<EventRow & import('mysql2').RowDataPacket>(sql, params);
  return row ? { id: row.id, title: row.title } : null;
}
