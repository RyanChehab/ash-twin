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

test(16, 'vitality', async ({ customer, resolver, tenant, db, feedback }) => {
  test.setTimeout(120_000);   // paid checkout + 3DS challenge

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

    await customer.payWith('cybersource_unified', cards.visa3ds);

    const ticket = await customer.readTicket();
    expect(ticket.orderRef).toBeTruthy();
    expect(ticket.status).toBe('paid');

    feedback(`event ${event.id} category ${category.id}: 3DS paid order ${ticket.orderRef}`);
  } finally {
    await restoreRecaptcha();
  }
});

test(17, 'vitality', async ({ customer, resolver, tenant, db, feedback }) => {
  test.setTimeout(120_000);

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

    await customer.proceedFromProducts();

    await customer.payWith('cybersource_unified', cards.visa3ds, { cancelChallenge: true });

    const ticket = await customer.readTicket();
    expect(ticket.status).toBe('failed');

    feedback(`event ${event.id} category ${category.id}: 3DS cancelled → status ${ticket.status}`);
  } finally {
    await restoreRecaptcha();
  }
});

test(18, 'vitality', async ({ customer, resolver, db, feedback }) => {
  test.setTimeout(60_000);

  const restoreRecaptcha = await db.overrideConfig('recaptcha_enabled', '0');
  try {
    const event = await resolver.event(events.normal);
    const category = await resolver.category({
      eventId:      event.id,
      numbering:    'none',
      webPublished: true,
      soldout:      false,
    });

    await customer.openEvent(event);
    await customer.pickCategory(category);
    await customer.setQuantity(category, 1);
    await customer.acceptTerms();
    await customer.addToCart(category);
    await customer.proceedToCheckout();

    if (await customer.isOnCheckoutProducts()) {
      await customer.proceedFromProducts();
    }

    expect(await customer.isOnAuthPage()).toBe(true);

    feedback(`anonymous user landed on auth (${customer.currentUrl()})`);
  } finally {
    await restoreRecaptcha();
  }
});
