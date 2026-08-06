import type { Page } from '@playwright/test';
import type { TenantConfig } from '../../types/tenant';
import type { WebPages } from './types';
import { LandingPage } from './cca/landing';
import { EventPage } from './cca/event';
import { EventDatesPage } from './cca/event-dates';
import { CheckoutPage } from './cca/checkout';
import { ConfirmationPage } from './cca/confirmation';
import { AuthPage } from './cca/auth';

/**
 * Constructs the WebPages bundle for the given tenant.
 * Currently only cca has a page-object set; adrea/blublood (capetown theme),
 * antoine/virgin (Next.js) will branch here when their overrides land.
 */
export function webPages(page: Page, tenant: TenantConfig): WebPages {
  // if (tenant.name === 'adrea' || tenant.name === 'blublood') return capetownWebPages(page);
  // if (tenant.name === 'antoine') return antoineWebPages(page);
  // if (tenant.name === 'virgin')  return virginWebPages(page);

  return {
    landing:      new LandingPage(page),
    event:        new EventPage(page),
    eventDates:   new EventDatesPage(page),
    checkout:     new CheckoutPage(page),
    confirmation: new ConfirmationPage(page),
    auth:         new AuthPage(page),
  };
}
