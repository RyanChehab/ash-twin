# 09 — Writing tests

Every ash-twin test goes through two things: the **registry** and the **`test(id, fn)` wrapper**.

## The registry — `specs/registry.json`

One JSON array, one entry per test:

```json
[
  { "id": 1,  "title": "empty first name blocks submission" },
  { "id": 2,  "title": "empty last name blocks submission" },
  ...
  { "id": 14, "title": "an existing user logs in with valid credentials" }
]
```

Each entry holds:
- **`id`** — an integer, the test's stable identity. Referenced from Linear tickets, PR bodies, the HTML report, and any future dashboard.
- **`title`** — what shows in the report and terminal output. Editable without touching the spec file.

The registry never renumbers. Deleting a test leaves a gap in the ids — that's fine and expected. IDs are permanent so external references (Linear tickets, PR comments, dashboards) stay meaningful.

## The wrapper — `helpers/test.ts`

Import `test` and `expect` from `helpers/test`, then call `test(id, category, fn)`:

```ts
import { test, expect } from '../../helpers/test';

test(1, 'vitality', async ({ customer }) => {
  await customer.openAuth();
  // ...
});
```

Three arguments:
- **`id`** — integer, looked up in the registry
- **`category`** — string, becomes an `@{category}` tag (`'vitality'`, `'regression'`, `'smoke'`, ...)
- **`fn`** — the test body, same signature as Playwright's

Under the hood the wrapper:
1. Looks up `id` in the registry
2. Builds the Playwright test title as `ID: {id} {registry.title}`
3. Auto-injects a single tag: `@{category}`
4. Throws at import time if the id isn't in the registry, or if the registry has a duplicate

Playwright's own methods (`test.describe`, `test.beforeAll`, `test.step`, `test.use`, ...) still work — the wrapper passes them through.

## Title and tag convention

Each test surfaces as:

- **Title**: `ID: 1 empty first name blocks submission` — id lives at the start so it's visible in the terminal, the HTML report, UI mode, and any JSON export without ever needing to inspect tags.
- **Tag**: `@{category}` — only one tag emitted. Today every test in `specs/vitality/` passes `'vitality'` → `@vitality`.

**Folder rule** (a convention, not framework-enforced):
- Tests under `specs/vitality/` pass `'vitality'` as the category.
- (Future) tests under `specs/regression/` will pass `'regression'`.
- (Future) tests under `specs/smoke/` will pass `'smoke'`.

Grouping tests by folder + naming their category explicitly at every call keeps the tag intent obvious to reviewers and makes misplaced tests visible in code review.

Filter examples:
```bash
# Run every vitality test
npx playwright test --grep @vitality

# Run only test 10 — three equivalent options
npx playwright test --grep "^ID: 10 "               # by title (mind the trailing space so 10 doesn't match 100)
npx playwright test specs/vitality/auth.spec.ts:98  # by file path + line number
npx playwright test --ui                            # UI mode, click any test to run it
```

## Adding a new test

1. **Reserve an id.** Open `specs/registry.json`, look at the last entry's `id`, add 1.
2. **Add the entry:**
   ```json
   { "id": 15, "title": "logout returns the user to signed-out state" }
   ```
3. **Write the test** in any file under `specs/vitality/`:
   ```ts
   test(15, 'vitality', async ({ customer }) => {
     // ...
   });
   ```
4. Commit both changes together (registry entry + spec file). The wrapper handles tag injection.

## What we're NOT tagging (any more)

The registry used to also carry `feature`, `surface`, and `validatedOn` fields, each surfaced as a separate tag. Those were dropped once we realized the tag list was noise: `@id:N` uniquely identifies the test, `@vitality` categorizes it, and everything else belongs in a proper metadata layer (a future test-coverage store, not a Playwright tag string).

When we build the coverage dashboard, richer metadata will land in a real schema — not in dot-separated tag strings.

## Rules to write down

- **Every test lives in `specs/registry.json`.** The wrapper enforces this at import time.
- **IDs are permanent.** Renaming a test's title in the registry is free; changing its id breaks external references.
- **Test files under `specs/vitality/` produce `@vitality`-tagged tests.** The wrapper does this automatically today. When we add other categories, we'll grow the wrapper to reflect folder structure.
