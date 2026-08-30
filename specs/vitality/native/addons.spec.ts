import { test, expect } from '../../../helpers/test';
import { events } from '../../../helpers/event-presets';
import { addons } from '../../../helpers/addon-presets';
import { requireTestCustomer } from '../../../helpers/tenant';


test.describe('addon visibility gates', () => {

  test.describe.configure({ mode: 'serial' });

  test(27, 'vitality', async ({ customer, resolver, tenant, db, feedback }) => {
    test.setTimeout(120_000);
    const creds = requireTestCustomer(tenant);
    const event = await resolver.event({
      ...events.withAddons,
      hasAddons: addons.multiCategoryEligible,
    });
    const addon = await resolver.addon({
      ...addons.multiCategoryEligible,
      eventId: event.id,
    });
    const parentCat = await resolver.category({
      eventId:      event.id,
      numbering:    'none',
      webPublished: true,
      soldout:      false,
    });
    const previous = await db.setEventField(addon.id, 'event_webshop', 0);

    try {
      await customer.pages.auth.open();
      await customer.pages.auth.login(creds);
      await customer.openEvent(event);
      await customer.pages.event.pickCategory(parentCat.id);
      await customer.pages.event.setQuantity(parentCat.id, 1);
      await customer.pages.event.acceptTerms();
      await customer.pages.event.addToCart(parentCat.id);
      await customer.pages.event.proceedToCheckout();

      const picker = customer.page.locator(`.quantity-picker.addon[data-addon-id="${addon.id}"]`);
      expect(await picker.count()).toBe(0);

      feedback(`addon ${addon.id} hidden when event_webshop=0`);
    } finally {
      await db.setEventField(addon.id, 'event_webshop', previous);
      await customer.logout();
    }
  });


  test(28, 'vitality', async ({ customer, resolver, tenant, db, feedback }) => {
    test.setTimeout(120_000);
    const creds = requireTestCustomer(tenant);
    const event = await resolver.event({
      ...events.withAddons,
      hasAddons: addons.multiCategoryEligible,
    });
    const addon = await resolver.addon({
      ...addons.multiCategoryEligible,
      eventId: event.id,
    });
    const parentCat = await resolver.category({
      eventId:      event.id,
      numbering:    'none',
      webPublished: true,
      soldout:      false,
    });
    const previous = await db.setEventField(addon.id, 'event_status', 'unpub');

    try {
      await customer.pages.auth.open();
      await customer.pages.auth.login(creds);
      await customer.openEvent(event);
      await customer.pages.event.pickCategory(parentCat.id);
      await customer.pages.event.setQuantity(parentCat.id, 1);
      await customer.pages.event.acceptTerms();
      await customer.pages.event.addToCart(parentCat.id);
      await customer.pages.event.proceedToCheckout();

      const picker = customer.page.locator(`.quantity-picker.addon[data-addon-id="${addon.id}"]`);
      expect(await picker.count()).toBe(0);

      feedback(`addon ${addon.id} hidden when event_status=unpub`);
    } finally {
      await db.setEventField(addon.id, 'event_status', previous);
    }
  });


  test(29, 'vitality', async ({ customer, resolver, tenant, db, feedback }) => {
    test.setTimeout(120_000);
    const creds = requireTestCustomer(tenant);
    const event = await resolver.event({
      ...events.withAddons,
      hasAddons: addons.multiCategoryEligible,
    });
    const addon = await resolver.addon({
      ...addons.multiCategoryEligible,
      eventId: event.id,
    });
    const parentCat = await resolver.category({
      eventId:      event.id,
      numbering:    'none',
      webPublished: true,
      soldout:      false,
    });

    // Flip category_web = 0 on EVERY category of the addon so none render.
    const rows = await db.query<{ category_id: number; category_web: number }>(
      'SELECT category_id, category_web FROM category WHERE category_event_id = ?',
      [addon.id],
    );
    const backups = new Map<number, unknown>();
    for (const r of rows) {
      backups.set(r.category_id, await db.setCategoryField(r.category_id, 'category_web', 0));
    }

    try {
      await customer.pages.auth.open();
      await customer.pages.auth.login(creds);
      await customer.openEvent(event);
      await customer.pages.event.pickCategory(parentCat.id);
      await customer.pages.event.setQuantity(parentCat.id, 1);
      await customer.pages.event.acceptTerms();
      await customer.pages.event.addToCart(parentCat.id);
      await customer.pages.event.proceedToCheckout();

      const picker = customer.page.locator(`.quantity-picker.addon[data-addon-id="${addon.id}"]`);
      expect(await picker.count()).toBe(0);

      feedback(`addon ${addon.id} hidden when all its ${rows.length} categories have category_web=0`);
    } finally {
      for (const [categoryId, prev] of backups) {
        await db.setCategoryField(categoryId, 'category_web', prev);
      }
      await customer.logout();
    }
  });


  test(30, 'vitality', async ({ customer, resolver, tenant, feedback }) => {
    test.setTimeout(120_000);
    const creds = requireTestCustomer(tenant);
    const event = await resolver.event(events.normal);
    const parentCat = await resolver.category({
      eventId:      event.id,
      numbering:    'none',
      webPublished: true,
      soldout:      false,
    });

    try {
      await customer.pages.auth.open();
      await customer.pages.auth.login(creds);
      await customer.openEvent(event);
      await customer.pages.event.pickCategory(parentCat.id);
      await customer.pages.event.setQuantity(parentCat.id, 1);
      await customer.pages.event.acceptTerms();
      await customer.pages.event.addToCart(parentCat.id);
      await customer.pages.event.proceedToCheckout();

      const anyAddonPicker = customer.page.locator('.quantity-picker.addon');
      expect(await anyAddonPicker.count()).toBe(0);

      feedback(`event ${event.id}: no eligible addons → no addon pickers rendered`);
    } finally {
      await customer.logout();
    }
  });

});
