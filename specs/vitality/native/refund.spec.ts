import { test, expect } from '../../../helpers/test';
import { events } from '../../../helpers/presets/event';
import { requireTestCustomer } from '../../../helpers/tenant';
import { registeredPaymentKeys } from '../../../payments';


test.beforeAll(async ({ admin, db }) => {
  await db.overrideConfig('disable_config_cache', '1');
  await admin.clearCache();
});


test(23, 'vitality', async ({ customer, admin, resolver, tenant, db, feedback }) => {
  test.setTimeout(180_000);

  const creds    = requireTestCustomer(tenant);
  const event    = await resolver.event({ ...events.normal, hasHandling: registeredPaymentKeys() });
  const category = await resolver.category({
    eventId:      event.id,
    numbering:    'none',
    webPublished: true,
    soldout:      false,
  });

  await customer.login(creds);

  const order = await customer.buyTicket(event, category, 3, { payment: 'any' });
  expect(order.orderRef).toBeTruthy();
  expect(order.status).toBe('paid');

  const originalId = Number(order.orderRef);
  const preRefund  = await db.orderTicketsInfo(originalId);
  expect(preRefund?.ticketsNr).toBe(3);

  await admin.refundOrder(originalId, { seats: 'all' });

  const originalAfter = await db.orderById(originalId);
  expect(originalAfter?.status).toBe('ord');
  expect(originalAfter?.paymentStatus).toBe('paid');

  const postRefund = await db.orderTicketsInfo(originalId);
  expect(postRefund?.ticketsNr).toBe(0);
  expect(postRefund?.oldTicketsNr).toBe(3);

  const credits = await db.creditOrdersFor(originalId);
  expect(credits.length).toBe(1);
  expect(credits[0].status).toBe('credit');
  expect(credits[0].totalPrice).toBeLessThan(0);

  feedback(`order ${originalId}: fully refunded → credit ${credits[0].orderId}`);
});


test(24, 'vitality', async ({ customer, admin, resolver, tenant, db, feedback }) => {
  test.setTimeout(180_000);

  const creds    = requireTestCustomer(tenant);
  const event    = await resolver.event({ ...events.normal, hasHandling: registeredPaymentKeys() });
  const category = await resolver.category({
    eventId:      event.id,
    numbering:    'none',
    webPublished: true,
    soldout:      false,
  });

  await customer.login(creds);

  const order = await customer.buyTicket(event, category, 3, { payment: 'any' });
  expect(order.orderRef).toBeTruthy();
  expect(order.status).toBe('paid');

  const originalId = Number(order.orderRef);
  const preRefund  = await db.orderTicketsInfo(originalId);
  expect(preRefund?.ticketsNr).toBe(3);

  await admin.refundOrder(originalId, { seats: 1 });

  const originalAfter = await db.orderById(originalId);
  expect(originalAfter?.status).toBe('ord');
  expect(originalAfter?.paymentStatus).toBe('paid');

  const postRefund = await db.orderTicketsInfo(originalId);
  expect(postRefund?.ticketsNr).toBe(2);
  expect(postRefund?.oldTicketsNr).toBe(3);

  const credits = await db.creditOrdersFor(originalId);
  expect(credits.length).toBe(1);
  expect(credits[0].status).toBe('credit');
  expect(credits[0].totalPrice).toBeLessThan(0);

  feedback(`order ${originalId}: partial refund (1 of 3) → credit ${credits[0].orderId}`);
});
