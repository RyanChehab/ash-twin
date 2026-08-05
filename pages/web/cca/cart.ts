import type { Locator } from '@playwright/test';
import { BasePage } from '../base';

/** Shopping cart view at "/cart" */
export class CartPage extends BasePage {
  readonly path = '/cart';
  readonly orderForm:      Locator = this.page.locator('form#order-handling');
  readonly checkoutButton: Locator = this.page.locator('#checkoutBtn');

  async open(): Promise<void> {
    await this.page.goto(this.path);
    await this.waitReady();
  }

  async proceedToCheckout(): Promise<void> {
    await this.checkoutButton.click();
    await this.waitReady();
  }
}
