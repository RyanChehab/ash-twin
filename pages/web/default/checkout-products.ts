import type { Locator } from '@playwright/test';
import { BasePage } from '../base';

/**
 * Addons / shop-products interstitial rendered by SquareMaze when the cart
 * is eligible for addons or on-checkout products.
 */

export class CheckoutProductsPage extends BasePage {

  readonly checkoutButton: Locator = this.page.locator('#btns #checkoutBtn');

  async isCurrent(): Promise<boolean> {
    return await this.checkoutButton.isVisible();
  }

  async continue(): Promise<void> {
    await this.checkoutButton.click();
    await this.waitReady();
  }
}
