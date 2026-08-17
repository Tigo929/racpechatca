# Graph Report - raspechatka  (2026-08-17)

## Corpus Check
- 296 files · ~123,846 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2224 nodes · 4278 edges · 163 communities (105 shown, 58 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 136 edges (avg confidence: 0.79)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8a2eda78`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- SalaryPage.tsx
- TasksService
- dependencies
- DtoUpdateUser
- telegram.module.ts
- jest
- tshirt-partner-telegram.service.ts
- index.ts
- OrdersPage.tsx
- Roles
- System Map
- DtoCreateExpense
- reports.service.ts
- OrderDetail.tsx
- daily-plan-rules.ts
- AvitoService
- Брендбук — Распечатка PRO
- DtoUpdateItemOrder
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
- getErrorMessage
- DtoCreateLead
- telegram-update.service.ts
- salary.controller.ts
- Интеграция с исполнителем-партнёром (печать футболок)
- .get
- CRM «Распечатка» — как всё устроено
- partner-payload.ts
- auth.controller.ts
- OrderPhotoService
- partner-settings.service.ts
- lead.controller.ts
- DtoAllOrdersforQuery
- order-photo.service.ts
- salary-integrity.spec.ts
- ReportsPage.tsx
- CreateOrderForm.tsx
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
- MarketplacePage.tsx
- TshirtItemsTable.tsx
- GulianService
- seed.js
- DtoUpdateOrder
- scenario.registry.ts
- React + TypeScript + Vite
- backup-db.sh
- shipment-reminder-rules.ts
- ts-loader
- frontend/tsconfig.json
- ozon.service.ts
- @eslint/js
- partner-telegram-format.ts
- .createOrder
- TechSpecStorageService
- @nestjs/cli
- @nestjs/schematics
- @nestjs/testing
- scenario.controller.ts
- PartnerSettingsService
- supertest
- ts-jest
- MarketplaceController
- ts-node
- tsconfig-paths
- TelegramPollingService
- .webhook
- marketplace-account.service.ts
- crm-new/package.json
- GulianOutboxProcessorService
- @types/supertest
- lead-pricing.ts
- typescript-eslint
- MarketplaceAccountService
- eslint-plugin-react-refresh
- @eslint/js
- tailwindcss
- typescript-eslint
- vite
- lead-notification.ts
- bwip-js
- TshirtPartnerTelegramService
- @nestjs/core
- @nestjs/jwt
- @nestjs/mapped-types
- @nestjs/throttler
- passport
- pdf-lib
- pg
- @types/jest
- task-reminder.service.spec.ts
- gulian-outbox.service.ts
- @types/pdfkit
- DtoUpdatePartnerSettings
- @prisma/adapter-pg
- @prisma/client
- reflect-metadata
- CurrentUser
- PrismaService
- roboto-fontface
- DtoUpdateMarketplaceAccount
- DtoCreateItemOrder
- avito.controller.ts
- PartnerStatusPollService
- Выкатка: репозиторий → сервер
- order-financial-integrity.service.ts
- prisma
- Интеграция с Ozon Seller API
- GulianOutboxService
- DtoCreateMarketplaceAccount
- nginx-routes.spec.ts
- main.ts
- DtoSendAvitoMessage
- scenario-draft.spec.ts
- .me
- auto-update.sh
- bcryptjs
- helmet
- @nestjs/common
- @nestjs/config
- @nestjs/passport
- @nestjs/platform-express
- passport-jwt
- rxjs
- sharp
- undici
- uuid
- web-push
- jest
- @types/express

## God Nodes (most connected - your core abstractions)
1. `PrismaService` - 74 edges
2. `Roles()` - 58 edges
3. `CurrentUser` - 34 edges
4. `OrderPhotoController` - 34 edges
5. `TelegramService` - 29 edges
6. `getErrorMessage()` - 29 edges
7. `useAuth()` - 27 edges
8. `OrderPhotoService` - 26 edges
9. `PartnerSettingsService` - 24 edges
10. `AvitoService` - 23 edges

## Surprising Connections (you probably didn't know these)
- `AccountCard()` --calls--> `getErrorMessage()`  [EXTRACTED]
  frontend/src/pages/MarketplacePage.tsx → frontend/src/utils/get-error-message.ts
- `AccountForm()` --calls--> `getErrorMessage()`  [EXTRACTED]
  frontend/src/pages/MarketplacePage.tsx → frontend/src/utils/get-error-message.ts
- `BonusForm()` --calls--> `getErrorMessage()`  [EXTRACTED]
  frontend/src/pages/SalaryPage.tsx → frontend/src/utils/get-error-message.ts
- `AvitoController` --references--> `Roles()`  [EXTRACTED]
  crm-new/src/avito/avito.controller.ts → crm-new/src/auth/decorators/roles.decorator.ts
- `ExpensesController` --references--> `Roles()`  [EXTRACTED]
  crm-new/src/expenses/expenses.controller.ts → crm-new/src/auth/decorators/roles.decorator.ts

## Import Cycles
- None detected.

## Communities (163 total, 58 thin omitted)

### Community 0 - "SalaryPage.tsx"
Cohesion: 0.11
Nodes (27): MySalaryBalance, salaryApi, MySalaryPage, SalaryPage, buildReceiptHtml(), buildReceiptTitle(), escapeHtml(), formatFilenameDate() (+19 more)

### Community 1 - "TasksService"
Cohesion: 0.10
Nodes (14): DtoUpdateTaskStatus, IsEnum, TasksController, Body, Controller, Delete, Get, Param (+6 more)

### Community 2 - "dependencies"
Cohesion: 0.29
Nodes (7): class-transformer, class-validator, dependencies, class-transformer, class-validator, pdfkit, pdfkit

### Community 3 - "DtoUpdateUser"
Cohesion: 0.06
Nodes (28): DtoCreateUser, IsEnum, IsString, MinLength, DtoUpdateUser, IsBoolean, IsInt, IsOptional (+20 more)

### Community 4 - "telegram.module.ts"
Cohesion: 0.16
Nodes (8): TelegramStickerController, Controller, Get, Param, Query, Res, TelegramStickerLinkService, Injectable

### Community 5 - "jest"
Cohesion: 0.12
Nodes (16): jest, collectCoverageFrom, coverageDirectory, moduleFileExtensions, moduleNameMapper, rootDir, testEnvironment, testRegex (+8 more)

### Community 6 - "tshirt-partner-telegram.service.ts"
Cohesion: 0.20
Nodes (8): buildPartnerButtons(), escapeHtml(), EXT_CONTENT_TYPE, money(), PRINT_LOCATION_LABELS, PRINT_TYPE_LABELS, TechSpecAttachment, TshirtOrderWithItems

### Community 7 - "index.ts"
Cohesion: 0.10
Nodes (28): OrderEditForm(), Props, AvitoLinkedOrder, ClosedAccrualBrief, CreateCanvasItemDto, CreateItemDto, CreateTshirtItemDto, EnumAccrualKind (+20 more)

### Community 8 - "OrdersPage.tsx"
Cohesion: 0.10
Nodes (31): StatusStepper(), DELIVERY_STYLES, DeliveryBadge(), Props, Props, STATUS_STYLES, StatusBadge(), CANVAS_STATUS_FLOW (+23 more)

### Community 9 - "Roles"
Cohesion: 0.19
Nodes (7): Roles(), Body, Delete, Param, Patch, Post, Query

### Community 10 - "System Map"
Cohesion: 0.06
Nodes (30): 2026-07-08, 2026-07-09, 2026-07-11, Access Rules, App Modules, Assignment Rules, Backend API Map, Backend Map (+22 more)

### Community 11 - "DtoCreateExpense"
Cohesion: 0.08
Nodes (20): DtoCreateExpense, IsEnum, IsInt, IsOptional, IsString, Min, ExpensesController, Body (+12 more)

### Community 12 - "reports.service.ts"
Cohesion: 0.07
Nodes (36): calcOrderProfit(), forecastSalary(), kopecksToRub(), OrderProfit, OrderProfitInput, SHEET, DECLARED_PRINTS_PER_SHEET, HALF_SHEET_WORDS (+28 more)

### Community 13 - "OrderDetail.tsx"
Cohesion: 0.08
Nodes (35): ordersApi, CanvasItemsTable(), EditState, EMPTY, money(), toDto(), DispatchToExecutorModal(), PayoutInfo (+27 more)

### Community 14 - "daily-plan-rules.ts"
Cohesion: 0.06
Nodes (58): buildDailyPlanMessage(), buildShipmentBlock(), dayMonth(), DELIVERY_LABEL, effectiveDeadline(), executorKey(), inWorkTail(), isWithinPlanWindow() (+50 more)

### Community 15 - "AvitoService"
Cohesion: 0.05
Nodes (33): AvitoController, Body, Controller, Get, Param, Post, Query, UseGuards (+25 more)

### Community 16 - "Брендбук — Распечатка PRO"
Cohesion: 0.08
Nodes (24): 1. Анализ конкурентов, 2. Психология цвета, 3. Цветовая палитра, 4. Типографика, 5. Логотип и иконка, 6. Правила применения, 7. Tone of Voice, 8. Применение на сайте (будущее) (+16 more)

### Community 17 - "DtoUpdateItemOrder"
Cohesion: 0.05
Nodes (33): CanvasItemService, canvasMoney(), Injectable, DtoUpdateItemOrder, IsBoolean, IsEnum, IsInt, IsOptional (+25 more)

### Community 18 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, allowSyntheticDefaultImports, baseUrl, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, forceConsistentCasingInFileNames (+14 more)

### Community 19 - "TasksPage.tsx"
Cohesion: 0.14
Nodes (18): tasksApi, TasksQuery, TasksPage, FilterChip(), Props, daysUntil(), DeadlineChip(), EMPTY_FORM (+10 more)

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
Cohesion: 0.13
Nodes (18): authApi, AdminRoute(), App(), AppRoutes(), CrmGate(), LoginPage, OrdersPage, OrderStaffRoute() (+10 more)

### Community 26 - "tasks.controller.ts"
Cohesion: 0.13
Nodes (18): DtoCreateTask, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength (+10 more)

### Community 27 - "compilerOptions"
Cohesion: 0.10
Nodes (20): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+12 more)

### Community 28 - "DtoCreateOrder"
Cohesion: 0.09
Nodes (23): DtoCreateOrder, IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString (+15 more)

### Community 29 - "partner-api.controller.ts"
Cohesion: 0.16
Nodes (14): DtoPartnerStatus, IsString, Body, Patch, FLOW_RANK, FROM_PARTNER, fromPartnerStatus(), mapPartnerStage() (+6 more)

### Community 30 - "app.module.ts"
Cohesion: 0.11
Nodes (19): AuthModule, Module, GulianModule, Module, MarketplaceModule, Module, OrderPhotoModule, Module (+11 more)

### Community 31 - "review-reminder.service.ts"
Cohesion: 0.16
Nodes (12): isReviewReminderEligible(), REVIEW_REMINDER_CATEGORIES, REVIEW_REMINDER_DELAY_MS, REVIEW_REMINDER_PICKUP_DELAY_MS, REVIEW_REMINDER_STATUSES, reviewReminderDelayMs(), buildReviewRequestText(), categoryLabel() (+4 more)

### Community 32 - "PartnerAdminController"
Cohesion: 0.19
Nodes (9): PartnerAdminController, Controller, Get, Param, Post, Res, UseGuards, UseInterceptors (+1 more)

### Community 33 - "devDependencies"
Cohesion: 0.11
Nodes (19): eslint-plugin-react-hooks, devDependencies, eslint, eslint-plugin-react-hooks, globals, @tailwindcss/vite, @types/node, @types/react (+11 more)

### Community 34 - "getErrorMessage"
Cohesion: 0.10
Nodes (32): partnerSettingsApi, shipmentLeadApi, usersApi, SettingsPage, UsersPage, AssignPanel(), AddExpenseModal(), DailyPlanCard() (+24 more)

### Community 35 - "DtoCreateLead"
Cohesion: 0.09
Nodes (20): DtoCreateLead, base, meta, pipe, IsBoolean, IsEnum, IsIn, IsInt (+12 more)

### Community 36 - "telegram-update.service.ts"
Cohesion: 0.24
Nodes (7): calcGulianPayout(), Item, PayoutResult, toGulianStatus(), ACTION_STATUS, STATUS_TOAST, TelegramCallback

### Community 37 - "salary.controller.ts"
Cohesion: 0.06
Nodes (34): ArrayMinSize, DtoCreateBonus, IsInt, IsString, IsUUID, MaxLength, Min, MinLength (+26 more)

### Community 38 - "Интеграция с исполнителем-партнёром (печать футболок)"
Cohesion: 0.12
Nodes (15): 1. Модель взаимодействия, 2. Аутентификация, 3. Webhook, который мы отправляем партнёру, 4.1 Данные заказа, 4.2 ТЗ-фото (макет), 4.3 Стикер (PDF, 58×40 мм), 4.4 Смена статуса заказа (партнёр → нам), 4. Эндпоинты, откуда партнёр забирает данные (pull) (+7 more)

### Community 39 - ".get"
Cohesion: 0.20
Nodes (6): PartnerSettingsController, Body, Controller, Get, Patch, UseGuards

### Community 40 - "CRM «Распечатка» — как всё устроено"
Cohesion: 0.11
Nodes (18): 10. Слабые места, 11. Что дальше, 1. Что это, 2. Из чего собрано, 3. Продукты и статусы, 4. Деньги, 5. Роли, 6. Сценарии оформления (+10 more)

### Community 41 - "partner-payload.ts"
Cohesion: 0.19
Nodes (11): PartnerOutboundService, Injectable, buildPartnerOrderPayload(), PartnerOrderForPayload, PartnerOrderPayload, PRINT_LOCATION_LABELS, PRINT_TYPE_LABELS, getTechSpecPathAt() (+3 more)

### Community 42 - "auth.controller.ts"
Cohesion: 0.20
Nodes (10): AuthController, Body, Controller, Post, Throttle, AuthService, Injectable, DtoLogin (+2 more)

### Community 43 - "OrderPhotoService"
Cohesion: 0.24
Nodes (4): isExternalProductionCategory(), needsShipmentStatus(), OrderPhotoService, Injectable

### Community 44 - "partner-settings.service.ts"
Cohesion: 0.25
Nodes (11): Db, TshirtItemForSettlement, UpdatePartnerSettingsDto, DEFAULT_PARTNER_RATE_BASIS_POINTS, OrderSettlement, positionMaterials(), PositionSettlement, SettlementPosition (+3 more)

### Community 45 - "lead.controller.ts"
Cohesion: 0.30
Nodes (7): constantTimeEqual(), readBearerToken(), readHeader(), SignedRequest, SiteLeadTokenGuard, stripPrefix(), Injectable

### Community 46 - "DtoAllOrdersforQuery"
Cohesion: 0.17
Nodes (11): DtoAllOrdersforQuery, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength (+3 more)

### Community 47 - "order-photo.service.ts"
Cohesion: 0.10
Nodes (18): DtoAssignExecutor, IsOptional, IsString, IsUUID, IsEnum, UpdateStatus, CLOSED_STATUSES, CONTROL_CLOSED_STATUSES (+10 more)

### Community 48 - "salary-integrity.spec.ts"
Cohesion: 0.14
Nodes (13): AccrualByIdRow, AsyncMock, createOrderService(), CreatePaymentArgs, createPrismaStub(), HarnessAccrual, makeOrder(), PaymentByAccrualsHarness (+5 more)

### Community 49 - "ReportsPage.tsx"
Cohesion: 0.10
Nodes (21): api, expensesApi, reportsApi, ReportsPage, expenseCategoryLabel(), expenseDetails(), ExpenseList(), money() (+13 more)

### Community 50 - "CreateOrderForm.tsx"
Cohesion: 0.11
Nodes (22): baseSchema, canvasItemSchema, CreateOrderForm(), FormValues, freeItemSchema, fullSchema, isRussianPhone(), photoItemSchema (+14 more)

### Community 51 - "Исправленные проблемы"
Cohesion: 0.18
Nodes (10): CRITICAL, CRM Audit Report — 2026-06-14, HIGH, HIGH, LOW, MEDIUM, MEDIUM, Исправленные проблемы (+2 more)

### Community 52 - "crm-new/README.md"
Cohesion: 0.20
Nodes (9): Compile and run the project, Deployment, Description, License, Project setup, Resources, Run tests, Stay in touch (+1 more)

### Community 53 - "TelegramService"
Cohesion: 0.14
Nodes (9): logger, proxyDispatcher(), resetTelegramProxyCache(), telegramFetch(), TgUpdateWithId, TelegramService, Injectable, TelegramUpdateService (+1 more)

### Community 54 - "PartnerApiController"
Cohesion: 0.36
Nodes (6): PartnerApiController, Controller, Get, Param, Res, UseGuards

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
Cohesion: 0.12
Nodes (13): LeadController, Controller, Throttle, UseGuards, StickerModule, Module, PartnerSettingsModule, Module (+5 more)

### Community 60 - "package.json"
Cohesion: 0.25
Nodes (7): concurrently, devDependencies, concurrently, name, private, scripts, dev

### Community 61 - "order-photo.controller.ts"
Cohesion: 0.10
Nodes (20): DtoCreateCanvasItem, IsInt, IsString, MaxLength, Min, Type, DtoSetReview, IsBoolean (+12 more)

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
Cohesion: 0.09
Nodes (23): devDependencies, eslint, eslint-config-prettier, @eslint/eslintrc, eslint-plugin-prettier, globals, prettier, source-map-support (+15 more)

### Community 66 - "AvitoPage.tsx"
Cohesion: 0.22
Nodes (11): avitoApi, AvitoChatQuery, AvitoPage, AvitoPage(), clientInitial(), messagePreview(), messageText(), timeLabel() (+3 more)

### Community 67 - "nest-cli.json"
Cohesion: 0.33
Nodes (5): collection, compilerOptions, deleteOutDir, $schema, sourceRoot

### Community 68 - "MarketplacePage.tsx"
Cohesion: 0.12
Nodes (16): CreateAccountDto, EnumMarketplace, MarketplaceAccount, marketplaceApi, OzonConnectionInfo, UpdateAccountDto, MarketplacePage, Modal() (+8 more)

### Community 69 - "TshirtItemsTable.tsx"
Cohesion: 0.10
Nodes (17): Props, EditState, ItemsTable(), Props, AssignPanelProps, Props, EditState, EMPTY (+9 more)

### Community 71 - "seed.js"
Cohesion: 0.40
Nodes (3): bcrypt, { Client }, { randomUUID }

### Community 72 - "DtoUpdateOrder"
Cohesion: 0.17
Nodes (11): DtoUpdateOrder, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Matches, MaxLength (+3 more)

### Community 73 - "scenario.registry.ts"
Cohesion: 0.06
Nodes (56): DELIVERY_STEPS, NOTE_STEP, OPTIONAL, PAPER_LABEL, photoToOrder(), PHOTO_SCENARIO, tshirtToOrder(), TSHIRT_SCENARIO (+48 more)

### Community 74 - "React + TypeScript + Vite"
Cohesion: 0.50
Nodes (3): Expanding the ESLint configuration, React Compiler, React + TypeScript + Vite

### Community 76 - "shipment-reminder-rules.ts"
Cohesion: 0.16
Nodes (11): buildShipmentReminder(), DEADLINE_METHODS, dueReminderStage(), hasDeadline(), hoursLeft(), SHIPMENT_REMINDER_STAGES_MS, ShipmentOrder, START (+3 more)

### Community 79 - "ozon.service.ts"
Cohesion: 0.15
Nodes (11): humanize(), OzonApiClient, OzonApiError, OzonCredentials, OzonErrorBody, Injectable, OzonConnectionInfo, OzonProductListResponse (+3 more)

### Community 81 - "partner-telegram-format.ts"
Cohesion: 0.27
Nodes (9): buildPartnerCaption(), calcSettlement(), esc(), PartnerOrderData, PartnerOrderItem, PRINT_LOCATION_LABELS, PRINT_TYPE_LABELS, rub() (+1 more)

### Community 82 - ".createOrder"
Cohesion: 0.25
Nodes (8): buildCommunicationUrl(), buildMaxUrl(), DEFAULT_MAX_LINK_TEMPLATE, formatPhoneForDisplay(), normalizePhone(), validateCommunicationValue(), calcCanvasMoney(), fullDate()

### Community 87 - "scenario.controller.ts"
Cohesion: 0.14
Nodes (13): DtoDetectProduct, IsString, MaxLength, DtoSaveDraft, IsObject, IsOptional, IsString, MaxLength (+5 more)

### Community 88 - "PartnerSettingsService"
Cohesion: 0.21
Nodes (6): PartnerSettingsService, AnyMock, call(), items, JULY, Injectable

### Community 91 - "MarketplaceController"
Cohesion: 0.16
Nodes (10): MarketplaceController, Body, Controller, Delete, Get, Param, Patch, Post (+2 more)

### Community 95 - ".webhook"
Cohesion: 0.24
Nodes (7): TgUpdate, constantTimeEqual(), TelegramWebhookController, Body, Controller, Post, Headers

### Community 96 - "marketplace-account.service.ts"
Cohesion: 0.24
Nodes (9): AccountRow, CreateAccountInput, MarketplaceAccountView, UpdateAccountInput, decryptSecret(), deriveKey(), encryptSecret(), secretHint() (+1 more)

### Community 97 - "crm-new/package.json"
Cohesion: 0.29
Nodes (6): author, description, license, name, private, version

### Community 100 - "lead-pricing.ts"
Cohesion: 0.38
Nodes (5): LeadMoneyError, LeadMoneyInput, LeadMoneyResult, MAX_POSITION_TOTAL, resolveLeadMoney()

### Community 112 - "lead-notification.ts"
Cohesion: 0.33
Nodes (6): buildLeadNotification(), escape(), LeadForNotification, NotifiableUser, pickLeadResponders(), toMention()

### Community 123 - "task-reminder.service.spec.ts"
Cohesion: 0.25
Nodes (7): AsyncMock, AT_TEN, BEFORE_TEN, createStub(), LATE_NIGHT, setup(), Stub

### Community 124 - "gulian-outbox.service.ts"
Cohesion: 0.39
Nodes (4): RETRY_DELAYS_SECONDS, OrderForOutbox, GulianOrderPayload, GulianResponse

### Community 126 - "DtoUpdatePartnerSettings"
Cohesion: 0.25
Nodes (7): DtoUpdatePartnerSettings, IsInt, IsOptional, IsString, Max, MaxLength, Min

### Community 130 - "CurrentUser"
Cohesion: 0.25
Nodes (7): CurrentUser, OrderPhotoController, Controller, Get, Res, UseGuards, UseInterceptors

### Community 131 - "PrismaService"
Cohesion: 0.11
Nodes (10): JwtPayload, JwtStrategy, Injectable, HealthController, Controller, Get, ELIGIBLE_ROLES, ShipmentLeadView (+2 more)

### Community 133 - "DtoUpdateMarketplaceAccount"
Cohesion: 0.29
Nodes (6): DtoUpdateMarketplaceAccount, IsBoolean, IsOptional, IsString, MaxLength, MinLength

### Community 134 - "DtoCreateItemOrder"
Cohesion: 0.18
Nodes (11): DtoCreateItemOrder, IsBoolean, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min (+3 more)

### Community 135 - "avito.controller.ts"
Cohesion: 0.19
Nodes (11): ROLES_KEY, JwtAuthGuard, Injectable, RolesGuard, Injectable, RequestUser, ALLOWED, EXT_CONTENT_TYPE (+3 more)

### Community 137 - "Выкатка: репозиторий → сервер"
Cohesion: 0.29
Nodes (6): Выкатка: репозиторий → сервер, Как это устроено на сервере, Команды, Откат, Почему именно так, Чего в цепочке пока нет

### Community 138 - "order-financial-integrity.service.ts"
Cohesion: 0.31
Nodes (6): FinancialClient, calculateManagerSalarySnapshot(), calculateSalarySnapshot(), earnsStaffSalary(), ManagerSalarySnapshot, SalarySnapshot

### Community 140 - "Интеграция с Ozon Seller API"
Cohesion: 0.29
Nodes (6): 1. Что уже сделано (этап 1 — подключение), 2. Следующий этап — карточки товаров (футболки с принтом), 3. Дальше, API CRM, Интеграция с Ozon Seller API, Как устроен клиент Ozon

### Community 142 - "DtoCreateMarketplaceAccount"
Cohesion: 0.33
Nodes (5): DtoCreateMarketplaceAccount, IsEnum, IsString, MaxLength, MinLength

### Community 144 - "main.ts"
Cohesion: 0.50
Nodes (4): AppModule, Module, allowedOrigins(), bootstrap()

### Community 145 - "DtoSendAvitoMessage"
Cohesion: 0.40
Nodes (4): DtoSendAvitoMessage, IsString, MaxLength, MinLength

### Community 146 - "scenario-draft.spec.ts"
Cohesion: 0.40
Nodes (3): FakeOrder, READY_PHOTO, READY_TSHIRT

## Knowledge Gaps
- **555 isolated node(s):** `$schema`, `collection`, `sourceRoot`, `deleteOutDir`, `name` (+550 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **58 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PrismaService` connect `PrismaService` to `TasksService`, `DtoUpdateUser`, `tshirt-partner-telegram.service.ts`, `avito.controller.ts`, `PartnerStatusPollService`, `order-financial-integrity.service.ts`, `DtoCreateExpense`, `reports.service.ts`, `GulianOutboxService`, `daily-plan-rules.ts`, `AvitoService`, `DtoUpdateItemOrder`, `scenario-draft.spec.ts`, `sticker.service.ts`, `tasks.controller.ts`, `partner-api.controller.ts`, `app.module.ts`, `review-reminder.service.ts`, `PartnerAdminController`, `telegram-update.service.ts`, `salary.controller.ts`, `partner-payload.ts`, `auth.controller.ts`, `partner-settings.service.ts`, `order-photo.service.ts`, `salary-integrity.spec.ts`, `TelegramService`, `order-photo.controller.ts`, `scenario.registry.ts`, `shipment-reminder-rules.ts`, `ozon.service.ts`, `PartnerSettingsService`, `marketplace-account.service.ts`, `GulianOutboxProcessorService`, `task-reminder.service.spec.ts`, `gulian-outbox.service.ts`?**
  _High betweenness centrality (0.093) - this node is a cross-community bridge._
- **Why does `Roles()` connect `Roles` to `PartnerAdminController`, `TasksService`, `CurrentUser`, `DtoUpdateUser`, `salary.controller.ts`, `avito.controller.ts`, `.get`, `scenario.registry.ts`, `DtoCreateExpense`, `reports.service.ts`, `AvitoService`, `scenario.controller.ts`, `tasks.controller.ts`, `MarketplaceController`, `order-photo.controller.ts`?**
  _High betweenness centrality (0.082) - this node is a cross-community bridge._
- **Why does `MarketplaceController` connect `MarketplaceController` to `Roles`, `app.module.ts`, `avito.controller.ts`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **What connects `$schema`, `collection`, `sourceRoot` to the rest of the system?**
  _555 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `SalaryPage.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.10984848484848485 - nodes in this community are weakly interconnected._
- **Should `TasksService` be split into smaller, more focused modules?**
  _Cohesion score 0.10416666666666667 - nodes in this community are weakly interconnected._
- **Should `DtoUpdateUser` be split into smaller, more focused modules?**
  _Cohesion score 0.06387921022067364 - nodes in this community are weakly interconnected._