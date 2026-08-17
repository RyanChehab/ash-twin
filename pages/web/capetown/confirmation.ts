import type { Locator } from '@playwright/test';
import { BasePage } from '../base';

export type ConfirmationStatus = 'paid' | 'pending' | 'failed' | 'unknown';

export class CapetownConfirmationPage extends BasePage {
  readonly successHeading:    Locator = this.page.locator('h1.success');
  readonly pendingHeading:    Locator = this.page.locator('h1.pending');
  readonly failHeading:       Locator = this.page.locator('h1.fail');
  readonly orderRefValue:     Locator = this.page.locator('.info-list .row').first().locator('dd');
  readonly printTicketsLink:  Locator = this.page.locator('a.btn.btn_primary[href*="action=print"]');

  async status(): Promise<ConfirmationStatus> {
    if ((await this.successHeading.count()) > 0) return 'paid';
    if ((await this.pendingHeading.count()) > 0) return 'pending';
    if ((await this.failHeading.count()) > 0)    return 'failed';
    return 'unknown';
  }

  async orderRef(): Promise<string | null> {
    if ((await this.orderRefValue.count()) === 0) return null;
    return (await this.orderRefValue.textContent())?.trim() ?? null;
  }

  async isSuccess(): Promise<boolean> {
    return (await this.successHeading.count()) > 0;
  }
}
