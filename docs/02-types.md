# 02 — Types

The `types/` folder holds SquareMaze **domain shapes** — the vocabulary tests speak.

## What lives here

| File | Contains | Purpose |
|---|---|---|
| `event.ts` | `Event`, `EventCriteria` | An event and how to filter for one |
| `category.ts` | `Category`, `CategoryCriteria`, `CategoryNumbering`, `CategoryMode`, `CategoryPubStatus` | A category (ticket tier) and how to filter |
| `ticket.ts` | `Ticket` | A purchased ticket returned from checkout |
| `seat.ts` | `SeatRef` | A seated-category seat reference |
| `tenant.ts` | `TenantConfig`, `TenantDb`, `TenantUsers`, `UserCreds` | Runtime tenant configuration |
| `selectors.ts` | `EventSelector`, `CategorySelector` | Union types for "how to pick" an entity |

## Three shapes per entity — different concerns

For events (same rule applies to categories):

| Interface | Represents | Example |
|---|---|---|
| **`Event`** | The row you get BACK from the DB | `{ id: 42, title: 'Coldplay', status: 'published' }` |
| **`EventCriteria`** | Filters you PASS IN to search | `{ hasCategory: { soldout: false } }` |
| **`EventSelector`** | Union of all shapes accepted by `resolver.event()` | `number \| string \| Event \| EventCriteria` |

Never mix them. Domain shape = what a category has. Criteria shape = how to find one. Selector union = the callable API.

## What DOESN'T live in `types/`

Framework-internal wiring:
- `WebPages` interface → `pages/web/types.ts` (only pages + factory use it)
- Method input types on actors → colocated with the actor

Rule: if a spec file might import it, it belongs in `types/`. If only one subsystem uses it internally, keep it local.

## Growth pattern

Adding a new entity (Discount, Voucher, etc.) means adding one file with the same three-part shape:

```
types/discount.ts
├── Discount            (domain shape)
├── DiscountCriteria    (filter shape)
└── (any related enums like DiscountType)
```

Add the selector union to `types/selectors.ts`. Done.
