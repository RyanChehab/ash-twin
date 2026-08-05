import type { Locator } from '@playwright/test';
import { BasePage } from '../base';

/**
 * cca landing page — customer-facing event listing at "/".
 * Backed by `includes/templates/default/web/listing_shop.tpl`.
 */
export class LandingPage extends BasePage {
  readonly path = '/';
  readonly eventCards: Locator = this.page.locator('.cell > article');

  async open(): Promise<void> {
    await this.page.goto(this.path);
    await this.waitReady();
  }

  async eventCount(): Promise<number> {
    return await this.eventCards.count();
  }

  async clickEventByTitle(title: string): Promise<void> {
    const card = this.eventCards.filter({ hasText: title }).first();
    await card.click();
    await this.waitReady();
  }
}
