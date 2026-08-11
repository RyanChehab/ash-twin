import { test, expect } from '../../helpers/test';
import type { RegisterData } from '../../types/user';

/**
 * Auth vitality specs for the default theme / cca.
 *
 *   1 –9   register form — client-side validation progression (no POST)
 *  10      signup end-to-end — register + activate + verify + cleanup
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

// ── Register form: per-field client-side validation ────────────────────────

test(1, async ({ customer }) => {
  await customer.openAuth();
  await customer.fillRegister({ ...validBase(), firstName: '' });
  await customer.submitRegister();
  expect(await customer.hasRegisterFieldError('user_firstname')).toBe(true);
  expect(await customer.landedOnActivation()).toBe(false);
});

test(2, async ({ customer }) => {
  await customer.openAuth();
  await customer.fillRegister({ ...validBase(), lastName: '' });
  await customer.submitRegister();
  expect(await customer.hasRegisterFieldError('user_lastname')).toBe(true);
});

test(3, async ({ customer }) => {
  await customer.openAuth();
  await customer.fillRegister({ ...validBase(), email: 'not-an-email' });
  await customer.submitRegister();
  expect(await customer.hasRegisterFieldError('user_email')).toBe(true);
});

test(4, async ({ customer }) => {
  await customer.openAuth();
  await customer.fillRegister({ ...validBase(), dob: '' });
  await customer.submitRegister();
  expect(await customer.hasRegisterFieldError('user_dob')).toBe(true);
});

test(5, async ({ customer }) => {
  await customer.openAuth();
  await customer.fillRegister({ ...validBase(), phone: '' });
  await customer.submitRegister();
  expect(await customer.hasRegisterFieldError('user_phone')).toBe(true);
});

test(6, async ({ customer }) => {
  // Rule: >=8 chars, at least 1 digit, 1 lowercase, 1 uppercase (`strongPassword`).
  await customer.openAuth();
  await customer.fillRegister({ ...validBase(), password: 'weakpass' });
  await customer.submitRegister();
  expect(await customer.hasRegisterFieldError('password1')).toBe(true);
});

test(7, async ({ customer }) => {
  await customer.openAuth();
  await customer.fillRegister({
    ...validBase(),
    password:        'StrongPass1',
    passwordConfirm: 'DifferentPass1',
  });
  await customer.submitRegister();
  expect(await customer.hasRegisterFieldError('password2')).toBe(true);
});

test(8, async ({ customer }) => {
  await customer.openAuth();
  await customer.fillRegister({ ...validBase(), acceptTerms: false });
  await customer.submitRegister();
  expect(await customer.hasRegisterFieldError('check_condition')).toBe(true);
});

test(9, async ({ customer }) => {
  await customer.openAuth();
  await customer.submitRegister();
  expect(await customer.hasRegisterFieldError('user_firstname')).toBe(true);
  expect(await customer.hasRegisterFieldError('user_lastname')).toBe(true);
  expect(await customer.hasRegisterFieldError('user_email')).toBe(true);
});

// ── Signup end-to-end ──────────────────────────────────────────────────────

test(10, async ({ customer, db, feedback }) => {
  const email = `ash.twin.${Date.now()}@example.com`;

  try {
    await customer.openAuth();
    await customer.fillRegister(validBase(email));
    await customer.enableTestCaptchaBypass();
    await customer.submitRegisterProgrammatically();

    // Server persisted the user + auth row — activation hash now available.
    const activationPath = await db.activationUrlFor(email);
    expect(activationPath).toContain('/activation.php?uar=');

    // Follow the activation URL — server clears auth.active and signs the user in.
    await customer.activate(activationPath);

    expect(await db.isUserActive(email)).toBe(true);
    expect(await customer.isSignedIn()).toBe(true);

    feedback(`user ${email} signed up`);
  } finally {
    await db.deleteUserByEmail(email);
  }
});

// ── Login form: validation, rejection, and success ────────────────────────
//
// Login tests rely on `tenant.users.testCustomer` already existing (and being
// activated) in the tenant's DB. Set the creds in `tenants/{name}.{env}.json`.

test(11, async ({ customer, tenant }) => {
  const creds = tenant.users.testCustomer!;
  await customer.openAuth();
  await customer.fillLogin({ username: '', password: creds.password });
  await customer.submitLogin();
  expect(await customer.hasLoginFieldError('username')).toBe(true);
  expect(await customer.isSignedIn()).toBe(false);
});

test(12, async ({ customer, tenant }) => {
  const creds = tenant.users.testCustomer!;
  await customer.openAuth();
  await customer.fillLogin({ username: creds.username, password: '' });
  await customer.submitLogin();
  expect(await customer.hasLoginFieldError('password')).toBe(true);
  expect(await customer.isSignedIn()).toBe(false);
});

test(13, async ({ customer }) => {
  await customer.openAuth();
  await customer.fillLogin({
    username: 'not.a.real.user@ashtwin.com',
    password: 'DefinitelyWrong1',
  });
  await customer.submitLogin();
  // Client-side validation passes (email format + non-empty), form POSTs.
  // Server rejects → we stay on the auth page, unsigned.
  expect(await customer.isSignedIn()).toBe(false);
});

test(14, async ({ customer, tenant, feedback }) => {
  const creds = tenant.users.testCustomer!;
  await customer.openAuth();
  await customer.login(creds);
  expect(await customer.isSignedIn()).toBe(true);
  feedback(`user ${creds.username} logged in`);
});
