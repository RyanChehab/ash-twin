import {test,expect} from '../../helpers/test'
import { cards } from '../../payments/cybersource_unified';
import { events } from '../../helpers/presets/event';
import { requireTestCustomer } from '../../helpers/tenant';
import { identities as tabbyIdentities } from '../../payments/tabby';

test.beforeAll(async ({ admin, db }) => {
  await db.overrideConfig('disable_config_cache', '1');
  await admin.clearCache();
});



test(16, 'vitality', async ({ customer, resolver, tenant, db, feedback }) => {
  test.setTimeout(120_000);   // paid checkout goes through the gateway sandbox

  const creds    = requireTestCustomer(tenant);
  const event    = await resolver.event({ ...events.normal, hasHandling: 'cybersource_unified' });
  const category = await resolver.category({
    eventId:      event.id,
    numbering:    'none',
    webPublished: true,
    soldout:      false,
  });

  await customer.login(creds);

  const order = await customer.buyTicket(event, category, 1, {
    payment: { key: 'cybersource_unified', card: cards.visaSuccess },
  });

  expect(order.orderRef).toBeTruthy();
  expect(order.status).toBe('paid');

  const dbOrder = await db.orderById(order.orderRef);
  expect(dbOrder, `order ${order.orderRef} not found in DB`).not.toBeNull();
  expect(dbOrder?.paymentStatus).toBe('paid');
  expect(dbOrder?.status).toBe('ord');

  feedback(`event ${event.id} category ${category.id}: paid order ${order.orderRef}`);
});

test(17, 'vitality', async ({ customer, resolver, tenant, db, feedback }) => {
  test.setTimeout(120_000);   // paid checkout + 3DS challenge

  const creds    = requireTestCustomer(tenant);
  const event    = await resolver.event({ ...events.normal, hasHandling: 'cybersource_unified' });
  const category = await resolver.category({
    eventId:      event.id,
    numbering:    'none',
    webPublished: true,
    soldout:      false,
  });

  await customer.login(creds);

  const order = await customer.buyTicket(event, category, 1, {
    payment: { key: 'cybersource_unified', card: cards.visa3ds },
  });

  expect(order.orderRef).toBeTruthy();
  expect(order.status).toBe('paid');

  const dbOrder = await db.orderById(order.orderRef);
  expect(dbOrder, `order ${order.orderRef} not found in DB`).not.toBeNull();
  expect(dbOrder?.paymentStatus).toBe('paid');
  expect(dbOrder?.status).toBe('ord');

  feedback(`event ${event.id} category ${category.id}: 3DS paid order ${order.orderRef}`);
});

test(18, 'vitality', async ({ customer, resolver, tenant, db, feedback }) => {
  test.setTimeout(120_000);

  const creds    = requireTestCustomer(tenant);
  const event    = await resolver.event({ ...events.normal, hasHandling: 'cybersource_unified' });
  const category = await resolver.category({
    eventId:      event.id,
    numbering:    'none',
    webPublished: true,
    soldout:      false,
  });

  await customer.login(creds);

  const order = await customer.buyTicket(event, category, 1, {
    payment: {
      key:          'cybersource_unified',
      card:         cards.visa3ds,
      strategyOpts: { cancelChallenge: true },
    },
  });

  expect(order.status).toBe('failed');

  if (order.orderRef) {
    const dbOrder = await db.orderById(order.orderRef);
    expect(dbOrder?.paymentStatus).not.toBe('paid');
  }

  feedback(`event ${event.id} category ${category.id}: 3DS cancelled → status ${order.status}`);
});

test(21, 'vitality', async ({ customer, resolver, tenant, db, feedback }) => {
  test.setTimeout(180_000);

  const creds    = requireTestCustomer(tenant);
  const event    = await resolver.event({ ...events.normal, hasHandling: 'tabby' });
  const category = await resolver.category({
    eventId:      event.id,
    numbering:    'none',
    webPublished: true,
    soldout:      false,
  });

  await customer.login(creds);

  const order = await customer.buyTicket(event, category, 1, {
    payment: {
      key:          'tabby',
      strategyOpts: { identity: tabbyIdentities.success },
    },
  });

  expect(order.orderRef).toBeTruthy();
  expect(order.status).toBe('paid');

  const dbOrder = await db.orderById(order.orderRef);
  expect(dbOrder, `order ${order.orderRef} not found in DB`).not.toBeNull();
  expect(dbOrder?.paymentStatus).toBe('paid');
  expect(dbOrder?.status).toBe('ord');

  feedback(`event ${event.id} category ${category.id}: tabby paid order ${order.orderRef}`);
});

test(19, 'vitality', async ({ customer, resolver, feedback }) => {
  test.setTimeout(60_000);

  const event    = await resolver.event(events.normal);
  const category = await resolver.category({
    eventId:      event.id,
    numbering:    'none',
    webPublished: true,
    soldout:      false,
  });

  // Anonymous → checkout should bounce to auth. Drive the individual pages
  // so we can observe the redirect precisely (buyTicket would auto-follow
  // through and fail on the wrong page).
  await customer.openEvent(event);
  await customer.pages.event.pickCategory(category.id);
  await customer.pages.event.setQuantity(category.id, 1);
  await customer.pages.event.acceptTerms();
  await customer.pages.event.addToCart(category.id);
  await customer.pages.event.proceedToCheckout();

  if (await customer.pages.checkoutProducts.isCurrent()) {
    await customer.pages.checkoutProducts.continue();
  }

  expect(await customer.isOnAuthPage()).toBe(true);

  feedback(`anonymous user landed on auth (${customer.page.url()})`);
});
