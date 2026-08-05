import type { Page } from '@playwright/test';

/**
 * Chassis for every web page object.
 * Holds the raw Playwright Page reference and shared utilities every concrete
 * page needs (wait strategies, URL assertions, error detection).
 *
 * Concrete pages extend this class and add:
 *   - their own URL in an `open(...)` method
 *   - their own Locator properties for selectors
 *   - their own atomic action / read methods
 */

export abstract class BasePage {
  constructor(protected page: Page) {}

  /** Default wait for server-rendered pages — DOM ready is enough. Override for SPAs. */
  protected async waitReady(): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded');
  }

  /** Stronger wait for SPAs and pages with meaningful async content. */
  protected async waitForNetworkIdle(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  /** Throws if the current URL doesn't match the expected pattern. */
  protected async assertUrl(pattern: RegExp): Promise<void> {
    const current = this.page.url();
    if (!pattern.test(current)) {
      throw new Error(`Expected URL matching ${pattern}, got ${current}`);
    }
  }
  
}
