# 02 — Types

The `types/` folder holds SquareMaze **domain shapes** — the vocabulary tests speak.

## What lives here

| File | Contains | Purpose |
|---|---|---|
| `event.ts` | `Event`, `EventCriteria`, `EventRep`, `EventModel` | An event and how to filter for one |
| `category.ts` | `Category`, `CategoryCriteria`, `CategoryNumbering`, `CategoryMode`, `CategoryPubStatus` | A category (ticket tier) and how to filter |
| `addon.ts` | `Addon`, `AddonCriteria`, `AddonLink` | An addon row (event with `event_addon=1`) and its many-to-many link |
| `ticket.ts` | `Ticket` | A purchased ticket returned from checkout |
| `seat.ts` | `SeatRef` | A seated-category seat reference |
| `user.ts` | `RegisterData`, `LoginCreds` | Auth form inputs |
| `tenant.ts` | `TenantConfig`, `TenantDb`, `TenantUsers`, `UserCreds` | Runtime tenant configuration |
| `payment.ts` | `TestCard`, `PaymentContext`, `PaymentStrategy` | Payment strategy contract (see [10-payments.md](./10-payments.md)) |
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
- `RenderedHandling` → `pages/web/cca/checkout.ts` (only the checkout page produces it)
- `CheckoutUserInfo` → `pages/web/cca/checkout.ts` (only the checkout page consumes it)
- Method input types on actors → colocated with the actor

Rule: if a spec file might import it, it belongs in `types/`. If only one subsystem uses it internally, keep it local.

**One border-case worth calling out:** `payment.ts` mixes domain data (`TestCard`) and framework contracts (`PaymentStrategy`, `PaymentContext` — depend on Playwright's `Locator`/`Page`). We keep them in one file because they always ship together, and moving contracts to `payments/types.ts` while data lives in `types/payment.ts` is over-split for the payoff.

## Growth pattern

Adding a new entity (Discount, Voucher, etc.) means adding one file with the same three-part shape:

```
types/discount.ts
├── Discount            (domain shape)
├── DiscountCriteria    (filter shape)
└── (any related enums like DiscountType)
```

Add the selector union to `types/selectors.ts`. Done.
