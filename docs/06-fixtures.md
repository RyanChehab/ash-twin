# 06 — Fixtures

`fixtures/` — the wiring that hands tests their dependencies. Playwright's dependency injection system.

## What lives here

| File | Provides | Depends on |
|---|---|---|
| `tenant.ts` | `tenant` — loaded TenantConfig | `TENANT` and `ENV` env vars |
| `auth.ts` | `adminPage`, `customerPage` — logged-in browser tabs | `tenant` |
| `actors.ts` | `db`, `admin`, `customer` (`resolver` next) | `tenant`, `adminPage`, `customerPage` |
| `index.ts` | Merged `test` export tests import from | All of the above |

## How tests use fixtures

```ts
import { test, expect } from '../../fixtures';

test('foo', async ({ customer, resolver, tenant }) => {
  //                    ↑          ↑         ↑
  //  names match the fixtures declared above
  const event = await resolver.event({ status: 'published' });
  await customer.buyTicket(event, ...);
});
```

Test destructures the fixtures it needs. Playwright resolves dependencies in order, constructs each one, hands them over.

## Resolution chain — example

```
Test declares: { customer }
   ↓
Playwright looks up 'customer' in actors.ts
   ↓
'customer' needs { customerPage, tenant }
   ↓
'customerPage' needs { browser, tenant }
   ↓
'tenant' loads tenants/${TENANT}.${ENV}.json
   ↓
Everything constructed bottom-up, test receives ready-to-use customer
```

## Lifecycle

Each fixture has setup + teardown:

```ts
db: async ({ tenant }, use) => {
  const client = new DbClient(tenant.db);   // setup
  await use(client);                          // hand to test
  await client.close();                       // teardown after test
},
```

Teardown runs automatically even if the test fails.

## Fixture scopes

- **Test-scoped** (default) — new instance per test. Isolation.
- **Worker-scoped** — one instance per parallel worker. Useful for expensive setup (login, DB seed).

We currently use test-scoped everywhere. Worker-scoped storage-state auth is a future optimization when the suite grows.

## The tenant/env variables

```bash
TENANT=cca ENV=local npx playwright test
```

`fixtures/tenant.ts` reads these:

```ts
const name = process.env.TENANT ?? 'cca';
const env  = process.env.ENV    ?? 'local';
const cfg  = loadTenant(`tenants/${name}.${env}.json`);
```

Same test file runs against any tenant/env by changing env vars. Test code never mentions tenant name.

## Adding a new fixture

1. Add it to `actors.ts` (or a new file if it's a new concern)
2. Merge it into `index.ts` via `mergeTests`
3. Tests can now destructure it

Example — adding a `resolver` fixture:

```ts
// fixtures/actors.ts
resolver: async ({ db }, use) => {
  await use(new Resolver(db));
},
```

That's it — `test('x', async ({ resolver }) => ...)` now works.
