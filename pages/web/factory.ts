import type { Page } from '@playwright/test';
import type { TenantConfig } from '../../types/tenant';
import type { WebPages } from './types';
import { LandingPage } from './default/landing';
import { EventPage } from './default/event';
import { EventDatesPage } from './default/event-dates';
import { CheckoutProductsPage } from './default/checkout-products';
import { CheckoutPage } from './default/checkout';
import { ConfirmationPage } from './default/confirmation';
import { AuthPage } from './default/auth';

/**
 * Return the WebPages bundle for the tenant's theme.
 *
 * Dispatches on `tenant.theme` — declared per-tenant in `tenants/*.json`,
 * NOT inferred from `tenant.name`. Adding a new tenant on an existing theme
 * is a JSON edit (no code change). Adding a new theme is a new bundle
 * function here plus the concrete page-object files under `pages/web/{theme}/`.
 */
export function webPages(page: Page, tenant: TenantConfig): WebPages {
  switch (tenant.theme) {
    case 'default':  return defaultPages(page);
    case 'capetown': return capetownPages(page, tenant);
    case 'next':     return nextPages(page, tenant);
  }
}

function defaultPages(page: Page): WebPages {
  return {
    landing:          new LandingPage(page),
    event:            new EventPage(page),
    eventDates:       new EventDatesPage(page),
    checkoutProducts: new CheckoutProductsPage(page),
    checkout:         new CheckoutPage(page),
    confirmation:     new ConfirmationPage(page),
    auth:             new AuthPage(page),
  };
}

// Placeholders — implement when we onboard adrea/blublood. Throwing here means
// a tenant declared with `"theme": "capetown"` fails loud with the exact fix
// instead of silently getting wrong pages.
function capetownPages(_page: Page, tenant: TenantConfig): WebPages {
  throw new Error(
    `capetown page bundle not yet implemented (needed by tenant '${tenant.name}'). ` +
    `Add pages/web/capetown/*.ts and finish the capetownPages() branch in pages/web/factory.ts.`,
  );
}

function nextPages(_page: Page, tenant: TenantConfig): WebPages {
  throw new Error(
    `next page bundle not yet implemented (needed by tenant '${tenant.name}'). ` +
    `The Next.js customer app is a separate frontend — add pages/web/next/*.ts and finish nextPages() when ready.`,
  );
}
