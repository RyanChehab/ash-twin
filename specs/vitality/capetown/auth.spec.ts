import { test, expect } from '../../../helpers/test';
import type { RegisterData } from '../../../types/user';


test.describe.configure({ mode: 'serial' });

const validBase = (email?: string): RegisterData => ({
  firstName: 'Ash',
  lastName:  'Twin',
  email:     email ?? `ash.twin.${Date.now()}@example.com`,
  dob:       '1995-04-15',
  phone:     '+971501234567',
  country:   'AE',
  city:      'Dubai',
  address:   'Al Wasl Rd, Jumeirah',
  password:  'StrongPass1',
});

let prevShowDob: string | null = null;

test.beforeAll(async ({ admin, db }) => {
  await db.overrideConfig('disable_config_cache', '1');
  await admin.clearCache();
});


test(20, "vitality", async ({ customer, db }) => {
  await db.overrideConfig('legacyweb_config_show_dob', '1');
  const auth = customer.pages.auth;
  await auth.open();
  await auth.fillRegister({ ...validBase(), dob: '' });
  await auth.submitRegister();
  expect(await auth.hasFieldError('user_dob')).toBe(true);
  expect(await auth.isOnActivationPage()).toBe(false);
});
