import { test, expect } from '../../../helpers/test';
import { events } from '../../../helpers/presets/event';
import { requireTestCustomer } from '../../../helpers/tenant';
import { registeredPaymentKeys } from '../../../payments';


test.beforeAll(async ({ admin, db }) => {
  await db.overrideConfig('disable_config_cache', '1');
  await admin.clearCache();
});


test(22, 'vitality', async ({ customer, resolver, tenant, db, feedback }) => {
  test.setTimeout(180_000);

  const creds    = requireTestCustomer(tenant);
  const event    = await resolver.event({ ...events.normal, hasHandling: registeredPaymentKeys() });
  const category = await resolver.category({
    eventId:      event.id,
    numbering:    'none',
    webPublished: true,
    soldout:      false,
  });

  await customer.pages.auth.open();
  await customer.pages.auth.login(creds);

  const order = await customer.buyTicket(event, category, 1, { payment: 'any' });

  expect(order.orderRef).toBeTruthy();
  expect(order.status).toBe('paid');

  const dbOrder = await db.orderById(order.orderRef);
  expect(dbOrder, `order ${order.orderRef} not found in DB`).not.toBeNull();
  expect(dbOrder?.paymentStatus).toBe('paid');
  expect(dbOrder?.status).toBe('ord');

  feedback(`event ${event.id} category ${category.id}: paid order ${order.orderRef}`);
});
