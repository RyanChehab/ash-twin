import { test as base, type Page } from '@playwright/test';
import type { TenantConfig } from '../types/tenant';
import { DbClient } from '../helpers/db-client';
import { Admin } from '../actors/admin';
import { WebCustomer } from '../actors/web-customer';

export const actorsFixtures = base.extend<{
  db: DbClient;
  admin: Admin;
  customer: WebCustomer;
}, {
  tenant: TenantConfig;
  adminPage: Page;
  customerPage: Page;
}>({
  db: async ({ tenant }, use) => {
    const client = new DbClient(tenant.db);
    await use(client);
    await client.close();
  },

  admin: async ({ adminPage, tenant, db }, use) => {
    await use(new Admin(adminPage, tenant, db));
  },

  customer: async ({ customerPage, tenant }, use) => {
    await use(new WebCustomer(customerPage, tenant));
  },
});
