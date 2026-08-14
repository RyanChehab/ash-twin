import type { Locator, Page } from '@playwright/test';

/** A sandbox test card as used by a card-based payment gateway. */
export interface TestCard {
  number: string;
  expiry: string;   // MM/YY
  cvc:    string;
  name?:  string;
}

/**
 * Context passed to strategy hooks. Scoped to the picked handling's <label>
 * so strategies don't accidentally interact with sibling handling widgets
 * that share DOM ids (iframes, gateway scripts).
 *
 * `opts` is a per-gateway grab bag — each strategy interprets its own keys
 * (e.g. cybersource_unified reads `cancelChallenge` to abort a 3DS challenge
 * instead of completing it). Kept generic here so the base contract doesn't
 * balloon with every gateway's quirks.
 */
export interface PaymentContext {
  handlingLabel: Locator;
  testCard?:     TestCard;
  opts?:         Record<string, unknown>;
}

/**
 * One strategy per `handling_payment` key in the SquareMaze DB. Registered
 * in payments/index.ts. Each gateway has its own DOM contract — the strategy
 * is where that contract lives.
 */
export interface PaymentStrategy {
  paymentKey: string;   // matches input[name="handling_id"][data-payment-type]

  /**
   * Runs after the handling radio is selected, before submit. Fill inline
   * widgets that live on the handling's label (card iframes, BNPL selectors).
   */
  prepare?(page: Page, ctx: PaymentContext): Promise<void>;

  /**
   * Runs after submit. Handle 3DS challenges, external gateway redirects,
   * iframe callbacks. Should leave the page on `checkout_result.tpl` — or
   * throw with a diagnostic message.
   */
  complete(page: Page, ctx: PaymentContext): Promise<void>;
}
