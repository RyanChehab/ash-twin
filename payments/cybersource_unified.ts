import type { PaymentStrategy, TestCard } from '../types/payment';
import type { Frame, Page } from '@playwright/test';

/**
 * Cybersource Unified Checkout (`eph_cybersource_unified.php`).
 *
 * The plugin only renders empty containers; everything visible comes from the
 * `VAS.UnifiedCheckout` SDK loaded at runtime from `#clientLibrary`. On CCA
 * the SDK renders its UI across multiple cross-origin iframes on
 * `*.cybersource.com` — buttonlist first, then swaps in an `mce.html` frame
 * for card entry after the user clicks "Checkout with card." Iframe src's
 * change as the SDK transitions between states, so we always re-walk frames
 * after every interaction instead of caching a locator.
 *
 * Flow:
 *   1. Find the buttonlist frame → click "Checkout with card".
 *   2. Re-scan → find the card-entry frame → fill number/exp/cvv.
 *   3. Re-scan → find the Pay button (may be the same frame) → click.
 *   4. SDK tokenises + runs 3DS inline, writes JWT into #flex_token, and
 *      auto-submits our form to `?action=submit`.
 */
export const cybersource_unified: PaymentStrategy = {
  paymentKey: 'cybersource_unified',

  async complete(page, { testCard }) {
    if (!testCard) {
      throw new Error(`cybersource_unified.complete requires a testCard`);
    }

    // 1. Wait for the plugin's form + SDK global.
    await page.waitForSelector('#payment-form', { timeout: 20_000 });
    await page.waitForFunction(
      () => typeof (window as unknown as { VAS?: unknown }).VAS !== 'undefined',
      { timeout: 30_000 },
    );

    // 2. Buttonlist: click "Checkout with card".
    const buttonlistFrame = await waitForFrameWith(page, 30_000, (frame) =>
      hasVisible(frame, 'button', /checkout with card|pay with card|card/i),
    );
    await buttonlistFrame.getByRole('button', { name: /checkout with card|pay with card|card/i })
      .first()
      .click();

    // 3. Card entry: the SDK swaps in a new iframe; find it by its Card Number field.
    //    Cybersource splits expiry into month + year comboboxes and marks CVV
    //    as "Security code". First name + last name are required — we split
    //    testCard.name when present, otherwise use a stable placeholder.
    const cardEntryFrame = await waitForFrameWith(page, 30_000, (frame) =>
      hasVisible(frame, 'textbox', /card number|pan/i),
    );
    await cardEntryFrame.getByRole('textbox', { name: /card number|pan/i })
      .fill(testCard.number);

    const [month, year] = testCard.expiry.split('/').map(s => s.trim());
    await cardEntryFrame.getByRole('combobox', { name: /expiry month/i }).selectOption(month);
    await cardEntryFrame.getByRole('combobox', { name: /expiry year/i }).selectOption(year);

    await cardEntryFrame.getByRole('textbox', { name: /security code|cvv|cvc/i })
      .fill(testCard.cvc);

    const [firstName, lastName] = (testCard.name ?? 'Test Customer').split(' ', 2);
    await cardEntryFrame.getByRole('textbox', { name: /first name/i }).fill(firstName);
    await cardEntryFrame.getByRole('textbox', { name: /last name/i }).fill(lastName ?? 'Customer');

    // 4. Advance: SDK's button is labelled "Continue" on the entry screen.
    const payFrame = await waitForFrameWith(page, 10_000, (frame) =>
      hasVisible(frame, 'button', /continue|^pay$|submit|confirm/i),
    );
    await payFrame.getByRole('button', { name: /continue|^pay$|submit|confirm/i }).first().click();

    // 5. SDK tokenises + runs any 3DS inline, populates #flex_token, and
    //    calls paymentForm.submit(). The response renders checkout_result.tpl
    //    on the same URL (no clean action= param survives), so we wait for
    //    the confirmation heading instead of an URL pattern.
    await page.locator('h1.success, h1.pending, h1.fail')
      .waitFor({ state: 'visible', timeout: 60_000 });
  },
};

/**
 * Walk every frame on the page until `match` returns true, then hand back
 * the raw `Frame` handle. Frames attach/detach as the SDK boots — each
 * probe is wrapped so one dying doesn't kill the whole search.
 */
async function waitForFrameWith(
  page: Page,
  timeoutMs: number,
  match: (frame: Frame) => Promise<boolean>,
): Promise<Frame> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      try {
        if (await match(frame)) return frame;
      } catch {
        /* frame detached mid-check — outer loop retries */
      }
    }
    await page.waitForTimeout(400);
  }
  throw new Error(`cybersource_unified: no frame matched within ${timeoutMs}ms`);
}

async function hasVisible(frame: Frame, role: 'button' | 'textbox', name: RegExp): Promise<boolean> {
  const loc = frame.getByRole(role, { name });
  if ((await loc.count()) === 0) return false;
  return await loc.first().isVisible();
}

/**
 * Cybersource sandbox test cards. Any future expiry works — the sandbox
 * doesn't reject on `MM/YY` format like Checkout.com's Frames widget did.
 */
export const cards: Record<string, TestCard> = {
  visaSuccess:       { number: '4111111111111111', expiry: '12/30', cvc: '100' },
  visa3ds:           { number: '4000000000001091', expiry: '12/30', cvc: '100' },
  mastercardSuccess: { number: '5555555555554444', expiry: '12/30', cvc: '100' },
  amex:              { number: '378282246310005',  expiry: '12/30', cvc: '1000' },
};
