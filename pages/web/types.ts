import type { LandingPage } from './default/landing';
import type { EventPage } from './default/event';
import type { EventDatesPage } from './default/event-dates';
import type { CheckoutProductsPage } from './default/checkout-products';
import type { CheckoutPage } from './default/checkout';
import type { ConfirmationPage } from './default/confirmation';
import type { AuthPage } from './default/auth';

/**
 * Contract for the customer-facing page objects the WebCustomer actor drives.
 * Every theme's page bundle satisfies this shape — see `pages/web/factory.ts`
 * for the tenant.theme → bundle mapping. The type parameters happen to be
 * named after the `default` theme's classes because it's the first one
 * implemented; capetown/next classes will implement the same shape.
 */
export interface WebPages {
  landing:          LandingPage;
  event:            EventPage;
  eventDates:       EventDatesPage;
  checkoutProducts: CheckoutProductsPage;
  checkout:         CheckoutPage;
  confirmation:     ConfirmationPage;
  auth:             AuthPage;
}
