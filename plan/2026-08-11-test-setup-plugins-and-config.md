# Plan: per-test plugin and config setup

**Status:** planned, not yet implemented
**Date drafted:** 2026-08-11

## What we're building

A declarative way for each test to specify:
- Which plugins should be enabled or disabled while it runs
- Which `configuration` table values should be overridden

The setup is read from `specs/registry.json`, applied by an auto-fixture before each test, and restored to the previous DB state on teardown.

## Why

Tests currently can't safely mutate plugin/config state because:
1. State is global to the DB — concurrent tests trip on each other
2. There's no fixture to declare "I need reCAPTCHA off"
3. No restore mechanism, so state leaks between runs

This plan gives us a typed, declarative API that lives in the registry (single source of truth), plus a fixture that handles apply + restore automatically.

## Concurrency: the underlying constraint

`configuration` is a single MySQL table shared across all workers. If test A sets `recaptcha_enabled=0` while test B on another worker sets `recaptcha_enabled=1`, they corrupt each other.

**Rule we're adopting**: every test that uses `setup` MUST live inside a `test.describe` block configured as `mode: 'serial'`. Tests within a serial describe run one at a time on the same worker. Tests without `setup` still run parallel at the configured worker count.

This is a convention, not framework-enforced. If we outgrow it, escalate to a cross-worker lock (Redis or file mutex) or per-worker isolated DBs.

## Design shape

### Tenant JSON declares baseline plugin state

```jsonc
// tenants/cca.local.json
{
  // existing fields...
  "plugins": {
    "recaptcha":      true,
    "cca_offers":     true,
    "family_package": true,
    "guest_checkout": true
  },
  "config": {}
}
```

Documents "cca has these plugins on by default." Used as a reference — the DB is source of truth for what's actually enabled at any moment.

### Registry entry declares per-test diff

```jsonc
// specs/registry.json
{
  "id": 14,
  "title": "registers a new user successfully",
  "feature": "auth.register",
  "surface": "auth",
  "validatedOn": ["cca"],
  "setup": {
    "plugins": {
      "disable": ["recaptcha"],
      "enable":  ["debug_plugin"]
    },
    "config": {
      "some_threshold": 5
    }
  }
}
```

`disable`/`enable` arrays list only the deltas from the tenant baseline. `config` overrides literal `configuration` table values.

### Spec stays clean

```ts
test.describe('register flows', () => {
  test.describe.configure({ mode: 'serial' });

  vitality(14, async ({ customer }) => {
    // Framework auto-disabled reCAPTCHA before this test.
    // Restored after.
  });
});
```

## Restore semantics

**Restore to DB state at test-start, NOT to tenant JSON baseline.** Rationale: someone might toggle a plugin manually mid-session, or a previous test might have left state changed unexpectedly. The tenant JSON is documentation; the DB is truth. We snapshot the actual pre-test values and replay them on teardown.

## Files to edit

| File | Change |
|---|---|
| `types/tenant.ts` | Add `plugins?: Record<string, boolean>` and `config?: Record<string, string \| number>` to `TenantConfig` |
| `tenants/cca.local.json` | Append `plugins` and `config` blocks with the current baseline |
| `helpers/vitality-test.ts` | Add `setup?` field to `RegistryEntry` interface (types only — no runtime change) |
| `helpers/db-client.ts` | Add `overrideConfig(field, value): Promise<() => Promise<void>>` and `setPluginState(name, enabled): Promise<() => Promise<void>>` |
| `fixtures/test-setup.ts` (new) | Auto-fixture that reads `testInfo.tags` for `@id:N`, looks up registry entry, applies overrides, tracks restorers, replays on teardown, annotates result |
| `fixtures/index.ts` | Merge `testSetup` fixture into the exported `test` |
| `specs/registry.json` | Add demo test entry with a `setup` block |
| `specs/vitality/config-setup.spec.ts` (new) | Demo test proving the fixture disables reCAPTCHA correctly |
| `docs/09-test-setup.md` (new) | Explain the registry setup schema, restore semantics, and the serial-describe rule |

Total: ~150 lines across nine files.

## Implementation notes

### PHP-serialized values

The `configuration` table stores values PHP-serialized (`s:1:"1";` etc.). `DbClient` will hide this format from callers via a `phpSerialize()` helper. Callers pass native types (`1`, `"0"`, etc.); the helper produces the wire format.

Common types to handle:
- `s:N:"value";` — strings
- `i:N;` — integers
- `b:1;` / `b:0;` — booleans

### Plugin field naming convention

Plugins are toggled via `configuration.config_field = '<plugin>_enabled'`. For example, `recaptcha_enabled`. `setPluginState(name, enabled)` uses this convention. If a plugin doesn't follow it, add a per-plugin override map later.

### Extracting the ID from tags

The `vitality()` wrapper already injects `@id:N` as a tag. The setup fixture reads `testInfo.tags`, finds the `@id:` entry, parses out the number, and uses it to look up the registry entry.

### Annotations for the HTML report

Applied setup is pushed into `testInfo.annotations` so the HTML report shows what state each test required, without polluting the `tag` list (which stays pure identity metadata).

## Two decisions to lock in before implementing

1. **Config value handling**: `DbClient` does the PHP serialization internally (callers pass native TS values). Confirmed cleaner API.
2. **Plugin field naming**: hardcode `<name>_enabled` convention initially; add per-plugin overrides if a real plugin breaks it.

## Open questions to revisit at implementation time

- Do we assert the tenant JSON baseline matches the actual DB state at test-run startup? (Nice sanity check, could be noisy; opt-in via env flag)
- Do we display applied setup diffs in the terminal reporter or only in HTML annotations?
- Does `setPluginState` need to also handle the plugin loading list (some tenants disable plugins via a different mechanism)?

## What we are NOT doing

- No cross-worker lock. Serial-describe is the discipline we start with.
- No per-worker DB isolation. Deferred until we have hundreds of config-mutating tests.
- No auto-detection of "this test has setup, force serial mode." Kept manual as a discipline — makes the constraint visible in the spec.
- No auto-generation of tenant baseline from current DB state. Manual is fine at the current scale.

## When to implement

Pick this up when the first test that genuinely needs to mutate `configuration` lands — likely the "register successfully with reCAPTCHA disabled" spec. Before then, all vitality tests remain read-only and this plan can sit.
