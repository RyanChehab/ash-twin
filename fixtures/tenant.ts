import { test as base } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TenantConfig } from '../types/tenant';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const SITES_DIR = path.join(__dirname, '..', 'sites');

function interpolate(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replace(/\$\{([A-Z0-9_]+)\}/g, (_, key) => {
      const v = process.env[key];
      if (v === undefined) throw new Error(`Missing env var ${key} referenced in tenant config`);
      return v;
    });
  }
  if (Array.isArray(value)) return value.map(interpolate);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = interpolate(v);
    return out;
  }
  return value;
}

function loadTenant(name: string, env: string): TenantConfig {
  const file = path.join(SITES_DIR, `${name}.${env}.json`);
  if (!fs.existsSync(file)) throw new Error(`Site config not found: ${file}`);
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const cfg = interpolate(raw) as TenantConfig & { db: { port: string | number } };
  cfg.db.port = Number(cfg.db.port);
  return cfg as TenantConfig;
}

export const tenantFixture = base.extend<{ tenant: TenantConfig }>({
  tenant: async ({}, use, testInfo) => {

    const meta = testInfo.project.metadata as { tenant?: string; env?: string } | undefined;
    const name = meta?.tenant ?? process.env.TENANT ?? 'cca';
    const env  = meta?.env    ?? process.env.ENV    ?? 'local';
    await use(loadTenant(name, env));
  },
});
