import type { Locator } from '@playwright/test';
import { BasePage } from '../base';

export class DefaultCheckoutProductsPage extends BasePage {

  readonly checkoutButton: Locator = this.page.locator('#btns #checkoutBtn');

  async isCurrent(): Promise<boolean> {
    return await this.page.locator('body.checkout-products').first().isVisible();
  }

  async continue(): Promise<void> {
    await this.checkoutButton.click();
    await this.waitReady();
  }

  /**
   * Single-category addon add-to-cart: click the picker's `.inc` button `qty`
   * times, then click the `.subCatBtn` add anchor and wait for the
   * `json.php?x=add` AJAX to resolve. Idempotent for qty=0 (no-op).
   */
  async pickAddon(addonId: number, categoryId: number, qty: number): Promise<void> {
    if (qty <= 0) return;

    const picker = this.page.locator(
      `.quantity-picker.addon[data-addon-id="${addonId}"][id="${categoryId}"]`,
    );
    await picker.waitFor({ state: 'visible' });

    const inc = picker.locator('.inc.addon-button');
    for (let i = 0; i < qty; i++) {
      await inc.click();
    }

    const item = this.page.locator(
      `.product-category-item:has(.quantity-picker.addon[data-addon-id="${addonId}"])`,
    );
    const addBtn = item.locator('.subCatBtn a.addon_mini_add_to_cart').first();

    // Add button carries the `disabled` attribute until qty > 0; poll for enable.
    for (let i = 0; i < 20 && !(await addBtn.isEnabled()); i++) {
      await this.page.waitForTimeout(100);
    }

    await Promise.all([
      this.page.waitForResponse(r => r.url().includes('json.php') && r.request().method() === 'POST'),
      addBtn.click(),
    ]);
  }

  /**
   * Headline price text for an addon (as rendered — includes currency symbol
   * and formatting). Reads `.product-category-item-price` inside the item
   * wrapper that contains a picker with `data-addon-id="{addonId}"`.
   */
  async readAddonPrice(addonId: number): Promise<string> {
    const item = this.page.locator(
      `.product-category-item:has(.quantity-picker.addon[data-addon-id="${addonId}"])`,
    );
    return (await item.locator('.product-category-item-price').first().textContent())?.trim() ?? '';
  }

  async isAddonSoldOutByName(addonName: string): Promise<boolean> {
    const item = this.page.locator('.product-category-item').filter({
      has: this.page.locator('.product-category-item-title-text', { hasText: addonName }),
    }).first();
    if ((await item.count()) === 0) return false;
    return await item.evaluate((el) => el.classList.contains('isSoldout'));
  }
}
