# 08 — SquareMaze DB conventions

Naming rules to follow when writing SQL against the SquareMaze DB. Learned the hard way after early SQL used the wrong assumptions.

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

## Enum values may be short-form

Some enum columns store abbreviated values rather than the English word:
- `event.event_status` may store `'pub'` / `'unp'` / `'pau'` (not `'published'` / etc.)
- Verify against the model's constants (`Model::STATUS_PUBLISHED`) before assuming.

Always check `includes/models/model.<name>.php` for the exact stored value.

## Where to find the truth

- **Table columns**: `includes/models/model.<entity>.php` → the `$_columns` array
- **Column value constants**: same file, class constants like `EVENT_STATUS_PUBLISHED`
- **Schema definitions**: `includes/install/data_db.php` (canonical DDL)

## The rule when writing new SQL in ash-twin

Before adding any query:

1. Verify the table name is singular
2. Verify every column has the table prefix
3. Check the model file for enum/status values
4. When in doubt, dispatch an Explore agent to read the model file

## Why aliases in SELECT stay simple

The alias is what our TS code reads — matches the domain interface's field names:

```sql
SELECT
  e.event_id     AS id,          -- alias to interface field
  e.event_name   AS title,
  e.event_status AS status
FROM event e
```

TS side sees `event.id`, `event.title`, `event.status` — domain-friendly names. SQL side speaks SquareMaze's actual columns. The alias is the seam.
