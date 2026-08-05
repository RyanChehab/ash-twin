import type { Locator } from '@playwright/test';
import { BasePage } from '../base';

export interface CheckoutUserInfo {
  firstName?: string;
  lastName?:  string;
  email?:     string;
  phone?:     string;
  country?:   string;
  city?:      string;
  address?:   string;
}

export class CheckoutPage extends BasePage {
  readonly path = '/checkout';
  readonly form:                Locator = this.page.locator('form#order-handling');
  readonly firstNameInput:      Locator = this.page.locator('input[name="user_firstname"]');
  readonly lastNameInput:       Locator = this.page.locator('input[name="user_lastname"]');
  readonly emailInput:          Locator = this.page.locator('input[name="user_email"]');
  readonly phoneInput:          Locator = this.page.locator('input[name="user_phone"]');
  readonly countryInput:        Locator = this.page.locator('input[name="user_country"]');
  readonly cityInput:           Locator = this.page.locator('input[name="user_city"]');
  readonly addressInput:        Locator = this.page.locator('input[name="user_address"]');
  readonly paymentMethodRadios: Locator = this.page.locator('input[name="handling_id"]');
  readonly submitButton:        Locator = this.page.locator('form#order-handling button[type="submit"], form#order-handling input[type="submit"]');

  async open(): Promise<void> {
    await this.page.goto(this.path);
    await this.waitReady();
  }

  async fillUserInfo(info: CheckoutUserInfo): Promise<void> {
    if (info.firstName !== undefined) await this.firstNameInput.fill(info.firstName);
    if (info.lastName  !== undefined) await this.lastNameInput.fill(info.lastName);
    if (info.email     !== undefined) await this.emailInput.fill(info.email);
    if (info.phone     !== undefined) await this.phoneInput.fill(info.phone);
    if (info.country   !== undefined) await this.countryInput.fill(info.country);
    if (info.city      !== undefined) await this.cityInput.fill(info.city);
    if (info.address   !== undefined) await this.addressInput.fill(info.address);
  }

  async pickPaymentMethod(handlingId: number): Promise<void> {
    await this.page
      .locator(`input[name="handling_id"][value="${handlingId}"]`)
      .check();
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
    await this.waitReady();
  }
}
