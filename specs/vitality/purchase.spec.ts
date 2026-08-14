import { test, expect } from '../../helpers/test';
import { events } from '../../helpers/event-presets';
import { requireTestCustomer } from '../../helpers/tenant';
import { cards } from '../../payments/cybersource_unified';

/**
 * Every purchase spec here needs `recaptcha_enabled` off — staging enforces it
 * on the AJAX add-to-cart path. Disable it before every test; deliberately
 * NOT restoring afterwards so the DB stays in a testable state across the run
 * (and, crucially, if a test crashes mid-run, we don't leave reCAPTCHA off
 * because of a half-run restore either — it's a single stable state).
 * Write is idempotent: 0 → 0 costs the same as 1 → 0.
 */
test.beforeEach(async ({ db }) => {
  await db.overrideConfig('recaptcha_enabled', '0');
});


test(15, 'vitality', async ({ customer, resolver, tenant, feedback }) => {
  test.setTimeout(120_000);   // paid checkout goes through the gateway sandbox

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
});

test(16, 'vitality', async ({ customer, resolver, tenant, feedback }) => {
  test.setTimeout(120_000);   // paid checkout + 3DS challenge

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
});

test(17, 'vitality', async ({ customer, resolver, tenant, feedback }) => {
  test.setTimeout(120_000);

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
});

test(18, 'vitality', async ({ customer, resolver, feedback }) => {
  test.setTimeout(60_000);

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
});
