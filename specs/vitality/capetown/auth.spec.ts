import { test, expect } from '../../../helpers/test';
import type { RegisterData } from '../../../types/user';

/**
 * Capetown-theme auth vitality specs. Capetown gates DOB on
 * `legacyweb_config_show_dob` — off by default on theagenda, so the native
 * spec skips it. Here we flip the flag on and assert the required-field
 * behavior. City is intentionally optional on capetown even when
 * `legacyweb_config_show_city` renders it, so we don't test-force it here.
 *
 * Serial mode: the whole file mutates shared tenant config, so all tests
 * must land on the same worker in sequence.
 */
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

// Raw serialized previous value, snapshot in beforeAll and rewritten in
// afterAll. Can't use a captured restore closure — the beforeAll db pool is
// closed before afterAll runs.
let prevShowDob: string | null = null;

test.beforeAll(async ({ admin, db }) => {
  await db.overrideConfig('disable_config_cache', '1');
  prevShowDob = await db.overrideConfig('legacyweb_config_show_dob', '1');
  await admin.clearCache();
});

test.afterAll(async ({ admin, db }) => {
  await db.restoreConfig('legacyweb_config_show_dob', prevShowDob);
  await admin.clearCache();
});

test(19, "vitality", async ({ customer }) => {
  await customer.openAuth();
  await customer.fillRegister({ ...validBase(), dob: '' });
  await customer.submitRegister();
  expect(await customer.hasRegisterFieldError('user_dob')).toBe(true);
  expect(await customer.landedOnActivation()).toBe(false);
});

