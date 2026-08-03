import type { Page } from '@playwright/test';
import type { TenantConfig } from '../types/tenant';
import type { BuyTicketPayload } from '../types/payloads';
import type { EventRef, TicketRef } from '../types/references';
import { WebEventDetailPage } from '../pages/web/web-event-detail-page';
import { WebCheckoutPage } from '../pages/web/web-checkout-page';
import { WebConfirmationPage } from '../pages/web/web-confirmation-page';
import { unique } from '../helpers/unique';

export class Customer {
  constructor(
    private page: Page,
    private tenant: TenantConfig,
  ) {}

  async openEvent(event: EventRef) {
    const detail = new WebEventDetailPage(this.page);
    await detail.open(event.id);
  }

  /**
   * High-level customer purchase flow. Drives event detail → checkout → confirmation.
   * Payload requires eventId + categoryId + userId, and exactly one of quantity | seats
   * depending on whether the category is GA or seated.
   */
  async buyTicket(payload: BuyTicketPayload): Promise<TicketRef> {
    // Validate exactly one of quantity | seats
    const hasQty  = payload.quantity !== undefined;
    const hasSeat = payload.seats !== undefined && payload.seats.length > 0;
    if (hasQty === hasSeat) {
      throw new Error('buyTicket: provide exactly one of `quantity` (for GA) or `seats` (for seated)');
    }

    const detail = new WebEventDetailPage(this.page);
    await detail.open(payload.eventId);

    // TODO: pick the specific category by payload.categoryId (page object needs a selectCategory method)
    // TODO: authenticate as payload.userId (either via storage-state per user, or a login step)
    // TODO: for seated → drive seatmap picker to select payload.seats

    if (hasQty) await detail.setQuantity(payload.quantity!);
    await detail.clickBuy();

    const checkout = new WebCheckoutPage(this.page);
    await checkout.submit();

    const confirmation = new WebConfirmationPage(this.page);
    const visible = await confirmation.isVisible();
    const orderRef = await confirmation.orderRef();

    return {
      orderRef: (orderRef ?? unique.orderRef()).trim(),
      status: visible ? 'paid' : 'unknown',
      eventId: payload.eventId,
    };
  }
}
