import type { Page } from '@playwright/test';
import type { TenantConfig } from '../types/tenant';
import type { Event } from '../types/event';
import type { Ticket } from '../types/ticket';
import type { SeatRef } from '../types/seat';
import { WebEventDetailPage } from '../pages/web/web-event-detail-page';
import { WebCheckoutPage } from '../pages/web/web-checkout-page';
import { WebConfirmationPage } from '../pages/web/web-confirmation-page';

/**
 * Action input for Customer.buyTicket().
 * Provide exactly one of `quantity` (for GA categories) or `seats` (for seated).
 */
export interface BuyTicketInput {
  eventId: number;
  categoryId: number;
  userId: number;
  quantity?: number;
  seats?: SeatRef[];
}

export class Customer {
  constructor(
    private page: Page,
    private tenant: TenantConfig,
  ) {}

  async openEvent(event: Pick<Event, 'id'>) {
    const detail = new WebEventDetailPage(this.page);
    await detail.open(event.id);
  }

  async buyTicket(input: BuyTicketInput): Promise<Ticket> {
    const hasQty  = input.quantity !== undefined;
    const hasSeat = input.seats !== undefined && input.seats.length > 0;
    if (hasQty === hasSeat) {
      throw new Error('buyTicket: provide exactly one of `quantity` (GA) or `seats` (seated)');
    }

    const detail = new WebEventDetailPage(this.page);
    await detail.open(input.eventId);

    // TODO: pick the specific category by input.categoryId
    // TODO: authenticate as input.userId
    // TODO: for seated → drive seatmap picker to select input.seats

    if (hasQty) await detail.setQuantity(input.quantity!);
    await detail.clickBuy();

    const checkout = new WebCheckoutPage(this.page);
    await checkout.submit();

    const confirmation = new WebConfirmationPage(this.page);
    const visible = await confirmation.isVisible();
    const orderRef = await confirmation.orderRef();

    return {
      orderRef: (orderRef ?? `T${Date.now()}`).trim(),
      status: visible ? 'paid' : 'unknown',
      eventId: input.eventId,
    };
  }
}
