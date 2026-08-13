import { test, expect } from '../../helpers/test';
import { events } from '../../helpers/event-presets';
import { requireTestCustomer } from '../../helpers/tenant';
import { cards } from '../../payments/cybersource_unified';


test(15, 'vitality', async ({ customer, resolver, tenant, db, feedback }) => {
  test.setTimeout(120_000);   // paid checkout goes through the gateway sandbox

  const restoreRecaptcha = await db.overrideConfig('recaptcha_enabled', '0');
  try {
    const creds = requireTestCustomer(tenant);
    const event = await resolver.event(events.normal);
    const category = await resolver.category({
      eventId:      event.id,
      numbering:    'none',
      webPublished: true,
      soldout:      false,
    });

    await customer.openAuth();
    await customer.login(creds);

    await customer.openEvent(event);
    await customer.pickCategory(category);
    await customer.setQuantity(category, 1);
    await customer.acceptTerms();
    await customer.addToCart(category);
    await customer.proceedToCheckout();

    expect(await customer.isOnCheckoutProducts()).toBe(true);
    await customer.proceedFromProducts();
    expect(await customer.isOnCheckoutProducts()).toBe(false);

    await customer.payWith('cybersource_unified', cards.visaSuccess);

    const ticket = await customer.readTicket();
    expect(ticket.orderRef).toBeTruthy();
    expect(ticket.status).toBe('paid');

    feedback(`event ${event.id} category ${category.id}: paid order ${ticket.orderRef}`);
  } finally {
    await restoreRecaptcha();
  }
});
