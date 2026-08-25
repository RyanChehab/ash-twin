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

  async complete(page, { testCard, opts }) {
    if (!testCard) {
      throw new Error(`cybersource_unified.complete requires a testCard`);
    }
    const cancelChallenge = !!opts?.cancelChallenge;

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
    const lastNameField = cardEntryFrame.getByRole('textbox', { name: /last name/i });
    await lastNameField.fill(lastName ?? 'Customer');
    // SDK enables Continue on blur — .fill() doesn't emit it. Tab out.
    await lastNameField.press('Tab');

    // 4. Advance the SDK, twice:
    //    (a) Continue on the card-entry screen → SDK collapses to a summary
    //        view (masked card + "Save my info" checkbox + another Continue).
    //    (b) Continue on the summary → SDK returns transientToken from
    //        mount(), then the plugin's JS runs checkout.complete() (which
    //        does frictionless 3DS + auth) and auto-submits payment-form.
    //    Both Continues live inside Cybersource iframes — the plugin renders
    //    no parent-page CTA. We identify the summary screen by its distinct
    //    "Save my information" text, then click Continue again.
    const cardContinue = await waitForEnabledButtonInFrames(
      page,
      30_000,
      /continue|^pay(\s|$)|submit|confirm/i,
    );
    await cardContinue.click();

    const summaryFrame = await waitForFrameWith(page, 30_000, (frame) =>
      hasVisibleText(frame, /save my (info|information)/i),
    );
    const summaryContinue = summaryFrame.getByRole('button', {
      name: /continue|^pay(\s|$)|submit|confirm/i,
    }).first();
    await summaryContinue.waitFor({ state: 'visible', timeout: 10_000 });
    // Wait for it to enable — SDK may need a beat before it's clickable.
    for (let i = 0; i < 20 && !(await summaryContinue.isEnabled()); i++) {
      await page.waitForTimeout(200);
    }
    await summaryContinue.click();

    // 5. Optionally a 3DS challenge appears (Cybersource routes it through
    //    Cardinal / Centinel — visible as `centinelapistag` or `cardinaltrusted`
    //    in the challenge iframe's URL). Poll: confirmation heading wins →
    //    done. Otherwise, if a 3DS challenge frame appears, drop the sandbox
    //    OTP (`1234`) and submit, then keep polling until the heading shows.
    const successHeading = page.locator('h1.success, h1.pending, h1.fail');
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      if ((await successHeading.count()) > 0 && await successHeading.first().isVisible().catch(() => false)) {
        return;
      }
      if (cancelChallenge) {
        await tryCancel3dsChallenge(page);
      } else {
        await tryComplete3dsChallenge(page, '1234');
      }
      await page.waitForTimeout(500);
    }
    throw new Error(
      `cybersource_unified: no confirmation heading after 60s. Current URL: ${page.url()}`,
    );
  },
};

/**
 * Look for a Cybersource 3DS challenge iframe (Cardinal/Centinel) and, if
 * found with an empty OTP field, drop `otp` into it and submit. No-op if
 * no such frame is present or the field is already filled.
 */
async function tryComplete3dsChallenge(page: Page, otp: string): Promise<void> {
  for (const frame of page.frames()) {
    if (!/cardinal|centinel|3ds/i.test(frame.url())) continue;
    try {
      const otpField = frame.getByRole('textbox').first();
      if ((await otpField.count()) === 0) continue;
      if (!(await otpField.isVisible())) continue;
      if ((await otpField.inputValue()) !== '') continue;

      await otpField.fill(otp);
      await frame.getByRole('button', { name: /submit|verify|continue|confirm/i })
        .first()
        .click();
      return;
    } catch {
      /* frame detached mid-check — outer poll will retry */
    }
  }
}

/**
 * Abort the 3DS challenge by clicking its Cancel button. Cybersource treats
 * user-cancellation as a failed payment and either surfaces `h1.fail` on the
 * result page or re-shows the widget with an error — both are terminal for
 * our poll (heading match, or eventual timeout).
 */
async function tryCancel3dsChallenge(page: Page): Promise<void> {
  for (const frame of page.frames()) {
    if (!/cardinal|centinel|3ds/i.test(frame.url())) continue;
    try {
      const cancelBtn = frame.getByRole('button', { name: /cancel/i }).first();
      if ((await cancelBtn.count()) === 0) continue;
      if (!(await cancelBtn.isVisible())) continue;
      await cancelBtn.click();
      return;
    } catch {
      /* frame detached mid-check — outer poll will retry */
    }
  }
}

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

async function hasVisibleText(frame: Frame, text: RegExp): Promise<boolean> {
  const loc = frame.getByText(text);
  if ((await loc.count()) === 0) return false;
  return await loc.first().isVisible();
}

/**
 * Poll every frame for a visible + enabled button matching `name`. Scoped to
 * frames only (excludes the parent page) so we don't accidentally match the
 * SquareMaze confirm page's own submit button instead of the SDK's Continue.
 */
async function waitForEnabledButtonInFrames(
  page: Page,
  timeoutMs: number,
  name: RegExp,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      if (frame === page.mainFrame()) continue;
      try {
        const btn = frame.getByRole('button', { name }).first();
        if ((await btn.count()) === 0) continue;
        if (!(await btn.isVisible())) continue;
        if (!(await btn.isEnabled())) continue;
        return btn;
      } catch {
        /* frame detached mid-check — retry */
      }
    }
    await page.waitForTimeout(400);
  }
  throw new Error(
    `cybersource_unified: no enabled iframe button matching ${name} within ${timeoutMs}ms`,
  );
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
