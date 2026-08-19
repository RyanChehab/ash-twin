import type { PaymentStrategy } from '../types/payment';

/**
 * Sandbox identity accepted by Tabby's hosted checkout. `otp.success@tabby.ai`
 * plus phone `500000001` (national digits — Tabby prefixes +971 itself) plus
 * OTP `8888` completes the auth without a real SMS.
 */
export interface TabbyIdentity {
  nationalPhone: string;
  email:         string;
  otp:           string;
}

/**
 * Tabby BNPL (`eph_tabby.php`).
 *
 * Flow: squaremaze's on_confirm() creates a Tabby session and renders a
 * "Proceed to payment" anchor. Clicking it drives a same-tab redirect to
 * `checkout.tabby.ai/auth` — a Next.js SPA that walks the customer through
 * phone → email → OTP → payment-plans, then bounces back to
 * `checkout_accept.php?…&payment=success`. on_return() finalises the order
 * and renders checkout_result.tpl with a status heading — same as the card
 * gateways.
 *
 * Sandbox: the identity in `opts.identity` (see `identities` below) short-
 * circuits the SMS + email verification when `pm_tabby_sandbox=1`.
 */
export const tabby: PaymentStrategy = {
  paymentKey: 'tabby',

  async complete(page, ctx) {
    const identity = ctx.opts?.identity as TabbyIdentity | undefined;
    if (!identity) throw new Error(`tabby.complete requires opts.identity`);

    await Promise.all([
      page.waitForURL(/checkout\.tabby\.ai/, { timeout: 30_000 }),
      page.getByRole('link', { name: /proceed to payment/i }).first().click(),
    ]);

    // Phone screen: `+971` is prefilled and disabled; national digits go into
    // `input[name="phone"]`. Continue is the primary button.
    await page.locator('input[name="phone"]').fill(identity.nationalPhone);
    await page.locator('button[data-testid="phoneForm.continue"]').click();

    // Email screen: Tabby prefills the field from squaremaze's session payload,
    // but sandbox only accepts otp.success@tabby.ai. Triple-click selects the
    // existing value so `.fill` overwrites instead of appending.
    const emailInput = page.locator('input[name="email"]');
    await emailInput.click({ clickCount: 3 });
    await emailInput.fill(identity.email);
    await page.locator('button[data-testid="loginForm.continue"]').click();

    // OTP screen: single 4-digit input; Tabby's SPA submits automatically on
    // the last keystroke, so we don't need to look for a follow-up button.
    await page.waitForURL(/checkout\.tabby\.ai\/otp/, { timeout: 30_000 });
    await page.locator('input[data-testid="otp.input"], input[name="otp-code"]')
      .first()
      .fill(identity.otp);

    // Payment-plans screen: post-OTP Tabby routes to `/payment-plans` and
    // asks the user to pick an installment count (4/6/8/12). Continue is
    // active but no-ops with "Select a payment plan to continue" until a plan
    // is highlighted. Pick the first option so the choice is deterministic.
    await page.waitForURL(/checkout\.tabby\.ai\/payment-plans/, { timeout: 30_000 });
    await page.locator('[data-testid="payment-plans.installments-item"]').first().click();
    await page.locator('button[data-testid="payment-plans.continue"]').click();

    // Return: Tabby → checkout_accept.php → on_return finalises → checkout_result.
    await page.waitForURL(/checkout_accept\.php|checkout_result/i, { timeout: 60_000 });
    await page.locator('h1.success, h1.pending, h1.fail')
      .first()
      .waitFor({ state: 'visible', timeout: 60_000 });
  },
};

export const identities: Record<string, TabbyIdentity> = {
  success: {
    nationalPhone: '500000001',
    email:         'otp.success@tabby.ai',
    otp:           '8888',
  },
};
