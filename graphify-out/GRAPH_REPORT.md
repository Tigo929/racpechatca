# Graph Report - raspechatka  (2026-08-11)

## Corpus Check
- 257 files · ~103,168 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1972 nodes · 3773 edges · 140 communities (89 shown, 51 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 111 edges (avg confidence: 0.79)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b52c83ea`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ReportsPage.tsx
- TasksService
- dependencies
- users.controller.ts
- telegram.module.ts
- jest
- tshirt-partner-telegram.service.ts
- index.ts
- OrdersPage.tsx
- Roles
- System Map
- expenses.controller.ts
- reports.service.ts
- OrderDetail.tsx
- daily-plan-rules.ts
- AvitoService
- Брендбук — Распечатка PRO
- OrderFinancialIntegrityService
- compilerOptions
- TasksPage.tsx
- compilerOptions
- Аудит проекта «Распечатка» — 2026-06-14
- AppShell.tsx
- dependencies
- sticker.service.ts
- App.tsx
- tasks.controller.ts
- compilerOptions
- DtoCreateOrder
- partner-api.controller.ts
- app.module.ts
- review-reminder.service.ts
- PartnerAdminController
- devDependencies
- SettingsPage.tsx
- DtoCreateLead
- telegram-update.service.ts
- salary.controller.ts
- Интеграция с исполнителем-партнёром (печать футболок)
- DtoUpdatePartnerSettings
- CRM «Распечатка» — как всё устроено
- partner-admin.controller.ts
- auth.controller.ts
- OrderPhotoService
- partner-settings.service.ts
- lead.controller.ts
- DtoAllOrdersforQuery
- order-photo.service.ts
- salary-integrity.spec.ts
- AvitoController
- DtoUpdateItemOrder
- Исправленные проблемы
- crm-new/README.md
- TelegramService
- PartnerApiController
- scripts
- frontend/package.json
- Architecture
- Architecture
- order-photo.module.ts
- package.json
- order-photo.controller.ts
- current-user.decorator.ts
- exclude
- Аудит финансов, кода и продакшена — 2026-07-09
- devDependencies
- AvitoPage.tsx
- nest-cli.json
- globals
- PartnerTokenGuard
- GulianService
- seed.js
- DtoUpdateOrder
- scenario.controller.ts
- React + TypeScript + Vite
- backup-db.sh
- source-map-support
- ts-loader
- frontend/tsconfig.json
- ReportsController
- @eslint/js
- partner-telegram-format.ts
- .createOrder
- TechSpecStorageService
- @nestjs/cli
- @nestjs/schematics
- @nestjs/testing
- prettier
- PartnerSettingsService
- supertest
- ts-jest
- PartnerSettingsService
- ts-node
- tsconfig-paths
- TelegramPollingService
- .webhook
- @types/node
- crm-new/package.json
- GulianOutboxProcessorService
- @types/supertest
- lead-pricing.ts
- typescript-eslint
- .constructor
- eslint-plugin-react-refresh
- @eslint/js
- tailwindcss
- typescript-eslint
- vite
- DtoSetShipmentLead
- bwip-js
- class-validator
- @nestjs/core
- @nestjs/jwt
- @nestjs/mapped-types
- @nestjs/throttler
- passport
- pdf-lib
- pg
- @types/jest
- @types/multer
- @types/passport-jwt
- @types/pdfkit
- typescript
- @prisma/adapter-pg
- @prisma/client
- reflect-metadata
- CurrentUser
- PrismaService
- roboto-fontface
- eslint
- DtoCreateItemOrder
- roles.guard.ts
- eslint-config-prettier
- order-financial-integrity.service.ts
- prisma
- @eslint/eslintrc

## God Nodes (most connected - your core abstractions)
1. `PrismaService` - 69 edges
2. `Roles()` - 53 edges
3. `CurrentUser` - 33 edges
4. `OrderPhotoController` - 30 edges
5. `TelegramService` - 27 edges
6. `getErrorMessage()` - 26 edges
7. `useAuth()` - 25 edges
8. `AvitoService` - 23 edges
9. `OrderPhotoService` - 23 edges
10. `PartnerSettingsService` - 23 edges

## Surprising Connections (you probably didn't know these)
- `BonusForm()` --calls--> `getErrorMessage()`  [EXTRACTED]
  frontend/src/pages/SalaryPage.tsx → frontend/src/utils/get-error-message.ts
- `AvitoController` --references--> `Roles()`  [EXTRACTED]
  crm-new/src/avito/avito.controller.ts → crm-new/src/auth/decorators/roles.decorator.ts
- `ExpensesController` --references--> `Roles()`  [EXTRACTED]
  crm-new/src/expenses/expenses.controller.ts → crm-new/src/auth/decorators/roles.decorator.ts
- `PartnerAdminController` --references--> `Roles()`  [EXTRACTED]
  crm-new/src/partner/partner-admin.controller.ts → crm-new/src/auth/decorators/roles.decorator.ts
- `PartnerSettingsController` --references--> `Roles()`  [EXTRACTED]
  crm-new/src/partner/partner-settings.controller.ts → crm-new/src/auth/decorators/roles.decorator.ts

## Import Cycles
- None detected.

## Communities (140 total, 51 thin omitted)

### Community 0 - "ReportsPage.tsx"
Cohesion: 0.07
Nodes (43): expensesApi, MySalaryBalance, salaryApi, MySalaryPage, ReportsPage, SalaryPage, buildReceiptHtml(), buildReceiptTitle() (+35 more)

### Community 1 - "TasksService"
Cohesion: 0.11
Nodes (12): TasksController, Body, Controller, Delete, Get, Param, Patch, Post (+4 more)

### Community 2 - "dependencies"
Cohesion: 0.09
Nodes (23): bcryptjs, class-transformer, dependencies, bcryptjs, class-transformer, @nestjs/common, @nestjs/config, @nestjs/passport (+15 more)

### Community 3 - "users.controller.ts"
Cohesion: 0.07
Nodes (29): DtoCreateUser, IsEnum, IsString, MinLength, DtoUpdateUser, IsBoolean, IsInt, IsOptional (+21 more)

### Community 4 - "telegram.module.ts"
Cohesion: 0.14
Nodes (10): TelegramModule, Module, TelegramStickerController, Controller, Get, Param, Query, Res (+2 more)

### Community 5 - "jest"
Cohesion: 0.12
Nodes (16): jest, collectCoverageFrom, coverageDirectory, moduleFileExtensions, moduleNameMapper, rootDir, testEnvironment, testRegex (+8 more)

### Community 6 - "tshirt-partner-telegram.service.ts"
Cohesion: 0.15
Nodes (10): buildPartnerButtons(), escapeHtml(), EXT_CONTENT_TYPE, money(), PRINT_LOCATION_LABELS, PRINT_TYPE_LABELS, TechSpecAttachment, Injectable (+2 more)

### Community 7 - "index.ts"
Cohesion: 0.12
Nodes (23): AvitoLinkedOrder, ClosedAccrualBrief, CreateItemDto, CreateTshirtItemDto, EnumAccrualKind, EnumAccrualStatus, EnumAvitoMessageDirection, EnumPartnerSyncStatus (+15 more)

### Community 8 - "OrdersPage.tsx"
Cohesion: 0.06
Nodes (51): ordersApi, baseSchema, CreateOrderForm(), FormValues, freeItemSchema, fullSchema, isRussianPhone(), photoItemSchema (+43 more)

### Community 9 - "Roles"
Cohesion: 0.21
Nodes (10): Roles(), OrderPhotoController, Body, Controller, Delete, Param, Patch, Post (+2 more)

### Community 10 - "System Map"
Cohesion: 0.06
Nodes (30): 2026-07-08, 2026-07-09, 2026-07-11, Access Rules, App Modules, Assignment Rules, Backend API Map, Backend Map (+22 more)

### Community 11 - "expenses.controller.ts"
Cohesion: 0.09
Nodes (19): DtoCreateExpense, IsEnum, IsInt, IsOptional, IsString, Min, ExpensesController, RequestUser (+11 more)

### Community 12 - "reports.service.ts"
Cohesion: 0.22
Nodes (12): addExpense(), addOrder(), emptyBucket(), ExpenseRow, finalize(), MONTH_LABELS, OrderRow, PnlRaw (+4 more)

### Community 13 - "OrderDetail.tsx"
Cohesion: 0.08
Nodes (32): DispatchToExecutorModal(), PayoutInfo, Props, rub(), GulianSyncBlock(), Props, STATUS_LABELS, formatPhotoItemLine() (+24 more)

### Community 14 - "daily-plan-rules.ts"
Cohesion: 0.05
Nodes (66): buildDailyPlanMessage(), buildShipmentBlock(), dayMonth(), DELIVERY_LABEL, effectiveDeadline(), executorKey(), inWorkTail(), isWithinPlanWindow() (+58 more)

### Community 15 - "AvitoService"
Cohesion: 0.06
Nodes (29): AvitoMessengerService, Injectable, AvitoModule, Module, AvitoAccount, AvitoChat, AvitoChatUser, AvitoMessage (+21 more)

### Community 16 - "Брендбук — Распечатка PRO"
Cohesion: 0.08
Nodes (24): 1. Анализ конкурентов, 2. Психология цвета, 3. Цветовая палитра, 4. Типографика, 5. Логотип и иконка, 6. Правила применения, 7. Tone of Voice, 8. Применение на сайте (будущее) (+16 more)

### Community 17 - "OrderFinancialIntegrityService"
Cohesion: 0.15
Nodes (9): OrderFinancialIntegrityService, Injectable, OrderItemService, Injectable, calcItemPricePosition(), calcOrderTotal(), PricedItem, Injectable (+1 more)

### Community 18 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, allowSyntheticDefaultImports, baseUrl, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, forceConsistentCasingInFileNames (+14 more)

### Community 19 - "TasksPage.tsx"
Cohesion: 0.11
Nodes (21): tasksApi, TasksQuery, usersApi, TasksPage, FilterChip(), Props, Modal(), Props (+13 more)

### Community 20 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection, moduleResolution (+14 more)

### Community 21 - "Аудит проекта «Распечатка» — 2026-06-14"
Cohesion: 0.09
Nodes (21): 10.1 Почему PDF «не формировался» и долго генерировался, 10.2 Декомпозиция API-слоя (был god-файл), 10.3 Группировка компонентов, 10.4 Автоматические бэкапы БД (рекомендация №1), 10.5 Итоговая структура фронта, 10.6 Деплой раунда 2, 10. Раунд 2 — PDF, декомпозиция API/компонентов, бэкапы (тот же день), 1. Резюме и метрики (+13 more)

### Community 22 - "AppShell.tsx"
Cohesion: 0.12
Nodes (15): AppShell(), NavProps, Props, AD_MGR, ADMIN, ALL, BadgeKey, MOBILE_BAR_LIMIT (+7 more)

### Community 23 - "dependencies"
Cohesion: 0.10
Nodes (21): axios, dependencies, axios, @hookform/resolvers, lucide-react, react, react-dom, react-hook-form (+13 more)

### Community 24 - "sticker.service.ts"
Cohesion: 0.16
Nodes (13): buildPhotoItemLines(), buildTshirtItemLines(), drawInstagramIcon(), drawTelegramIcon(), FONT_DIR, formatRub(), PRINT_LOCATION_LABELS, req (+5 more)

### Community 25 - "App.tsx"
Cohesion: 0.12
Nodes (19): authApi, AdminRoute(), App(), AppRoutes(), CrmGate(), LoginPage, OrdersPage, OrderStaffRoute() (+11 more)

### Community 26 - "tasks.controller.ts"
Cohesion: 0.12
Nodes (20): DtoCreateTask, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength (+12 more)

### Community 27 - "compilerOptions"
Cohesion: 0.10
Nodes (20): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+12 more)

### Community 28 - "DtoCreateOrder"
Cohesion: 0.13
Nodes (15): DtoCreateOrder, IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString (+7 more)

### Community 29 - "partner-api.controller.ts"
Cohesion: 0.13
Nodes (13): DtoPartnerStatus, IsString, FLOW_RANK, FROM_PARTNER, fromPartnerStatus(), mapPartnerStage(), PARTNER_SETTABLE_STATUSES, PARTNER_STAGE_MAP (+5 more)

### Community 30 - "app.module.ts"
Cohesion: 0.12
Nodes (15): AppModule, Module, ExpensesModule, Module, PrismaModule, Module, ReportsModule, Module (+7 more)

### Community 31 - "review-reminder.service.ts"
Cohesion: 0.17
Nodes (12): isReviewReminderEligible(), REVIEW_REMINDER_CATEGORIES, REVIEW_REMINDER_DELAY_MS, REVIEW_REMINDER_PICKUP_DELAY_MS, REVIEW_REMINDER_STATUSES, reviewReminderDelayMs(), buildReviewRequestText(), categoryLabel() (+4 more)

### Community 32 - "PartnerAdminController"
Cohesion: 0.21
Nodes (9): PartnerAdminController, Controller, Get, Param, Post, Res, UseGuards, UseInterceptors (+1 more)

### Community 33 - "devDependencies"
Cohesion: 0.11
Nodes (19): eslint-plugin-react-hooks, devDependencies, eslint, eslint-plugin-react-hooks, globals, @tailwindcss/vite, @types/node, @types/react (+11 more)

### Community 34 - "SettingsPage.tsx"
Cohesion: 0.08
Nodes (36): api, partnerSettingsApi, reportsApi, shipmentLeadApi, SettingsPage, UsersPage, AssignPanel(), AddExpenseModal() (+28 more)

### Community 35 - "DtoCreateLead"
Cohesion: 0.10
Nodes (17): DtoCreateLead, IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, Max (+9 more)

### Community 36 - "telegram-update.service.ts"
Cohesion: 0.15
Nodes (10): GulianOutboxService, OrderForOutbox, Injectable, calcGulianPayout(), Item, PayoutResult, toGulianStatus(), ACTION_STATUS (+2 more)

### Community 37 - "salary.controller.ts"
Cohesion: 0.06
Nodes (34): ArrayMinSize, DtoCreateBonus, IsInt, IsString, IsUUID, MaxLength, Min, MinLength (+26 more)

### Community 38 - "Интеграция с исполнителем-партнёром (печать футболок)"
Cohesion: 0.12
Nodes (15): 1. Модель взаимодействия, 2. Аутентификация, 3. Webhook, который мы отправляем партнёру, 4.1 Данные заказа, 4.2 ТЗ-фото (макет), 4.3 Стикер (PDF, 58×40 мм), 4.4 Смена статуса заказа (партнёр → нам), 4. Эндпоинты, откуда партнёр забирает данные (pull) (+7 more)

### Community 39 - "DtoUpdatePartnerSettings"
Cohesion: 0.12
Nodes (13): DtoUpdatePartnerSettings, IsInt, IsOptional, IsString, Max, MaxLength, Min, PartnerSettingsController (+5 more)

### Community 40 - "CRM «Распечатка» — как всё устроено"
Cohesion: 0.11
Nodes (18): 10. Слабые места, 11. Что дальше, 1. Что это, 2. Из чего собрано, 3. Продукты и статусы, 4. Деньги, 5. Роли, 6. Сценарии оформления (+10 more)

### Community 41 - "partner-admin.controller.ts"
Cohesion: 0.18
Nodes (10): PartnerOutboundService, Injectable, getTechSpecPathAt(), getTechSpecPaths(), hasTechSpecFiles(), TechSpecPathSource, ALLOWED, EXT_CONTENT_TYPE (+2 more)

### Community 42 - "auth.controller.ts"
Cohesion: 0.14
Nodes (13): AuthController, Body, Controller, Get, Post, UseGuards, AuthModule, Module (+5 more)

### Community 44 - "partner-settings.service.ts"
Cohesion: 0.13
Nodes (20): buildPartnerOrderPayload(), PartnerOrderForPayload, PartnerOrderPayload, PRINT_LOCATION_LABELS, PRINT_TYPE_LABELS, Db, TshirtItemForSettlement, UpdatePartnerSettingsDto (+12 more)

### Community 45 - "lead.controller.ts"
Cohesion: 0.17
Nodes (12): LeadController, Controller, UseGuards, constantTimeEqual(), readBearerToken(), readHeader(), SignedRequest, SiteLeadTokenGuard (+4 more)

### Community 46 - "DtoAllOrdersforQuery"
Cohesion: 0.17
Nodes (11): DtoAllOrdersforQuery, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength (+3 more)

### Community 47 - "order-photo.service.ts"
Cohesion: 0.13
Nodes (14): DtoAssignExecutor, IsOptional, IsString, IsUUID, CLOSED_STATUSES, CONTROL_CLOSED_STATUSES, DEFAULT_LIST_HIDDEN_STATUSES, escapeHtml() (+6 more)

### Community 48 - "salary-integrity.spec.ts"
Cohesion: 0.13
Nodes (12): AccrualByIdRow, AsyncMock, createOrderService(), CreatePaymentArgs, createPrismaStub(), HarnessAccrual, makeOrder(), PaymentByAccrualsHarness (+4 more)

### Community 49 - "AvitoController"
Cohesion: 0.18
Nodes (8): AvitoController, Body, Controller, Get, Param, Post, Query, UseGuards

### Community 50 - "DtoUpdateItemOrder"
Cohesion: 0.17
Nodes (11): DtoUpdateItemOrder, IsBoolean, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min (+3 more)

### Community 51 - "Исправленные проблемы"
Cohesion: 0.18
Nodes (10): CRITICAL, CRM Audit Report — 2026-06-14, HIGH, HIGH, LOW, MEDIUM, MEDIUM, Исправленные проблемы (+2 more)

### Community 52 - "crm-new/README.md"
Cohesion: 0.20
Nodes (9): Compile and run the project, Deployment, Description, License, Project setup, Resources, Run tests, Stay in touch (+1 more)

### Community 53 - "TelegramService"
Cohesion: 0.18
Nodes (4): TelegramService, Injectable, TelegramUpdateService, Injectable

### Community 54 - "PartnerApiController"
Cohesion: 0.26
Nodes (8): PartnerApiController, Body, Controller, Get, Param, Patch, Res, UseGuards

### Community 55 - "scripts"
Cohesion: 0.14
Nodes (14): scripts, build, db:push:dev, format, lint, start, start:debug, start:dev (+6 more)

### Community 56 - "frontend/package.json"
Cohesion: 0.20
Nodes (9): name, private, scripts, build, dev, lint, preview, type (+1 more)

### Community 57 - "Architecture"
Cohesion: 0.22
Nodes (7): API routes (prefix: `/order-photo`), Architecture, Commands, Data model, Environment, Key behaviors, Module structure

### Community 58 - "Architecture"
Cohesion: 0.20
Nodes (8): API routes (prefix: `/order-photo`), Architecture, Commands, Data model, Environment, Key behaviors, Module structure, Граф знаний (graphify)

### Community 59 - "order-photo.module.ts"
Cohesion: 0.20
Nodes (10): GulianModule, Module, OrderPhotoModule, Module, StickerModule, Module, PartnerModule, Module (+2 more)

### Community 60 - "package.json"
Cohesion: 0.25
Nodes (7): concurrently, devDependencies, concurrently, name, private, scripts, dev

### Community 61 - "order-photo.controller.ts"
Cohesion: 0.10
Nodes (21): DtoCreateTshirtItem, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min, Type (+13 more)

### Community 62 - "current-user.decorator.ts"
Cohesion: 0.29
Nodes (6): AuthenticatedRequest, AuthenticatedUser, PRICE_FIELDS, strip(), StripPricesInterceptor, Injectable

### Community 63 - "exclude"
Cohesion: 0.25
Nodes (7): exclude, extends, dist, node_modules, **/*spec.ts, test, ./tsconfig.json

### Community 64 - "Аудит финансов, кода и продакшена — 2026-07-09"
Cohesion: 0.29
Nodes (6): Аудит финансов, кода и продакшена — 2026-07-09, Кодовый аудит, Короткий вывод, Продакшен-аудит, Следующие улучшения, Финансовый аудит

### Community 65 - "devDependencies"
Cohesion: 0.29
Nodes (7): devDependencies, eslint-plugin-prettier, jest, @types/express, eslint-plugin-prettier, jest, @types/express

### Community 66 - "AvitoPage.tsx"
Cohesion: 0.22
Nodes (11): avitoApi, AvitoChatQuery, AvitoPage, AvitoPage(), clientInitial(), messagePreview(), messageText(), timeLabel() (+3 more)

### Community 67 - "nest-cli.json"
Cohesion: 0.33
Nodes (5): collection, compilerOptions, deleteOutDir, $schema, sourceRoot

### Community 70 - "GulianService"
Cohesion: 0.26
Nodes (5): RETRY_DELAYS_SECONDS, GulianOrderPayload, GulianResponse, GulianService, Injectable

### Community 71 - "seed.js"
Cohesion: 0.40
Nodes (3): bcrypt, { Client }, { randomUUID }

### Community 72 - "DtoUpdateOrder"
Cohesion: 0.17
Nodes (11): DtoUpdateOrder, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Matches, MaxLength (+3 more)

### Community 73 - "scenario.controller.ts"
Cohesion: 0.05
Nodes (69): DtoDetectProduct, IsString, MaxLength, DtoSaveDraft, IsObject, IsOptional, IsString, MaxLength (+61 more)

### Community 74 - "React + TypeScript + Vite"
Cohesion: 0.50
Nodes (3): Expanding the ESLint configuration, React Compiler, React + TypeScript + Vite

### Community 79 - "ReportsController"
Cohesion: 0.24
Nodes (5): ReportsController, Controller, Get, Query, UseGuards

### Community 81 - "partner-telegram-format.ts"
Cohesion: 0.27
Nodes (9): buildPartnerCaption(), calcSettlement(), esc(), PartnerOrderData, PartnerOrderItem, PRINT_LOCATION_LABELS, PRINT_TYPE_LABELS, rub() (+1 more)

### Community 82 - ".createOrder"
Cohesion: 0.44
Nodes (6): buildCommunicationUrl(), buildMaxUrl(), DEFAULT_MAX_LINK_TEMPLATE, formatPhoneForDisplay(), normalizePhone(), validateCommunicationValue()

### Community 94 - "TelegramPollingService"
Cohesion: 0.28
Nodes (3): TelegramPollingService, TgUpdateWithId, Injectable

### Community 95 - ".webhook"
Cohesion: 0.25
Nodes (6): TgUpdate, TelegramWebhookController, Body, Controller, Post, Headers

### Community 97 - "crm-new/package.json"
Cohesion: 0.29
Nodes (6): author, description, license, name, private, version

### Community 100 - "lead-pricing.ts"
Cohesion: 0.38
Nodes (5): LeadMoneyError, LeadMoneyInput, LeadMoneyResult, MAX_POSITION_TOTAL, resolveLeadMoney()

### Community 112 - "DtoSetShipmentLead"
Cohesion: 0.40
Nodes (4): DtoSetShipmentLead, IsOptional, IsString, ValidateIf

### Community 130 - "CurrentUser"
Cohesion: 0.24
Nodes (4): CurrentUser, Get, Query, Res

### Community 131 - "PrismaService"
Cohesion: 0.08
Nodes (13): JwtPayload, JwtStrategy, Injectable, HealthController, Controller, Get, ELIGIBLE_ROLES, ShipmentLeadView (+5 more)

### Community 134 - "DtoCreateItemOrder"
Cohesion: 0.18
Nodes (11): DtoCreateItemOrder, IsBoolean, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min (+3 more)

### Community 135 - "roles.guard.ts"
Cohesion: 0.29
Nodes (5): ROLES_KEY, JwtAuthGuard, Injectable, RolesGuard, Injectable

### Community 138 - "order-financial-integrity.service.ts"
Cohesion: 0.27
Nodes (5): FinancialClient, calculateManagerSalarySnapshot(), calculateSalarySnapshot(), ManagerSalarySnapshot, SalarySnapshot

## Knowledge Gaps
- **502 isolated node(s):** `$schema`, `collection`, `sourceRoot`, `deleteOutDir`, `name` (+497 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **51 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PrismaService` connect `PrismaService` to `TasksService`, `users.controller.ts`, `tshirt-partner-telegram.service.ts`, `order-financial-integrity.service.ts`, `expenses.controller.ts`, `reports.service.ts`, `daily-plan-rules.ts`, `AvitoService`, `OrderFinancialIntegrityService`, `sticker.service.ts`, `tasks.controller.ts`, `partner-api.controller.ts`, `app.module.ts`, `review-reminder.service.ts`, `telegram-update.service.ts`, `salary.controller.ts`, `partner-admin.controller.ts`, `auth.controller.ts`, `partner-settings.service.ts`, `order-photo.service.ts`, `salary-integrity.spec.ts`, `TelegramService`, `order-photo.controller.ts`, `GulianService`, `scenario.controller.ts`, `TechSpecStorageService`, `PartnerSettingsService`, `PartnerSettingsService`, `GulianOutboxProcessorService`, `.constructor`?**
  _High betweenness centrality (0.077) - this node is a cross-community bridge._
- **Why does `Roles()` connect `Roles` to `PartnerAdminController`, `TasksService`, `CurrentUser`, `users.controller.ts`, `salary.controller.ts`, `roles.guard.ts`, `DtoUpdatePartnerSettings`, `partner-admin.controller.ts`, `scenario.controller.ts`, `expenses.controller.ts`, `AvitoService`, `ReportsController`, `AvitoController`, `tasks.controller.ts`, `order-photo.controller.ts`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **Why does `CurrentUser` connect `CurrentUser` to `TasksService`, `users.controller.ts`, `salary.controller.ts`, `Roles`, `auth.controller.ts`, `expenses.controller.ts`, `scenario.controller.ts`, `AvitoService`, `AvitoController`, `tasks.controller.ts`, `order-photo.controller.ts`, `current-user.decorator.ts`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **What connects `$schema`, `collection`, `sourceRoot` to the rest of the system?**
  _502 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ReportsPage.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06599326599326599 - nodes in this community are weakly interconnected._
- **Should `TasksService` be split into smaller, more focused modules?**
  _Cohesion score 0.11397849462365592 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._