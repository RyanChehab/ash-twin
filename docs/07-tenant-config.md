# 07 — Tenant config

`tenants/` — one JSON file per (tenant × env) combo. Holds every value the framework needs to talk to a specific tenant's environment.

## File naming

```
tenants/
├── cca.local.json
├── cca.staging.json
├── adrea.local.json
├── ...
```

Pattern: `{tenant}.{env}.json`. Loader picks by `TENANT` + `ENV` env vars.

## Schema

```jsonc
{
  "name": "cca",
  "env":  "local",

  "baseUrl": "https://cca",              // used for admin/pos/dashboard/scanner
  "webUrl":  "https://cca",              // customer web (may differ for Next.js tenants)

  "currency": "AED",
  "locale":   "en",

  "users": {
    "superadmin": {
      "username": "${CCA_LOCAL_SUPERADMIN_USER}",
      "password": "${CCA_LOCAL_SUPERADMIN_PASSWORD}"
    },
    "customers": {
      "default": {
        "email":    "${CCA_LOCAL_CUSTOMER_EMAIL}",
        "password": "${CCA_LOCAL_CUSTOMER_PASSWORD}"
      }
    }
  },

  "db": {
    "host":     "${CCA_LOCAL_DB_HOST}",
    "port":     "${CCA_LOCAL_DB_PORT}",
    "user":     "${CCA_LOCAL_DB_USER}",
    "password": "${CCA_LOCAL_DB_PASSWORD}",
    "database": "${CCA_LOCAL_DB_NAME}"
  }
}
```

## Env var interpolation

Any `${VAR_NAME}` in the JSON is replaced with `process.env.VAR_NAME` at load time. Secrets (passwords, tokens) live in `.env` (gitignored), never in committed JSON.

`fixtures/tenant.ts` performs the interpolation. Missing env vars throw a clear error.

## Local `.env` — never committed

Every developer creates their own:

```bash
# tests/e2e/.env (or ash-twin/.env)
CCA_LOCAL_SUPERADMIN_USER=admin
CCA_LOCAL_SUPERADMIN_PASSWORD=H3ll0h123
CCA_LOCAL_DB_HOST=localhost
CCA_LOCAL_DB_PORT=3306
CCA_LOCAL_DB_USER=root
CCA_LOCAL_DB_PASSWORD=root
CCA_LOCAL_DB_NAME=cca
```

CI uses a secrets manager (GitHub Secrets etc.) that populates the same env vars.

## What's accessible in tests

The `tenant` fixture exposes everything except env-var placeholders (already interpolated):

```ts
test('foo', async ({ tenant }) => {
  console.log(tenant.baseUrl);           // https://cca
  console.log(tenant.currency);          // AED
  console.log(tenant.users.superadmin);  // { username: 'admin', password: '...' }
});
```

## Adding a new tenant

1. Create `tenants/{name}.local.json` following the schema
2. Add env vars to your local `.env`
3. Run `TENANT={name} ENV=local npx playwright test`

If the tenant uses a non-default frontend, also create page-object overrides under `pages/web/tenants/{name}/` and branch in the factory.

## Future fields

Not yet in schema but planned:

- `theme` — hint for the factory ('default' | 'capetown')
- `fixtures.venues` — pre-seeded test venues
- `fixtures.customers` — additional named customer roles
- `baseline.plugins` — required plugins for tests to work
