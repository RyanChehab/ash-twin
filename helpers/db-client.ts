import mysql, { Pool, RowDataPacket } from 'mysql2/promise';
import type { TenantDb } from '../types/tenant';

/**
 * Thin wrapper around mysql2 pool for the tenant's DB.
 * Used by fixtures/db, actors, and helpers/event-finder for reads AND writes.
 * Writes should only happen from the state fixture (per-test enforce)
 * or from cleanup teardown — never inline in tests.
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

  async query<T extends RowDataPacket = RowDataPacket>(sql: string, params: unknown[] = []): Promise<T[]> {
    const [rows] = await this.pool.query<T[]>(sql, params);
    return rows;
  }

  async one<T extends RowDataPacket = RowDataPacket>(sql: string, params: unknown[] = []): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows[0] ?? null;
  }

  async execute(sql: string, params: unknown[] = []): Promise<void> {
    await this.pool.execute(sql, params);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
