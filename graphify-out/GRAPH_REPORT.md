# Graph Report - racpechatca  (2026-08-24)

## Corpus Check
- 427 files · ~220,350 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 3444 nodes · 7100 edges · 183 communities (132 shown, 51 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 295 edges (avg confidence: 0.79)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a6a3694e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- DtoCreateOzonPrint
- tasks.controller.ts
- dependencies
- DtoUpdateUser
- telegram.module.ts
- jest
- DtoOzonArchive
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
- DtoUpdateCanvasItem
- compilerOptions
- ImageCardBatchController
- compilerOptions
- Аудит проекта «Распечатка» — 2026-06-14
- TasksPage.tsx
- dependencies
- sticker.service.ts
- TshirtItemsTable.tsx
- ApprovalEditor.tsx
- compilerOptions
- DtoCreateOrder
- partner-api.controller.ts
- app.module.ts
- review-reminder.service.ts
- TechSpecStorageService
- devDependencies
- getErrorMessage
- DtoCreateLead
- OzonPhotoStorageService
- salary.controller.ts
- Интеграция с исполнителем-партнёром (печать футболок)
- marketplace.module.ts
- CRM «Распечатка» — как всё устроено
- SettingsPage.tsx
- auth.controller.ts
- ozon-unit-economics.service.ts
- image-card-placement.ts
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
- approval-render.service.ts
- ozonProductCatalog.ts
- exclude
- Аудит финансов, кода и продакшена — 2026-07-09
- devDependencies
- AvitoPage.tsx
- nest-cli.json
- MarketplacePage.tsx
- ozonCatalog.ts
- gulian-outbox.service.ts
- seed.js
- order-photo.controller.ts
- OzonPrintService
- React + TypeScript + Vite
- backup-db.sh
- shipment-reminder-rules.ts
- ts-loader
- frontend/tsconfig.json
- OzonCredentials
- @eslint/js
- telegram-update.service.ts
- ImageCardTemplateService
- ozon-attributes.ts
- @nestjs/cli
- image-cards.module.ts
- approval.module.ts
- ApprovalService
- tshirt-partner-telegram.service.ts
- supertest
- ImageCardStorageService
- MarketplaceController
- ts-node
- MockupService
- telegram.service.ts
- .webhook
- OzonCatalogController
- crm-new/package.json
- ProductsTab.tsx
- @types/supertest
- MarketplaceAccountService
- PdfRasterService
- .credentials
- eslint-plugin-react-refresh
- TshirtPartnerTelegramService
- tailwindcss
- typescript-eslint
- vite
- DtoUpdatePartnerSettings
- MockupTemplatesCard.tsx
- .updateStatusOrder
- @nestjs/core
- OzonOrdersController
- DtoCreateOzonPrintsBulk
- @nestjs/throttler
- passport
- pdf-lib
- TelegramPollingService
- DtoOzonUpdateCardText
- DtoPublishOzonPrints
- ТЗ: семантика и структура страниц raspechatkaa.ru
- roboto-fontface
- DtoUpdateOzonPrint
- @prisma/adapter-pg
- @prisma/client
- eslint-config-prettier
- ApprovalController
- eslint-plugin-prettier
- approval.service.ts
- @nestjs/schematics
- PrismaService
- ozon-catalog.controller.ts
- .assertOrderFinanciallyEditable
- Выкатка: репозиторий → сервер
- @nestjs/testing
- prisma
- 2. Что уже сделано (этап 2 — карточки товаров)
- DtoBulkCards
- lead.controller.ts
- nginx-routes.spec.ts
- DtoUpdateOzonCatalogTemplate
- source-map-support
- ТЗ: раздел «Печать на холсте» на raspechatkaa.ru
- canvas-production-price.ts
- auto-update.sh
- ts-jest
- @types/archiver
- @types/node
- @nestjs/config
- ScenarioController
- typescript-eslint
- canvas.pricing.ts
- sharp
- undici
- @eslint/js
- jest
- ApprovalStorageService
- class-transformer
- scenario.registry.ts
- DtoUpdateItemOrder
- TelegramService
- DtoUpdateOzonUnitEconomics
- DtoUpdateOrder
- lead-notification.ts
- OrderPhotoService
- @eslint/eslintrc
- globals
- prettier
- @types/multer
- @nestjs/common
- @types/passport-jwt
- typescript
- LeadController
- @nestjs/passport
- tsconfig-paths
- pdfkit
- pg
- uuid
- web-push

## God Nodes (most connected - your core abstractions)
1. `PrismaService` - 96 edges
2. `Roles()` - 88 edges
3. `getErrorMessage()` - 66 edges
4. `CurrentUser` - 38 edges
5. `OrderPhotoController` - 36 edges
6. `OzonCredentials` - 33 edges
7. `useAuth()` - 31 edges
8. `OzonProductCatalogService` - 29 edges
9. `TelegramService` - 29 edges
10. `OrderPhotoService` - 28 edges

## Surprising Connections (you probably didn't know these)
- `AccountCard()` --calls--> `getErrorMessage()`  [EXTRACTED]
  frontend/src/components/marketplace/ConnectionTab.tsx → frontend/src/utils/get-error-message.ts
- `AccountForm()` --calls--> `getErrorMessage()`  [EXTRACTED]
  frontend/src/components/marketplace/ConnectionTab.tsx → frontend/src/utils/get-error-message.ts
- `BonusForm()` --calls--> `getErrorMessage()`  [EXTRACTED]
  frontend/src/pages/SalaryPage.tsx → frontend/src/utils/get-error-message.ts
- `TelegramEditor()` --calls--> `getErrorMessage()`  [EXTRACTED]
  frontend/src/pages/UsersPage.tsx → frontend/src/utils/get-error-message.ts
- `ApprovalController` --references--> `Roles()`  [EXTRACTED]
  crm-new/src/approval/approval.controller.ts → crm-new/src/auth/decorators/roles.decorator.ts

## Import Cycles
- None detected.

## Communities (183 total, 51 thin omitted)

### Community 0 - "DtoCreateOzonPrint"
Cohesion: 0.07
Nodes (28): DtoCreateOzonPrint, ArrayMaxSize, ArrayMinSize, ArrayNotEmpty, IsArray, IsEnum, IsInt, IsOptional (+20 more)

### Community 1 - "tasks.controller.ts"
Cohesion: 0.07
Nodes (32): DtoCreateTask, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength (+24 more)

### Community 2 - "dependencies"
Cohesion: 0.09
Nodes (23): archiver, bcryptjs, bwip-js, class-validator, dependencies, archiver, bcryptjs, bwip-js (+15 more)

### Community 3 - "DtoUpdateUser"
Cohesion: 0.06
Nodes (28): DtoCreateUser, IsEnum, IsString, MinLength, DtoUpdateUser, IsBoolean, IsInt, IsOptional (+20 more)

### Community 4 - "telegram.module.ts"
Cohesion: 0.14
Nodes (10): TelegramModule, Module, TelegramStickerController, Controller, Get, Param, Query, Res (+2 more)

### Community 5 - "jest"
Cohesion: 0.12
Nodes (16): jest, collectCoverageFrom, coverageDirectory, moduleFileExtensions, moduleNameMapper, rootDir, testEnvironment, testRegex (+8 more)

### Community 6 - "DtoOzonArchive"
Cohesion: 0.27
Nodes (14): DtoOzonArchive, DtoOzonPriceItem, DtoOzonStockItem, DtoOzonUpdatePrices, DtoOzonUpdateStocks, ArrayNotEmpty, IsArray, IsBoolean (+6 more)

### Community 7 - "index.ts"
Cohesion: 0.06
Nodes (46): canvasProductionApi, CanvasProductionPricing, CanvasProductionSize, CanvasItemsTable(), EditState, EMPTY, money(), Props (+38 more)

### Community 8 - "OrdersPage.tsx"
Cohesion: 0.08
Nodes (36): ExecutorFilter(), Props, StatusStepper(), DELIVERY_STYLES, DeliveryBadge(), Props, FilterChip(), Props (+28 more)

### Community 9 - "Roles"
Cohesion: 0.11
Nodes (16): CurrentUser, Roles(), OrderPhotoController, Body, Controller, Delete, Get, Param (+8 more)

### Community 10 - "System Map"
Cohesion: 0.06
Nodes (34): 2026-07-08, 2026-07-09, 2026-07-11, 2026-08-24, 2026-08-24 (later), Access Rules, App Modules, Assignment Rules (+26 more)

### Community 11 - "DtoCreateExpense"
Cohesion: 0.08
Nodes (20): DtoCreateExpense, IsEnum, IsInt, IsOptional, IsString, Min, ExpensesController, Body (+12 more)

### Community 12 - "reports.service.ts"
Cohesion: 0.07
Nodes (36): calcOrderProfit(), forecastSalary(), kopecksToRub(), OrderProfit, OrderProfitInput, SHEET, DECLARED_PRINTS_PER_SHEET, HALF_SHEET_WORDS (+28 more)

### Community 13 - "OrderDetail.tsx"
Cohesion: 0.09
Nodes (31): ordersApi, DispatchToExecutorModal(), PayoutInfo, Props, rub(), GulianSyncBlock(), Props, STATUS_LABELS (+23 more)

### Community 14 - "daily-plan-rules.ts"
Cohesion: 0.05
Nodes (65): buildDailyPlanMessage(), buildShipmentBlock(), dayMonth(), DELIVERY_LABEL, effectiveDeadline(), executorKey(), inWorkTail(), isWithinPlanWindow() (+57 more)

### Community 15 - "AvitoService"
Cohesion: 0.05
Nodes (31): AvitoController, Body, Controller, Get, Param, Post, Query, UseGuards (+23 more)

### Community 16 - "Брендбук — Распечатка PRO"
Cohesion: 0.08
Nodes (24): 1. Анализ конкурентов, 2. Психология цвета, 3. Цветовая палитра, 4. Типографика, 5. Логотип и иконка, 6. Правила применения, 7. Tone of Voice, 8. Применение на сайте (будущее) (+16 more)

### Community 17 - "DtoUpdateCanvasItem"
Cohesion: 0.15
Nodes (11): CanvasItemService, canvasMoney(), Injectable, DtoUpdateCanvasItem, IsIn, IsInt, IsOptional, IsString (+3 more)

### Community 18 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, allowSyntheticDefaultImports, baseUrl, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, forceConsistentCasingInFileNames (+14 more)

### Community 19 - "ImageCardBatchController"
Cohesion: 0.07
Nodes (25): DtoCreateImageCardBatch, ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, IsUUID (+17 more)

### Community 20 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection, moduleResolution (+14 more)

### Community 21 - "Аудит проекта «Распечатка» — 2026-06-14"
Cohesion: 0.09
Nodes (21): 10.1 Почему PDF «не формировался» и долго генерировался, 10.2 Декомпозиция API-слоя (был god-файл), 10.3 Группировка компонентов, 10.4 Автоматические бэкапы БД (рекомендация №1), 10.5 Итоговая структура фронта, 10.6 Деплой раунда 2, 10. Раунд 2 — PDF, декомпозиция API/компонентов, бэкапы (тот же день), 1. Резюме и метрики (+13 more)

### Community 22 - "TasksPage.tsx"
Cohesion: 0.07
Nodes (32): tasksApi, TasksQuery, TasksPage, AppShell(), NavProps, Props, AD_MGR, ADMIN (+24 more)

### Community 23 - "dependencies"
Cohesion: 0.10
Nodes (21): axios, dependencies, axios, @hookform/resolvers, lucide-react, react, react-dom, react-hook-form (+13 more)

### Community 24 - "sticker.service.ts"
Cohesion: 0.18
Nodes (13): buildPhotoItemLines(), buildTshirtItemLines(), drawInstagramIcon(), drawTelegramIcon(), FONT_DIR, formatRub(), PRINT_LOCATION_LABELS, req (+5 more)

### Community 25 - "TshirtItemsTable.tsx"
Cohesion: 0.10
Nodes (18): Props, ProductsTab(), EditState, EMPTY, EMPTY_FREE, FreeState, PositionMoney(), TshirtItemsTable() (+10 more)

### Community 26 - "ApprovalEditor.tsx"
Cohesion: 0.09
Nodes (41): approvalsApi, ApprovalEditor(), CmField(), downloadBlob(), Props, SIDE_LABELS, Sides, ApprovalsBlock() (+33 more)

### Community 27 - "compilerOptions"
Cohesion: 0.10
Nodes (20): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+12 more)

### Community 28 - "DtoCreateOrder"
Cohesion: 0.08
Nodes (26): DtoCreateItemOrder, IsBoolean, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min (+18 more)

### Community 29 - "partner-api.controller.ts"
Cohesion: 0.07
Nodes (27): DtoPartnerStatus, IsString, PartnerOutboundService, Injectable, buildPartnerOrderPayload(), PartnerOrderForPayload, PartnerOrderPayload, PRINT_LOCATION_LABELS (+19 more)

### Community 30 - "app.module.ts"
Cohesion: 0.09
Nodes (23): AppModule, Module, AvitoModule, Module, CanvasModule, Module, GulianModule, Module (+15 more)

### Community 31 - "review-reminder.service.ts"
Cohesion: 0.15
Nodes (12): isReviewReminderEligible(), REVIEW_REMINDER_CATEGORIES, REVIEW_REMINDER_DELAY_MS, REVIEW_REMINDER_PICKUP_DELAY_MS, REVIEW_REMINDER_STATUSES, reviewReminderDelayMs(), buildReviewRequestText(), categoryLabel() (+4 more)

### Community 32 - "TechSpecStorageService"
Cohesion: 0.13
Nodes (11): PartnerAdminController, Controller, Get, Param, Post, Res, UploadedFiles, UseGuards (+3 more)

### Community 33 - "devDependencies"
Cohesion: 0.11
Nodes (19): eslint-plugin-react-hooks, devDependencies, eslint, eslint-plugin-react-hooks, globals, @tailwindcss/vite, @types/node, @types/react (+11 more)

### Community 34 - "getErrorMessage"
Cohesion: 0.07
Nodes (53): ozonBatchesApi, ozonCardsApi, CardBatchReport(), CardEditorModal(), CardFinalizePanel(), BatchList(), CardGeneratorTab(), MODE_LABELS (+45 more)

### Community 35 - "DtoCreateLead"
Cohesion: 0.09
Nodes (18): DtoCreateLead, base, meta, pipe, IsBoolean, IsEnum, IsIn, IsInt (+10 more)

### Community 36 - "OzonPhotoStorageService"
Cohesion: 0.12
Nodes (13): OzonPhotoStorageService, Injectable, OzonPhotoController, Controller, Get, Param, Post, Req (+5 more)

### Community 37 - "salary.controller.ts"
Cohesion: 0.05
Nodes (36): DtoCreateBonus, IsInt, IsString, IsUUID, MaxLength, Min, MinLength, Type (+28 more)

### Community 38 - "Интеграция с исполнителем-партнёром (печать футболок)"
Cohesion: 0.12
Nodes (15): 1. Модель взаимодействия, 2. Аутентификация, 3. Webhook, который мы отправляем партнёру, 4.1 Данные заказа, 4.2 ТЗ-фото (макет), 4.3 Стикер (PDF, 58×40 мм), 4.4 Смена статуса заказа (партнёр → нам), 4. Эндпоинты, откуда партнёр забирает данные (pull) (+7 more)

### Community 39 - "marketplace.module.ts"
Cohesion: 0.06
Nodes (27): MarketplaceModule, Module, DEFAULT_SIZE_DIMENSIONS, OzonCatalogTemplateService, Injectable, UpdateOzonCatalogTemplateInput, OzonImportPollService, Injectable (+19 more)

### Community 40 - "CRM «Распечатка» — как всё устроено"
Cohesion: 0.11
Nodes (18): 10. Слабые места, 11. Что дальше, 1. Что это, 2. Из чего собрано, 3. Продукты и статусы, 4. Деньги, 5. Роли, 6. Сценарии оформления (+10 more)

### Community 41 - "SettingsPage.tsx"
Cohesion: 0.11
Nodes (26): api, partnerSettingsApi, shipmentLeadApi, usersApi, SettingsPage, UsersPage, Example(), FormState (+18 more)

### Community 42 - "auth.controller.ts"
Cohesion: 0.13
Nodes (14): AuthController, Body, Controller, Get, Post, Throttle, UseGuards, AuthModule (+6 more)

### Community 43 - "ozon-unit-economics.service.ts"
Cohesion: 0.14
Nodes (16): OzonProductTariffs, calculateUnitEconomics(), OzonTariffs, realSettings, settings, tariffs, UnitEconomicsLine, UnitEconomicsResult (+8 more)

### Community 44 - "image-card-placement.ts"
Cohesion: 0.06
Nodes (42): CARD_MODES, CardMode, BULK_ACTIONS, BulkAction, CARD_MANUAL_STATUSES, CardManualStatus, DtoUpdateImageCard, IsBoolean (+34 more)

### Community 45 - "ozon-product-catalog.service.ts"
Cohesion: 0.09
Nodes (21): OzonActionView, OzonCatalogProduct, OzonContentRating, OzonDemand, OzonImportAttributeBody, OzonProductCard, RawActionsResponse, RawAnalyticsResponse (+13 more)

### Community 46 - "DtoAllOrdersforQuery"
Cohesion: 0.12
Nodes (13): DtoAllOrdersforQuery, IsEnum, IsIn, IsInt, IsOptional, IsString, Matches, Max (+5 more)

### Community 47 - "order-photo.service.ts"
Cohesion: 0.08
Nodes (27): DtoAssignExecutor, IsOptional, IsString, IsUUID, IsEnum, UpdateStatus, LeadMoneyError, LeadMoneyInput (+19 more)

### Community 48 - "salary-integrity.spec.ts"
Cohesion: 0.14
Nodes (13): AccrualByIdRow, AsyncMock, createOrderService(), CreatePaymentArgs, createPrismaStub(), HarnessAccrual, makeOrder(), PaymentByAccrualsHarness (+5 more)

### Community 49 - "ReportsPage.tsx"
Cohesion: 0.06
Nodes (46): expensesApi, reportsApi, MySalaryBalance, salaryApi, MySalaryPage, ReportsPage, SalaryPage, buildReceiptHtml() (+38 more)

### Community 50 - "CreateOrderForm.tsx"
Cohesion: 0.11
Nodes (24): baseSchema, canvasItemSchema, clearOrderDraft(), CreateOrderForm(), EMPTY_ORDER_FORM, FormValues, freeItemSchema, fullSchema (+16 more)

### Community 51 - "Исправленные проблемы"
Cohesion: 0.18
Nodes (10): CRITICAL, CRM Audit Report — 2026-06-14, HIGH, HIGH, LOW, MEDIUM, MEDIUM, Исправленные проблемы (+2 more)

### Community 52 - "crm-new/README.md"
Cohesion: 0.20
Nodes (9): Compile and run the project, Deployment, Description, License, Project setup, Resources, Run tests, Stay in touch (+1 more)

### Community 53 - "App.tsx"
Cohesion: 0.12
Nodes (20): authApi, AdminRoute(), App(), AppRoutes(), CrmGate(), HomeRedirect(), LoginPage, MarketplaceRoute() (+12 more)

### Community 54 - "PartnerApiController"
Cohesion: 0.24
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

### Community 59 - "ozon-orders.service.ts"
Cohesion: 0.16
Nodes (14): GROUP_BY_STATUS, groupForStatus(), isShipmentOverdue(), OzonOrderGroup, STATUS_LABELS, statusLabel(), OzonOrderItem, OzonOrdersPage (+6 more)

### Community 60 - "package.json"
Cohesion: 0.25
Nodes (7): concurrently, devDependencies, concurrently, name, private, scripts, dev

### Community 61 - "approval-render.service.ts"
Cohesion: 0.09
Nodes (31): DPI_ACCEPTABLE, DPI_GOOD, estimateDpi(), formatCm(), formatSizeCm(), isCalibrated(), isOutsidePrintArea(), PrintAreaCalibration (+23 more)

### Community 62 - "ozonProductCatalog.ts"
Cohesion: 0.09
Nodes (39): baseCodeOf(), COLOR_CODES, COLOR_SUFFIX, colorCodeOf(), EditResult, groupByColor(), OzonAction, OzonCatalogProduct (+31 more)

### Community 63 - "exclude"
Cohesion: 0.25
Nodes (7): exclude, extends, dist, node_modules, **/*spec.ts, test, ./tsconfig.json

### Community 64 - "Аудит финансов, кода и продакшена — 2026-07-09"
Cohesion: 0.29
Nodes (6): Аудит финансов, кода и продакшена — 2026-07-09, Кодовый аудит, Короткий вывод, Продакшен-аудит, Следующие улучшения, Финансовый аудит

### Community 65 - "devDependencies"
Cohesion: 0.22
Nodes (9): devDependencies, eslint, @types/express, @types/jest, @types/pdfkit, eslint, @types/express, @types/jest (+1 more)

### Community 66 - "AvitoPage.tsx"
Cohesion: 0.22
Nodes (11): avitoApi, AvitoChatQuery, AvitoPage, AvitoPage(), clientInitial(), messagePreview(), messageText(), timeLabel() (+3 more)

### Community 67 - "nest-cli.json"
Cohesion: 0.33
Nodes (5): collection, compilerOptions, deleteOutDir, $schema, sourceRoot

### Community 68 - "MarketplacePage.tsx"
Cohesion: 0.07
Nodes (37): CreateAccountDto, EnumMarketplace, MarketplaceAccount, marketplaceApi, OzonConnectionInfo, UpdateAccountDto, OzonOrder, OzonOrderGroup (+29 more)

### Community 69 - "ozonCatalog.ts"
Cohesion: 0.13
Nodes (19): CreateOzonPrintDto, EnumOzonSyncStatus, OzonAttributeValueOption, ozonCatalogApi, OzonCatalogTemplate, PublishResult, SizeDimensions, UpdateOzonCatalogTemplateDto (+11 more)

### Community 70 - "gulian-outbox.service.ts"
Cohesion: 0.14
Nodes (9): GulianOutboxProcessorService, RETRY_DELAYS_SECONDS, Injectable, OrderForOutbox, GulianOrderPayload, GulianResponse, GulianService, Injectable (+1 more)

### Community 71 - "seed.js"
Cohesion: 0.40
Nodes (3): bcrypt, { Client }, { randomUUID }

### Community 72 - "order-photo.controller.ts"
Cohesion: 0.06
Nodes (34): DtoCreateCanvasItem, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, Type (+26 more)

### Community 73 - "OzonPrintService"
Cohesion: 0.17
Nodes (10): buildOfferId(), colorCodeFor(), normalizeSlug(), slugify(), stripUnsafe(), ColorGroupInput, CreatePrintInput, OzonPrintService (+2 more)

### Community 74 - "React + TypeScript + Vite"
Cohesion: 0.50
Nodes (3): Expanding the ESLint configuration, React Compiler, React + TypeScript + Vite

### Community 76 - "shipment-reminder-rules.ts"
Cohesion: 0.15
Nodes (11): buildShipmentReminder(), DEADLINE_METHODS, dueReminderStage(), hasDeadline(), hoursLeft(), SHIPMENT_REMINDER_STAGES_MS, ShipmentOrder, START (+3 more)

### Community 79 - "OzonCredentials"
Cohesion: 0.18
Nodes (3): OzonCredentials, OzonProductCatalogService, Injectable

### Community 81 - "telegram-update.service.ts"
Cohesion: 0.14
Nodes (16): calcGulianPayout(), Item, PayoutResult, buildPartnerButtons(), buildPartnerCaption(), calcSettlement(), esc(), PartnerOrderData (+8 more)

### Community 82 - "ImageCardTemplateService"
Cohesion: 0.10
Nodes (14): ImageCardTemplateController, Body, Controller, Delete, Get, Param, Patch, Post (+6 more)

### Community 83 - "ozon-attributes.ts"
Cohesion: 0.11
Nodes (26): buildExtraImages(), buildImportItem(), CatalogTemplateForImport, chunk(), COLOR_CODE_BY_LABEL, DEFAULT_SIZES, dictAttr(), dictListAttr() (+18 more)

### Community 85 - "image-cards.module.ts"
Cohesion: 0.11
Nodes (25): DtoCreateImageCardTemplate, DtoRect, DtoUpdateImageCardTemplate, IsBoolean, IsInt, IsObject, IsOptional, IsString (+17 more)

### Community 86 - "approval.module.ts"
Cohesion: 0.15
Nodes (16): ApprovalModule, Module, ALLOWED_IMAGE, SavedImage, UploadedImage, DtoCreateMockupTemplate, DtoUpdateMockupTemplate, IsBoolean (+8 more)

### Community 87 - "ApprovalService"
Cohesion: 0.15
Nodes (10): ApprovalService, Injectable, ApprovalSides, clamp(), filledSides(), MAX_PRINT_MM, MIN_PRINT_MM, num() (+2 more)

### Community 88 - "tshirt-partner-telegram.service.ts"
Cohesion: 0.08
Nodes (28): CanvasProductionController, Controller, Get, UseGuards, escapeHtml(), EXT_CONTENT_TYPE, money(), PRINT_LOCATION_LABELS (+20 more)

### Community 90 - "ImageCardStorageService"
Cohesion: 0.13
Nodes (5): ImageCardProcessorService, parseSnapshot(), Injectable, ImageCardStorageService, Injectable

### Community 91 - "MarketplaceController"
Cohesion: 0.08
Nodes (22): DtoCreateMarketplaceAccount, IsEnum, IsString, MaxLength, MinLength, DtoUpdateMarketplaceAccount, IsBoolean, IsOptional (+14 more)

### Community 93 - "MockupService"
Cohesion: 0.11
Nodes (14): MockupController, Body, Controller, Delete, Get, Param, Patch, Post (+6 more)

### Community 94 - "telegram.service.ts"
Cohesion: 0.33
Nodes (6): logger, proxyDispatcher(), resetTelegramProxyCache(), telegramFetch(), telegramFormData(), TgUpdateWithId

### Community 95 - ".webhook"
Cohesion: 0.24
Nodes (7): TgUpdate, constantTimeEqual(), TelegramWebhookController, Body, Controller, Post, Headers

### Community 96 - "OzonCatalogController"
Cohesion: 0.17
Nodes (10): OzonCatalogController, Body, Controller, Delete, Get, Param, Patch, Post (+2 more)

### Community 97 - "crm-new/package.json"
Cohesion: 0.29
Nodes (6): author, description, license, name, private, version

### Community 98 - "ProductsTab.tsx"
Cohesion: 0.09
Nodes (37): EnumTshirtGender, OzonColorGroupInput, OzonPrint, OzonVariant, Draft, EditPrintModal(), ALL_SIZES, COLOR_CODE_BY_LABEL (+29 more)

### Community 100 - "MarketplaceAccountService"
Cohesion: 0.12
Nodes (14): ACCOUNT_INCLUDE, AccountRow, CreateAccountInput, MarketplaceAccountService, MarketplaceAccountView, Injectable, UpdateAccountInput, OzonService (+6 more)

### Community 101 - "PdfRasterService"
Cohesion: 0.23
Nodes (5): PdfRasterService, PdfRasterUnavailableError, RASTER_LONG_SIDE, run, Injectable

### Community 102 - ".credentials"
Cohesion: 0.22
Nodes (9): OzonProductCatalogController, Body, Controller, Get, Param, Patch, Post, Query (+1 more)

### Community 104 - "TshirtPartnerTelegramService"
Cohesion: 0.18
Nodes (5): ShipmentLeadService, Injectable, Injectable, TshirtPartnerTelegramService, TelegramSendResult

### Community 112 - "DtoUpdatePartnerSettings"
Cohesion: 0.12
Nodes (13): DtoUpdatePartnerSettings, IsInt, IsOptional, IsString, Max, MaxLength, Min, PartnerSettingsController (+5 more)

### Community 113 - "MockupTemplatesCard.tsx"
Cohesion: 0.19
Nodes (11): mockupsApi, Area, areaOf(), CalibrationModal(), clamp(), MockupTemplatesCard(), Modal(), Props (+3 more)

### Community 114 - ".updateStatusOrder"
Cohesion: 0.25
Nodes (6): needsShipmentStatus(), calculateManagerSalarySnapshot(), calculateSalarySnapshot(), earnsStaffSalary(), ManagerSalarySnapshot, SalarySnapshot

### Community 116 - "OzonOrdersController"
Cohesion: 0.25
Nodes (6): OzonOrdersController, Controller, Get, Param, Query, UseGuards

### Community 117 - "DtoCreateOzonPrintsBulk"
Cohesion: 0.29
Nodes (7): DtoCreateOzonPrintsBulk, ArrayMaxSize, ArrayMinSize, ArrayNotEmpty, IsArray, Type, ValidateNested

### Community 122 - "DtoOzonUpdateCardText"
Cohesion: 0.33
Nodes (5): DtoOzonUpdateCardText, IsOptional, IsString, MaxLength, MinLength

### Community 123 - "DtoPublishOzonPrints"
Cohesion: 0.33
Nodes (5): DtoPublishOzonPrints, ArrayMinSize, ArrayNotEmpty, IsArray, IsUUID

### Community 124 - "ТЗ: семантика и структура страниц raspechatkaa.ru"
Cohesion: 0.07
Nodes (27): P10. Холст — `/interer/holst`, P1. Где распечатать фото в Москве — `/gde-raspechatat-foto-v-moskve`, P2. Цены — `/ceny`, P3. Размеры и форматы фото — `/formaty`, P4. Печать фото А4 — `/catalog/foto-a4`, P5. Печать фото на документы — `/dokumenty`, P6. Печать фото онлайн с доставкой — `/onlayn`, P7. Бумага и качество — `/bumaga` (+19 more)

### Community 126 - "DtoUpdateOzonPrint"
Cohesion: 0.17
Nodes (11): DtoUpdateOzonPrint, ArrayMaxSize, IsArray, IsEnum, IsInt, IsOptional, IsString, IsUrl (+3 more)

### Community 130 - "ApprovalController"
Cohesion: 0.12
Nodes (16): ApprovalController, parseSide(), Body, Controller, Delete, Get, Param, Patch (+8 more)

### Community 132 - "approval.service.ts"
Cohesion: 0.14
Nodes (13): approvalInclude, SIZE_LABELS, DtoCreateApproval, IsEnum, IsOptional, IsString, IsUUID, DtoUpdateApproval (+5 more)

### Community 134 - "PrismaService"
Cohesion: 0.08
Nodes (12): JwtPayload, JwtStrategy, Injectable, GulianOutboxService, Injectable, HealthController, Controller, Get (+4 more)

### Community 135 - "ozon-catalog.controller.ts"
Cohesion: 0.08
Nodes (31): SIDES, APPROVAL_MAX_BYTES, AuthenticatedRequest, AuthenticatedUser, ROLES_KEY, JwtAuthGuard, Injectable, RolesGuard (+23 more)

### Community 136 - ".assertOrderFinanciallyEditable"
Cohesion: 0.20
Nodes (7): OrderItemService, Injectable, calcItemPricePosition(), calcOrderTotal(), PricedItem, Injectable, TshirtItemService

### Community 137 - "Выкатка: репозиторий → сервер"
Cohesion: 0.29
Nodes (6): Выкатка: репозиторий → сервер, Как это устроено на сервере, Команды, Откат, Почему именно так, Чего в цепочке пока нет

### Community 140 - "2. Что уже сделано (этап 2 — карточки товаров)"
Cohesion: 0.10
Nodes (19): 1.1. Что показал живой кабинет (17.08.2026), 1. Что уже сделано (этап 1 — подключение), 2.1. Порядок работы с товаром в Ozon Seller API (справочно), 2.2. Заказы (этап 3, только чтение), 2.3. Мои товары и юнит-экономика (этап 4), 2. Что уже сделано (этап 2 — карточки товаров), 3. Дальше, API CRM (+11 more)

### Community 141 - "DtoBulkCards"
Cohesion: 0.33
Nodes (6): DtoBulkCards, ArrayMaxSize, ArrayNotEmpty, IsArray, IsIn, IsUUID

### Community 142 - "lead.controller.ts"
Cohesion: 0.30
Nodes (7): constantTimeEqual(), readBearerToken(), readHeader(), SignedRequest, SiteLeadTokenGuard, stripPrefix(), Injectable

### Community 143 - "nginx-routes.spec.ts"
Cohesion: 0.22
Nodes (4): FRONTEND, NGINX_CONF, SRC, VITE_CONF

### Community 144 - "DtoUpdateOzonCatalogTemplate"
Cohesion: 0.17
Nodes (11): DtoUpdateOzonCatalogTemplate, ArrayMaxSize, IsArray, IsBoolean, IsInt, IsObject, IsOptional, IsString (+3 more)

### Community 146 - "ТЗ: раздел «Печать на холсте» на raspechatkaa.ru"
Cohesion: 0.10
Nodes (19): Берём после сезона, Берём сразу, до сезона, Блок 0. Контекст и границы, Блок 10. Интеграция с CRM, Блок 11. Что НЕ делать, Блок 12. Технологическое преимущество, Блок 1. Информационная архитектура и URL, Блок 2. Хлебные крошки и связность (+11 more)

### Community 147 - "canvas-production-price.ts"
Cohesion: 0.32
Nodes (10): CANVAS_MATERIAL_KIND_LABELS, CANVAS_PRODUCTION_PRICES, canvasContractorCost(), CanvasMaterialKind, CanvasPositionPricing, CanvasProductionPrice, canvasRetailPrice(), canvasSizeLabel() (+2 more)

### Community 153 - "ScenarioController"
Cohesion: 0.09
Nodes (20): DtoDetectProduct, IsString, MaxLength, DtoSaveDraft, IsObject, IsOptional, IsString, MaxLength (+12 more)

### Community 155 - "canvas.pricing.ts"
Cohesion: 0.16
Nodes (16): CanvasPricingController, Controller, Get, calcCanvasUnitPrice(), calcCanvasUrgencyFee(), CANVAS_FRAME_LABELS, CANVAS_MATERIAL_LABELS, CANVAS_SIZES (+8 more)

### Community 166 - "scenario.registry.ts"
Cohesion: 0.08
Nodes (50): DELIVERY_STEPS, NOTE_STEP, OPTIONAL, PAPER_LABEL, photoToOrder(), PHOTO_SCENARIO, tshirtToOrder(), TSHIRT_SCENARIO (+42 more)

### Community 167 - "DtoUpdateItemOrder"
Cohesion: 0.18
Nodes (11): DtoUpdateItemOrder, IsBoolean, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min (+3 more)

### Community 170 - "TelegramService"
Cohesion: 0.20
Nodes (5): describeTelegramError(), TelegramService, Injectable, TelegramUpdateService, Injectable

### Community 172 - "DtoUpdateOzonUnitEconomics"
Cohesion: 0.22
Nodes (8): DtoUpdateOzonUnitEconomics, IsIn, IsInt, IsOptional, Max, Min, Type, IsNumber

### Community 173 - "DtoUpdateOrder"
Cohesion: 0.17
Nodes (11): DtoUpdateOrder, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Matches, MaxLength (+3 more)

### Community 177 - "lead-notification.ts"
Cohesion: 0.33
Nodes (6): buildLeadNotification(), escape(), LeadForNotification, NotifiableUser, pickLeadResponders(), toMention()

### Community 181 - "OrderPhotoService"
Cohesion: 0.14
Nodes (12): buildCommunicationUrl(), buildMaxUrl(), DEFAULT_MAX_LINK_TEMPLATE, formatPhoneForDisplay(), normalizePhone(), validateCommunicationValue(), calcCanvasMoney(), escapeHtml() (+4 more)

### Community 192 - "LeadController"
Cohesion: 0.17
Nodes (9): LeadController, Body, Controller, Post, Throttle, UseGuards, isUniqueViolation(), HttpCode (+1 more)

## Knowledge Gaps
- **769 isolated node(s):** `$schema`, `collection`, `sourceRoot`, `deleteOutDir`, `name` (+764 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **51 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Roles()` connect `Roles` to `tasks.controller.ts`, `ApprovalController`, `DtoUpdateUser`, `ozon-catalog.controller.ts`, `DtoCreateExpense`, `reports.service.ts`, `AvitoService`, `ImageCardBatchController`, `ScenarioController`, `TechSpecStorageService`, `OzonPhotoStorageService`, `salary.controller.ts`, `order-photo.controller.ts`, `ImageCardTemplateService`, `image-cards.module.ts`, `tshirt-partner-telegram.service.ts`, `MarketplaceController`, `MockupService`, `OzonCatalogController`, `.credentials`, `DtoUpdatePartnerSettings`, `OzonOrdersController`?**
  _High betweenness centrality (0.287) - this node is a cross-community bridge._
- **Why does `BatchView()` connect `ApprovalController` to `getErrorMessage`?**
  _High betweenness centrality (0.266) - this node is a cross-community bridge._
- **Why does `getErrorMessage()` connect `getErrorMessage` to `ApprovalController`, `ProductsTab.tsx`, `MarketplacePage.tsx`, `ozonCatalog.ts`, `AvitoPage.tsx`, `OrdersPage.tsx`, `SettingsPage.tsx`, `OrderDetail.tsx`, `MockupTemplatesCard.tsx`, `ReportsPage.tsx`, `TasksPage.tsx`, `ApprovalEditor.tsx`, `ozonProductCatalog.ts`?**
  _High betweenness centrality (0.219) - this node is a cross-community bridge._
- **What connects `$schema`, `collection`, `sourceRoot` to the rest of the system?**
  _769 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `DtoCreateOzonPrint` be split into smaller, more focused modules?**
  _Cohesion score 0.07096774193548387 - nodes in this community are weakly interconnected._
- **Should `tasks.controller.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06862745098039216 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._