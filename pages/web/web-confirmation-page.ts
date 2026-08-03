import type { Page, Locator } from '@playwright/test';

export class WebConfirmationPage {
  readonly thankYouMessage: Locator;
  readonly orderRefLabel: Locator;

  constructor(private page: Page) {
    this.thankYouMessage = page.locator('.confirmation, .thank-you, h1, h2')
      .filter({ hasText: /thank you|confirmed|success/i }).first();
    this.orderRefLabel = page.locator('[data-order-ref], .order-ref, .order-number').first();
  }

  async isVisible(): Promise<boolean> {
    return (await this.thankYouMessage.count()) > 0;
  }

  async orderRef(): Promise<string | null> {
    if (await this.orderRefLabel.count() === 0) return null;
    return (await this.orderRefLabel.textContent())?.trim() ?? null;
  }
}
