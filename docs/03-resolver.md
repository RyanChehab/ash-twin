# 03 — Resolver

`helpers/resolver.ts` — the single class that translates test intent into concrete domain objects via DB queries.

## The idea

Tests never write SQL. They describe WHAT they want via curated presets; the Resolver figures out WHICH row to fetch.

```ts
import { events } from '../../helpers/event-presets';

const event = await resolver.event(events.normal);
// → resolver runs a fully-explicit query built from the preset's criteria
```

## Public methods

Two currently. Each accepts multiple selector shapes:

### `event(selector)`

Accepts:
- `number` → by id
- `string` → by name
- `Event` ref → re-fetches by id
- `EventCriteria` → any event matching the conditions (usually a preset from `event-presets.ts`)

### `category(selector)`

Accepts:
- `number` → by id
- `Category` ref → re-fetches by id
- `CategoryCriteria` → any category matching the conditions

Both return the full domain object (`Event` / `Category`), or **throw** if nothing matches.

## Zero defaults — presets are the source of truth

The resolver applies **no** implicit filters. Every predicate comes from the criteria the caller passes. If a criterion field is unset, the resolver stays silent about that dimension.

Because that would make every test verbose to write, curated `EventCriteria` combinations live in `helpers/event-presets.ts`. Tests reference presets by name:

```ts
import { events } from '../../helpers/event-presets';

await resolver.event(events.normal);           // ordinary purchasable event
await resolver.event(events.presale);          // presale-gated event
await resolver.event(events.privateAccess);    // code-gated private event
await resolver.event(events.unpublished);      // for the "not visible" branch
await resolver.event(events.soldOutGa);        // sold-out GA category
await resolver.event(events.withAddons);       // event with addons in checkout
await resolver.event(events.requiresLogin);    // anonymous-user redirect case
await resolver.event(events.requiresNationalId);
```

Need a variant once? Spread and override:

```ts
await resolver.event({
  ...events.normal,
  hasCategory: { ...events.normal.hasCategory, numbering: 'seated' },
});
```

If the same variant appears in more than one test, promote it to a new preset in `event-presets.ts`.

## ⚠️ Maintenance rule

**Whenever `EventCriteria` in `types/event.ts` gains, renames, or changes the semantics of a field, every affected preset in `helpers/event-presets.ts` must be updated in the same commit.**

Presets are the entire safety net — the resolver won't fall back to sensible defaults for you. A preset that silently omits a new criterion means every test using it starts including events that field was meant to filter. Rules of thumb:

- **Adding a new visibility flag** (e.g. `isPresale`) → set it explicitly on every preset. `false` on the ones that want ordinary events, `true` on the one that targets the new state, add a new preset for the exotic case if needed.
- **Renaming a field** → find-and-replace in every preset. TypeScript catches this at compile time thanks to `satisfies EventCriteria`.
- **Changing semantics** (e.g. flipping what `true` means) → audit every preset by hand.

If unsure whether a change affects presets: it does. Open `event-presets.ts` and check.

## Criteria dimensions supported

### EventCriteria — every field optional; unset = no filter

- **Core selection**
  - `status` — `'pub' | 'unpub' | 'nosal' | 'trash'` (SquareMaze short-forms, see `docs/08`)
  - `rep` — `'unique' | 'main' | 'sub' | 'main-or-unique' | 'sub-or-unique'`
  - `model` — `EventModel` — `'event' | 'seasonpass' | 'voucher' | 'product' | 'ebook'`
- **Visibility flags** (tri-state — `true` = must be truthy, `false` = must be falsy or NULL, unset = no filter)
  - `webshop` — `event_webshop = 1`
  - `inViewWindow` — `NOW()` between `event_view_begin` and `event_view_end`
  - `isFuture` — `event_date >= CURDATE()` (or NULL = evergreen)
  - `parentViewable` — for subs, the parent main is pub + webshop + in view window
  - `isPresale` — `event_presales`
  - `isPrivate` — `event_is_private`
  - `requiresNationalId` — `event_nationalid`
  - `requiresLogin` — `event_requires_login`
  - `hasAddons` — has an eligible addon linked via `addonlink`
- **Nested**
  - `hasCategory` — a `CategoryCriteria` (becomes an EXISTS subquery)

### CategoryCriteria
- `eventId` — scope to a specific event
- `name` — exact match
- `numbering` — `'none' | 'both' | 'rows' | 'seat' | 'seated'` (shorthand for any non-none)
- `soldout` — `true` = `category_free = 0`, `false` = `category_free > 0`
- `minPrice` / `maxPrice` — range filter
- `mode` — `'ticket' | 'pass'`
- `webPublished` / `posPublished` / `b2bPublished` — `category_<channel> = 1`

Combine as many as you want:

```ts
resolver.category({
  eventId:      42,
  numbering:    'seated',
  soldout:      false,
  webPublished: true,
  minPrice:     100,
});
```

## How SQL is built — additive dimensions

Each criteria key maps to one SQL fragment in a private builder method (`buildEventCriteriaWhere`, `buildCategoryCriteriaWhere`). When you add a new filter dimension:

1. Add the key to the criteria interface in `types/event.ts` (e.g., `hasDiscount?: boolean`)
2. Add one `if` branch in the builder:
   ```ts
   if (c.hasDiscount === true)  parts.push('EXISTS (SELECT 1 FROM discount d WHERE ...)');
   if (c.hasDiscount === false) parts.push('NOT EXISTS (...)');
   ```
3. **Update every preset in `event-presets.ts`** that should have an opinion on the new dimension.

## Cross-table conditions use EXISTS subqueries

Never JOINs — subqueries stay independent and additive. Each cross-table filter is one EXISTS wrapping its own conditions:

```sql
SELECT e.* FROM event e
WHERE EXISTS (SELECT 1 FROM category c WHERE c.category_event_id = e.event_id AND ...)
  AND EXISTS (SELECT 1 FROM addonlink al WHERE al.addonlink_event_id = e.event_id AND ...)
```

## Failure mode — throws with clear message

If no row matches: `throw new Error("Event not found: <selector>")` or `Category not found: ...`. Tests fail loudly at the resolver call site, not in downstream code. If you need "check existence" semantics, add `tryEvent()` / `tryCategory()` returning `null` — not built yet.
