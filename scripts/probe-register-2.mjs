import { chromium } from 'playwright';

const url = 'https://staging.theagenda.com/register';
const browser = await chromium.launch();
const page = await browser.newPage();

// Stub grecaptcha the same way CapetownAuthPage.open does
await page.addInitScript(() => {
  window.grecaptcha = {
    enterprise: {
      ready: (cb) => cb(),
      execute: async () => 'ash-twin-stub-token',
    },
  };
});

await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(800);

// Mimic fillRegister with firstName: '' — same order as CapetownAuthPage.fillRegister
await page.locator('#user-register input[name="user_firstname"]').fill('');
await page.locator('#user-register input[name="user_lastname"]').fill('Twin');
await page.locator('#user-register input[name="user_email"]').fill('ash.twin.test@example.com');

// setDob (removes readonly, sets value, fires change)
await page.locator('#user-register input[name="user_dob"]').evaluate((el, v) => {
  el.removeAttribute('readonly'); el.value = v;
  el.dispatchEvent(new Event('change', { bubbles: true }));
}, '1995-04-15');

// setPhone via intlTelInput
await page.locator('#user-register input[name="user_phone"]').evaluate((el, num) => {
  const $ = window.jQuery;
  if ($) $(el).intlTelInput('setNumber', num);
  else el.value = num;
}, '+971501234567');

// setCountry
await page.locator('#user-register select[name="user_country"]').selectOption('AE');

// password1, password2, terms
await page.locator('#user-register input[name="password1"]').fill('StrongPass1');
await page.locator('#user-register input[name="password2"]').fill('StrongPass1');
await page.locator('#user-register input[name="check_condition"]').evaluate((el, val) => {
  el.checked = val;
  el.dispatchEvent(new Event('change', { bubbles: true }));
}, true);

// Give the form a beat to settle any deferred JS
await page.waitForTimeout(300);

// Click submit
await page.locator('#user-register [type="submit"]').click();
await page.waitForTimeout(1000);

const state = await page.evaluate(() => {
  const q = (sel) => document.querySelector(sel);
  const fields = ['user_firstname','user_lastname','user_email','user_phone','user_country','user_dob','password1','password2','check_condition'];
  return {
    urlNow: location.pathname + location.search,
    perField: fields.map(name => {
      const el = document.querySelector(`#user-register [name="${name}"]`);
      return { name, exists: !!el, classList: el ? el.className : null };
    }),
    errorLabels: Array.from(document.querySelectorAll('#user-register label.error')).map(l => ({
      for: l.getAttribute('for'),
      text: l.textContent?.trim(),
      hidden: l.style.display === 'none',
    })),
    activationVisible: !!document.querySelector('#registration-activation:not([style*="display: none"])'),
    // Was submitHandler called (form.submit dispatched)?
    // Look at whether reCAPTCHA hidden input got appended
    hasRecaptchaToken: !!document.querySelector('#user-register input[name="g-recaptcha-response"]'),
    // Or maybe form actually submitted normally and re-rendered
    firstNameValue: q('#user-register [name="user_firstname"]')?.value,
    lastNameValue: q('#user-register [name="user_lastname"]')?.value,
  };
});
console.log(JSON.stringify(state, null, 2));

await browser.close();
