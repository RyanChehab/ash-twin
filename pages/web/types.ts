import type { LandingPage } from './landing';
import type { EventPage } from './event';
import type { CartPage } from './cart';
import type { CheckoutPage } from './checkout';
import type { ConfirmationPage } from './confirmation';

/**
 * The set of customer-facing page objects every tenant must provide.
 * Tests never construct these directly — the factory hands the bundle to
 * the Customer actor at construction time.
 *
 * Tenant-specific extensions (AntoineWebPages, VirginWebPages) will be added
 * here when we onboard those Next.js frontends, each declaring extra pages
 * beyond the shared base surface.
 */
export interface WebPages {
  landing:      LandingPage;
  event:        EventPage;
  cart:         CartPage;
  checkout:     CheckoutPage;
  confirmation: ConfirmationPage;
}
