import { chromium } from 'playwright';

const url = 'https://staging.theagenda.com/register';
const browser = await chromium.launch();
const page = await browser.newPage({ ignoreHTTPSErrors: false });
await page.goto(url, { waitUntil: 'domcontentloaded' });

// Cookie consent / popups
await page.waitForTimeout(1000);

// Confirm jQuery Validate wired
const validated = await page.evaluate(() => {
  const w = window;
  const $ = w.jQuery;
  if (!$) return { hasJQuery: false };
  const form = document.getElementById('user-register');
  return {
    hasJQuery: true,
    formExists: !!form,
    hasValidator: !!(form && $(form).data('validator')),
    formSubmitAction: form?.getAttribute('action'),
  };
});
console.log('WIRING:', JSON.stringify(validated, null, 2));

// Click submit with the form blank — see what jQuery Validate does.
await page.locator('#user-register [type="submit"]').click();
await page.waitForTimeout(600);

const state = await page.evaluate(() => {
  const q = (sel) => document.querySelector(sel);
  const fields = ['user_firstname','user_lastname','user_email','user_phone','user_country','user_dob','password1','password2','check_condition'];
  return {
    urlNow: location.pathname + location.search,
    perField: fields.map(name => {
      const el = document.querySelector(`#user-register [name="${name}"]`);
      return {
        name,
        exists: !!el,
        classList: el ? el.className : null,
        hasErrorClass: !!(el && el.classList.contains('error')),
      };
    }),
    errorLabels: Array.from(document.querySelectorAll('#user-register label.error')).map(l => ({
      for: l.getAttribute('for'),
      text: l.textContent?.trim(),
      hidden: l.style.display === 'none',
    })),
    activationVisible: !!document.querySelector('#registration-activation:not([style*="display: none"])'),
  };
});
console.log('AFTER SUBMIT:', JSON.stringify(state, null, 2));

await browser.close();
