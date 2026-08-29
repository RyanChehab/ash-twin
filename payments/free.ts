import type { PaymentStrategy } from '../types/payment';

/**
 * Free / zero-total checkout (`eph_free.php`).
 *
 * squaremaze's on_confirm returns instant approval; no gateway hop, no
 * iframes, no card entry. The submit posts to `checkout.php?action=submit`
 * and the server responds directly with `checkout_result.tpl`.
 */
export const free: PaymentStrategy = {
  paymentKey: 'free',

  async complete(page) {
    await page.locator('h1.success, h1.pending, h1.fail')
      .first()
      .waitFor({ state: 'visible', timeout: 30_000 });
  },
};
