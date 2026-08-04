import mysql, { Pool, RowDataPacket } from 'mysql2/promise';
import type { TenantDb } from '../types/tenant';

/**
 * Thin wrapper around a mysql2 connection pool for one tenant's DB.
 * The mysql2-specific types (RowDataPacket) stay internal — callers pass
 * plain object interfaces as the generic T. Reads and writes only,
 * writes should originate from the state fixture or cleanup teardown.
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
    await this.pool.execute(sql, params);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
