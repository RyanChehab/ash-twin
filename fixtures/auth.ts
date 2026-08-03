import { test as base, type Page } from '@playwright/test';
import type { TenantConfig } from '../types/tenant';
import { AdminLoginPage } from '../pages/admin/admin-login-page';

/**
 * Provides logged-in browser tabs per role.
 * Each tab is a fresh Playwright context (isolated cookies/storage) with the right baseURL.
 */
export const authFixtures = base.extend<{
  adminPage: Page;
  customerPage: Page;
}, { tenant: TenantConfig }>({
  adminPage: async ({ browser, tenant }, use) => {
    const ctx = await browser.newContext({ baseURL: tenant.baseUrl, ignoreHTTPSErrors: true });
    const page = await ctx.newPage();
    const login = new AdminLoginPage(page);
    await login.open();
    await login.login(tenant.users.superadmin.username, tenant.users.superadmin.password);
    const err = await login.errorText();
    if (err) throw new Error(`admin login failed: ${err}`);
    await use(page);
    await ctx.close();
  },

  customerPage: async ({ browser, tenant }, use) => {
    const ctx = await browser.newContext({ baseURL: tenant.webUrl, ignoreHTTPSErrors: true });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },
});
