import type { Page } from '@playwright/test';
import type { TenantConfig } from '../types/tenant';
import type { Event } from '../types/event';
import type { Category } from '../types/category';
import type { Order } from '../types/order';
import type { WebPages } from '../pages/web/types';
import type { CheckoutUserInfo } from '../pages/web/default/checkout';
import type { TestCard } from '../payments';
import { webPages } from '../pages/web/factory';
import { Resolver } from '../helpers/resolver';
import { getPaymentStrategy } from '../payments';

export interface BuyTicketOpts {
  userInfo?: CheckoutUserInfo;
  payment?: {
    key:           string;
    card?:         TestCard;
    strategyOpts?: Record<string, unknown>;
  };
}

/**
 * WebCustomer — the business layer for the customer-facing purchase flow.
 * Only holds methods that either touch multiple pages, make a routing
 * decision, or add guards / service calls around the raw page gestures.
 * Atomic gestures live on the page objects; tests reach them through
 * `customer.pages.<page>.*`.
 */
export class WebCustomer {
  readonly pages: WebPages;

  constructor(
    readonly page:     Page,
    readonly tenant:   TenantConfig,
    readonly resolver: Resolver,
  ) {
    this.pages = webPages(page, tenant);
  }

  /**
   * Navigate to an event's buy page. Handles all three event shapes:
   *   - unique → direct navigation to /{type}/{id}, arrives on buy page
   *   - sub    → navigate via the main's URL, then pick THIS sub in the date picker
   *   - main   → navigate to /{type}/{id}, date picker shown; auto-pick next
   *              upcoming sub (fallback for tests that pass a main by mistake)
   */
  async openEvent(event: Event): Promise<void> {
    if (event.rep === 'sub' && event.mainId != null) {
      await this.pages.event.open({ id: event.mainId, type: event.type });
      await this.pages.eventDates.pickDate(event.id);
      return;
    }

    await this.pages.event.open(event);

    if (event.rep === 'main') {
      const sub = await this.resolver.nextSub(event.id);
      await this.pages.eventDates.pickDate(sub.id);
    }
  }

  /** Convenience for callers that only have the id — resolves then delegates. */
  async openEventById(id: number): Promise<void> {
    const event = await this.resolver.event(id);
    await this.openEvent(event);
  }

  /**
   * Pay for the current checkout using the strategy registered for `paymentKey`.
   * Two guards fire before any DOM interaction:
   *   1. paymentKey must be rendered on the checkout preview
   *   2. a strategy must be registered for it in payments/index.ts
   */
  async payWith(
    paymentKey: string,
    testCard?:  TestCard,
    opts?:      Record<string, unknown>,
  ): Promise<void> {
    const available = await this.pages.checkout.readAvailableHandlings();
    if (!available.some(h => h.paymentKey === paymentKey)) {
      const list = available.map(h => h.paymentKey).join(', ') || '(none)';
      throw new Error(
        `Payment '${paymentKey}' not rendered on this checkout. Available: [${list}]`,
      );
    }
    const strategy      = getPaymentStrategy(paymentKey);
    const handlingLabel = await this.pages.checkout.pickHandlingByPayment(paymentKey);
    const ctx           = { handlingLabel, testCard, opts };

    await strategy.prepare?.(this.page, ctx);
    await this.pages.checkout.submit();
    await strategy.complete(this.page, ctx);
  }

  /**
   * Full purchase flow: event → cart → (skip products interstitial if shown) →
   * checkout → optional payment → confirmation. Returns the resulting Order.
   *
   * Auto-skips the products interstitial when present — this composite is the
   * "happy-path buy". Tests that need to interact with addons/products should
   * drive the individual page objects through `customer.pages.*` instead.
   */
  async buyTicket(
    event:    Event,
    category: Category,
    quantity: number,
    opts?:    BuyTicketOpts,
  ): Promise<Order> {
    await this.openEvent(event);
    await this.pages.event.pickCategory(category.id);
    await this.pages.event.setQuantity(category.id, quantity);
    await this.pages.event.acceptTerms();
    await this.pages.event.addToCart(category.id);
    await this.pages.event.proceedToCheckout();

    if (await this.pages.checkoutProducts.isCurrent()) {
      await this.pages.checkoutProducts.continue();
    }

    if (opts?.userInfo) {
      await this.pages.checkout.fillUserInfo(opts.userInfo);
    }

    if (opts?.payment) {
      await this.payWith(opts.payment.key, opts.payment.card, opts.payment.strategyOpts);
    } else {
      await this.pages.checkout.submit();
    }

    return await this.pages.confirmation.readOrder();
  }
}
