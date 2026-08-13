import type { Page } from '@playwright/test';
import type { TenantConfig } from '../types/tenant';
import type { Event } from '../types/event';
import type { Category } from '../types/category';
import type { Ticket } from '../types/ticket';
import type { WebPages } from '../pages/web/types';
import type { CheckoutUserInfo } from '../pages/web/cca/checkout';
import type { RegisterData, LoginCreds } from '../types/user';
import { webPages } from '../pages/web/factory';
import { Resolver } from '../helpers/resolver';

/**
 * WebCustomer actor — orchestrates the customer-facing purchase flow via the
 * WebPages bundle. Page-specific selectors live in the page objects; this
 * class only composes them into business operations.
 *
 * Handles multi-day events: when openEvent lands on a main event, the actor
 * auto-picks the next upcoming sub via the Resolver, submits the date form,
 * and continues on the sub's buy page.
 */
export class WebCustomer {
  private pages: WebPages;

  constructor(
    private page:     Page,
    private tenant:   TenantConfig,
    private resolver: Resolver,
  ) {
    this.pages = webPages(page, tenant);
  }

  currentUrl(): string {
    return this.page.url();
  }

  // ── Navigation ─────────────────────────────────────────────────────────

  async openLanding(): Promise<void> {
    await this.pages.landing.open();
  }

  async openAuth(): Promise<void> {
    await this.pages.auth.open();
  }

  // ── Register: individual gestures + composite ──────────────────────────

  async fillRegister(data: RegisterData): Promise<void> {
    await this.pages.auth.fillRegister(data);
  }

  async submitRegister(): Promise<void> {
    await this.pages.auth.submitRegister();
  }

  async enableTestCaptchaBypass(): Promise<void> {
    await this.pages.auth.enableTestCaptchaBypass();
  }

  async submitRegisterProgrammatically(): Promise<void> {
    await this.pages.auth.submitRegisterProgrammatically();
  }

  async hasRegisterFieldError(field: string): Promise<boolean> {
    return this.pages.auth.hasFieldError(field);
  }

  async landedOnActivation(): Promise<boolean> {
    return this.pages.auth.isOnActivationPage();
  }

  // ── Login ───────────────────────────────────────────────────────────────

  async login(creds: LoginCreds): Promise<void> {
    await this.pages.auth.fillLogin(creds);
    await this.pages.auth.submitLogin();
  }

  async fillLogin(creds: LoginCreds): Promise<void> {
    await this.pages.auth.fillLogin(creds);
  }

  async submitLogin(): Promise<void> {
    await this.pages.auth.submitLogin();
  }

  async hasLoginFieldError(field: string): Promise<boolean> {
    return this.pages.auth.hasLoginFieldError(field);
  }

  async activate(activationPath: string): Promise<void> {
    await this.pages.auth.activate(activationPath);
  }

  async isSignedIn(): Promise<boolean> {
    return this.pages.auth.isSignedIn();
  }

  /**
   * Navigate to an event's buy page. Handles all three shapes:
   *   - unique → direct navigation to /event/{id}, arrives on buy page
   *   - sub    → navigate via mainId to reach the date picker, then pick THIS sub
   *   - main   → navigate to /event/{id}, date picker shown; auto-pick next
   *              upcoming sub (fallback — most tests will pass a sub instead)
   */
  async openEvent(event: Event): Promise<void> {
    if (event.rep === 'sub' && event.mainId != null) {
      // Navigate via the main's URL (subs and mains share event_type)
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

  /** Explicit date pick — for tests that want to select a specific sub. */
  async pickDate(sub: Event): Promise<void> {
    await this.pages.eventDates.pickDate(sub.id);
  }

  /** Compat: for old test code that passed just an id. */
  async openEventById(id: number): Promise<void> {
    const event = await this.resolver.event(id);
    await this.openEvent(event);
  }

  // ── Composable purchase steps ──────────────────────────────────────────

  async pickCategory(category: Category): Promise<void> {
    await this.pages.event.pickCategory(category.id);
  }

  async setQuantity(category: Category, n: number): Promise<void> {
    await this.pages.event.setQuantity(category.id, n);
  }

  async addToCart(category: Category): Promise<void> {
    await this.pages.event.addToCart(category.id);
  }

  async acceptTerms(): Promise<void> {
    await this.pages.event.acceptTerms();
  }

  async isCheckoutReady(): Promise<boolean> {
    return this.pages.event.checkoutButton.isVisible();
  }

  async proceedToCheckout(): Promise<void> {
    await this.pages.event.proceedToCheckout();
  }

  async proceedFromProducts(): Promise<void> {
    await this.pages.checkoutProducts.continue();
  }

  async isOnCheckoutProducts(): Promise<boolean> {
    return await this.pages.checkoutProducts.isCurrent();
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
    await this.setQuantity(category, quantity);
    await this.acceptTerms();
    await this.addToCart(category);
    await this.proceedToCheckout();
    if (userInfo) await this.fillCheckout(userInfo);
    await this.submitCheckout();
    return await this.readTicket();
  }
}
