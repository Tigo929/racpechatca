# Graph Report - racpechatca  (2026-07-21)

## Corpus Check
- 188 files · ~68,204 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1515 nodes · 2458 edges · 127 communities (78 shown, 49 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6a128f80`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ReportsPage.tsx
- TasksService
- dependencies
- DtoUpdateUser
- index.ts
- scripts
- task-reminder-rules.ts
- Roles
- TshirtItemsTable.tsx
- order-photo.controller.ts
- System Map
- DtoCreateExpense
- reports.service.ts
- OrdersPage.tsx
- review-reminder.service.ts
- OrderDetail.tsx
- Брендбук — Распечатка PRO
- OrderFinancialIntegrityService
- compilerOptions
- TasksPage.tsx
- compilerOptions
- Аудит проекта «Распечатка» — 2026-06-14
- AppShell.tsx
- dependencies
- sticker.service.ts
- salary-integrity.spec.ts
- CreateOrderForm.tsx
- compilerOptions
- DtoCreateOrder
- partner-api.controller.ts
- app.module.ts
- OrderPhotoService
- TechSpecStorageService
- devDependencies
- UsersPage.tsx
- DtoCreateLead
- App.tsx
- SalaryService
- Интеграция с исполнителем-партнёром (печать футболок)
- PartnerSettingsService
- DtoCreatePaymentByAccruals
- partner.module.ts
- auth.controller.ts
- PrismaService
- partner-settings.service.ts
- DtoCreatePayment
- DtoAllOrdersforQuery
- DtoUpdateOrder
- StockService
- DtoCreateItemOrder
- DtoUpdateItemOrder
- Исправленные проблемы
- crm-new/README.md
- current-user.decorator.ts
- PartnerApiController
- DtoSetStock
- frontend/package.json
- Architecture
- Architecture
- DtoUpdatePartnerSettings
- package.json
- DtoCreateTshirtItem
- DtoUpdateTshirtItem
- exclude
- Аудит финансов, кода и продакшена — 2026-07-09
- devDependencies
- AuthController
- nest-cli.json
- JwtStrategy
- PartnerTokenGuard
- StockController
- seed.js
- .login
- my-balance.spec.ts
- React + TypeScript + Vite
- backup-db.sh
- PrismaModule
- PaymentPrismaHarness
- frontend/tsconfig.json
- @eslint/eslintrc
- @eslint/js
- eslint-plugin-prettier
- globals
- jest
- @nestjs/cli
- @nestjs/schematics
- @nestjs/testing
- prettier
- source-map-support
- supertest
- ts-jest
- ts-loader
- ts-node
- tsconfig-paths
- @types/jest
- @types/multer
- @types/node
- @types/passport-jwt
- @types/pdfkit
- @types/supertest
- typescript
- typescript-eslint
- eslint-plugin-react-refresh
- @eslint/js
- tailwindcss
- typescript-eslint
- vite
- 20260716000000_add_partner_sync/migration.sql
- 20260716120000_add_partner_contract_fields/migration.sql
- 20260718130000_partner_outbound_rework/migration.sql
- 20260719160000_add_status_changed_at/migration.sql
- 20260720170000_add_tasks/migration.sql
- @types/jest
- @types/multer
- @types/passport-jwt
- @types/pdfkit
- typescript

## God Nodes (most connected - your core abstractions)
1. `PrismaService` - 27 edges
2. `Roles()` - 26 edges
3. `OrderPhotoController` - 25 edges
4. `useAuth()` - 24 edges
5. `CurrentUser` - 22 edges
6. `compilerOptions` - 22 edges
7. `DtoCreateOrder` - 21 edges
8. `OrderPhotoService` - 21 edges
9. `getErrorMessage()` - 21 edges
10. `DtoAllOrdersforQuery` - 18 edges

## Surprising Connections (you probably didn't know these)
- `strip()` --indirect_call--> `key()`  [INFERRED]
  crm-new/src/interceptors/strip-prices.interceptor.ts → frontend/src/pages/StockPage.tsx
- `bootstrap()` --indirect_call--> `AppModule`  [INFERRED]
  crm-new/src/main.ts → crm-new/src/app.module.ts
- `ExpensesController` --references--> `Roles()`  [EXTRACTED]
  crm-new/src/expenses/expenses.controller.ts → crm-new/src/auth/decorators/roles.decorator.ts
- `PartnerAdminController` --references--> `Roles()`  [EXTRACTED]
  crm-new/src/partner/partner-admin.controller.ts → crm-new/src/auth/decorators/roles.decorator.ts
- `PartnerSettingsController` --references--> `Roles()`  [EXTRACTED]
  crm-new/src/partner/partner-settings.controller.ts → crm-new/src/auth/decorators/roles.decorator.ts

## Import Cycles
- None detected.

## Communities (127 total, 49 thin omitted)

### Community 0 - "ReportsPage.tsx"
Cohesion: 0.14
Nodes (17): MySalaryBalance, salaryApi, buildReceiptHtml(), escapeHtml(), printReceipt(), money(), MySalaryPage(), orderWord() (+9 more)

### Community 1 - "TasksService"
Cohesion: 0.07
Nodes (29): DtoCreateTask, IsOptional, IsString, IsUUID, MaxLength, MinLength, DtoQueryTasks, IsEnum (+21 more)

### Community 2 - "dependencies"
Cohesion: 0.04
Nodes (47): bcryptjs, bwip-js, class-transformer, class-validator, dependencies, bcryptjs, bwip-js, class-transformer (+39 more)

### Community 3 - "DtoUpdateUser"
Cohesion: 0.07
Nodes (28): DtoCreateUser, IsEnum, IsString, MinLength, DtoUpdateUser, IsBoolean, IsInt, IsOptional (+20 more)

### Community 4 - "index.ts"
Cohesion: 0.11
Nodes (15): api, expensesApi, reportsApi, money(), MONTH_LABELS_FULL, MONTH_LABELS_SHORT, MonthSummary(), PnlRow() (+7 more)

### Community 5 - "scripts"
Cohesion: 0.05
Nodes (36): author, description, jest, collectCoverageFrom, coverageDirectory, moduleFileExtensions, moduleNameMapper, rootDir (+28 more)

### Community 6 - "task-reminder-rules.ts"
Cohesion: 0.12
Nodes (27): buildDigestMessage(), daysUntilDeadline(), deadlineMarker(), DigestGroup, DigestTask, escapeHtml(), formatDeadlineLabel(), isTaskDueForReminder() (+19 more)

### Community 7 - "Roles"
Cohesion: 0.14
Nodes (20): ClosedAccrualBrief, CreateItemDto, CreateTshirtItemDto, EnumAccrualStatus, EnumPartnerSyncStatus, EnumSourceOrder, ItemTshirt, MonthData (+12 more)

### Community 8 - "TshirtItemsTable.tsx"
Cohesion: 0.09
Nodes (23): ordersApi, AdminRoute(), AppRoutes(), CrmGate(), PrivateRoute(), EditState, ItemsTable(), Props (+15 more)

### Community 9 - "order-photo.controller.ts"
Cohesion: 0.15
Nodes (18): formatPhotoItemLine(), generateConfirmationText(), generateReadyText(), isFreeFormPhotoItem(), OrderDetail(), PhotoOrderItem, Props, pvzReminder() (+10 more)

### Community 10 - "System Map"
Cohesion: 0.06
Nodes (30): 2026-07-08, 2026-07-09, 2026-07-11, Access Rules, App Modules, Assignment Rules, Backend API Map, Backend Map (+22 more)

### Community 11 - "DtoCreateExpense"
Cohesion: 0.09
Nodes (20): DtoCreateExpense, IsEnum, IsInt, IsOptional, IsString, Min, ExpensesController, RequestUser (+12 more)

### Community 12 - "reports.service.ts"
Cohesion: 0.11
Nodes (19): ReportsController, Controller, Get, Query, UseGuards, ReportsModule, Module, addExpense() (+11 more)

### Community 13 - "OrdersPage.tsx"
Cohesion: 0.12
Nodes (25): StatusStepper(), DELIVERY_STYLES, DeliveryBadge(), Props, Props, STATUS_STYLES, StatusBadge(), COMMUNICATION_LABELS (+17 more)

### Community 14 - "review-reminder.service.ts"
Cohesion: 0.12
Nodes (14): isReviewReminderEligible(), REVIEW_REMINDER_CATEGORIES, REVIEW_REMINDER_STATUSES, reviewReminderDelayMs(), buildReviewRequestText(), categoryLabel(), escapeHtml(), formatRuDateTime() (+6 more)

### Community 15 - "OrderDetail.tsx"
Cohesion: 0.19
Nodes (10): stockApi, ReportsPage(), COLORS, key(), SIZE_LABELS, SIZES, StockPage(), EnumTshirtSize (+2 more)

### Community 16 - "Брендбук — Распечатка PRO"
Cohesion: 0.08
Nodes (24): 1. Анализ конкурентов, 2. Психология цвета, 3. Цветовая палитра, 4. Типографика, 5. Логотип и иконка, 6. Правила применения, 7. Tone of Voice, 8. Применение на сайте (будущее) (+16 more)

### Community 17 - "OrderFinancialIntegrityService"
Cohesion: 0.17
Nodes (7): OrderItemService, Injectable, calcItemPricePosition(), calcOrderTotal(), PricedItem, Injectable, TshirtItemService

### Community 18 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, allowSyntheticDefaultImports, baseUrl, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, forceConsistentCasingInFileNames (+14 more)

### Community 19 - "TasksPage.tsx"
Cohesion: 0.13
Nodes (19): tasksApi, TasksQuery, FilterChip(), Props, Modal(), Props, daysUntil(), DeadlineChip() (+11 more)

### Community 20 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection, moduleResolution (+14 more)

### Community 21 - "Аудит проекта «Распечатка» — 2026-06-14"
Cohesion: 0.09
Nodes (21): 10.1 Почему PDF «не формировался» и долго генерировался, 10.2 Декомпозиция API-слоя (был god-файл), 10.3 Группировка компонентов, 10.4 Автоматические бэкапы БД (рекомендация №1), 10.5 Итоговая структура фронта, 10.6 Деплой раунда 2, 10. Раунд 2 — PDF, декомпозиция API/компонентов, бэкапы (тот же день), 1. Резюме и метрики (+13 more)

### Community 22 - "AppShell.tsx"
Cohesion: 0.13
Nodes (13): AppShell(), NavProps, Props, ADMIN, ALL, BadgeKey, EXECUTOR, NAV_GROUPS (+5 more)

### Community 23 - "dependencies"
Cohesion: 0.10
Nodes (21): axios, dependencies, axios, @hookform/resolvers, lucide-react, react, react-dom, react-hook-form (+13 more)

### Community 24 - "sticker.service.ts"
Cohesion: 0.16
Nodes (12): buildPhotoItemLines(), drawInstagramIcon(), drawTelegramIcon(), FONT_DIR, formatRub(), PRINT_LOCATION_LABELS, req, SIZE_LABELS (+4 more)

### Community 26 - "CreateOrderForm.tsx"
Cohesion: 0.12
Nodes (18): partnerSettingsApi, baseSchema, CreateOrderForm(), FormValues, freeItemSchema, fullSchema, photoItemSchema, Props (+10 more)

### Community 27 - "compilerOptions"
Cohesion: 0.10
Nodes (20): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+12 more)

### Community 28 - "DtoCreateOrder"
Cohesion: 0.13
Nodes (15): DtoCreateOrder, IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString (+7 more)

### Community 29 - "partner-api.controller.ts"
Cohesion: 0.16
Nodes (15): DtoPartnerStatus, IsString, Body, Patch, buildPartnerOrderPayload(), PartnerOrderForPayload, PartnerOrderPayload, PRINT_LOCATION_LABELS (+7 more)

### Community 30 - "app.module.ts"
Cohesion: 0.18
Nodes (11): AppModule, Module, bootstrap(), OrderPhotoModule, Module, PartnerModule, Module, SalaryModule (+3 more)

### Community 31 - "OrderPhotoService"
Cohesion: 0.09
Nodes (18): AuthenticatedRequest, AuthenticatedUser, CurrentUser, Roles(), RolesGuard, Injectable, OrderPhotoController, Body (+10 more)

### Community 32 - "TechSpecStorageService"
Cohesion: 0.14
Nodes (11): PartnerAdminController, Controller, Get, Param, Post, Res, UseGuards, UseInterceptors (+3 more)

### Community 33 - "devDependencies"
Cohesion: 0.11
Nodes (19): eslint-plugin-react-hooks, devDependencies, eslint, eslint-plugin-react-hooks, globals, @tailwindcss/vite, @types/node, @types/react (+11 more)

### Community 34 - "UsersPage.tsx"
Cohesion: 0.16
Nodes (17): usersApi, AssignPanel(), AddExpenseModal(), bpToPercent(), loadBadgeColor(), percentToBp(), RateEditor(), RateEditorProps (+9 more)

### Community 35 - "DtoCreateLead"
Cohesion: 0.13
Nodes (13): DtoCreateLead, IsEnum, IsOptional, IsString, MaxLength, MinLength, LeadController, Body (+5 more)

### Community 36 - "App.tsx"
Cohesion: 0.39
Nodes (5): authApi, AuthContext, AuthContextValue, AuthUser, LoginResponse

### Community 37 - "SalaryService"
Cohesion: 0.17
Nodes (7): SalaryController, Controller, Get, Param, UseGuards, SalaryService, Injectable

### Community 38 - "Интеграция с исполнителем-партнёром (печать футболок)"
Cohesion: 0.12
Nodes (15): 1. Модель взаимодействия, 2. Аутентификация, 3. Webhook, который мы отправляем партнёру, 4.1 Данные заказа, 4.2 ТЗ-фото (макет), 4.3 Стикер (PDF, 58×40 мм), 4.4 Смена статуса заказа (партнёр → нам), 4. Эндпоинты, откуда партнёр забирает данные (pull) (+7 more)

### Community 39 - "PartnerSettingsService"
Cohesion: 0.17
Nodes (8): PartnerSettingsController, Body, Controller, Get, Patch, UseGuards, PartnerSettingsService, Injectable

### Community 40 - "DtoCreatePaymentByAccruals"
Cohesion: 0.24
Nodes (7): ArrayMinSize, DtoCreatePaymentByAccruals, IsArray, IsOptional, IsString, IsUUID, RequestUser

### Community 41 - "partner.module.ts"
Cohesion: 0.21
Nodes (6): PartnerOutboundService, Injectable, PartnerSettingsModule, Module, ALLOWED, EXT_CONTENT_TYPE

### Community 42 - "auth.controller.ts"
Cohesion: 0.05
Nodes (31): AuthController, Body, Controller, Get, Post, UseGuards, AuthModule, Module (+23 more)

### Community 43 - "PrismaService"
Cohesion: 0.13
Nodes (10): prisma, HealthController, Controller, Get, PrismaModule, Module, PrismaService, Injectable (+2 more)

### Community 44 - "partner-settings.service.ts"
Cohesion: 0.28
Nodes (10): Db, TshirtItemForSettlement, UpdatePartnerSettingsDto, OrderSettlement, positionMaterials(), PositionSettlement, SettlementPosition, settleOrder() (+2 more)

### Community 45 - "DtoCreatePayment"
Cohesion: 0.20
Nodes (9): DtoCreatePayment, IsInt, IsOptional, IsString, IsUUID, Min, Type, Body (+1 more)

### Community 46 - "DtoAllOrdersforQuery"
Cohesion: 0.08
Nodes (26): DtoAllOrdersforQuery, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength (+18 more)

### Community 47 - "DtoUpdateOrder"
Cohesion: 0.17
Nodes (11): DtoUpdateOrder, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Matches, MaxLength (+3 more)

### Community 48 - "StockService"
Cohesion: 0.05
Nodes (34): calculateSalarySnapshot(), SalarySnapshot, AccrualByIdRow, AsyncMock, createOrderService(), CreatePaymentArgs, createPrismaStub(), HarnessAccrual (+26 more)

### Community 49 - "DtoCreateItemOrder"
Cohesion: 0.18
Nodes (11): DtoCreateItemOrder, IsBoolean, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min (+3 more)

### Community 50 - "DtoUpdateItemOrder"
Cohesion: 0.10
Nodes (16): DtoUpdateItemOrder, IsBoolean, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min (+8 more)

### Community 51 - "Исправленные проблемы"
Cohesion: 0.18
Nodes (10): CRITICAL, CRM Audit Report — 2026-06-14, HIGH, HIGH, LOW, MEDIUM, MEDIUM, Исправленные проблемы (+2 more)

### Community 52 - "crm-new/README.md"
Cohesion: 0.20
Nodes (9): Compile and run the project, Deployment, Description, License, Project setup, Resources, Run tests, Stay in touch (+1 more)

### Community 53 - "current-user.decorator.ts"
Cohesion: 0.44
Nodes (8): "OrderAssignment", "OrderPhoto", "PaymentAccrualLink", "SalaryAccrual", "SalaryPayment", "StatusHistory", "User", "UserRateHistory"

### Community 54 - "PartnerApiController"
Cohesion: 0.31
Nodes (6): PartnerApiController, Controller, Get, Param, Res, UseGuards

### Community 56 - "frontend/package.json"
Cohesion: 0.20
Nodes (9): name, private, scripts, build, dev, lint, preview, type (+1 more)

### Community 57 - "Architecture"
Cohesion: 0.22
Nodes (7): API routes (prefix: `/order-photo`), Architecture, Commands, Data model, Environment, Key behaviors, Module structure

### Community 58 - "Architecture"
Cohesion: 0.20
Nodes (8): API routes (prefix: `/order-photo`), Architecture, Commands, Data model, Environment, Key behaviors, Module structure, Граф знаний (graphify)

### Community 59 - "DtoUpdatePartnerSettings"
Cohesion: 0.25
Nodes (7): DtoUpdatePartnerSettings, IsInt, IsOptional, IsString, Max, MaxLength, Min

### Community 60 - "package.json"
Cohesion: 0.25
Nodes (7): concurrently, devDependencies, concurrently, name, private, scripts, dev

### Community 61 - "DtoCreateTshirtItem"
Cohesion: 0.10
Nodes (21): DtoCreateTshirtItem, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min, Type (+13 more)

### Community 62 - "DtoUpdateTshirtItem"
Cohesion: 0.47
Nodes (4): PRICE_FIELDS, strip(), StripPricesInterceptor, Injectable

### Community 63 - "exclude"
Cohesion: 0.25
Nodes (7): exclude, extends, dist, node_modules, **/*spec.ts, test, ./tsconfig.json

### Community 64 - "Аудит финансов, кода и продакшена — 2026-07-09"
Cohesion: 0.29
Nodes (6): Аудит финансов, кода и продакшена — 2026-07-09, Кодовый аудит, Короткий вывод, Продакшен-аудит, Следующие улучшения, Финансовый аудит

### Community 65 - "devDependencies"
Cohesion: 0.29
Nodes (7): devDependencies, eslint, eslint-config-prettier, @types/express, eslint, eslint-config-prettier, @types/express

### Community 66 - "AuthController"
Cohesion: 0.50
Nodes (3): "ExpenseOrder", "ItemTshirt", "PartnerSettings"

### Community 67 - "nest-cli.json"
Cohesion: 0.33
Nodes (5): collection, compilerOptions, deleteOutDir, $schema, sourceRoot

### Community 71 - "seed.js"
Cohesion: 0.50
Nodes (4): bcrypt, { Client }, main(), { randomUUID }

### Community 74 - "React + TypeScript + Vite"
Cohesion: 0.50
Nodes (3): Expanding the ESLint configuration, React Compiler, React + TypeScript + Vite

## Knowledge Gaps
- **435 isolated node(s):** `$schema`, `collection`, `sourceRoot`, `deleteOutDir`, `name` (+430 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **49 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `EnumStatus` connect `OrdersPage.tsx` to `DtoAllOrdersforQuery`, `Roles`?**
  _High betweenness centrality (0.186) - this node is a cross-community bridge._
- **Why does `PrismaService` connect `PrismaService` to `TasksService`, `DtoCreateLead`, `DtoUpdateUser`, `DtoCreatePayment`, `DtoAllOrdersforQuery`, `OrderFinancialIntegrityService`, `partner-api.controller.ts`, `OrderPhotoService`?**
  _High betweenness centrality (0.180) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `devDependencies` to `scripts`, `salary-integrity.spec.ts`, `PrismaService`, `DtoSetStock`, `JwtStrategy`, `PrismaModule`, `PaymentPrismaHarness`, `@eslint/js`, `jest`, `@nestjs/cli`, `@nestjs/schematics`, `@nestjs/testing`, `prettier`, `supertest`, `ts-jest`, `ts-node`, `tsconfig-paths`, `@types/node`, `@types/supertest`, `typescript-eslint`, `@types/jest`, `@types/multer`, `@types/passport-jwt`, `@types/pdfkit`, `typescript`?**
  _High betweenness centrality (0.130) - this node is a cross-community bridge._
- **What connects `$schema`, `collection`, `sourceRoot` to the rest of the system?**
  _435 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ReportsPage.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.14333333333333334 - nodes in this community are weakly interconnected._
- **Should `TasksService` be split into smaller, more focused modules?**
  _Cohesion score 0.07013574660633484 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.0425531914893617 - nodes in this community are weakly interconnected._