# Graph Report - raspechatka  (2026-08-17)

## Corpus Check
- 317 files · ~134,151 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2438 nodes · 4722 edges · 167 communities (114 shown, 53 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 155 edges (avg confidence: 0.79)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e3020fca`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ozon-catalog.controller.ts
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
- .assertOrderFinanciallyEditable
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
- partner-status.ts
- order-photo.module.ts
- review-reminder.service.ts
- TechSpecStorageService
- devDependencies
- getErrorMessage
- DtoCreateLead
- telegram-update.service.ts
- salary.controller.ts
- Интеграция с исполнителем-партнёром (печать футболок)
- marketplace.module.ts
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
- partner-api.controller.ts
- package.json
- order-photo.controller.ts
- current-user.decorator.ts
- exclude
- Аудит финансов, кода и продакшена — 2026-07-09
- devDependencies
- AvitoPage.tsx
- nest-cli.json
- MarketplacePage.tsx
- ProductsTab.tsx
- GulianService
- seed.js
- DtoUpdateOrder
- scenario.controller.ts
- React + TypeScript + Vite
- backup-db.sh
- shipment-reminder-rules.ts
- ts-loader
- frontend/tsconfig.json
- marketplace-account.service.ts
- @eslint/js
- partner-telegram-format.ts
- .createOrder
- ozon-attributes.ts
- @nestjs/cli
- @nestjs/schematics
- @nestjs/testing
- AvitoController
- PartnerSettingsService
- supertest
- ts-jest
- MarketplaceController
- ts-node
- tsconfig-paths
- telegram.service.ts
- .webhook
- OzonCatalogController
- crm-new/package.json
- canvas-item.service.ts
- @types/supertest
- DtoCreateTshirtItem
- typescript-eslint
- MarketplaceAccountService
- eslint-plugin-react-refresh
- OzonPrintService
- tailwindcss
- typescript-eslint
- vite
- lead-notification.ts
- bwip-js
- tshirt-item.service.ts
- @nestjs/core
- @nestjs/jwt
- @nestjs/mapped-types
- @nestjs/throttler
- passport
- pdf-lib
- pg
- @types/jest
- ReportsController
- prisma.service.ts
- @types/pdfkit
- DtoUpdateOzonPrint
- @prisma/adapter-pg
- @prisma/client
- reflect-metadata
- CurrentUser
- PrismaService
- roboto-fontface
- marketplace.controller.ts
- DtoCreateItemOrder
- avito.controller.ts
- DtoUpdateItemOrder
- Выкатка: репозиторий → сервер
- .updateStatusOrder
- prisma
- Интеграция с Ozon Seller API
- DtoAssignExecutor
- order-photo/photo-material.ts
- nginx-routes.spec.ts
- DtoUpdateOzonCatalogTemplate
- OrderFinancialIntegrityService
- scenario-draft.spec.ts
- .me
- auto-update.sh
- order-profit.spec.ts
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
- jwt.strategy.ts
- .constructor
- class-transformer
- eslint

## God Nodes (most connected - your core abstractions)
1. `PrismaService` - 80 edges
2. `Roles()` - 60 edges
3. `getErrorMessage()` - 35 edges
4. `CurrentUser` - 34 edges
5. `OrderPhotoController` - 34 edges
6. `TelegramService` - 29 edges
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

## Communities (167 total, 53 thin omitted)

### Community 0 - "ozon-catalog.controller.ts"
Cohesion: 0.06
Nodes (36): DtoCreateOzonPrint, ArrayMaxSize, ArrayMinSize, ArrayNotEmpty, IsArray, IsEnum, IsInt, IsOptional (+28 more)

### Community 1 - "TasksService"
Cohesion: 0.11
Nodes (12): TasksController, Body, Controller, Delete, Get, Param, Patch, Post (+4 more)

### Community 2 - "dependencies"
Cohesion: 0.29
Nodes (7): bcryptjs, class-validator, dependencies, bcryptjs, class-validator, pdfkit, pdfkit

### Community 3 - "users.controller.ts"
Cohesion: 0.07
Nodes (29): DtoCreateUser, IsEnum, IsString, MinLength, DtoUpdateUser, IsBoolean, IsInt, IsOptional (+21 more)

### Community 4 - "telegram.module.ts"
Cohesion: 0.17
Nodes (8): TelegramStickerController, Controller, Get, Param, Query, Res, TelegramStickerLinkService, Injectable

### Community 5 - "jest"
Cohesion: 0.12
Nodes (16): jest, collectCoverageFrom, coverageDirectory, moduleFileExtensions, moduleNameMapper, rootDir, testEnvironment, testRegex (+8 more)

### Community 6 - "tshirt-partner-telegram.service.ts"
Cohesion: 0.15
Nodes (10): buildPartnerButtons(), escapeHtml(), EXT_CONTENT_TYPE, money(), PRINT_LOCATION_LABELS, PRINT_TYPE_LABELS, TechSpecAttachment, Injectable (+2 more)

### Community 7 - "index.ts"
Cohesion: 0.07
Nodes (40): api, reportsApi, MySalaryBalance, shipmentLeadApi, AvitoLinkedOrder, ClosedAccrualBrief, CreateCanvasItemDto, CreateItemDto (+32 more)

### Community 8 - "OrdersPage.tsx"
Cohesion: 0.12
Nodes (26): ordersApi, DELIVERY_STYLES, DeliveryBadge(), Props, Props, STATUS_STYLES, StatusBadge(), CANVAS_STATUS_FLOW (+18 more)

### Community 9 - "Roles"
Cohesion: 0.20
Nodes (10): Roles(), OrderPhotoController, Body, Controller, Delete, Param, Patch, Post (+2 more)

### Community 10 - "System Map"
Cohesion: 0.06
Nodes (30): 2026-07-08, 2026-07-09, 2026-07-11, Access Rules, App Modules, Assignment Rules, Backend API Map, Backend Map (+22 more)

### Community 11 - "expenses.controller.ts"
Cohesion: 0.09
Nodes (21): DtoCreateExpense, IsEnum, IsInt, IsOptional, IsString, Min, ExpensesController, RequestUser (+13 more)

### Community 12 - "reports.service.ts"
Cohesion: 0.17
Nodes (15): addExpense(), addOrder(), CostSettings, deliveryPaidFor(), emptyBucket(), ExpenseRow, finalize(), MONTH_LABELS (+7 more)

### Community 13 - "OrderDetail.tsx"
Cohesion: 0.09
Nodes (31): DispatchToExecutorModal(), PayoutInfo, Props, rub(), GulianSyncBlock(), Props, STATUS_LABELS, COMBINING_LOW_LINE (+23 more)

### Community 14 - "daily-plan-rules.ts"
Cohesion: 0.05
Nodes (65): buildDailyPlanMessage(), buildShipmentBlock(), dayMonth(), DELIVERY_LABEL, effectiveDeadline(), executorKey(), inWorkTail(), isWithinPlanWindow() (+57 more)

### Community 15 - "AvitoService"
Cohesion: 0.08
Nodes (15): AvitoMessengerService, Injectable, AvitoAccount, AvitoChat, AvitoChatUser, AvitoMessage, AvitoNotConfiguredError, AvitoRating (+7 more)

### Community 16 - "Брендбук — Распечатка PRO"
Cohesion: 0.08
Nodes (24): 1. Анализ конкурентов, 2. Психология цвета, 3. Цветовая палитра, 4. Типографика, 5. Логотип и иконка, 6. Правила применения, 7. Tone of Voice, 8. Применение на сайте (будущее) (+16 more)

### Community 17 - ".assertOrderFinanciallyEditable"
Cohesion: 0.22
Nodes (5): OrderItemService, Injectable, calcItemPricePosition(), Injectable, TshirtItemService

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
Cohesion: 0.10
Nodes (20): salaryApi, MySalaryPage, AppShell(), NavProps, Props, AD_MGR, ADMIN, ALL (+12 more)

### Community 23 - "dependencies"
Cohesion: 0.10
Nodes (21): axios, dependencies, axios, @hookform/resolvers, lucide-react, react, react-dom, react-hook-form (+13 more)

### Community 24 - "sticker.service.ts"
Cohesion: 0.15
Nodes (13): buildPhotoItemLines(), buildTshirtItemLines(), drawInstagramIcon(), drawTelegramIcon(), FONT_DIR, formatRub(), PRINT_LOCATION_LABELS, req (+5 more)

### Community 25 - "App.tsx"
Cohesion: 0.06
Nodes (41): authApi, AdminRoute(), App(), AppRoutes(), CrmGate(), LoginPage, OrdersPage, OrderStaffRoute() (+33 more)

### Community 26 - "tasks.controller.ts"
Cohesion: 0.12
Nodes (20): DtoCreateTask, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength (+12 more)

### Community 27 - "compilerOptions"
Cohesion: 0.10
Nodes (20): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+12 more)

### Community 28 - "DtoCreateOrder"
Cohesion: 0.13
Nodes (15): DtoCreateOrder, IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString (+7 more)

### Community 29 - "partner-status.ts"
Cohesion: 0.13
Nodes (14): Body, Patch, FLOW_RANK, FROM_PARTNER, fromPartnerStatus(), mapPartnerStage(), PARTNER_SETTABLE_STATUSES, PARTNER_STAGE_MAP (+6 more)

### Community 30 - "order-photo.module.ts"
Cohesion: 0.07
Nodes (30): AppModule, Module, AvitoModule, Module, GulianModule, Module, allowedOrigins(), bootstrap() (+22 more)

### Community 31 - "review-reminder.service.ts"
Cohesion: 0.15
Nodes (12): isReviewReminderEligible(), REVIEW_REMINDER_CATEGORIES, REVIEW_REMINDER_DELAY_MS, REVIEW_REMINDER_PICKUP_DELAY_MS, REVIEW_REMINDER_STATUSES, reviewReminderDelayMs(), buildReviewRequestText(), categoryLabel() (+4 more)

### Community 32 - "TechSpecStorageService"
Cohesion: 0.13
Nodes (11): PartnerAdminController, Controller, Get, Param, Post, Res, UseGuards, UseInterceptors (+3 more)

### Community 33 - "devDependencies"
Cohesion: 0.11
Nodes (19): eslint-plugin-react-hooks, devDependencies, @eslint/js, eslint-plugin-react-hooks, globals, @tailwindcss/vite, @types/node, @types/react (+11 more)

### Community 34 - "getErrorMessage"
Cohesion: 0.09
Nodes (33): partnerSettingsApi, usersApi, SettingsPage, UsersPage, PrintsList(), AssignPanel(), StatusStepper(), AddExpenseModal() (+25 more)

### Community 35 - "DtoCreateLead"
Cohesion: 0.09
Nodes (19): DtoCreateLead, base, meta, pipe, IsBoolean, IsEnum, IsIn, IsInt (+11 more)

### Community 36 - "telegram-update.service.ts"
Cohesion: 0.24
Nodes (7): calcGulianPayout(), Item, PayoutResult, toGulianStatus(), ACTION_STATUS, STATUS_TOAST, TelegramCallback

### Community 37 - "salary.controller.ts"
Cohesion: 0.05
Nodes (36): DtoCreateBonus, IsInt, IsString, IsUUID, MaxLength, Min, MinLength, Type (+28 more)

### Community 38 - "Интеграция с исполнителем-партнёром (печать футболок)"
Cohesion: 0.12
Nodes (15): 1. Модель взаимодействия, 2. Аутентификация, 3. Webhook, который мы отправляем партнёру, 4.1 Данные заказа, 4.2 ТЗ-фото (макет), 4.3 Стикер (PDF, 58×40 мм), 4.4 Смена статуса заказа (партнёр → нам), 4. Эндпоинты, откуда партнёр забирает данные (pull) (+7 more)

### Community 39 - "marketplace.module.ts"
Cohesion: 0.09
Nodes (18): DEFAULT_SIZE_DIMENSIONS, OzonCatalogTemplateService, Injectable, UpdateOzonCatalogTemplateInput, OzonImportPollService, Injectable, OzonImportService, Injectable (+10 more)

### Community 40 - "CRM «Распечатка» — как всё устроено"
Cohesion: 0.11
Nodes (18): 10. Слабые места, 11. Что дальше, 1. Что это, 2. Из чего собрано, 3. Продукты и статусы, 4. Деньги, 5. Роли, 6. Сценарии оформления (+10 more)

### Community 41 - "partner-payload.ts"
Cohesion: 0.19
Nodes (11): PartnerOutboundService, Injectable, buildPartnerOrderPayload(), PartnerOrderForPayload, PartnerOrderPayload, PRINT_LOCATION_LABELS, PRINT_TYPE_LABELS, getTechSpecPathAt() (+3 more)

### Community 42 - "auth.controller.ts"
Cohesion: 0.17
Nodes (12): AuthController, Body, Controller, Post, Throttle, AuthModule, Module, AuthService (+4 more)

### Community 44 - "partner-settings.service.ts"
Cohesion: 0.25
Nodes (11): Db, TshirtItemForSettlement, UpdatePartnerSettingsDto, DEFAULT_PARTNER_RATE_BASIS_POINTS, OrderSettlement, positionMaterials(), PositionSettlement, SettlementPosition (+3 more)

### Community 45 - "lead.controller.ts"
Cohesion: 0.30
Nodes (7): constantTimeEqual(), readBearerToken(), readHeader(), SignedRequest, SiteLeadTokenGuard, stripPrefix(), Injectable

### Community 46 - "DtoAllOrdersforQuery"
Cohesion: 0.13
Nodes (12): DtoAllOrdersforQuery, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength (+4 more)

### Community 47 - "order-photo.service.ts"
Cohesion: 0.12
Nodes (17): LeadMoneyError, LeadMoneyInput, LeadMoneyResult, MAX_POSITION_TOTAL, resolveLeadMoney(), CLOSED_STATUSES, CONTROL_CLOSED_STATUSES, DEFAULT_LIST_HIDDEN_STATUSES (+9 more)

### Community 48 - "salary-integrity.spec.ts"
Cohesion: 0.14
Nodes (13): AccrualByIdRow, AsyncMock, createOrderService(), CreatePaymentArgs, createPrismaStub(), HarnessAccrual, makeOrder(), PaymentByAccrualsHarness (+5 more)

### Community 49 - "ReportsPage.tsx"
Cohesion: 0.09
Nodes (32): expensesApi, ReportsPage, SalaryPage, buildReceiptHtml(), buildReceiptTitle(), escapeHtml(), formatFilenameDate(), printReceipt() (+24 more)

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
Cohesion: 0.21
Nodes (4): TelegramService, Injectable, TelegramUpdateService, Injectable

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

### Community 59 - "partner-api.controller.ts"
Cohesion: 0.27
Nodes (4): DtoPartnerStatus, IsString, PartnerTokenGuard, Injectable

### Community 60 - "package.json"
Cohesion: 0.25
Nodes (7): concurrently, devDependencies, concurrently, name, private, scripts, dev

### Community 61 - "order-photo.controller.ts"
Cohesion: 0.19
Nodes (9): DtoSetReview, IsBoolean, DtoSetShipmentLead, IsOptional, IsString, ValidateIf, IsEnum, UpdateStatus (+1 more)

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

### Community 69 - "ProductsTab.tsx"
Cohesion: 0.09
Nodes (37): CreateOzonPrintDto, EnumOzonSyncStatus, EnumTshirtGender, OzonAttributeValueOption, ozonCatalogApi, OzonCatalogTemplate, OzonColorGroupInput, OzonPrint (+29 more)

### Community 70 - "GulianService"
Cohesion: 0.23
Nodes (4): GulianOutboxProcessorService, Injectable, GulianService, Injectable

### Community 71 - "seed.js"
Cohesion: 0.40
Nodes (3): bcrypt, { Client }, { randomUUID }

### Community 72 - "DtoUpdateOrder"
Cohesion: 0.17
Nodes (11): DtoUpdateOrder, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Matches, MaxLength (+3 more)

### Community 73 - "scenario.controller.ts"
Cohesion: 0.05
Nodes (71): DtoDetectProduct, IsString, MaxLength, DtoSaveDraft, IsObject, IsOptional, IsString, MaxLength (+63 more)

### Community 74 - "React + TypeScript + Vite"
Cohesion: 0.50
Nodes (3): Expanding the ESLint configuration, React Compiler, React + TypeScript + Vite

### Community 76 - "shipment-reminder-rules.ts"
Cohesion: 0.16
Nodes (11): buildShipmentReminder(), DEADLINE_METHODS, dueReminderStage(), hasDeadline(), hoursLeft(), SHIPMENT_REMINDER_STAGES_MS, ShipmentOrder, START (+3 more)

### Community 79 - "marketplace-account.service.ts"
Cohesion: 0.12
Nodes (15): AccountRow, CreateAccountInput, MarketplaceAccountView, UpdateAccountInput, humanize(), OzonApiClient, OzonApiError, OzonCredentials (+7 more)

### Community 81 - "partner-telegram-format.ts"
Cohesion: 0.27
Nodes (9): buildPartnerCaption(), calcSettlement(), esc(), PartnerOrderData, PartnerOrderItem, PRINT_LOCATION_LABELS, PRINT_TYPE_LABELS, rub() (+1 more)

### Community 82 - ".createOrder"
Cohesion: 0.38
Nodes (7): buildCommunicationUrl(), buildMaxUrl(), DEFAULT_MAX_LINK_TEMPLATE, formatPhoneForDisplay(), normalizePhone(), validateCommunicationValue(), calcCanvasMoney()

### Community 83 - "ozon-attributes.ts"
Cohesion: 0.11
Nodes (26): buildImportItem(), buildOfferId(), CatalogTemplateForImport, chunk(), DEFAULT_SIZES, dictAttr(), dictListAttr(), dictListAttrFromLabels() (+18 more)

### Community 87 - "AvitoController"
Cohesion: 0.12
Nodes (16): AvitoController, Body, Controller, Get, Param, Post, Query, UseGuards (+8 more)

### Community 88 - "PartnerSettingsService"
Cohesion: 0.11
Nodes (12): PartnerSettingsController, Body, Controller, Get, Patch, UseGuards, PartnerSettingsService, AnyMock (+4 more)

### Community 91 - "MarketplaceController"
Cohesion: 0.16
Nodes (10): MarketplaceController, Body, Controller, Delete, Get, Param, Patch, Post (+2 more)

### Community 94 - "telegram.service.ts"
Cohesion: 0.19
Nodes (7): logger, proxyDispatcher(), resetTelegramProxyCache(), telegramFetch(), TelegramPollingService, TgUpdateWithId, Injectable

### Community 95 - ".webhook"
Cohesion: 0.24
Nodes (7): TgUpdate, constantTimeEqual(), TelegramWebhookController, Body, Controller, Post, Headers

### Community 96 - "OzonCatalogController"
Cohesion: 0.18
Nodes (10): OzonCatalogController, Body, Controller, Delete, Get, Param, Patch, Post (+2 more)

### Community 97 - "crm-new/package.json"
Cohesion: 0.29
Nodes (6): author, description, license, name, private, version

### Community 98 - "canvas-item.service.ts"
Cohesion: 0.16
Nodes (10): CanvasItemService, canvasMoney(), Injectable, DtoUpdateCanvasItem, IsInt, IsOptional, IsString, MaxLength (+2 more)

### Community 100 - "DtoCreateTshirtItem"
Cohesion: 0.13
Nodes (14): DtoCreateCanvasItem, IsInt, IsString, MaxLength, Min, Type, DtoCreateTshirtItem, IsBoolean (+6 more)

### Community 102 - "MarketplaceAccountService"
Cohesion: 0.22
Nodes (7): MarketplaceAccountService, Injectable, decryptSecret(), deriveKey(), encryptSecret(), secretHint(), SecretKeyMissingError

### Community 112 - "lead-notification.ts"
Cohesion: 0.36
Nodes (6): buildLeadNotification(), escape(), LeadForNotification, NotifiableUser, pickLeadResponders(), toMention()

### Community 114 - "tshirt-item.service.ts"
Cohesion: 0.17
Nodes (10): DtoUpdateTshirtItem, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min, Type (+2 more)

### Community 123 - "ReportsController"
Cohesion: 0.19
Nodes (7): ReportsController, Controller, Get, Query, UseGuards, ReportsModule, Module

### Community 124 - "prisma.service.ts"
Cohesion: 0.24
Nodes (6): RETRY_DELAYS_SECONDS, OrderForOutbox, GulianOrderPayload, GulianResponse, ELIGIBLE_ROLES, ShipmentLeadView

### Community 126 - "DtoUpdateOzonPrint"
Cohesion: 0.17
Nodes (11): DtoUpdateOzonPrint, ArrayMaxSize, IsArray, IsEnum, IsInt, IsOptional, IsString, IsUrl (+3 more)

### Community 130 - "CurrentUser"
Cohesion: 0.23
Nodes (4): CurrentUser, Get, Query, Res

### Community 131 - "PrismaService"
Cohesion: 0.11
Nodes (7): GulianOutboxService, Injectable, HealthController, Controller, Get, PrismaService, Injectable

### Community 133 - "marketplace.controller.ts"
Cohesion: 0.16
Nodes (11): DtoCreateMarketplaceAccount, IsEnum, IsString, MaxLength, MinLength, DtoUpdateMarketplaceAccount, IsBoolean, IsOptional (+3 more)

### Community 134 - "DtoCreateItemOrder"
Cohesion: 0.18
Nodes (11): DtoCreateItemOrder, IsBoolean, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min (+3 more)

### Community 135 - "avito.controller.ts"
Cohesion: 0.10
Nodes (20): ROLES_KEY, JwtAuthGuard, Injectable, RolesGuard, Injectable, DtoSendAvitoMessage, IsString, MaxLength (+12 more)

### Community 136 - "DtoUpdateItemOrder"
Cohesion: 0.18
Nodes (11): DtoUpdateItemOrder, IsBoolean, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min (+3 more)

### Community 137 - "Выкатка: репозиторий → сервер"
Cohesion: 0.29
Nodes (6): Выкатка: репозиторий → сервер, Как это устроено на сервере, Команды, Откат, Почему именно так, Чего в цепочке пока нет

### Community 138 - ".updateStatusOrder"
Cohesion: 0.29
Nodes (6): needsShipmentStatus(), calculateManagerSalarySnapshot(), calculateSalarySnapshot(), earnsStaffSalary(), ManagerSalarySnapshot, SalarySnapshot

### Community 140 - "Интеграция с Ozon Seller API"
Cohesion: 0.15
Nodes (12): 1.1. Что показал живой кабинет (17.08.2026), 1. Что уже сделано (этап 1 — подключение), 2.1. Порядок работы с товаром в Ozon Seller API (справочно), 2. Что уже сделано (этап 2 — карточки товаров), 3. Дальше, API CRM, API CRM, Интеграция с Ozon Seller API (+4 more)

### Community 141 - "DtoAssignExecutor"
Cohesion: 0.20
Nodes (6): DtoAssignExecutor, IsOptional, IsString, IsUUID, escapeHtml(), formatRuDate()

### Community 142 - "order-photo/photo-material.ts"
Cohesion: 0.36
Nodes (8): DECLARED_PRINTS_PER_SHEET, HALF_SHEET_WORDS, normalize(), PhotoItemForCost, photoMaterialCostKopecks(), printsPerSheet(), printsPerSheetBySize(), sheetCostKopecks()

### Community 144 - "DtoUpdateOzonCatalogTemplate"
Cohesion: 0.22
Nodes (8): DtoUpdateOzonCatalogTemplate, IsBoolean, IsInt, IsObject, IsOptional, IsString, Min, Type

### Community 145 - "OrderFinancialIntegrityService"
Cohesion: 0.25
Nodes (3): FinancialClient, OrderFinancialIntegrityService, Injectable

### Community 146 - "scenario-draft.spec.ts"
Cohesion: 0.40
Nodes (3): FakeOrder, READY_PHOTO, READY_TSHIRT

### Community 149 - "order-profit.spec.ts"
Cohesion: 0.36
Nodes (6): calcOrderProfit(), forecastSalary(), kopecksToRub(), OrderProfit, OrderProfitInput, SHEET

### Community 163 - "jwt.strategy.ts"
Cohesion: 0.33
Nodes (3): JwtPayload, JwtStrategy, Injectable

## Knowledge Gaps
- **585 isolated node(s):** `$schema`, `collection`, `sourceRoot`, `deleteOutDir`, `name` (+580 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **53 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PrismaService` connect `PrismaService` to `TasksService`, `users.controller.ts`, `tshirt-partner-telegram.service.ts`, `avito.controller.ts`, `expenses.controller.ts`, `reports.service.ts`, `daily-plan-rules.ts`, `AvitoService`, `OrderFinancialIntegrityService`, `.assertOrderFinanciallyEditable`, `scenario-draft.spec.ts`, `sticker.service.ts`, `tasks.controller.ts`, `partner-status.ts`, `order-photo.module.ts`, `review-reminder.service.ts`, `TechSpecStorageService`, `jwt.strategy.ts`, `.constructor`, `salary.controller.ts`, `telegram-update.service.ts`, `marketplace.module.ts`, `partner-payload.ts`, `auth.controller.ts`, `OrderPhotoService`, `partner-settings.service.ts`, `order-photo.service.ts`, `salary-integrity.spec.ts`, `TelegramService`, `partner-api.controller.ts`, `GulianService`, `scenario.controller.ts`, `shipment-reminder-rules.ts`, `marketplace-account.service.ts`, `ozon-attributes.ts`, `PartnerSettingsService`, `canvas-item.service.ts`, `OzonPrintService`, `tshirt-item.service.ts`, `prisma.service.ts`?**
  _High betweenness centrality (0.092) - this node is a cross-community bridge._
- **Why does `Roles()` connect `Roles` to `ozon-catalog.controller.ts`, `OzonCatalogController`, `CurrentUser`, `TechSpecStorageService`, `TasksService`, `marketplace.controller.ts`, `salary.controller.ts`, `avito.controller.ts`, `users.controller.ts`, `scenario.controller.ts`, `expenses.controller.ts`, `ReportsController`, `AvitoController`, `PartnerSettingsService`, `tasks.controller.ts`, `MarketplaceController`, `order-photo.controller.ts`?**
  _High betweenness centrality (0.077) - this node is a cross-community bridge._
- **Why does `DtoOzonColorGroup` connect `ozon-catalog.controller.ts` to `OzonCatalogController`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **What connects `$schema`, `collection`, `sourceRoot` to the rest of the system?**
  _585 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ozon-catalog.controller.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06097560975609756 - nodes in this community are weakly interconnected._
- **Should `TasksService` be split into smaller, more focused modules?**
  _Cohesion score 0.11397849462365592 - nodes in this community are weakly interconnected._
- **Should `users.controller.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06765327695560254 - nodes in this community are weakly interconnected._