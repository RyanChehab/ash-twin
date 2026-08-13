import type { LandingPage } from './cca/landing';
import type { EventPage } from './cca/event';
import type { EventDatesPage } from './cca/event-dates';
import type { CheckoutProductsPage } from './cca/checkout-products';
import type { CheckoutPage } from './cca/checkout';
import type { ConfirmationPage } from './cca/confirmation';
import type { AuthPage } from './cca/auth';

/**
 * Contract for the customer-facing page objects the WebCustomer actor drives.
 * Every tenant's page bundle satisfies this shape. Tenant-specific extensions
 * (AntoineWebPages, VirginWebPages) will add extra pages beyond this base.
 */
export interface WebPages {
  landing:        LandingPage;
  event:          EventPage;
  eventDates:     EventDatesPage;
  checkoutProducts: CheckoutProductsPage;
  checkout:       CheckoutPage;
  confirmation:   ConfirmationPage;
  auth:           AuthPage;
}
