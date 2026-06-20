# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run start:dev      # Start with watch mode
npm run start:debug    # Start with debugger + watch

# Build & production
npm run build
npm run start:prod     # Run from dist/

# Code quality
npm run lint           # ESLint with auto-fix
npm run format         # Prettier format

# Tests
npm test               # Unit tests
npm run test:watch
npm run test:cov       # With coverage
npm run test:e2e       # e2e tests (config: test/jest-e2e.json)
```

## Architecture

NestJS 11 REST API (TypeScript) backed by PostgreSQL via Prisma ORM with the `PrismaPg` adapter.

### Module structure

Single feature module: `order-photo/` handles all business logic. There is no auth layer.

```
src/
├── main.ts                     # Bootstrap; global ValidationPipe (whitelist, implicit conversion)
├── app.module.ts               # Imports OrderPhotoModule
├── order-photo/
│   ├── order-photo.controller.ts   # REST routes
│   ├── order-photo.service.ts      # Business logic + total recalculation
│   ├── order-photo.module.ts
│   └── dto/                        # class-validator DTOs
├── prisma/
│   └── prisma.service.ts           # PrismaClient with PrismaPg adapter
└── utils/
    ├── caculator-total-price.ts    # Computes totalOrder from items + delivery
    └── full-date.ts                # Formats orderNumber as YYYYMMDD-{seq}
```

### Data model

**OrderPhoto** — the main order record. Key fields:
- `numberOrder`: auto-generated unique identifier (YYYYMMDD-sequential)
- `sourceOrder`: `AVITO | OZON | WB | LOCAL`
- `communicationPlatform`: `AVITO | TELEGRAM | MAX | OZON`
- `deliveryMethod`: `YANDEX_PVZ | OZON_PVZ | PICKUP | OZON_SELLER | WB_SELLER`
- `status`: `NEW | FOLDER_STRUCTURE_CREATED | PRINTED | READY | SENT | PAID` (default: NEW)
- `totalOrder`: recalculated automatically on every item mutation
- `items`: relation to ItemPhoto (CASCADE delete)

**ItemPhoto** — line items within an order:
- `formatPaper`: `SIZE_10X15 | POLAROID | INSTAX`
- `typePaper`: `GLOSS | MATTE`
- `pricePosition`: auto-computed as `price × quantity`

### API routes (prefix: `/order-photo`)

| Method | Path | Action |
|--------|------|--------|
| POST | `/order-photo` | Create order with items |
| GET | `/order-photo` | List orders (pagination, filter by status/sourceOrder) |
| GET | `/order-photo/:idOrder` | Get order with items |
| PATCH | `/order-photo/:idOrder` | Update order fields |
| PATCH | `/order-photo/:idOrder/status` | Update status only |
| DELETE | `/order-photo/:idOrder` | Delete order (cascades items) |
| POST | `/order-photo/:idOrder/items` | Add item to existing order |
| GET | `/order-photo/items/:idItem` | Get item |
| PATCH | `/order-photo/items/:idItem` | Update item |
| DELETE | `/order-photo/items/:idItem` | Delete item |

### Key behaviors

- `totalOrder` and `pricePosition` are always recalculated server-side — never trust client-supplied totals.
- `ValidationPipe` with `whitelist: true` strips unknown fields from all request bodies.
- `enableImplicitConversion: true` coerces query-string primitives to their declared types.
- Prisma `generated/prisma/` is auto-generated — do not edit manually.

## Environment

Required in `.env`:
- `DATABASE_URL` — PostgreSQL connection string (`postgresql://user:pass@host:port/db`)
- `PORT` — server port (defaults to 3000)
