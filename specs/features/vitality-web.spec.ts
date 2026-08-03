import { test, expect } from '../../fixtures';
import { unique } from '../../helpers/unique';

test.describe('vitality', () => {
  const base = ['@feature:vitality', '@surface:web', '@validated-on:cca'];

  test('admin creates event → customer buys via web → confirmation', {
    tag: [...base, '@id:vitality-web'],
  }, async ({ admin, customer, db }) => {
    // Arrange: get (or create) an event.
    let event = await admin.findEvent({ status: 'published', hasCapacity: true });
    if (!event) {
      event = await admin.createEvent({
        title: unique.name('vitality'),
        capacity: 100,
      });
    }

    expect(event).toBeTruthy();

    // Fetch one category on this event (GA preferred for simplicity).
    // TODO: replace with admin.findCategory({ eventId, isGa: true }) once that helper exists.
    const cat = await db.one<{ id: number } & import('mysql2').RowDataPacket>(
      'SELECT id FROM categories WHERE event_id = ? ORDER BY id ASC LIMIT 1',
      [event!.id],
    );
    expect(cat).toBeTruthy();

    // Fetch a customer user to buy as.
    // TODO: replace with admin.findCustomer({}) or a tenant.fixtures.customers.default lookup.
    const user = await db.one<{ id: number } & import('mysql2').RowDataPacket>(
      'SELECT id FROM customers ORDER BY id ASC LIMIT 1',
    );
    expect(user).toBeTruthy();

    // Act.
    const ticket = await customer.buyTicket({
      eventId:    Number(event!.id),
      categoryId: cat!.id,
      userId:     user!.id,
      quantity:   1,
    });

    // Assert.
    expect(ticket.orderRef).toBeTruthy();
    expect(['paid', 'unknown']).toContain(ticket.status);
  });
});
