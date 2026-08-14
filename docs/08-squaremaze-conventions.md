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

The `event` table is overloaded. `event_model` classifies the row:

| `event_model` | What it is |
|---|---|
| `'event'`      | Real event (concert, match, festival, ...) |
| `'seasonpass'` | Season pass / subscription |
| `'voucher'`    | Prepaid voucher |
| `'product'`    | F&B combo, merchandise, add-on |
| `'ebook'`      | Digital publication |

Products in particular have `event_type = NULL`, `event_status = 'pub'`, and can carry categories too — so a naive "give me any published event with a category" query hits a burger combo instead of a concert.

**Rules the Resolver enforces on every criteria query**:
1. `event_model = ?` — defaults to `'event'`; callers targeting other kinds must set `model:` explicitly.
2. `event_type IS NOT NULL AND event_type != ''` — safety net for URL building (real events always have a type).

Direct id / name lookups (`resolver.event(42)`) skip these filters — if the caller says "give me row 42," they get row 42.

## The date picker doesn't navigate

Clicking a date option triggers AJAX that loads categories in-place. The URL stays at `/{type}/{main_id}` throughout. No form submission, no submit button.

## The products interstitial hijacks the checkout URL

When the cart is eligible for addons or on-checkout products, SquareMaze renders `checkout_products_list.tpl` instead of the real preview — but at the same URL (`checkout.php?action=preview`). URL-based detection can't tell them apart. Use DOM instead: `#btns #checkoutBtn` (or the presence of the products listing) uniquely identifies the interstitial. See `pages/web/cca/checkout-products.ts`.

## `configuration` writes are shadowed by a file cache

`configuration` table reads route through a JSON cache file at `{squaremaze}/includes/tmp/{tenant}/cache/cached_config_data.dat`. `applyConfig()` in `model.config.php` reads from THAT file if it exists, and only falls back to DB when the file is missing.

Every SquareMaze-side write (`updateField`, `save`, `deleteField`) always unlinks the cache file so the next read rebuilds from DB. If we write to `configuration` from outside SquareMaze (e.g. via `db.overrideConfig` in ash-twin), we MUST also invalidate the cache — otherwise the DB write is silently a no-op and the site keeps serving the stale value.

**Invalidation paths:**
- **Filesystem access** (cca-local): `fs.unlink('{squaremaze}/includes/tmp/{tenant}/cache/cached_config_data.dat')` — same-machine, trivial.
- **HTTP endpoint** (staging, prod-ish): `admin/index.php?action=clearcache` (requires admin session).

The plugin's registered `handling_payment` column has the same issue — anywhere SquareMaze reads plugin-provided config, the cache file is authoritative until deleted.

## The captcha test-mode bypass

`skipCaptcha=1` in a POST body short-circuits **both** captcha layers (reCAPTCHA and the fallback nospam), but only when `isTestVersion()` returns true server-side:

```php
// basics.php:2727-2731
function validateCaptcha($nospam, $fieldName = null, $bypassNoSpam = false) {
    if($_REQUEST['skipCaptcha'] && isTestVersion()) return true;    // ← the bypass
    $valid = Plugin::call('readValidateCaptcha', $nospam, $fieldName);
    if(!is_null($valid)) return $valid;                              // reCAPTCHA plugin
    if(!$bypassNoSpam) { /* nospam check */ }
    return true;
}
```

`isTestVersion()` = `strpos(INSTALL_VERSION, 'staging') !== false || strpos(INSTALL_VERSION, 'dev') !== false`. The source file has `INSTALL_VERSION = "latest-dev"`, but deploy pipelines can override with a version tag that contains neither string — at which point the bypass is silently ignored server-side even though the request carries it.

**When test 10 (signup) fails on staging with "No user found" and the trace shows `skipCaptcha=1` was sent** — the diagnosis is almost always `INSTALL_VERSION` on the staging deploy missing the `staging`/`dev` marker. Fix on the SquareMaze deploy side (append `-staging` to the version), not on ash-twin's side.

## `handling_payment` ↔ `eph_*.php` filename convention

The `handling` table's `handling_payment` column stores the middle segment of the payment plugin's filename. SquareMaze loads via `plugin::load('eph_' . $this->handling_payment)` at runtime (`model.handling.php:918`):

| DB `handling_payment` | Plugin file |
|---|---|
| `free` | `eph_free.php` |
| `complimentary` | `eph_complimentary.php` |
| `checkoutframes` | `eph_checkoutframes.php` |
| `cybersource_unified` | `eph_cybersource_unified.php` |
| `ngenius` | `eph_ngenius.php` |

Every radio on the checkout preview carries `data-payment-type="{handling_payment}"`, so the DOM ↔ DB ↔ plugin filename are one identity, stable across tenants. Our `payments/{name}.ts` files mirror the same naming.

The `handling_shipment` column follows the same convention with `esm_*.php` shipment plugins.

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
