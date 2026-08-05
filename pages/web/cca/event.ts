import type { Locator } from '@playwright/test';
import { BasePage } from '../base';

export class EventPage extends BasePage {
  readonly categoryList:     Locator = this.page.locator('#list.rd');
  readonly categoryRadios:   Locator = this.page.locator('input[name="category_id"]');
  readonly quantityInput:    Locator = this.page.locator('.quantity-picker input[type="tel"]');
  readonly quantityInc:      Locator = this.page.locator('.quantity-picker .inc');
  readonly quantityDec:      Locator = this.page.locator('.quantity-picker .dec');
  readonly addToCartButtons: Locator = this.page.locator('.mini_add_to_cart');
  readonly seatMapTrigger:   Locator = this.page.locator('.js-openSeatMap');
  readonly checkoutButton:   Locator = this.page.locator('#checkoutBtn');

  buildPath(id: number): string {
    return `/event/${id}`;
  }

  async open(eventId: number): Promise<void> {
    await this.page.goto(this.buildPath(eventId));
    await this.waitReady();
  }

  async pickCategory(categoryId: number): Promise<void> {
    await this.page
      .locator(`input[name="category_id"][value="${categoryId}"]`)
      .check();
  }

  async setQuantity(n: number): Promise<void> {
    await this.quantityInput.fill(String(n));
  }

  async incrementQuantity(): Promise<void> {
    await this.quantityInc.click();
  }

  async decrementQuantity(): Promise<void> {
    await this.quantityDec.click();
  }

  async addToCart(categoryId: number): Promise<void> {
    await this.page.locator(`#li_${categoryId} .mini_add_to_cart`).click();
    await this.waitReady();
  }

  async proceedToCheckout(): Promise<void> {
    await this.checkoutButton.click();
    await this.waitReady();
  }

  async hasSeatMap(): Promise<boolean> {
    return (await this.seatMapTrigger.count()) > 0;
  }
}
