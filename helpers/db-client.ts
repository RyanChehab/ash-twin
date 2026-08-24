import mysql, { Pool, RowDataPacket } from 'mysql2/promise';
import type { TenantDb } from '../types/tenant';

/**
 * Thin wrapper around a mysql2 connection pool for one tenant's DB.
 * The mysql2-specific types (RowDataPacket) stay internal — callers pass
 * plain object interfaces as the generic T.
 */
export class DbClient {
  private pool: Pool;

  constructor(cfg: TenantDb) {
    this.pool = mysql.createPool({
      host: cfg.host,
      port: cfg.port,
      user: cfg.user,
      password: cfg.password,
      database: cfg.database,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
    });
  }

  async query<T extends object = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    const [rows] = await this.pool.query<(T & RowDataPacket)[]>(sql, params);
    return rows as T[];
  }

  async one<T extends object = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows[0] ?? null;
  }

  async execute(sql: string, params: unknown[] = []): Promise<void> {

    await this.pool.query(sql, params);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  // ── configuration overrides ─────────────────────────────────────────────

  async overrideConfig(field: string, value: string | number | boolean): Promise<string | null> {
    const row = await this.one<{ config_value: string }>(
      'SELECT config_value FROM configuration WHERE config_field = ?',
      [field],
    );
    await this.execute(
      'UPDATE configuration SET config_value = ? WHERE config_field = ?',
      [phpSerialize(value), field],
    );
    return row?.config_value ?? null;
  }

  /**
   * Write a raw PHP-serialized value back to `configuration` — the companion
   * to `overrideConfig` when restoring across fixture scopes.
   */
  async restoreConfig(field: string, previous: string | null): Promise<void> {
    if (previous === null) return;
    await this.execute(
      'UPDATE configuration SET config_value = ? WHERE config_field = ?',
      [previous, field],
    );
  }

  // ── user + auth: for the signup vitality test ───────────────────────────


  //Build the activation URL for a just-registered user.
  async activationUrlFor(email: string): Promise<string> {
    // Read-after-write can race on staging (commit lag + potential replica
    // fan-out), so retry up to ~1.5s before giving up. Happy path is one query.
    const row = await withRetry(() =>
      this.one<{ user_id: number; active: string | null }>(
        `SELECT u.user_id, a.active
         FROM user u
         JOIN auth a ON a.user_id = u.user_id
         WHERE u.user_email = ?
         LIMIT 1`,
        [email],
      ),
      r => !!r && !!r.active,
    );
    if (!row) throw new Error(`No user found with email ${email} after retries`);
    if (!row.active) throw new Error(`User ${email} has no pending activation (auth.active is NULL)`);
    const token = Buffer.from(`${row.user_id}|activate|${row.active}`).toString('base64');
    return `/activation.php?uar=${encodeURIComponent(token)}`;
  }

  /** True once activation cleared auth.active (NULL) and user.user_active flipped to 1. */
  async isUserActive(email: string): Promise<boolean> {
    // Same race window as activationUrlFor — retry until the activation write
    // (user.user_active = 1 AND auth.active = NULL) is visible.
    const row = await withRetry(() =>
      this.one<{ user_active: number; active: string | null }>(
        `SELECT u.user_active, a.active
         FROM user u
         JOIN auth a ON a.user_id = u.user_id
         WHERE u.user_email = ?
         LIMIT 1`,
        [email],
      ),
      r => !!r && r.user_active === 1 && r.active === null,
    );
    return !!row && row.user_active === 1 && row.active === null;
  }

  /** Remove the test-created user + its auth row. Safe to call even if the user was never created. */
  async deleteUserByEmail(email: string): Promise<void> {
    await this.execute(
      'DELETE FROM auth WHERE user_id IN (SELECT user_id FROM (SELECT user_id FROM user WHERE user_email = ?) AS t)',
      [email],
    );
    await this.execute('DELETE FROM user WHERE user_email = ?', [email]);
  }
}

/** PHP `serialize()` for the scalar types we override — matches how `configuration.config_value` is stored. */
function phpSerialize(value: string | number | boolean): string {
  const s = String(value);
  return `s:${s.length}:"${s}";`;
}

async function withRetry<T>(
  read: () => Promise<T | null>,
  ready: (row: T | null) => boolean,
  attempts = 5,
  gapMs = 300,
): Promise<T | null> {
  let row = await read();
  for (let i = 1; i < attempts && !ready(row); i++) {
    await new Promise(r => setTimeout(r, gapMs));
    row = await read();
  }
  return row;
}
