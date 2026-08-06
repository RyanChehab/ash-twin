# 03 — Resolver

`helpers/resolver.ts` — the single class that translates test intent into concrete domain objects via DB queries.

## The idea

Tests never write SQL. They describe WHAT they want; the Resolver figures out WHICH row to fetch.

```ts
const event = await resolver.event({ hasCategory: { soldout: false } });
// → resolver runs: SELECT ... FROM events e WHERE EXISTS (SELECT 1 FROM category c WHERE c.category_event_id = e.id AND c.category_free > 0) LIMIT 1
```

## Public methods

Two currently. Each accepts multiple selector shapes:

### `event(selector)`

Accepts:
- `number` → by id
- `string` → by name
- `Event` ref → re-fetches by id
- `EventCriteria` → any event matching the conditions

### `category(selector)`

Accepts:
- `number` → by id
- `Category` ref → re-fetches by id
- `CategoryCriteria` → any category matching the conditions

Both return the full domain object (`Event` / `Category`), or **throw** if nothing matches.

## Always-on filters (criteria queries only)

Any `EventCriteria` query enforces these implicitly. Direct id / name lookups (`resolver.event(42)` / `resolver.event("CHICAGO")`) skip them — if the caller asks for row 42, they get row 42.

| Filter | Why |
|---|---|
| `event_model = 'event'` | The `event` table is overloaded — also holds season passes, vouchers, F&B products, ebooks. Override via `model:` in the criteria. |
| `event_type IS NOT NULL AND != ''` | Real events always have a type (used to build the URL). Products/vouchers don't. |
| `event_webshop = 1` | Only rows listed for sale on the storefront. |
| `event_view_begin < NOW()` and `event_view_end > NOW()` | Inside the configured view window. NULL either side = open-ended. |
| `event_date >= CURDATE()` | Not yet past. NULL date is fine (evergreen). |
| Parent-viewable | For subs (`event_main_id NOT NULL`), the parent main must itself be pub + webshop=1 + inside its view window. Prevents returning a pub sub whose unpub main renders an empty page. |

## Criteria dimensions supported

### EventCriteria
- `status` — `'pub' \| 'unpub' \| 'nosal' \| 'trash'` (SquareMaze short-forms, see `docs/08`)
- `rep` — `'unique' \| 'main' \| 'sub' \| 'main-or-unique' \| 'sub-or-unique'`. Default depends on `hasCategory`: set → `'sub-or-unique'` (categories only live on those); unset → `'main-or-unique'` (landing-visible rows).
- `model` — `EventModel`. Defaults to `'event'`. Set explicitly to target `'seasonpass'` / `'voucher'` / `'product'` / `'ebook'`.
- `hasCategory` — a nested `CategoryCriteria` (becomes an EXISTS subquery)

### CategoryCriteria
- `eventId` — scope to a specific event
- `name` — exact match
- `numbering` — 'none' | 'both' | 'rows' | 'seat' | 'seated' (shorthand for any non-none)
- `soldout` — `true` = `category_free = 0`, `false` = `category_free > 0`
- `minPrice` / `maxPrice` — range filter
- `mode` — 'ticket' | 'pass'
- `webPublished` / `posPublished` / `b2bPublished` — `category_<channel> = 1`

Combine as many as you want:

```ts
resolver.category({
  eventId: 42,
  numbering: 'seated',
  soldout: false,
  webPublished: true,
  minPrice: 100,
});
```

## How SQL is built — additive dimensions

Each criteria key maps to one SQL fragment in a private builder method (`buildEventCriteriaWhere`, `buildCategoryCriteriaWhere`). When you add a new filter dimension:

1. Add the key to the criteria interface (e.g., `hasDiscount?: boolean`)
2. Add one `if` branch in the builder:
   ```ts
   if (cond.hasDiscount) parts.push('EXISTS (SELECT 1 FROM discount d WHERE ...)');
   ```

Zero disruption to existing tests.

## Cross-table conditions use EXISTS subqueries

Never JOINs — subqueries stay independent and additive. Each cross-table filter is one EXISTS wrapping its own conditions:

```sql
SELECT e.* FROM events e
WHERE EXISTS (SELECT 1 FROM category c WHERE c.category_event_id = e.id AND ...)
  AND EXISTS (SELECT 1 FROM discount d WHERE d.discount_event_id = e.id AND ...)
```

## Failure mode — throws with clear message

If no row matches: `throw new Error("Event not found: <selector>")` or `Category not found: ...`. Tests fail loudly at the resolver call site, not in downstream code. If you need "check existence" semantics, add `tryEvent()` / `tryCategory()` returning `null` — not built yet.
