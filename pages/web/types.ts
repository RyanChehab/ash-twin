import type { LandingPage } from './cca/landing';
import type { EventPage } from './cca/event';
import type { CartPage } from './cca/cart';
import type { CheckoutPage } from './cca/checkout';
import type { ConfirmationPage } from './cca/confirmation';

/**
 * Contract for the customer-facing page objects the Customer actor drives.
 * Every tenant's page bundle satisfies this shape. Tenant-specific extensions
 * (AntoineWebPages, VirginWebPages, etc.) add extra pages beyond this base.
 *
 * Type references point at cca implementations because those are the canonical
 * shape — other tenant classes extend the same base concepts.
 */
export interface WebPages {
  landing:      LandingPage;
  event:        EventPage;
  cart:         CartPage;
  checkout:     CheckoutPage;
  confirmation: ConfirmationPage;
}
