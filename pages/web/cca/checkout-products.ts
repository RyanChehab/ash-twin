import type { Locator } from '@playwright/test';
import { BasePage } from '../base';

/**
 * Addons / shop-products interstitial rendered by SquareMaze when the cart
 * is eligible for addons or on-checkout products.
 */

export class CheckoutProductsPage extends BasePage {
  readonly checkoutButton: Locator = this.page.locator('#checkoutBtn');

  isCurrent(): boolean {
    return this.page.url().includes('checkout_products_list');
  }

  async continue(): Promise<void> {
    await this.checkoutButton.click();
    await this.waitReady();
  }
}
