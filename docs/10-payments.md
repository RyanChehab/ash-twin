# 10 — Payments

`payments/` — one strategy per SquareMaze payment gateway. Tests never touch handling IDs or gateway DOM directly; they say `payWith('cybersource_unified', card)` and the strategy handles everything else.

## The problem being solved

The SquareMaze checkout preview page renders one `<input name="handling_id">` radio per available handling (payment × shipment combo). Each radio carries `data-payment-type` — a string that names the payment plugin (`'free'`, `'cybersource_unified'`, `'checkoutframes'`, `'ngenius'`, …). That string matches the middle segment of the plugin filename: `eph_{data-payment-type}.php`. It's the stable key we use everywhere.

Beyond clicking the radio, every gateway is bespoke:
- Some render nothing on the label; the widget lives on the next page (Cybersource Unified, Frames).
- Some inject a widget directly on the label (Apple Pay, Google Pay, Tabby).
- Some redirect externally (NGenius classic, Peach).
- Post-submit flow can be direct-success, inline 3DS iframe, external redirect, or callback chain.

A single "click submit and wait" strategy can't cover any of these honestly. So we register a **strategy per gateway**.

## The registry

```
payments/
├── types re-exported from ../types/payment.ts
├── index.ts                     — registry + getPaymentStrategy(key)
├── cybersource_unified.ts       — one file per gateway
└── (future: ngenius.ts, checkoutframes.ts, ...)
```

`payments/index.ts` holds a `strategies` array. Adding a new gateway = new file + one entry in that array:

```ts
const strategies: PaymentStrategy[] = [
  cybersource_unified,
];
```

Runtime lookup:

```ts
export function getPaymentStrategy(key: string): PaymentStrategy {
  const s = registry[key];
  if (!s) {
    throw new Error(
      `No PaymentStrategy for '${key}'. Add payments/${key}.ts and register it in payments/index.ts.`,
    );
  }
  return s;
}
```

Loud failure on unknown key. When a tenant enables a new gateway we haven't scripted, the test throws with the exact fix instruction rather than silently misbehaving.

## The interface (`types/payment.ts`)

```ts
export interface TestCard {
  number: string;
  expiry: string;   // MM/YY
  cvc:    string;
  name?:  string;
}

export interface PaymentContext {
  handlingLabel: Locator;       // scoped to the picked radio's <label>
  testCard?:     TestCard;
  opts?:         Record<string, unknown>;  // per-gateway grab bag
}

export interface PaymentStrategy {
  paymentKey: string;                                     // matches data-payment-type

  prepare?(page: Page, ctx: PaymentContext): Promise<void>;   // pre-submit widget interaction
  complete(page: Page, ctx: PaymentContext): Promise<void>;   // post-submit orchestration
}
```

Two lifecycle hooks:

- **`prepare()`** — optional. Runs after the handling radio is picked, BEFORE the checkout form submits. Use for gateways whose widget lives inline on the label (Apple Pay button, BNPL selector). Cybersource Unified and Frames DON'T need this; their widget renders on the confirm page.
- **`complete()`** — required. Runs AFTER submit. Handle whatever the gateway throws at you: tokenization, 3DS challenges, external redirects, callbacks. Should exit on the confirmation page (`checkout_result.tpl`) or throw with a diagnostic.

`opts` is a gateway-specific dictionary. Each strategy interprets its own keys. `cybersource_unified` reads `opts.cancelChallenge` to abort a 3DS challenge instead of completing it — kept off the base interface so it doesn't balloon with every gateway's quirks.

## Test cards live WITH the strategy

Each gateway has its own sandbox card set (Checkout.com sandbox cards don't work on Cybersource). Colocate them:

```ts
// payments/cybersource_unified.ts
export const cybersource_unified: PaymentStrategy = { ... };

export const cards: Record<string, TestCard> = {
  visaSuccess:       { number: '4111111111111111', expiry: '12/30', cvc: '100' },
  visa3ds:           { number: '4000000000001091', expiry: '12/30', cvc: '100' },
  mastercardSuccess: { number: '5555555555554444', expiry: '12/30', cvc: '100' },
  amex:              { number: '378282246310005',  expiry: '12/30', cvc: '1000' },
};
```

Tests import them by gateway:

```ts
import { cards } from '../../payments/cybersource_unified';
await customer.payWith('cybersource_unified', cards.visaSuccess);
```

## How the actor uses it (`WebCustomer.payWith`)

```ts
async payWith(paymentKey: string, testCard?: TestCard, opts?: Record<string, unknown>): Promise<void> {
  const available = await this.pages.checkout.readAvailableHandlings();
  if (!available.some(h => h.paymentKey === paymentKey)) {
    const list = available.map(h => h.paymentKey).join(', ') || '(none)';
    throw new Error(`Payment '${paymentKey}' not rendered on this checkout. Available: [${list}]`);
  }
  const strategy = getPaymentStrategy(paymentKey);
  const handlingLabel = await this.pages.checkout.pickHandlingByPayment(paymentKey);
  const ctx = { handlingLabel, testCard, opts };

  await strategy.prepare?.(this.page, ctx);
  await this.pages.checkout.submit();
  await strategy.complete(this.page, ctx);
}
```

Two guards:
1. **Is the handling actually rendered on the checkout page?** If not, throw with the list of available keys — usually means the tenant hasn't enabled this gateway.
2. **Is a strategy registered for this key?** Throw with the exact fix message.

Then pick the radio, run `prepare` (if defined), submit the form, run `complete`.

## The DOM contract on the preview page

Set by `pages/web/cca/checkout.ts`. Two universal primitives:

```ts
// Read all handlings the server rendered on this page
async readAvailableHandlings(): Promise<RenderedHandling[]> {
  return await this.handlingRadios.evaluateAll(rows =>
    rows.map(r => ({
      id:         Number((r as HTMLInputElement).value),
      paymentKey: r.getAttribute('data-payment-type') ?? '',
      feeLabel:   r.getAttribute('data-fee-label')    ?? '',
    })),
  );
}

// Click the radio for a given payment type; return the wrapping <label>
async pickHandlingByPayment(paymentKey: string): Promise<Locator> {
  const label = this.page.locator(
    `label.radio-option:has(input[name="handling_id"][data-payment-type="${paymentKey}"])`,
  );
  await label.click();   // radios may be visually hidden; the label handles the toggle
  return label;
}
```

Strategies never touch these directly — the actor does — but they receive the returned `<label>` locator as `ctx.handlingLabel` for scoping inline-widget queries.

## Worked example — `cybersource_unified`

Cybersource Unified Checkout renders across **multiple cross-origin iframes** on `checkout_confirm.tpl`. The plugin's PHP only outputs empty container divs; the SDK (loaded from a per-session URL) populates them. The iframes SWAP as the SDK transitions between states (buttonlist → mce → 3DS challenge), so caching a locator to a specific iframe breaks after any state change.

**Frame-walk pattern.** Instead of pinning iframes, we re-scan `page.frames()` after every interaction, filter by URL substring (`cybersource.com` for the SDK, `cardinal|centinel|3ds` for the 3DS challenge), and pick the frame that currently contains the element we need:

```ts
const cardEntryFrame = await waitForFrameWith(page, 30_000, (frame) =>
  hasVisible(frame, 'textbox', /card number|pan/i),
);
```

Each helper wraps frame probes in try/catch — frames attach/detach during SDK boot, and a detached frame during iteration mustn't kill the whole search.

**Role/label selectors, not CSS classes.** Inside the SDK's iframes, Cybersource owns the DOM. Class names shift between SDK versions. Role-based selectors (`getByRole('textbox', { name: /card number/i })`, `getByRole('button', { name: /continue/i })`) survive across releases because Cybersource maintains the accessibility contract.

**No `#pay-button` from us.** In Frames, the plugin renders its own submit button and calls `Frames.submitCard()`. In Unified Checkout, the SDK owns the submit button — we click it INSIDE the iframe, and it calls `paymentForm.submit()` on our top-level form itself.

**3DS handling — polled, not awaited.** Cybersource's 3DS challenge appears in a nested iframe on `authentication-devices.sandbox.checkout.com/…`. We can't `waitForURL` because the outer page URL doesn't change. Instead we poll every 500ms up to 60s:
- If `h1.success/pending/fail` appears on the parent page → done.
- Else, look for a Cardinal/Centinel frame containing a text field and a Continue/Submit/Verify button. If found, fill the OTP and click.

`opts.cancelChallenge` swaps the fill-and-continue path for a click-Cancel path — used to test the "user aborted 3DS → payment fails" scenario.

## Adding a new gateway

1. **Understand the DOM.** Read `includes/plugins/eph_{name}.php` on the SquareMaze side. Trace `on_confirm()` to see the HTML/JS emitted. Note whether the widget renders on the preview label (needs `prepare`) or the confirm page (only `complete`).
2. **Get sandbox test cards.** From the gateway's docs, not from us. They're stable and public.
3. **Create `payments/{name}.ts`.** Export `{name}: PaymentStrategy` and a `cards: Record<string, TestCard>` map.
4. **Register in `payments/index.ts`** — add to the `strategies` array.
5. **Write one spec** that uses `payWith('{name}', cards.someCard)`. Run against a tenant that has this handling enabled. Iterate on selectors until it works — expect surprises (the first Cybersource run had 6 iterations before the DOM contract stabilized).

## Rules

1. **No numeric handling IDs anywhere in tests or strategies.** Use the `data-payment-type` string. Numeric IDs are DB primary keys — they change per tenant and re-seed.
2. **Strategies own their gateway's DOM.** The checkout page object handles universal parts (form, radios, submit, terms); strategies handle widget-specific parts (card iframes, 3DS challenges, wallet buttons).
3. **Test cards live with the strategy that consumes them.** Central utilities-style card catalog is an anti-pattern — different gateways accept different cards.
4. **Loud failure on unknown keys.** `getPaymentStrategy` throws with a fix message. `payWith` throws with a list of available keys. Silent no-ops in this layer are much worse than crashes.
5. **Selectors inside gateway iframes: role + accessible name.** Class names change across SDK versions; ARIA doesn't. `getByRole('textbox', { name: /card number/i })` outlives class-based selectors.
