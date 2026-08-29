import type { Locator, Page } from '@playwright/test';

/** A sandbox test card as used by a card-based payment gateway. */
export interface TestCard {
  number: string;
  expiry: string;   // MM/YY
  cvc:    string;
  name?:  string;
}


export interface PaymentContext {
  handlingLabel: Locator;
  testCard?:     TestCard;
  opts?:         Record<string, unknown>;
}


export interface PaymentStrategy {
  paymentKey: string;   // matches input[name="handling_id"][data-payment-type]

// Runs after the handling radio is selected
  prepare?(page: Page, ctx: PaymentContext): Promise<void>;

// Runs after submit
  complete(page: Page, ctx: PaymentContext): Promise<void>;
}
