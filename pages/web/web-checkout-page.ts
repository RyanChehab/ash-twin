import type { Page, Locator } from '@playwright/test';

export class WebCheckoutPage {
  readonly emailInput: Locator;
  readonly nameInput: Locator;
  readonly payButton: Locator;
  readonly errorMessage: Locator;

  constructor(private page: Page) {
    this.emailInput   = page.locator('input[name="email"], input[type="email"]').first();
    this.nameInput    = page.locator('input[name="name"], input[name="fullname"], input[name="full_name"]').first();
    this.payButton    = page.getByRole('button', { name: /pay|checkout|confirm/i }).first();
    this.errorMessage = page.locator('.error, .alert-danger, .checkout-error').first();
  }

  async fillEmail(v: string) {
    if ((await this.emailInput.count()) > 0) await this.emailInput.fill(v);
  }

  async fillName(v: string) {
    if ((await this.nameInput.count()) > 0) await this.nameInput.fill(v);
  }

  async submit() {
    await this.payButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  async errorText(): Promise<string | null> {
    if (await this.errorMessage.count() === 0) return null;
    return (await this.errorMessage.textContent())?.trim() ?? null;
  }
}
