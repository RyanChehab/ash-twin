import type { Page, Locator } from '@playwright/test';

export class WebEventDetailPage {
  readonly buyButton: Locator;
  readonly quantityInput: Locator;

  constructor(private page: Page) {
    this.buyButton     = page.getByRole('button', { name: /buy|book|reserve/i })
      .or(page.getByRole('link', { name: /buy|book|reserve/i })).first();
    this.quantityInput = page.locator('input[name="quantity"], input[name="qty"]').first();
  }

  async open(eventId: number | string) {
    await this.page.goto(`/event/${eventId}`);
  }

  async setQuantity(n: number) {
    if ((await this.quantityInput.count()) > 0) {
      await this.quantityInput.fill(String(n));
    }
  }

  async clickBuy() {
    await this.buyButton.click();
    await this.page.waitForLoadState('networkidle');
  }
}
