import type { Page, Locator } from '@playwright/test';

export class WebHomePage {
  readonly eventCards: Locator;

  constructor(private page: Page) {
    this.eventCards = page.locator('.event-card, [data-event-id], article.event').first();
  }

  async open() {
    await this.page.goto('/');
  }

  async openEvent(idOrTitle: string | number) {
    if (typeof idOrTitle === 'number') {
      await this.page.goto(`/event/${idOrTitle}`);
    } else {
      const card = this.page.locator('[data-event-id], .event-card').filter({ hasText: idOrTitle }).first();
      await card.click();
    }
  }
}
