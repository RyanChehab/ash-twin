import type { PaymentStrategy, TestCard } from '../types/payment';
import type { Frame, Locator, Page } from '@playwright/test';

/**
 * Cybersource Unified Checkout (`eph_cybersource_unified.php`).
 *
 * Plugin renders empty containers; UI comes from the `VAS.UnifiedCheckout`
 * SDK across cross-origin iframes on `*.cybersource.com`. Iframes detach and
 * reattach as the SDK transitions between states — we re-walk `page.frames()`
 * after every interaction instead of caching a locator.
 *
 * Flow: buttonlist → card entry (fill + Tab-blur) → Continue → summary →
 * Continue → SDK tokenises + runs 3DS → auto-submits to `?action=submit`.
 * Neither Continue lives on the parent page — both are inside SDK iframes.
 */
export const cybersource_unified: PaymentStrategy = {
  paymentKey: 'cybersource_unified',

  async complete(page, { testCard, opts }) {
    const card            = testCard ?? cards.visaSuccess;
    const cancelChallenge = !!opts?.cancelChallenge;

    await page.waitForSelector('#payment-form', { timeout: 20_000 });
    await page.waitForFunction(
      () => typeof (window as unknown as { VAS?: unknown }).VAS !== 'undefined',
      { timeout: 30_000 },
    );

    // Buttonlist → click "Checkout with card"
    const cardButton = /checkout with card|pay with card|card/i;
    const buttonlist = await pollFrames(page, 30_000, 'buttonlist frame', async (frame) =>
      (await visible(frame.getByRole('button', { name: cardButton }))) ? frame : null,
    );
    await buttonlist.getByRole('button', { name: cardButton }).first().click();

    // Card entry: fill fields, Tab-blur to enable Continue
    const cardEntry = await pollFrames(page, 30_000, 'card entry frame', async (frame) =>
      (await visible(frame.getByRole('textbox', { name: /card number|pan/i }))) ? frame : null,
    );
    await cardEntry.getByRole('textbox', { name: /card number|pan/i }).fill(card.number);

    const [month, year] = card.expiry.split('/').map((s) => s.trim());
    await cardEntry.getByRole('combobox', { name: /expiry month/i }).selectOption(month);
    await cardEntry.getByRole('combobox', { name: /expiry year/i }).selectOption(year);
    await cardEntry.getByRole('textbox', { name: /security code|cvv|cvc/i }).fill(card.cvc);

    const [firstName, lastName] = (card.name ?? 'Test Customer').split(' ', 2);
    await cardEntry.getByRole('textbox', { name: /first name/i }).fill(firstName);
    const lastNameField = cardEntry.getByRole('textbox', { name: /last name/i });
    await lastNameField.fill(lastName ?? 'Customer');
    await lastNameField.press('Tab'); // SDK enables Continue on blur

    // First Continue (card entry → summary)
    const continueButton = /continue|^pay(\s|$)|submit|confirm/i;
    const cardContinue = await pollFrames(page, 30_000, 'enabled Continue button', async (frame) => {
      if (frame === page.mainFrame()) return null;
      const btn = frame.getByRole('button', { name: continueButton }).first();
      return ((await visible(btn)) && (await btn.isEnabled())) ? btn : null;
    });
    await cardContinue.click();

    // Second Continue (summary — identified by "Save my information" text)
    const summary = await pollFrames(page, 30_000, 'summary frame', async (frame) =>
      (await visible(frame.getByText(/save my (info|information)/i))) ? frame : null,
    );
    const summaryContinue = summary.getByRole('button', { name: continueButton }).first();
    await summaryContinue.waitFor({ state: 'visible', timeout: 10_000 });
    for (let i = 0; i < 20 && !(await summaryContinue.isEnabled()); i++) {
      await page.waitForTimeout(200);
    }
    await summaryContinue.click();

    // Poll for confirmation heading. If a 3DS challenge shows up, react to it.
    const heading = page.locator('h1.success, h1.pending, h1.fail');
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      if ((await heading.count()) > 0 && (await heading.first().isVisible().catch(() => false))) return;
      await react3ds(page, cancelChallenge);
      await page.waitForTimeout(500);
    }
    throw new Error(`cybersource_unified: no confirmation heading after 60s. Current URL: ${page.url()}`);
  },
};

/**
 * React to a Cardinal/Centinel 3DS challenge: cancel it, or drop sandbox OTP
 * `1234` and submit. No-op when no challenge frame is present.
 */
async function react3ds(page: Page, cancel: boolean): Promise<void> {
  for (const frame of page.frames()) {
    if (!/cardinal|centinel|3ds/i.test(frame.url())) continue;
    try {
      if (cancel) {
        const btn = frame.getByRole('button', { name: /cancel/i }).first();
        if (!(await visible(btn))) continue;
        await btn.click();
        return;
      }
      const field = frame.getByRole('textbox').first();
      if (!(await visible(field))) continue;
      if ((await field.inputValue()) !== '') continue;
      await field.fill('1234');
      await frame.getByRole('button', { name: /submit|verify|continue|confirm/i }).first().click();
      return;
    } catch {
      /* detached mid-check — outer poll retries */
    }
  }
}

/**
 * Poll every frame every 400ms until `probe` returns a truthy value. Each
 * probe is wrapped so a detached frame doesn't kill the search.
 */
async function pollFrames<T>(
  page: Page,
  timeoutMs: number,
  what: string,
  probe: (frame: Frame) => Promise<T | null>,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      try {
        const hit = await probe(frame);
        if (hit) return hit;
      } catch {
        /* detached — retry */
      }
    }
    await page.waitForTimeout(400);
  }
  throw new Error(`cybersource_unified: no ${what} within ${timeoutMs}ms`);
}

async function visible(loc: Locator): Promise<boolean> {
  return (await loc.count()) > 0 && (await loc.first().isVisible());
}

/**
 * Cybersource sandbox test cards. Any future expiry works.
 */
export const cards: Record<string, TestCard> = {
  visaSuccess:       { number: '4111111111111111', expiry: '12/30', cvc: '100' },
  visa3ds:           { number: '4000000000001091', expiry: '12/30', cvc: '100' },
  mastercardSuccess: { number: '5555555555554444', expiry: '12/30', cvc: '100' },
  amex:              { number: '378282246310005',  expiry: '12/30', cvc: '1000' },
};
