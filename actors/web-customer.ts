import type { Page } from '@playwright/test';
import type { TenantConfig } from '../types/tenant';
import type { Event } from '../types/event';
import type { Category } from '../types/category';
import type { Ticket } from '../types/ticket';
import type { WebPages } from '../pages/web/types';
import type { CheckoutUserInfo } from '../pages/web/cca/checkout';
import { webPages } from '../pages/web/factory';

/**
 * WebCustomer actor — orchestrates the customer-facing purchase flow via the
 * WebPages bundle. Page-specific selectors live in the page objects; this
 * class only composes them into business operations.
 *
 * Note: seated purchases (SeatRef-based) will be added when a test requires
 * driving the seatmap picker.
 */
export class WebCustomer {
  private pages: WebPages;

  constructor(private page: Page, private tenant: TenantConfig) {
    this.pages = webPages(page, tenant);
  }

  currentUrl(): string {
    return this.page.url();
  }

  // ── Navigation ─────────────────────────────────────────────────────────

  async openLanding(): Promise<void> {
    await this.pages.landing.open();
  }

  async openEvent(event: Event): Promise<void> {
    await this.pages.event.open(event.id);
  }

  // ── Composable purchase steps ──────────────────────────────────────────

  async pickCategory(category: Category): Promise<void> {
    await this.pages.event.pickCategory(category.id);
  }

  async setQuantity(n: number): Promise<void> {
    await this.pages.event.setQuantity(n);
  }

  async addToCart(category: Category): Promise<void> {
    await this.pages.event.addToCart(category.id);
  }

  async proceedToCheckout(): Promise<void> {
    await this.pages.event.proceedToCheckout();
  }

  async fillCheckout(info: CheckoutUserInfo): Promise<void> {
    await this.pages.checkout.fillUserInfo(info);
  }

  async submitCheckout(): Promise<void> {
    await this.pages.checkout.submit();
  }

  // ── Read confirmation result ───────────────────────────────────────────

  async readTicket(): Promise<Ticket> {
    return {
      orderRef: (await this.pages.confirmation.orderRef()) ?? '',
      status:   await this.pages.confirmation.status(),
    };
  }

  // ── High-level wrapper: cart → checkout → confirm ──────────────────────

  async buyTicket(event: Event, category: Category, quantity: number, userInfo?: CheckoutUserInfo): Promise<Ticket> {
    await this.openEvent(event);
    await this.pickCategory(category);
    await this.setQuantity(quantity);
    await this.addToCart(category);
    await this.proceedToCheckout();
    if (userInfo) await this.fillCheckout(userInfo);
    await this.submitCheckout();
    return await this.readTicket();
  }
}
