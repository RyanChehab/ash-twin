# 05 — Actors

`actors/` — the business-orchestration layer. Actors compose page objects into meaningful user flows.

## The pattern

Each actor represents a user role (a customer, an admin, etc.) with a browser context. It exposes verbs the test author would speak (`buyTicket`, `login`, `createEvent`) and delegates to page objects internally.

```
Test: customer.buyTicket(event, category, 1)
   ↓
Actor: composes page-object calls
   → this.pages.event.open(event.id)
   → this.pages.event.pickCategory(category.id)
   → this.pages.event.setQuantity(1)
   → this.pages.event.addToCart(category.id)
   → this.pages.event.proceedToCheckout()
   → this.pages.checkout.submit()
   → this.pages.confirmation.status()
   ↓
Page objects: click / fill / read
```

## Current actors

| Actor | Where | Represents |
|---|---|---|
| `WebCustomer` | `actors/web-customer.ts` | A customer browsing the storefront |
| `Admin` | `actors/admin.ts` | An admin on the /admin panel |

## Actor construction

Takes a `Page` (from the auth fixture) + `TenantConfig`. Internally calls `webPages(page, tenant)` to get its page bundle.

```ts
export class WebCustomer {
  private pages: WebPages;

  constructor(private page: Page, private tenant: TenantConfig) {
    this.pages = webPages(page, tenant);
  }
  // ...
}
```

Tenant-appropriate page objects are chosen by the factory. Actor code never branches on tenant.

## Method granularity — atomic verbs

Small, composable methods. Each does ONE thing:

```ts
// Auth
customer.openAuth()
customer.login(creds)
customer.isSignedIn()
customer.isOnAuthPage()            // true when the sign-in or register form is visible

// Event → cart
customer.openLanding()
customer.openEvent(event)          // sub → main URL + pickDate; unique → direct; main → next-sub fallback
customer.pickCategory(category)
customer.setQuantity(category, 3)  // category-scoped: clicks that category's + button 3 times
customer.acceptTerms()             // no-op if the event has no terms / age gate
customer.addToCart(category)
customer.isCheckoutReady()         // read: checkout button visible (proxy for successful add)

// Cart → checkout
customer.proceedToCheckout()       // click event page's #checkoutBtn; nothing more
customer.isOnCheckoutProducts()    // true when we landed on the addons/products interstitial
customer.proceedFromProducts()     // advance past the interstitial (deliberately explicit)

// Checkout → payment
customer.fillCheckout({ email, phone })
customer.payWith(paymentKey, testCard?, opts?)   // strategy-driven, see 10-payments.md
customer.submitCheckout()          // low-level: just click submit; payWith orchestrates around it

// Result
customer.readTicket()              // reads confirmation page → { orderRef, status }
```

**Why proceedToCheckout doesn't auto-skip the products page:** the interstitial shows addons + shop products. Future tests will interact with them (add an addon to cart, tick an insurance option) BEFORE continuing. Baking a skip into `proceedToCheckout` would require ripping it back out. Explicit two-step keeps the intent visible in every spec.

Composite methods exist as **explicit wrappers**:

```ts
async buyTicket(event, category, quantity, userInfo?) {
  await this.openEvent(event);
  await this.pickCategory(category);
  await this.setQuantity(category, quantity);
  await this.acceptTerms();
  await this.addToCart(category);
  await this.proceedToCheckout();
  if (userInfo) await this.fillCheckout(userInfo);
  await this.submitCheckout();
  return await this.readTicket();
}
```

`buyTicket` currently assumes no products interstitial (fine for `events.normal` which has `hasNoAddons: webCheckoutAddon`). When we test flows that DO show the interstitial, spell out the steps in the spec rather than growing `buyTicket` with conditionals.

## Payment via `payWith`

`payWith` is where the strategy pattern from [10-payments.md](./10-payments.md) surfaces on the actor:

```ts
async payWith(paymentKey: string, testCard?: TestCard, opts?: Record<string, unknown>): Promise<void>
```

Two guards fire before any DOM interaction:
1. `paymentKey` is actually rendered on the checkout preview (else throws with the list of `data-payment-type` values that ARE rendered).
2. A strategy is registered for `paymentKey` in `payments/index.ts` (else throws with the exact fix — "Add `payments/{key}.ts`").

Both failure modes are loud and actionable; neither can silently do the wrong thing.

Test usage:

```ts
import { cards } from '../../payments/cybersource_unified';

await customer.payWith('cybersource_unified', cards.visaSuccess);
await customer.payWith('cybersource_unified', cards.visa3ds);
await customer.payWith('cybersource_unified', cards.visa3ds, { cancelChallenge: true });
```

The `opts` object is a per-gateway grab bag — each strategy interprets its own keys. Cybersource reads `cancelChallenge`; a future NGenius strategy might read something else entirely.

## Rules

1. **No selectors in actor code** — always delegate to page objects
2. **No SQL in actor code** — use Resolver or DbClient
3. **One action per method** — composites are named as wrappers
4. **Positional args for ≤3-4 params**; interface for many optional fields
5. **Never branch on tenant** — the factory handles that

## Adding a new actor method

- If it's atomic (one page-object call) → add a delegating method
- If it composes multiple pages → add a wrapper that calls the atomic methods

When two tests use the same sequence, extract it into an actor wrapper. Otherwise leave it inline in the spec.
