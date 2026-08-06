# 04 — Page objects

`pages/web/` — the UI-mechanics layer. Each page object owns the selectors + atomic actions for one page.

## Structure

```
pages/web/
├── base.ts              — abstract BasePage (chassis)
├── types.ts             — WebPages interface (the bundle contract)
├── factory.ts           — webPages(page, tenant) picks the right set
├── cca/                 — default-theme pages (used by cca)
│   ├── landing.ts
│   ├── event.ts
│   ├── checkout.ts
│   └── confirmation.ts
└── tenants/             — future per-tenant/theme overrides
    ├── capetown/        — adrea, blublood
    ├── antoine/         — Next.js
    └── virgin/          — Next.js
```

## The chassis — `BasePage`

Every concrete page extends it. Provides:

- `protected page: Page` — the raw Playwright browser tab
- `protected waitReady()` — wait for DOM ready
- `protected waitForNetworkIdle()` — stronger wait, used by SPAs
- `protected assertUrl(pattern)` — verify current URL

No selectors, no URL. Each concrete page adds those.

## Concrete page anatomy

```ts
export class EventPage extends BasePage {
  // 1. URL — property for static, buildPath(...) method for parameterized
  buildPath(id: number): string { return `/event/${id}`; }

  // 2. Selectors — Locator properties
  readonly categoryRadios = this.page.locator('input[name="category_id"]');
  readonly checkoutButton = this.page.locator('#checkoutBtn');

  // 3. Navigation
  async open(id: number) {
    await this.page.goto(this.buildPath(id));
    await this.waitReady();
  }

  // 4. Atomic actions — one gesture each
  async pickCategory(id: number) {
    await this.page.locator(`input[name="category_id"][value="${id}"]`).check();
  }

  async addToCart(categoryId: number) {
    await this.page.locator(`#li_${categoryId} .mini_add_to_cart`).click();
    await this.waitReady();
  }
}
```

## The factory — picks the right set per tenant

```ts
export function webPages(page: Page, tenant: TenantConfig): WebPages {
  // if (tenant.name === 'antoine') return antoineWebPages(page);
  // if (tenant.name === 'adrea' || tenant.name === 'blublood') return capetownWebPages(page);
  return {
    landing:      new LandingPage(page),
    event:        new EventPage(page),
    checkout:     new CheckoutPage(page),
    confirmation: new ConfirmationPage(page),
  };
}
```

Actor calls the factory once in its constructor. Actor code stays tenant-agnostic; the factory hides differences.

## Per-tenant overrides

When a tenant's DOM differs (adrea uses capetown theme, antoine uses Next.js), create an override file that extends the default class and overrides ONLY the differing selectors/URLs:

```ts
// pages/web/tenants/antoine/event.ts
export class AntoineEventPage extends EventPage {
  override buildPath(id: number): string { return `/events/${id}`; }   // Next.js path
  override readonly addToCartButtons = this.page.locator('[data-testid="add-to-cart"]');
}
```

Everything else inherits. Add branch to factory.

## Selector conventions

- **Prefer stable selectors**: IDs, `name=` attributes, `getByRole`
- **Avoid**: nth-child, sibling traversal, DOM hierarchy assumptions
- **One source of truth**: every selector lives in exactly one page-object file
- **No business logic** in page objects — that's the actor's job
