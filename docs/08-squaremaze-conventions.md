# 08 — SquareMaze conventions

Rules and gotchas to follow when writing SQL, page objects, or URLs against SquareMaze. Grown from real breakage.

## Table names are SINGULAR

| ❌ Wrong | ✓ Correct |
|---|---|
| `FROM events` | `FROM event` |
| `FROM categories` | `FROM category` |
| `FROM users` | `FROM user` |
| `FROM orders` | `FROM order` |

Not English-plural, not `_tbl` suffixed. Just the singular noun.

## Every column is prefixed with its table name

| ❌ Wrong | ✓ Correct |
|---|---|
| `e.id` | `e.event_id` |
| `e.status` | `e.event_status` |
| `c.name` | `c.category_name` |
| `u.email` | `u.user_email` |

Rule: **`{table}_{field}`** for every column in that table, including the primary key.

## Foreign keys use the target column name

```
category.category_event_id  →  event.event_id
seat.seat_category_id       →  category.category_id
order.order_user_id         →  user.user_id
```

FK column = `{owning_table}_{referenced_column}`.

## Enum values are often short-form

Some enum columns store abbreviated values rather than the English word. Known so far:

| Column | Stored values |
|---|---|
| `event.event_status` | `'pub'` \| `'unpub'` \| `'nosal'` \| `'trash'` |
| `event.event_rep` | `'main,sub'` (unique) \| `'main'` \| `'sub'` |
| `category.category_numbering` | `'none'` (GA) \| `'both'` \| `'rows'` \| `'seat'` |
| `category.category_mode` | `'ticket'` \| `'pass'` |
| `category.category_web/pos/b2b` | `0` (unpublished) \| `1` (published) \| `2` (unavailable) |

**Always check `includes/models/model.<name>.php` for the exact stored value** before writing a filter. Full English words like `'published'` usually won't match.

## Customer-facing URLs use `/{event_type}/{event_id}[/{slug}]`

**Not** `/event/{id}` — that path doesn't route (redirects to `/`).

Format: `/{type}/{id}[/{slug}]` where `type` is `event.event_type` (`music`, `sports`, `comedy`, `festival`, ...) and `id` is the display id (main's id for subs, own id for unique/main).

| Event | Canonical URL | Notes |
|---|---|---|
| Unique (`rep = 'main,sub'`) | `/{type}/{event_id}` | Direct to buy page |
| Main (`rep = 'main'`) | `/{type}/{event_id}` | Renders event.tpl + date picker |
| Sub (`rep = 'sub'`) | `/{type}/{event_main_id}` | Same URL as the main; date is picked via the AJAX date picker on that page |

**Sub event ids never appear in URLs.** Subs are reachable only via their main's URL + the date picker.

## The `event` table holds more than events

Products (F&B combos, merchandise) and other non-performance rows live in the same `event` table with `event_type = NULL`. They have `event_status = 'pub'` and can have categories too — so a naive query "give me any published event with a category" can hit a burger combo instead of a concert.

**Rule**: any criteria-based event lookup must require `event_type IS NOT NULL AND event_type != ''`. The Resolver adds this automatically for every criteria query. Direct id / name lookups (`resolver.event(42)`) skip the filter — if the caller says "give me row 42," they get row 42.

## The date picker doesn't navigate

Clicking a date option triggers AJAX that loads categories in-place. The URL stays at `/{type}/{main_id}` throughout. No form submission, no submit button.

## Where to find the truth

- **Table columns**: `includes/models/model.<entity>.php` → the `$_columns` array
- **Column value constants**: same file, class constants (e.g. `STATUS_PUB`, `EVENT_REP_MAIN`)
- **Schema definitions**: `includes/install/data_db.php` (canonical DDL)
- **URL routing**: `.htaccess` at repo root + `includes/plugins/plugin.legacyweb.php` (URL generation logic)
- **Rendered markup**: the actual `.tpl` files under `includes/templates/default/web/` — the DOM is the truth, not documentation

## The rule when adding new SQL / URLs in ash-twin

Before writing any query or navigation:

1. Verify the table name is singular
2. Verify every column has the table prefix
3. Check the model file for enum/status values (short-forms are common)
4. For customer URLs, check the actual rendered HTML in the browser, not just `.htaccess` — `/event/{id}` and similar generic paths are misleading
5. When in doubt, dispatch an Explore agent to read the source (model / template / plugin)

## Why aliases in SELECT stay simple

The alias is what our TS code reads — matches the domain interface's field names:

```sql
SELECT
  e.event_id     AS id,          -- alias to interface field
  e.event_name   AS title,
  e.event_type   AS type,
  e.event_status AS status
FROM event e
```

TS side sees `event.id`, `event.title`, `event.type`, `event.status` — domain-friendly names. SQL side speaks SquareMaze's actual columns. The alias is the seam.
