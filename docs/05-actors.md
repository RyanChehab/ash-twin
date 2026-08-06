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
customer.openLanding()
customer.openEvent(event)
customer.pickCategory(category)
customer.setQuantity(3)
customer.addToCart(category)
customer.proceedToCheckout()
customer.fillCheckout({ email, phone })
customer.submitCheckout()
customer.readTicket()
```

Composite methods exist as **explicit wrappers**:

```ts
async buyTicket(event, category, quantity, userInfo?) {
  await this.openEvent(event);
  await this.pickCategory(category);
  await this.setQuantity(quantity);
  await this.addToCart(category);
  await this.proceedToCheckout();
  if (userInfo) await this.fillCheckout(userInfo);
  await this.submitCheckout();
  return await this.readTicket();
}
```

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
