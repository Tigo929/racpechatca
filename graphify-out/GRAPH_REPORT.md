# Graph Report - raspechatka  (2026-08-19)

## Corpus Check
- 351 files · ~159,714 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2728 nodes · 5397 edges · 165 communities (110 shown, 55 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 198 edges (avg confidence: 0.79)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8f820ba9`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- DtoCreateOzonPrint
- TasksService
- dependencies
- users.controller.ts
- TelegramStickerLinkService
- jest
- ozon-product-catalog.controller.ts
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
- order-photo.module.ts
- compilerOptions
- TasksPage.tsx
- compilerOptions
- Аудит проекта «Распечатка» — 2026-06-14
- AppShell.tsx
- dependencies
- sticker.service.ts
- TshirtItemsTable.tsx
- tasks.controller.ts
- compilerOptions
- DtoCreateOrder
- partner-status.ts
- app.module.ts
- review-reminder.service.ts
- PartnerAdminController
- devDependencies
- getErrorMessage
- DtoCreateLead
- marketplace.module.ts
- salary.controller.ts
- Интеграция с исполнителем-партнёром (печать футболок)
- ozon-import.service.ts
- CRM «Распечатка» — как всё устроено
- partner-payload.ts
- auth.controller.ts
- ozon-unit-economics.service.ts
- tshirt-partner-telegram.service.ts
- ozon-product-catalog.service.ts
- DtoAllOrdersforQuery
- order-photo.service.ts
- salary-integrity.spec.ts
- ReportsPage.tsx
- CreateOrderForm.tsx
- Исправленные проблемы
- crm-new/README.md
- App.tsx
- PartnerApiController
- scripts
- frontend/package.json
- Architecture
- Architecture
- ozon-orders.service.ts
- package.json
- order-photo.controller.ts
- ozonProductCatalog.ts
- exclude
- Аудит финансов, кода и продакшена — 2026-07-09
- devDependencies
- AvitoPage.tsx
- nest-cli.json
- MarketplacePage.tsx
- ozonCatalog.ts
- GulianService
- seed.js
- DtoUpdateOrder
- scenario.registry.ts
- React + TypeScript + Vite
- backup-db.sh
- shipment-reminder-rules.ts
- ts-loader
- frontend/tsconfig.json
- OzonCredentials
- @eslint/js
- telegram-update.service.ts
- PrintCardModal.tsx
- ozon-attributes.ts
- @nestjs/cli
- @nestjs/schematics
- @nestjs/testing
- CurrentUser
- PartnerSettingsService
- supertest
- ts-jest
- MarketplaceController
- ts-node
- tsconfig-paths
- TelegramService
- telegram.module.ts
- OzonCatalogController
- crm-new/package.json
- printDraft.ts
- @types/supertest
- MarketplaceAccountService
- typescript-eslint
- .credentials
- eslint-plugin-react-refresh
- OzonPrintService
- tailwindcss
- typescript-eslint
- vite
- ProductsTab.tsx
- partner-api.controller.ts
- DtoUpdatePartnerSettings
- @nestjs/core
- @nestjs/jwt
- @nestjs/mapped-types
- @nestjs/throttler
- passport
- pdf-lib
- TechSpecStorageService
- @types/jest
- GulianOutboxProcessorService
- lead-pricing.ts
- @types/pdfkit
- DtoUpdateOzonPrint
- @prisma/adapter-pg
- @prisma/client
- reflect-metadata
- PartnerStatusPollService
- PrismaService
- DtoQueryTasks
- TelegramPollingService
- HealthController
- ozon-catalog.controller.ts
- DtoUpdateItemOrder
- Выкатка: репозиторий → сервер
- main.ts
- prisma
- 2. Что уже сделано (этап 2 — карточки товаров)
- OzonOrdersController
- UnitEconomicsPanel.tsx
- nginx-routes.spec.ts
- DtoUpdateOzonCatalogTemplate
- .me
- bwip-js
- helmet
- auto-update.sh
- @nestjs/common
- @nestjs/passport
- passport-jwt
- @nestjs/config
- pg
- @nestjs/platform-express
- roboto-fontface
- rxjs
- sharp
- undici
- @eslint/js
- web-push
- jest
- uuid
- @types/express
- class-transformer

## God Nodes (most connected - your core abstractions)
1. `PrismaService` - 82 edges
2. `Roles()` - 66 edges
3. `getErrorMessage()` - 45 edges
4. `CurrentUser` - 34 edges
5. `OrderPhotoController` - 34 edges
6. `OzonCredentials` - 32 edges
7. `TelegramService` - 29 edges
8. `OzonProductCatalogService` - 28 edges
9. `useAuth()` - 27 edges
10. `OrderPhotoService` - 26 edges

## Surprising Connections (you probably didn't know these)
- `AccountCard()` --calls--> `getErrorMessage()`  [EXTRACTED]
  frontend/src/components/marketplace/ConnectionTab.tsx → frontend/src/utils/get-error-message.ts
- `AccountForm()` --calls--> `getErrorMessage()`  [EXTRACTED]
  frontend/src/components/marketplace/ConnectionTab.tsx → frontend/src/utils/get-error-message.ts
- `Props` --references--> `OrderPhoto`  [EXTRACTED]
  frontend/src/components/orders/CanvasItemsTable.tsx → frontend/src/types/index.ts
- `AddExpenseModal()` --calls--> `getErrorMessage()`  [EXTRACTED]
  frontend/src/pages/ReportsPage.tsx → frontend/src/utils/get-error-message.ts
- `AvitoController` --references--> `Roles()`  [EXTRACTED]
  crm-new/src/avito/avito.controller.ts → crm-new/src/auth/decorators/roles.decorator.ts

## Import Cycles
- None detected.

## Communities (165 total, 55 thin omitted)

### Community 0 - "DtoCreateOzonPrint"
Cohesion: 0.06
Nodes (34): DtoCreateOzonPrint, ArrayMaxSize, ArrayMinSize, ArrayNotEmpty, IsArray, IsEnum, IsInt, IsOptional (+26 more)

### Community 1 - "TasksService"
Cohesion: 0.13
Nodes (11): TasksController, Body, Controller, Delete, Get, Param, Patch, Post (+3 more)

### Community 2 - "dependencies"
Cohesion: 0.29
Nodes (7): bcryptjs, class-validator, dependencies, bcryptjs, class-validator, pdfkit, pdfkit

### Community 3 - "users.controller.ts"
Cohesion: 0.07
Nodes (27): DtoCreateUser, IsEnum, IsString, MinLength, DtoUpdateUser, IsBoolean, IsInt, IsOptional (+19 more)

### Community 5 - "jest"
Cohesion: 0.12
Nodes (16): jest, collectCoverageFrom, coverageDirectory, moduleFileExtensions, moduleNameMapper, rootDir, testEnvironment, testRegex (+8 more)

### Community 6 - "ozon-product-catalog.controller.ts"
Cohesion: 0.11
Nodes (27): DtoOzonArchive, DtoOzonPriceItem, DtoOzonStockItem, DtoOzonUpdatePrices, DtoOzonUpdateStocks, ArrayNotEmpty, IsArray, IsBoolean (+19 more)

### Community 7 - "index.ts"
Cohesion: 0.08
Nodes (34): MySalaryBalance, AvitoLinkedOrder, ClosedAccrualBrief, CreateCanvasItemDto, CreateItemDto, CreatePaymentByAccrualsDto, CreatePaymentDto, CreateTshirtItemDto (+26 more)

### Community 8 - "OrdersPage.tsx"
Cohesion: 0.13
Nodes (25): DELIVERY_STYLES, DeliveryBadge(), Props, Props, STATUS_STYLES, StatusBadge(), CANVAS_STATUS_FLOW, CANVAS_STATUS_LABELS (+17 more)

### Community 9 - "Roles"
Cohesion: 0.18
Nodes (11): Roles(), OrderPhotoController, Body, Controller, Delete, Get, Param, Patch (+3 more)

### Community 10 - "System Map"
Cohesion: 0.06
Nodes (30): 2026-07-08, 2026-07-09, 2026-07-11, Access Rules, App Modules, Assignment Rules, Backend API Map, Backend Map (+22 more)

### Community 11 - "DtoCreateExpense"
Cohesion: 0.08
Nodes (20): DtoCreateExpense, IsEnum, IsInt, IsOptional, IsString, Min, ExpensesController, Body (+12 more)

### Community 12 - "reports.service.ts"
Cohesion: 0.08
Nodes (34): calcOrderProfit(), forecastSalary(), kopecksToRub(), OrderProfit, OrderProfitInput, SHEET, DECLARED_PRINTS_PER_SHEET, HALF_SHEET_WORDS (+26 more)

### Community 13 - "OrderDetail.tsx"
Cohesion: 0.07
Nodes (39): ordersApi, CanvasItemsTable(), EditState, EMPTY, money(), Props, toDto(), DispatchToExecutorModal() (+31 more)

### Community 14 - "daily-plan-rules.ts"
Cohesion: 0.05
Nodes (65): buildDailyPlanMessage(), buildShipmentBlock(), dayMonth(), DELIVERY_LABEL, effectiveDeadline(), executorKey(), inWorkTail(), isWithinPlanWindow() (+57 more)

### Community 15 - "AvitoService"
Cohesion: 0.05
Nodes (32): AvitoController, Controller, Get, Param, Post, Query, UseGuards, AvitoMessengerService (+24 more)

### Community 16 - "Брендбук — Распечатка PRO"
Cohesion: 0.08
Nodes (24): 1. Анализ конкурентов, 2. Психология цвета, 3. Цветовая палитра, 4. Типографика, 5. Логотип и иконка, 6. Правила применения, 7. Tone of Voice, 8. Применение на сайте (будущее) (+16 more)

### Community 17 - "order-photo.module.ts"
Cohesion: 0.09
Nodes (16): CanvasItemService, canvasMoney(), Injectable, DtoUpdateCanvasItem, IsInt, IsOptional, IsString, MaxLength (+8 more)

### Community 18 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, allowSyntheticDefaultImports, baseUrl, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, forceConsistentCasingInFileNames (+14 more)

### Community 19 - "TasksPage.tsx"
Cohesion: 0.16
Nodes (16): tasksApi, TasksQuery, TasksPage, daysUntil(), DeadlineChip(), EMPTY_FORM, FILTERS, FormState (+8 more)

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
Cohesion: 0.11
Nodes (19): buildPhotoItemLines(), buildTshirtItemLines(), drawInstagramIcon(), drawTelegramIcon(), FONT_DIR, formatRub(), PRINT_LOCATION_LABELS, req (+11 more)

### Community 25 - "TshirtItemsTable.tsx"
Cohesion: 0.10
Nodes (17): EditState, ItemsTable(), Props, AssignPanelProps, Props, EditState, EMPTY, EMPTY_FREE (+9 more)

### Community 26 - "tasks.controller.ts"
Cohesion: 0.15
Nodes (16): DtoCreateTask, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength (+8 more)

### Community 27 - "compilerOptions"
Cohesion: 0.10
Nodes (20): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+12 more)

### Community 28 - "DtoCreateOrder"
Cohesion: 0.08
Nodes (26): DtoCreateItemOrder, IsBoolean, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min (+18 more)

### Community 29 - "partner-status.ts"
Cohesion: 0.18
Nodes (12): Body, Patch, FLOW_RANK, FROM_PARTNER, fromPartnerStatus(), mapPartnerStage(), PARTNER_SETTABLE_STATUSES, PARTNER_STAGE_MAP (+4 more)

### Community 30 - "app.module.ts"
Cohesion: 0.10
Nodes (19): MarketplaceModule, Module, OrderPhotoModule, Module, PartnerModule, Module, PrismaModule, Module (+11 more)

### Community 31 - "review-reminder.service.ts"
Cohesion: 0.17
Nodes (12): isReviewReminderEligible(), REVIEW_REMINDER_CATEGORIES, REVIEW_REMINDER_DELAY_MS, REVIEW_REMINDER_PICKUP_DELAY_MS, REVIEW_REMINDER_STATUSES, reviewReminderDelayMs(), buildReviewRequestText(), categoryLabel() (+4 more)

### Community 32 - "PartnerAdminController"
Cohesion: 0.19
Nodes (9): PartnerAdminController, Controller, Get, Param, Post, Res, UploadedFiles, UseGuards (+1 more)

### Community 33 - "devDependencies"
Cohesion: 0.11
Nodes (19): eslint-plugin-react-hooks, devDependencies, eslint, eslint-plugin-react-hooks, globals, @tailwindcss/vite, @types/node, @types/react (+11 more)

### Community 34 - "getErrorMessage"
Cohesion: 0.08
Nodes (38): api, partnerSettingsApi, shipmentLeadApi, usersApi, SalaryPage, SettingsPage, UsersPage, AssignPanel() (+30 more)

### Community 35 - "DtoCreateLead"
Cohesion: 0.05
Nodes (37): DtoCreateLead, base, meta, pipe, IsBoolean, IsEnum, IsIn, IsInt (+29 more)

### Community 36 - "marketplace.module.ts"
Cohesion: 0.11
Nodes (16): ALLOWED_INPUT, OZON_PHOTO_MAX_BYTES, OZON_PHOTO_MAX_FILES, OzonPhotoStorageService, Injectable, OzonPhotoController, Controller, Get (+8 more)

### Community 37 - "salary.controller.ts"
Cohesion: 0.05
Nodes (34): DtoCreateBonus, IsInt, IsString, IsUUID, MaxLength, Min, MinLength, Type (+26 more)

### Community 38 - "Интеграция с исполнителем-партнёром (печать футболок)"
Cohesion: 0.12
Nodes (15): 1. Модель взаимодействия, 2. Аутентификация, 3. Webhook, который мы отправляем партнёру, 4.1 Данные заказа, 4.2 ТЗ-фото (макет), 4.3 Стикер (PDF, 58×40 мм), 4.4 Смена статуса заказа (партнёр → нам), 4. Эндпоинты, откуда партнёр забирает данные (pull) (+7 more)

### Community 39 - "ozon-import.service.ts"
Cohesion: 0.08
Nodes (18): DEFAULT_SIZE_DIMENSIONS, OzonCatalogTemplateService, Injectable, UpdateOzonCatalogTemplateInput, OzonImportPollService, Injectable, OzonImportService, Injectable (+10 more)

### Community 40 - "CRM «Распечатка» — как всё устроено"
Cohesion: 0.11
Nodes (18): 10. Слабые места, 11. Что дальше, 1. Что это, 2. Из чего собрано, 3. Продукты и статусы, 4. Деньги, 5. Роли, 6. Сценарии оформления (+10 more)

### Community 41 - "partner-payload.ts"
Cohesion: 0.19
Nodes (11): PartnerOutboundService, Injectable, buildPartnerOrderPayload(), PartnerOrderForPayload, PartnerOrderPayload, PRINT_LOCATION_LABELS, PRINT_TYPE_LABELS, getTechSpecPathAt() (+3 more)

### Community 42 - "auth.controller.ts"
Cohesion: 0.16
Nodes (12): AuthController, Body, Controller, Post, Throttle, AuthModule, Module, AuthService (+4 more)

### Community 43 - "ozon-unit-economics.service.ts"
Cohesion: 0.13
Nodes (16): OzonProductTariffs, calculateUnitEconomics(), OzonTariffs, realSettings, settings, tariffs, UnitEconomicsLine, UnitEconomicsResult (+8 more)

### Community 44 - "tshirt-partner-telegram.service.ts"
Cohesion: 0.11
Nodes (20): escapeHtml(), EXT_CONTENT_TYPE, money(), PRINT_LOCATION_LABELS, PRINT_TYPE_LABELS, TechSpecAttachment, Injectable, TshirtOrderWithItems (+12 more)

### Community 45 - "ozon-product-catalog.service.ts"
Cohesion: 0.09
Nodes (21): OzonActionView, OzonCatalogProduct, OzonContentRating, OzonDemand, OzonImportAttributeBody, OzonProductCard, RawActionsResponse, RawAnalyticsResponse (+13 more)

### Community 46 - "DtoAllOrdersforQuery"
Cohesion: 0.17
Nodes (11): DtoAllOrdersforQuery, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength (+3 more)

### Community 47 - "order-photo.service.ts"
Cohesion: 0.06
Nodes (37): buildCommunicationUrl(), buildMaxUrl(), DEFAULT_MAX_LINK_TEMPLATE, formatPhoneForDisplay(), normalizePhone(), validateCommunicationValue(), DtoAssignExecutor, IsOptional (+29 more)

### Community 48 - "salary-integrity.spec.ts"
Cohesion: 0.14
Nodes (13): AccrualByIdRow, AsyncMock, createOrderService(), CreatePaymentArgs, createPrismaStub(), HarnessAccrual, makeOrder(), PaymentByAccrualsHarness (+5 more)

### Community 49 - "ReportsPage.tsx"
Cohesion: 0.09
Nodes (32): expensesApi, reportsApi, ReportsPage, buildReceiptHtml(), buildReceiptTitle(), escapeHtml(), formatFilenameDate(), printReceipt() (+24 more)

### Community 50 - "CreateOrderForm.tsx"
Cohesion: 0.11
Nodes (22): baseSchema, canvasItemSchema, CreateOrderForm(), FormValues, freeItemSchema, fullSchema, isRussianPhone(), photoItemSchema (+14 more)

### Community 51 - "Исправленные проблемы"
Cohesion: 0.18
Nodes (10): CRITICAL, CRM Audit Report — 2026-06-14, HIGH, HIGH, LOW, MEDIUM, MEDIUM, Исправленные проблемы (+2 more)

### Community 52 - "crm-new/README.md"
Cohesion: 0.20
Nodes (9): Compile and run the project, Deployment, Description, License, Project setup, Resources, Run tests, Stay in touch (+1 more)

### Community 53 - "App.tsx"
Cohesion: 0.10
Nodes (23): authApi, salaryApi, AdminRoute(), App(), AppRoutes(), CrmGate(), LoginPage, MySalaryPage (+15 more)

### Community 54 - "PartnerApiController"
Cohesion: 0.32
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

### Community 59 - "ozon-orders.service.ts"
Cohesion: 0.16
Nodes (14): GROUP_BY_STATUS, groupForStatus(), isShipmentOverdue(), OzonOrderGroup, STATUS_LABELS, statusLabel(), OzonOrderItem, OzonOrdersPage (+6 more)

### Community 60 - "package.json"
Cohesion: 0.25
Nodes (7): concurrently, devDependencies, concurrently, name, private, scripts, dev

### Community 61 - "order-photo.controller.ts"
Cohesion: 0.07
Nodes (29): DtoCreateCanvasItem, IsInt, IsString, MaxLength, Min, Type, DtoCreateTshirtItem, IsBoolean (+21 more)

### Community 62 - "ozonProductCatalog.ts"
Cohesion: 0.11
Nodes (19): COLOR_CODES, COLOR_SUFFIX, EditResult, OzonAction, OzonCatalogProduct, OzonContentRating, OzonProductCard, ozonProductCatalogApi (+11 more)

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
Cohesion: 0.07
Nodes (38): CreateAccountDto, EnumMarketplace, MarketplaceAccount, marketplaceApi, OzonConnectionInfo, UpdateAccountDto, OzonOrder, OzonOrderGroup (+30 more)

### Community 69 - "ozonCatalog.ts"
Cohesion: 0.13
Nodes (19): CreateOzonPrintDto, EnumOzonSyncStatus, OzonAttributeValueOption, ozonCatalogApi, OzonCatalogTemplate, PublishResult, SizeDimensions, UpdateOzonCatalogTemplateDto (+11 more)

### Community 70 - "GulianService"
Cohesion: 0.21
Nodes (7): GulianModule, Module, RETRY_DELAYS_SECONDS, GulianOrderPayload, GulianResponse, GulianService, Injectable

### Community 71 - "seed.js"
Cohesion: 0.40
Nodes (3): bcrypt, { Client }, { randomUUID }

### Community 72 - "DtoUpdateOrder"
Cohesion: 0.17
Nodes (11): DtoUpdateOrder, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Matches, MaxLength (+3 more)

### Community 73 - "scenario.registry.ts"
Cohesion: 0.05
Nodes (64): DtoSaveDraft, IsObject, IsOptional, IsString, MaxLength, DELIVERY_STEPS, NOTE_STEP, OPTIONAL (+56 more)

### Community 74 - "React + TypeScript + Vite"
Cohesion: 0.50
Nodes (3): Expanding the ESLint configuration, React Compiler, React + TypeScript + Vite

### Community 76 - "shipment-reminder-rules.ts"
Cohesion: 0.16
Nodes (11): buildShipmentReminder(), DEADLINE_METHODS, dueReminderStage(), hasDeadline(), hoursLeft(), SHIPMENT_REMINDER_STAGES_MS, ShipmentOrder, START (+3 more)

### Community 79 - "OzonCredentials"
Cohesion: 0.09
Nodes (13): humanize(), OzonApiClient, OzonApiError, OzonCredentials, OzonErrorBody, Injectable, OzonProductCatalogService, Injectable (+5 more)

### Community 81 - "telegram-update.service.ts"
Cohesion: 0.13
Nodes (18): OrderForOutbox, calcGulianPayout(), Item, PayoutResult, toGulianStatus(), buildPartnerButtons(), buildPartnerCaption(), calcSettlement() (+10 more)

### Community 82 - "PrintCardModal.tsx"
Cohesion: 0.19
Nodes (18): baseCodeOf(), colorCodeOf(), groupByColor(), printCodeOf(), sizeOf(), sizeRank(), CatalogTab(), colorsOf() (+10 more)

### Community 83 - "ozon-attributes.ts"
Cohesion: 0.11
Nodes (25): buildExtraImages(), buildImportItem(), CatalogTemplateForImport, chunk(), COLOR_CODE_BY_LABEL, DEFAULT_SIZES, dictAttr(), dictListAttr() (+17 more)

### Community 87 - "CurrentUser"
Cohesion: 0.21
Nodes (4): CurrentUser, Body, Post, Query

### Community 88 - "PartnerSettingsService"
Cohesion: 0.11
Nodes (12): PartnerSettingsController, Body, Controller, Get, Patch, UseGuards, PartnerSettingsService, AnyMock (+4 more)

### Community 91 - "MarketplaceController"
Cohesion: 0.08
Nodes (21): DtoCreateMarketplaceAccount, IsEnum, IsString, MaxLength, MinLength, DtoUpdateMarketplaceAccount, IsBoolean, IsOptional (+13 more)

### Community 94 - "TelegramService"
Cohesion: 0.14
Nodes (9): logger, proxyDispatcher(), resetTelegramProxyCache(), telegramFetch(), TgUpdateWithId, TelegramService, Injectable, TelegramUpdateService (+1 more)

### Community 95 - "telegram.module.ts"
Cohesion: 0.16
Nodes (11): StickerModule, Module, TelegramModule, Module, TgUpdate, constantTimeEqual(), TelegramWebhookController, Body (+3 more)

### Community 96 - "OzonCatalogController"
Cohesion: 0.20
Nodes (10): OzonCatalogController, Body, Controller, Delete, Get, Param, Patch, Post (+2 more)

### Community 97 - "crm-new/package.json"
Cohesion: 0.29
Nodes (6): author, description, license, name, private, version

### Community 98 - "printDraft.ts"
Cohesion: 0.20
Nodes (16): EnumTshirtGender, OzonColorGroupInput, OzonVariant, ALL_SIZES, COLOR_CODE_BY_LABEL, colorCodeFor(), ColorGroupDraft, DEFAULT_SIZES (+8 more)

### Community 100 - "MarketplaceAccountService"
Cohesion: 0.17
Nodes (11): AccountRow, CreateAccountInput, MarketplaceAccountService, MarketplaceAccountView, Injectable, UpdateAccountInput, decryptSecret(), deriveKey() (+3 more)

### Community 102 - ".credentials"
Cohesion: 0.22
Nodes (9): OzonProductCatalogController, Body, Controller, Get, Param, Patch, Post, Query (+1 more)

### Community 104 - "OzonPrintService"
Cohesion: 0.18
Nodes (10): buildOfferId(), colorCodeFor(), normalizeSlug(), slugify(), stripUnsafe(), ColorGroupInput, CreatePrintInput, OzonPrintService (+2 more)

### Community 112 - "ProductsTab.tsx"
Cohesion: 0.18
Nodes (13): OzonPrint, EditPrintModal(), draftErrors(), draftToPayload(), emptyPrintDraft(), GENDER_LABELS, BulkCreateForm(), Mode (+5 more)

### Community 113 - "partner-api.controller.ts"
Cohesion: 0.27
Nodes (4): DtoPartnerStatus, IsString, PartnerTokenGuard, Injectable

### Community 114 - "DtoUpdatePartnerSettings"
Cohesion: 0.25
Nodes (7): DtoUpdatePartnerSettings, IsInt, IsOptional, IsString, Max, MaxLength, Min

### Community 124 - "lead-pricing.ts"
Cohesion: 0.38
Nodes (5): LeadMoneyError, LeadMoneyInput, LeadMoneyResult, MAX_POSITION_TOTAL, resolveLeadMoney()

### Community 126 - "DtoUpdateOzonPrint"
Cohesion: 0.17
Nodes (11): DtoUpdateOzonPrint, ArrayMaxSize, IsArray, IsEnum, IsInt, IsOptional, IsString, IsUrl (+3 more)

### Community 131 - "PrismaService"
Cohesion: 0.08
Nodes (11): JwtPayload, JwtStrategy, Injectable, GulianOutboxService, Injectable, ELIGIBLE_ROLES, ShipmentLeadService, ShipmentLeadView (+3 more)

### Community 132 - "DtoQueryTasks"
Cohesion: 0.33
Nodes (5): DtoQueryTasks, IsEnum, IsOptional, IsUUID, Query

### Community 134 - "HealthController"
Cohesion: 0.33
Nodes (3): HealthController, Controller, Get

### Community 135 - "ozon-catalog.controller.ts"
Cohesion: 0.07
Nodes (33): AuthenticatedRequest, AuthenticatedUser, ROLES_KEY, JwtAuthGuard, Injectable, RolesGuard, Injectable, DtoSendAvitoMessage (+25 more)

### Community 136 - "DtoUpdateItemOrder"
Cohesion: 0.12
Nodes (16): DtoUpdateItemOrder, IsBoolean, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min (+8 more)

### Community 137 - "Выкатка: репозиторий → сервер"
Cohesion: 0.29
Nodes (6): Выкатка: репозиторий → сервер, Как это устроено на сервере, Команды, Откат, Почему именно так, Чего в цепочке пока нет

### Community 138 - "main.ts"
Cohesion: 0.50
Nodes (4): AppModule, Module, allowedOrigins(), bootstrap()

### Community 140 - "2. Что уже сделано (этап 2 — карточки товаров)"
Cohesion: 0.10
Nodes (19): 1.1. Что показал живой кабинет (17.08.2026), 1. Что уже сделано (этап 1 — подключение), 2.1. Порядок работы с товаром в Ozon Seller API (справочно), 2.2. Заказы (этап 3, только чтение), 2.3. Мои товары и юнит-экономика (этап 4), 2. Что уже сделано (этап 2 — карточки товаров), 3. Дальше, API CRM (+11 more)

### Community 141 - "OzonOrdersController"
Cohesion: 0.25
Nodes (6): OzonOrdersController, Controller, Get, Param, Query, UseGuards

### Community 142 - "UnitEconomicsPanel.tsx"
Cohesion: 0.60
Nodes (4): ProductEconomics, Line(), money(), UnitEconomicsPanel()

### Community 144 - "DtoUpdateOzonCatalogTemplate"
Cohesion: 0.17
Nodes (11): DtoUpdateOzonCatalogTemplate, ArrayMaxSize, IsArray, IsBoolean, IsInt, IsObject, IsOptional, IsString (+3 more)

## Knowledge Gaps
- **649 isolated node(s):** `$schema`, `collection`, `sourceRoot`, `deleteOutDir`, `name` (+644 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **55 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PrismaService` connect `PrismaService` to `TasksService`, `PartnerStatusPollService`, `users.controller.ts`, `HealthController`, `ozon-catalog.controller.ts`, `DtoUpdateItemOrder`, `DtoCreateExpense`, `reports.service.ts`, `daily-plan-rules.ts`, `AvitoService`, `order-photo.module.ts`, `sticker.service.ts`, `tasks.controller.ts`, `partner-status.ts`, `app.module.ts`, `review-reminder.service.ts`, `PartnerAdminController`, `salary.controller.ts`, `ozon-import.service.ts`, `partner-payload.ts`, `auth.controller.ts`, `ozon-unit-economics.service.ts`, `tshirt-partner-telegram.service.ts`, `order-photo.service.ts`, `salary-integrity.spec.ts`, `PartnerApiController`, `order-photo.controller.ts`, `GulianService`, `scenario.registry.ts`, `shipment-reminder-rules.ts`, `OzonCredentials`, `telegram-update.service.ts`, `PartnerSettingsService`, `TelegramService`, `MarketplaceAccountService`, `OzonPrintService`, `partner-api.controller.ts`, `GulianOutboxProcessorService`?**
  _High betweenness centrality (0.093) - this node is a cross-community bridge._
- **Why does `Roles()` connect `Roles` to `TasksService`, `users.controller.ts`, `DtoQueryTasks`, `ozon-product-catalog.controller.ts`, `ozon-catalog.controller.ts`, `DtoCreateExpense`, `reports.service.ts`, `OzonOrdersController`, `AvitoService`, `tasks.controller.ts`, `PartnerAdminController`, `marketplace.module.ts`, `salary.controller.ts`, `order-photo.controller.ts`, `scenario.registry.ts`, `CurrentUser`, `PartnerSettingsService`, `MarketplaceController`, `OzonCatalogController`, `.credentials`?**
  _High betweenness centrality (0.082) - this node is a cross-community bridge._
- **Why does `DtoCreateLead` connect `DtoCreateLead` to `order-photo.service.ts`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **What connects `$schema`, `collection`, `sourceRoot` to the rest of the system?**
  _649 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `DtoCreateOzonPrint` be split into smaller, more focused modules?**
  _Cohesion score 0.06006006006006006 - nodes in this community are weakly interconnected._
- **Should `TasksService` be split into smaller, more focused modules?**
  _Cohesion score 0.12698412698412698 - nodes in this community are weakly interconnected._
- **Should `users.controller.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07200929152148665 - nodes in this community are weakly interconnected._