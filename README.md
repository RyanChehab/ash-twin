# Ash Twin

Automated regression testing platform for SquareMaze. Playwright + TypeScript.

Runs the same functional flows every cycle against every tenant, detects deviation, replaces manual QA.

## Quick start

```bash
npm install
npx playwright install chromium
cp .env.example .env    # fill in credentials
TENANT=cca ENV=local npx playwright test
```

## Layout

- `actors/` — user roles (Admin, Customer, Cashier, Scanner, Organizer)
- `pages/` — page objects: one class per page, owns selectors
- `fixtures/` — dependency injection: tenant, auth, db, actors
- `helpers/` — utilities (db client, factories, unique data)
- `tenants/` — one JSON per (tenant × env)
- `types/` — shared TypeScript contracts
- `specs/` — the actual tests

## Design docs

See `docs/design.md` in the SquareMaze repo (spec: `docs/specs/2026-06-14-playwright-e2e-testing-framework-design.md`, plan: `docs/plans/2026-06-14-playwright-e2e-testing-framework.md`).
