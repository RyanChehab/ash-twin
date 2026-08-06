# 01 — Architecture

Four layers, each with one job. Higher layers use lower ones; lower layers never know about higher ones.

```
┌──────────────────────────────────────────────┐
│  Spec (test file)                            │  Business intent
│  await customer.buyTicket(event, cat, 1)    │
└─────────────────┬────────────────────────────┘
                  │
┌─────────────────▼────────────────────────────┐
│  Actor (WebCustomer, Admin)                  │  Composes pages
│  Small verbs: openEvent, addToCart           │  into flows
└─────────────────┬────────────────────────────┘
                  │
┌─────────────────▼────────────────────────────┐
│  Page object (LandingPage, EventPage, ...)   │  UI mechanics:
│  Selectors + atomic clicks + fills           │  find, click, fill
└─────────────────┬────────────────────────────┘
                  │
┌─────────────────▼────────────────────────────┐
│  Playwright API + DbClient + Resolver        │  Framework primitives
└──────────────────────────────────────────────┘
```

## Responsibilities

| Layer | Owns | Doesn't own |
|---|---|---|
| **Spec** | Assertions + business narrative | Any UI or DB logic |
| **Actor** | Composing multi-page flows | Selectors or SQL |
| **Page object** | Selectors + atomic UI actions | Business flows or DB |
| **Playwright / DbClient / Resolver** | Framework primitives | Domain logic |

## Data flow — a typical test

```
1. Test asks: { customer, resolver }
2. Fixtures construct dependencies (tenant → db → resolver → actors)
3. Test calls resolver.event({...}) → SQL against tenant DB → Event object
4. Test calls customer.buyTicket(event, ...) → actor composes page calls
5. Page objects click / fill in the real browser
6. Test asserts on returned Ticket or DB state
```

## The seam that hides tenant differences

Actors ask the **factory** (`pages/web/factory.ts`) for a `WebPages` bundle at construction time. The factory returns default-theme (cca) pages by default; when a tenant differs (adrea/blublood use capetown theme, antoine/virgin use Next.js), the factory returns overridden page objects. **Actor and spec code never branch on tenant**.
