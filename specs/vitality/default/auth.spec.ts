import { test, expect } from '../../../helpers/test';
import type { RegisterData } from '../../../types/user';

/**
 * Default-theme auth vitality specs. Tests here assume default's guarantee
 * that certain fields (DOB in particular) are ALWAYS rendered and required.
 * Capetown gates the same fields via config (`legacyweb_config_show_dob`),
 * so the same assertion doesn't hold there — capetown covers this behavior
 * conditionally in its own auth spec.
 */

/** A base RegisterData that would pass every client-side rule. */
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

test(4, "vitality", async ({ customer }) => {
  await customer.openAuth();
  await customer.fillRegister({ ...validBase(), dob: '' });
  await customer.submitRegister();
  expect(await customer.hasRegisterFieldError('user_dob')).toBe(true);
});
