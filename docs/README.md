# Ash Twin — Documentation

Granular documentation of the framework. Each file covers one concern; read in order or dip into whichever piece you need.

## Reading order

1. [Architecture](./01-architecture.md) — the four layers and how they hand off
2. [Types](./02-types.md) — domain shapes (Event, Category, Ticket, selectors)
3. [Resolver](./03-resolver.md) — how tests pick entities to work with
4. [Page objects](./04-page-objects.md) — UI abstraction, base + tenant overrides
5. [Actors](./05-actors.md) — business orchestration on top of pages
6. [Fixtures](./06-fixtures.md) — how tests receive dependencies
7. [Tenant config](./07-tenant-config.md) — per-tenant JSON schema
8. [SquareMaze DB conventions](./08-squaremaze-conventions.md) — table/column naming rules (read before writing SQL)
9. [Writing tests](./09-writing-tests.md) — the registry, the `test(id, fn)` wrapper, and the folder-based tag convention

## Reference layout

```
ash-twin/
├── actors/           — business orchestrators (WebCustomer, Admin)
├── helpers/          — Resolver, DbClient
├── pages/            — page objects (base + per-tenant)
├── fixtures/         — test dependency wiring
├── tenants/          — per-tenant JSON config
├── types/            — domain type definitions
├── specs/            — the actual tests
└── docs/             — you are here
```
