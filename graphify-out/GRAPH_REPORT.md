# Graph Report - raspechatka  (2026-09-05)

## Corpus Check
- 476 files · ~253,661 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 3740 nodes · 7760 edges · 205 communities (154 shown, 51 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 319 edges (avg confidence: 0.79)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `72aca96b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- DtoCreateOzonPrint
- tasks.controller.ts
- dependencies
- DtoUpdateUser
- sticker.service.ts
- jest
- DtoOzonArchive
- prisma.service.ts
- usePersistentState
- Roles
- System Map
- DtoCreateExpense
- reports.service.ts
- OrdersPage.tsx
- daily-plan-rules.ts
- AvitoService
- Брендбук — Распечатка PRO
- ProductsTab.tsx
- compilerOptions
- DtoUpdateMockupTemplate
- compilerOptions
- Аудит проекта «Распечатка» — 2026-06-14
- TasksPage.tsx
- dependencies
- ozon-bulk-stock.service.ts
- ozonProductCatalog.ts
- ApprovalEditor.tsx
- compilerOptions
- MarketplaceAccountService
- OzonCredentials
- app.module.ts
- review-reminder.service.ts
- PartnerAdminController
- devDependencies
- getErrorMessage
- DtoCreateLead
- ozon-photo.controller.ts
- salary.controller.ts
- Интеграция с исполнителем-партнёром (печать футболок)
- scenario-draft.service.ts
- CRM «Распечатка» — как всё устроено
- SettingsPage.tsx
- auth.controller.ts
- ozon-unit-economics.service.ts
- image-card-placement.ts
- ozon-product-catalog.service.ts
- OrderPhotoService
- order-photo.service.ts
- salary-integrity.spec.ts
- index.ts
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
- partner-payload.ts
- exclude
- Аудит финансов, кода и продакшена — 2026-07-09
- devDependencies
- AvitoPage.tsx
- nest-cli.json
- MarketplacePage.tsx
- PrintCardModal.tsx
- GulianService
- seed.js
- DtoCreateOrder
- OzonPrintService
- React + TypeScript + Vite
- backup-db.sh
- shipment-reminder-rules.ts
- ts-loader
- frontend/tsconfig.json
- ImageCardBatchController
- ozon-import.service.ts
- telegram-update.service.ts
- ImageCardTemplateService
- ozon-attributes.ts
- @nestjs/cli
- ImageCardBatchService
- OzonApiClient
- ApprovalService
- scenario.mapping.ts
- supertest
- ImageCardStorageService
- MarketplaceController
- ts-node
- MockupService
- AvitoController
- .webhook
- OzonCatalogController
- crm-new/package.json
- PrintEditor.tsx
- @types/supertest
- partner-settings.service.ts
- PdfRasterService
- OzonProductCatalogController
- eslint-plugin-react-refresh
- OzonBulkStockService
- tshirt-partner-telegram.service.ts
- typescript-eslint
- vite
- DtoUpdatePartnerSettings
- render
- tshirt-item.service.ts
- @nestjs/core
- .list
- partner-api.controller.ts
- TelegramStickerLinkService
- passport
- pdf-lib
- ScenarioController
- tg_greeter.py
- DtoPublishOzonPrints
- ТЗ: семантика и структура страниц raspechatkaa.ru
- OzonImportService
- DtoUpdateOzonPrint
- @prisma/adapter-pg
- @prisma/client
- site-lead-token.guard.ts
- ApprovalController
- describe
- approval.service.ts
- PartnerTokenGuard
- PrismaService
- marketplace.module.ts
- DtoUpdateItemOrder
- Выкатка: репозиторий → сервер
- scenario.engine.ts
- DtoBulkStock
- 2. Что уже сделано (этап 2 — карточки товаров)
- parse_proxy
- .constructor
- nginx-routes.spec.ts
- DtoUpdateOzonCatalogTemplate
- ImageCardGenerationService
- ТЗ: раздел «Печать на холсте» на raspechatkaa.ru
- canvas-item.service.ts
- auto-update.sh
- Первое сообщение клиенту
- sign
- delivery_line
- OrderDetail.tsx
- items_list
- ozon-default-warehouses.ts
- canvas.pricing.ts
- partner-admin.controller.ts
- sharp
- undici
- CanvasPricingController
- DtoUpdateImageCard
- jest
- OzonOrdersController
- ApprovalStorageService
- @nestjs/passport
- class-transformer
- scenario.registry.ts
- roboto-fontface
- eslint
- eslint-plugin-prettier
- TelegramService
- @nestjs/schematics
- DtoUpdateOzonUnitEconomics
- TechSpecStorageService
- @nestjs/testing
- prisma
- source-map-support
- lead-notification.ts
- ts-jest
- @nestjs/mapped-types
- @types/archiver
- eslint
- passport-jwt
- @types/node
- @eslint/eslintrc
- globals
- prettier
- typescript-eslint
- @types/multer
- @nestjs/common
- @types/passport-jwt
- typescript
- DtoOzonUpdateCardText
- lead.controller.ts
- tsconfig-paths
- scenario.controller.ts
- pdfkit
- pg
- uuid
- web-push
- scenario.module.ts
- main.ts
- tailwindcss
- order-photo.controller.ts
- @eslint/js

## God Nodes (most connected - your core abstractions)
1. `PrismaService` - 103 edges
2. `Roles()` - 88 edges
3. `getErrorMessage()` - 68 edges
4. `OzonCredentials` - 42 edges
5. `CurrentUser` - 40 edges
6. `OrderPhotoController` - 36 edges
7. `OzonProductCatalogService` - 32 edges
8. `useAuth()` - 31 edges
9. `PartnerSettingsService` - 29 edges
10. `TelegramService` - 29 edges

## Surprising Connections (you probably didn't know these)
- `AccountCard()` --calls--> `getErrorMessage()`  [EXTRACTED]
  frontend/src/components/marketplace/ConnectionTab.tsx → frontend/src/utils/get-error-message.ts
- `AccountForm()` --calls--> `getErrorMessage()`  [EXTRACTED]
  frontend/src/components/marketplace/ConnectionTab.tsx → frontend/src/utils/get-error-message.ts
- `AssignPanel()` --calls--> `getErrorMessage()`  [EXTRACTED]
  frontend/src/components/orders/OrderDetail.tsx → frontend/src/utils/get-error-message.ts
- `AddExpenseModal()` --calls--> `getErrorMessage()`  [EXTRACTED]
  frontend/src/pages/ReportsPage.tsx → frontend/src/utils/get-error-message.ts
- `BonusForm()` --calls--> `getErrorMessage()`  [EXTRACTED]
  frontend/src/pages/SalaryPage.tsx → frontend/src/utils/get-error-message.ts

## Import Cycles
- None detected.

## Communities (205 total, 51 thin omitted)

### Community 0 - "DtoCreateOzonPrint"
Cohesion: 0.06
Nodes (35): DtoCreateOzonPrint, ArrayMaxSize, ArrayMinSize, ArrayNotEmpty, IsArray, IsEnum, IsInt, IsOptional (+27 more)

### Community 1 - "tasks.controller.ts"
Cohesion: 0.06
Nodes (32): DtoCreateTask, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength (+24 more)

### Community 2 - "dependencies"
Cohesion: 0.09
Nodes (23): archiver, bcryptjs, bwip-js, class-validator, dependencies, archiver, bcryptjs, bwip-js (+15 more)

### Community 3 - "DtoUpdateUser"
Cohesion: 0.06
Nodes (28): DtoCreateUser, IsEnum, IsString, MinLength, DtoUpdateUser, IsBoolean, IsInt, IsOptional (+20 more)

### Community 4 - "sticker.service.ts"
Cohesion: 0.13
Nodes (17): line(), computePrepayment(), DEFAULT_PREPAY_RATE, Prepayment, buildPhotoItemLines(), buildTshirtItemLines(), drawInstagramIcon(), drawTelegramIcon() (+9 more)

### Community 5 - "jest"
Cohesion: 0.12
Nodes (16): jest, collectCoverageFrom, coverageDirectory, moduleFileExtensions, moduleNameMapper, rootDir, testEnvironment, testRegex (+8 more)

### Community 6 - "DtoOzonArchive"
Cohesion: 0.27
Nodes (14): DtoOzonArchive, DtoOzonPriceItem, DtoOzonStockItem, DtoOzonUpdatePrices, DtoOzonUpdateStocks, ArrayNotEmpty, IsArray, IsBoolean (+6 more)

### Community 7 - "prisma.service.ts"
Cohesion: 0.10
Nodes (22): DtoCreateImageCardTemplate, DtoRect, DtoUpdateImageCardTemplate, IsBoolean, IsInt, IsObject, IsOptional, IsString (+14 more)

### Community 8 - "usePersistentState"
Cohesion: 0.16
Nodes (15): canvasProductionApi, CanvasProductionPricing, CanvasProductionSize, ProductsTab(), CanvasItemsTable(), EditState, EMPTY, money() (+7 more)

### Community 9 - "Roles"
Cohesion: 0.13
Nodes (14): CurrentUser, Roles(), OrderPhotoController, Body, Controller, Delete, Get, Param (+6 more)

### Community 10 - "System Map"
Cohesion: 0.05
Nodes (36): 2026-07-08, 2026-07-09, 2026-07-11, 2026-08-24, 2026-08-24 (later), 2026-08-25, Access Rules, App Modules (+28 more)

### Community 11 - "DtoCreateExpense"
Cohesion: 0.08
Nodes (20): DtoCreateExpense, IsEnum, IsInt, IsOptional, IsString, Min, ExpensesController, Body (+12 more)

### Community 12 - "reports.service.ts"
Cohesion: 0.07
Nodes (36): calcOrderProfit(), forecastSalary(), kopecksToRub(), OrderProfit, OrderProfitInput, SHEET, DECLARED_PRINTS_PER_SHEET, HALF_SHEET_WORDS (+28 more)

### Community 13 - "OrdersPage.tsx"
Cohesion: 0.06
Nodes (52): ordersApi, Props, ExecutorFilter(), Props, EditState, ItemsTable(), Props, AssignPanelProps (+44 more)

### Community 14 - "daily-plan-rules.ts"
Cohesion: 0.05
Nodes (62): buildDailyPlanMessage(), buildShipmentBlock(), dayMonth(), DELIVERY_LABEL, effectiveDeadline(), executorKey(), inWorkTail(), isWithinPlanWindow() (+54 more)

### Community 15 - "AvitoService"
Cohesion: 0.06
Nodes (27): Get, Query, AvitoMessengerService, Injectable, AvitoModule, Module, AvitoAccount, AvitoChat (+19 more)

### Community 16 - "Брендбук — Распечатка PRO"
Cohesion: 0.08
Nodes (24): 1. Анализ конкурентов, 2. Психология цвета, 3. Цветовая палитра, 4. Типографика, 5. Логотип и иконка, 6. Правила применения, 7. Tone of Voice, 8. Применение на сайте (будущее) (+16 more)

### Community 17 - "ProductsTab.tsx"
Cohesion: 0.13
Nodes (25): EnumTshirtGender, OzonPrint, EditPrintModal(), COLOR_CODE_BY_LABEL, colorCodeFor(), DEFAULT_SIZES, draftErrors(), draftToPayload() (+17 more)

### Community 18 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, allowSyntheticDefaultImports, baseUrl, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, forceConsistentCasingInFileNames (+14 more)

### Community 19 - "DtoUpdateMockupTemplate"
Cohesion: 0.26
Nodes (11): DtoCreateMockupTemplate, DtoUpdateMockupTemplate, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Matches (+3 more)

### Community 20 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection, moduleResolution (+14 more)

### Community 21 - "Аудит проекта «Распечатка» — 2026-06-14"
Cohesion: 0.09
Nodes (21): 10.1 Почему PDF «не формировался» и долго генерировался, 10.2 Декомпозиция API-слоя (был god-файл), 10.3 Группировка компонентов, 10.4 Автоматические бэкапы БД (рекомендация №1), 10.5 Итоговая структура фронта, 10.6 Деплой раунда 2, 10. Раунд 2 — PDF, декомпозиция API/компонентов, бэкапы (тот же день), 1. Резюме и метрики (+13 more)

### Community 22 - "TasksPage.tsx"
Cohesion: 0.06
Nodes (37): salaryApi, tasksApi, TasksQuery, MySalaryPage, TasksPage, AppShell(), NavProps, Props (+29 more)

### Community 23 - "dependencies"
Cohesion: 0.10
Nodes (21): axios, dependencies, axios, @hookform/resolvers, lucide-react, react, react-dom, react-hook-form (+13 more)

### Community 24 - "ozon-bulk-stock.service.ts"
Cohesion: 0.10
Nodes (27): buildPairs(), BulkStockMode, BulkStockValidationError, checkQuantity(), chunkPairs(), LARGE_OPERATION_THRESHOLD, MAX_QUANTITY, MIN_PAIR_INTERVAL_MS (+19 more)

### Community 25 - "ozonProductCatalog.ts"
Cohesion: 0.07
Nodes (38): baseCodeOf(), BulkStockHistoryRow, BulkStockInput, BulkStockItem, BulkStockMode, BulkStockOperation, BulkStockPreview, BulkStockWarehouseInput (+30 more)

### Community 26 - "ApprovalEditor.tsx"
Cohesion: 0.07
Nodes (50): approvalsApi, mockupsApi, ApprovalEditor(), CmField(), downloadBlob(), Props, SIDE_LABELS, Sides (+42 more)

### Community 27 - "compilerOptions"
Cohesion: 0.10
Nodes (20): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+12 more)

### Community 28 - "MarketplaceAccountService"
Cohesion: 0.12
Nodes (14): ACCOUNT_INCLUDE, AccountRow, CreateAccountInput, MarketplaceAccountService, MarketplaceAccountView, Injectable, UpdateAccountInput, OzonService (+6 more)

### Community 29 - "OzonCredentials"
Cohesion: 0.18
Nodes (3): OzonCredentials, OzonProductCatalogService, Injectable

### Community 30 - "app.module.ts"
Cohesion: 0.10
Nodes (23): ApprovalModule, Module, CanvasModule, Module, GulianModule, Module, HealthController, Controller (+15 more)

### Community 31 - "review-reminder.service.ts"
Cohesion: 0.16
Nodes (12): isReviewReminderEligible(), REVIEW_REMINDER_CATEGORIES, REVIEW_REMINDER_DELAY_MS, REVIEW_REMINDER_PICKUP_DELAY_MS, REVIEW_REMINDER_STATUSES, reviewReminderDelayMs(), buildReviewRequestText(), categoryLabel() (+4 more)

### Community 32 - "PartnerAdminController"
Cohesion: 0.23
Nodes (9): PartnerAdminController, Controller, Get, Param, Post, Res, UploadedFiles, UseGuards (+1 more)

### Community 33 - "devDependencies"
Cohesion: 0.11
Nodes (19): eslint-plugin-react-hooks, devDependencies, @eslint/js, eslint-plugin-react-hooks, globals, @tailwindcss/vite, @types/node, @types/react (+11 more)

### Community 34 - "getErrorMessage"
Cohesion: 0.08
Nodes (45): ozonBatchesApi, ozonCardsApi, CardBatchReport(), CardEditorModal(), CardFinalizePanel(), BatchList(), MODE_LABELS, SOURCE_STATUS (+37 more)

### Community 35 - "DtoCreateLead"
Cohesion: 0.09
Nodes (18): DtoCreateLead, base, meta, pipe, IsBoolean, IsEnum, IsIn, IsInt (+10 more)

### Community 36 - "ozon-photo.controller.ts"
Cohesion: 0.10
Nodes (16): ALLOWED_INPUT, OZON_PHOTO_MAX_BYTES, OZON_PHOTO_MAX_FILES, OzonPhotoStorageService, Injectable, OzonPhotoController, Controller, Get (+8 more)

### Community 37 - "salary.controller.ts"
Cohesion: 0.05
Nodes (36): DtoCreateBonus, IsInt, IsString, IsUUID, MaxLength, Min, MinLength, Type (+28 more)

### Community 38 - "Интеграция с исполнителем-партнёром (печать футболок)"
Cohesion: 0.12
Nodes (15): 1. Модель взаимодействия, 2. Аутентификация, 3. Webhook, который мы отправляем партнёру, 4.1 Данные заказа, 4.2 ТЗ-фото (макет), 4.3 Стикер (PDF, 58×40 мм), 4.4 Смена статуса заказа (партнёр → нам), 4. Эндпоинты, откуда партнёр забирает данные (pull) (+7 more)

### Community 39 - "scenario-draft.service.ts"
Cohesion: 0.21
Nodes (9): DraftState, ScenarioDraftService, Injectable, FakeOrder, READY_PHOTO, READY_TSHIRT, findProduct(), Answers (+1 more)

### Community 40 - "CRM «Распечатка» — как всё устроено"
Cohesion: 0.11
Nodes (18): 10. Слабые места, 11. Что дальше, 1. Что это, 2. Из чего собрано, 3. Продукты и статусы, 4. Деньги, 5. Роли, 6. Сценарии оформления (+10 more)

### Community 41 - "SettingsPage.tsx"
Cohesion: 0.09
Nodes (30): api, partnerSettingsApi, shipmentLeadApi, usersApi, SettingsPage, UsersPage, MockupTemplatesCard(), DailyPlanCard() (+22 more)

### Community 42 - "auth.controller.ts"
Cohesion: 0.10
Nodes (17): AuthController, Body, Controller, Get, Post, Throttle, UseGuards, AuthModule (+9 more)

### Community 43 - "ozon-unit-economics.service.ts"
Cohesion: 0.13
Nodes (16): OzonProductTariffs, calculateUnitEconomics(), OzonTariffs, realSettings, settings, tariffs, UnitEconomicsLine, UnitEconomicsResult (+8 more)

### Community 44 - "image-card-placement.ts"
Cohesion: 0.10
Nodes (24): MODE_COLORS, ASPECT_ALERT, CardTransform, clamp(), containFit(), DEFAULT_FILL, DEFAULT_TRANSFORM, isOutside() (+16 more)

### Community 45 - "ozon-product-catalog.service.ts"
Cohesion: 0.09
Nodes (21): OzonActionView, OzonCatalogProduct, OzonContentRating, OzonDemand, OzonImportAttributeBody, OzonProductCard, RawActionsResponse, RawAnalyticsResponse (+13 more)

### Community 46 - "OrderPhotoService"
Cohesion: 0.09
Nodes (17): DtoAllOrdersforQuery, IsEnum, IsIn, IsInt, IsOptional, IsString, Matches, Max (+9 more)

### Community 47 - "order-photo.service.ts"
Cohesion: 0.05
Nodes (44): buildCommunicationUrl(), buildMaxUrl(), DEFAULT_MAX_LINK_TEMPLATE, formatPhoneForDisplay(), normalizePhone(), validateCommunicationValue(), DtoUpdateOrder, IsBoolean (+36 more)

### Community 48 - "salary-integrity.spec.ts"
Cohesion: 0.08
Nodes (23): DtoAssignExecutor, IsOptional, IsString, IsUUID, FinancialClient, calculateManagerSalarySnapshot(), calculateSalarySnapshot(), earnsStaffSalary() (+15 more)

### Community 49 - "index.ts"
Cohesion: 0.05
Nodes (60): expensesApi, reportsApi, MySalaryBalance, ReportsPage, SalaryPage, buildReceiptHtml(), buildReceiptTitle(), escapeHtml() (+52 more)

### Community 50 - "CreateOrderForm.tsx"
Cohesion: 0.06
Nodes (41): Props, baseSchema, canvasItemSchema, clearOrderDraft(), CreateOrderForm(), EMPTY_ORDER_FORM, FormValues, freeItemSchema (+33 more)

### Community 51 - "Исправленные проблемы"
Cohesion: 0.18
Nodes (10): CRITICAL, CRM Audit Report — 2026-06-14, HIGH, HIGH, LOW, MEDIUM, MEDIUM, Исправленные проблемы (+2 more)

### Community 52 - "crm-new/README.md"
Cohesion: 0.20
Nodes (9): Compile and run the project, Deployment, Description, License, Project setup, Resources, Run tests, Stay in touch (+1 more)

### Community 53 - "App.tsx"
Cohesion: 0.12
Nodes (21): authApi, AdminRoute(), App(), AppRoutes(), CrmGate(), HomeRedirect(), LoginPage, MarketplaceRoute() (+13 more)

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

### Community 59 - "ozon-orders.service.ts"
Cohesion: 0.16
Nodes (14): GROUP_BY_STATUS, groupForStatus(), isShipmentOverdue(), OzonOrderGroup, STATUS_LABELS, statusLabel(), OzonOrderItem, OzonOrdersPage (+6 more)

### Community 60 - "package.json"
Cohesion: 0.25
Nodes (7): concurrently, devDependencies, concurrently, name, private, scripts, dev

### Community 61 - "approval-render.service.ts"
Cohesion: 0.09
Nodes (30): DPI_ACCEPTABLE, DPI_GOOD, estimateDpi(), formatCm(), formatSizeCm(), isCalibrated(), isOutsidePrintArea(), PrintAreaCalibration (+22 more)

### Community 62 - "partner-payload.ts"
Cohesion: 0.13
Nodes (14): hasProductionItems(), NO_PRODUCTION_ITEMS_MESSAGE, OrderWithProductionItems, PartnerOutboundService, Injectable, buildPartnerOrderPayload(), PartnerOrderForPayload, PartnerOrderPayload (+6 more)

### Community 63 - "exclude"
Cohesion: 0.25
Nodes (7): exclude, extends, dist, node_modules, **/*spec.ts, test, ./tsconfig.json

### Community 64 - "Аудит финансов, кода и продакшена — 2026-07-09"
Cohesion: 0.29
Nodes (6): Аудит финансов, кода и продакшена — 2026-07-09, Кодовый аудит, Короткий вывод, Продакшен-аудит, Следующие улучшения, Финансовый аудит

### Community 65 - "devDependencies"
Cohesion: 0.22
Nodes (9): devDependencies, eslint-config-prettier, @types/express, @types/jest, @types/pdfkit, eslint-config-prettier, @types/express, @types/jest (+1 more)

### Community 66 - "AvitoPage.tsx"
Cohesion: 0.22
Nodes (11): avitoApi, AvitoChatQuery, AvitoPage, AvitoPage(), clientInitial(), messagePreview(), messageText(), timeLabel() (+3 more)

### Community 67 - "nest-cli.json"
Cohesion: 0.33
Nodes (5): collection, compilerOptions, deleteOutDir, $schema, sourceRoot

### Community 68 - "MarketplacePage.tsx"
Cohesion: 0.06
Nodes (42): CreateAccountDto, EnumMarketplace, MarketplaceAccount, marketplaceApi, OzonConnectionInfo, UpdateAccountDto, OzonOrder, OzonOrderGroup (+34 more)

### Community 69 - "PrintCardModal.tsx"
Cohesion: 0.16
Nodes (20): colorCodeOf(), firstEditableWarehouse(), groupByColor(), OzonCatalogProduct, ProductEconomics, sizeOf(), sizeRank(), CardAnalytics() (+12 more)

### Community 70 - "GulianService"
Cohesion: 0.17
Nodes (7): GulianOutboxProcessorService, RETRY_DELAYS_SECONDS, Injectable, GulianOrderPayload, GulianResponse, GulianService, Injectable

### Community 71 - "seed.js"
Cohesion: 0.40
Nodes (3): bcrypt, { Client }, { randomUUID }

### Community 72 - "DtoCreateOrder"
Cohesion: 0.06
Nodes (34): DtoCreateCanvasItem, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, Type (+26 more)

### Community 73 - "OzonPrintService"
Cohesion: 0.17
Nodes (10): buildOfferId(), colorCodeFor(), normalizeSlug(), slugify(), stripUnsafe(), ColorGroupInput, CreatePrintInput, OzonPrintService (+2 more)

### Community 74 - "React + TypeScript + Vite"
Cohesion: 0.50
Nodes (3): Expanding the ESLint configuration, React Compiler, React + TypeScript + Vite

### Community 76 - "shipment-reminder-rules.ts"
Cohesion: 0.16
Nodes (11): buildShipmentReminder(), DEADLINE_METHODS, dueReminderStage(), hasDeadline(), hoursLeft(), SHIPMENT_REMINDER_STAGES_MS, ShipmentOrder, START (+3 more)

### Community 79 - "ImageCardBatchController"
Cohesion: 0.14
Nodes (12): ImageCardBatchController, Body, Controller, Delete, Get, Param, Patch, Post (+4 more)

### Community 80 - "ozon-import.service.ts"
Cohesion: 0.13
Nodes (14): DEFAULT_SIZE_DIMENSIONS, OzonCatalogTemplateService, Injectable, UpdateOzonCatalogTemplateInput, IMPORT_BATCH_SIZE, OzonImportItem, VariantDimensions, OzonAttributeValueOption (+6 more)

### Community 81 - "telegram-update.service.ts"
Cohesion: 0.13
Nodes (17): OrderForOutbox, calcGulianPayout(), Item, PayoutResult, toGulianStatus(), buildPartnerCaption(), calcSettlement(), esc() (+9 more)

### Community 82 - "ImageCardTemplateService"
Cohesion: 0.10
Nodes (14): ImageCardTemplateController, Body, Controller, Delete, Get, Param, Patch, Post (+6 more)

### Community 83 - "ozon-attributes.ts"
Cohesion: 0.11
Nodes (25): buildExtraImages(), buildImportItem(), CatalogTemplateForImport, chunk(), COLOR_CODE_BY_LABEL, DEFAULT_SIZES, dictAttr(), dictListAttr() (+17 more)

### Community 85 - "ImageCardBatchService"
Cohesion: 0.08
Nodes (23): CARD_MODES, CardMode, DtoCreateImageCardBatch, ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional (+15 more)

### Community 86 - "OzonApiClient"
Cohesion: 0.08
Nodes (24): humanize(), OzonApiClient, OzonApiError, OzonErrorBody, Injectable, OzonConnectionInfo, OzonProductListResponse, OzonWarehouseListResponse (+16 more)

### Community 87 - "ApprovalService"
Cohesion: 0.15
Nodes (10): ApprovalService, Injectable, ApprovalSides, clamp(), filledSides(), MAX_PRINT_MM, MIN_PRINT_MM, num() (+2 more)

### Community 88 - "scenario.mapping.ts"
Cohesion: 0.35
Nodes (12): PAPER_LABEL, photoToOrder(), tshirtToOrder(), bool(), date(), deliveryOf(), noteOf(), num() (+4 more)

### Community 90 - "ImageCardStorageService"
Cohesion: 0.14
Nodes (4): ImageCardProcessorService, Injectable, ImageCardStorageService, Injectable

### Community 91 - "MarketplaceController"
Cohesion: 0.08
Nodes (22): DtoCreateMarketplaceAccount, IsEnum, IsString, MaxLength, MinLength, DtoUpdateMarketplaceAccount, IsBoolean, IsOptional (+14 more)

### Community 93 - "MockupService"
Cohesion: 0.10
Nodes (14): MockupController, Body, Controller, Delete, Get, Param, Patch, Post (+6 more)

### Community 94 - "AvitoController"
Cohesion: 0.16
Nodes (10): AvitoController, Body, Controller, Param, Post, UseGuards, DtoSendAvitoMessage, IsString (+2 more)

### Community 95 - ".webhook"
Cohesion: 0.24
Nodes (7): TgUpdate, constantTimeEqual(), TelegramWebhookController, Body, Controller, Post, Headers

### Community 96 - "OzonCatalogController"
Cohesion: 0.17
Nodes (11): OzonCatalogController, Body, Controller, Delete, Get, Param, Patch, Post (+3 more)

### Community 97 - "crm-new/package.json"
Cohesion: 0.29
Nodes (6): author, description, license, name, private, version

### Community 98 - "PrintEditor.tsx"
Cohesion: 0.09
Nodes (31): CreateOzonPrintDto, EnumOzonSyncStatus, OzonAttributeValueOption, ozonCatalogApi, OzonCatalogTemplate, OzonColorGroupInput, OzonVariant, PublishResult (+23 more)

### Community 100 - "partner-settings.service.ts"
Cohesion: 0.18
Nodes (16): Db, UpdatePartnerSettingsDto, DEFAULT_PARTNER_RATE_BASIS_POINTS, OrderSettlement, positionMaterials(), PositionSettlement, SettlementPosition, settleOrder() (+8 more)

### Community 101 - "PdfRasterService"
Cohesion: 0.21
Nodes (5): PdfRasterService, PdfRasterUnavailableError, RASTER_LONG_SIDE, run, Injectable

### Community 102 - "OzonProductCatalogController"
Cohesion: 0.19
Nodes (9): OzonProductCatalogController, Body, Controller, Get, Param, Patch, Post, Query (+1 more)

### Community 104 - "OzonBulkStockService"
Cohesion: 0.14
Nodes (5): OzonBulkStockProcessorService, Injectable, keyOf(), OzonBulkStockService, Injectable

### Community 105 - "tshirt-partner-telegram.service.ts"
Cohesion: 0.16
Nodes (10): escapeHtml(), EXT_CONTENT_TYPE, money(), PRINT_LOCATION_LABELS, PRINT_TYPE_LABELS, TechSpecAttachment, Injectable, TshirtOrderWithItems (+2 more)

### Community 112 - "DtoUpdatePartnerSettings"
Cohesion: 0.25
Nodes (7): DtoUpdatePartnerSettings, IsInt, IsOptional, IsString, Max, MaxLength, Min

### Community 113 - "render"
Cohesion: 0.17
Nodes (9): greeting_for(), money(), Обращение целиком, а не только имя. У заявки имени может не быть — человек…, Сумма с пробелами между разрядами: 2 490, а не 2490. Ноль означает, что позиций…, Готовый текст сообщения. Неизвестные метки остаются как есть., render(), TestGreeting, TestMoney (+1 more)

### Community 114 - "tshirt-item.service.ts"
Cohesion: 0.12
Nodes (16): DtoCreateTshirtItem, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min, Type (+8 more)

### Community 116 - ".list"
Cohesion: 0.50
Nodes (3): Get, Param, Query

### Community 117 - "partner-api.controller.ts"
Cohesion: 0.12
Nodes (16): DtoPartnerStatus, IsString, Body, Patch, FLOW_RANK, FROM_PARTNER, fromPartnerStatus(), mapPartnerStage() (+8 more)

### Community 118 - "TelegramStickerLinkService"
Cohesion: 0.15
Nodes (8): TelegramStickerController, Controller, Get, Param, Query, Res, TelegramStickerLinkService, Injectable

### Community 121 - "ScenarioController"
Cohesion: 0.20
Nodes (9): ScenarioController, Body, Controller, Get, Param, Patch, Post, UseGuards (+1 more)

### Community 122 - "tg_greeter.py"
Cohesion: 0.18
Nodes (11): Exception, Crm, Fatal, load_templates(), main(), Очередь и отметки. Ошибки сети не роняют процесс — просто ждём., Одно сообщение. Возвращает итог из закрытого списка, который знает CRM. Все…, Настройки неверны — работать нельзя, перезапуск не поможет. (+3 more)

### Community 123 - "DtoPublishOzonPrints"
Cohesion: 0.33
Nodes (5): DtoPublishOzonPrints, ArrayMinSize, ArrayNotEmpty, IsArray, IsUUID

### Community 124 - "ТЗ: семантика и структура страниц raspechatkaa.ru"
Cohesion: 0.07
Nodes (27): P10. Холст — `/interer/holst`, P1. Где распечатать фото в Москве — `/gde-raspechatat-foto-v-moskve`, P2. Цены — `/ceny`, P3. Размеры и форматы фото — `/formaty`, P4. Печать фото А4 — `/catalog/foto-a4`, P5. Печать фото на документы — `/dokumenty`, P6. Печать фото онлайн с доставкой — `/onlayn`, P7. Бумага и качество — `/bumaga` (+19 more)

### Community 125 - "OzonImportService"
Cohesion: 0.19
Nodes (4): OzonImportPollService, Injectable, OzonImportService, Injectable

### Community 126 - "DtoUpdateOzonPrint"
Cohesion: 0.17
Nodes (11): DtoUpdateOzonPrint, ArrayMaxSize, IsArray, IsEnum, IsInt, IsOptional, IsString, IsUrl (+3 more)

### Community 129 - "site-lead-token.guard.ts"
Cohesion: 0.33
Nodes (7): constantTimeEqual(), readBearerToken(), readHeader(), SignedRequest, SiteLeadTokenGuard, stripPrefix(), Injectable

### Community 130 - "ApprovalController"
Cohesion: 0.13
Nodes (16): ApprovalController, parseSide(), Body, Controller, Delete, Get, Param, Patch (+8 more)

### Community 131 - "describe"
Cohesion: 0.22
Nodes (9): describe_code_type(), describe_next(), main(), Человеческое название способа доставки кода., Чем можно переслать, если не дошло., describe(), Строка для лога — без логина и пароля., Строка для лога не должна содержать логин и пароль. (+1 more)

### Community 132 - "approval.service.ts"
Cohesion: 0.12
Nodes (16): approvalInclude, SIZE_LABELS, ALLOWED_IMAGE, SavedImage, UploadedImage, DtoCreateApproval, IsEnum, IsOptional (+8 more)

### Community 134 - "PrismaService"
Cohesion: 0.06
Nodes (22): CanvasProductionController, Controller, Get, UseGuards, GulianOutboxService, Injectable, OrderFinancialIntegrityService, Injectable (+14 more)

### Community 135 - "marketplace.module.ts"
Cohesion: 0.17
Nodes (14): SIDES, APPROVAL_MAX_BYTES, AuthenticatedRequest, AuthenticatedUser, ROLES_KEY, JwtAuthGuard, Injectable, RolesGuard (+6 more)

### Community 136 - "DtoUpdateItemOrder"
Cohesion: 0.10
Nodes (18): DtoUpdateItemOrder, IsBoolean, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min (+10 more)

### Community 137 - "Выкатка: репозиторий → сервер"
Cohesion: 0.29
Nodes (6): Выкатка: репозиторий → сервер, Как это устроено на сервере, Команды, Откат, Почему именно так, Чего в цепочке пока нет

### Community 138 - "scenario.engine.ts"
Cohesion: 0.41
Nodes (10): detectProduct(), evaluateCondition(), evaluateScenario(), isFilled(), isStepRequired(), isStepVisible(), normalize(), pickRelevantAnswers() (+2 more)

### Community 139 - "DtoBulkStock"
Cohesion: 0.15
Nodes (12): DtoBulkStock, DtoBulkStockWarehouse, ArrayMaxSize, ArrayNotEmpty, IsArray, IsIn, IsInt, IsString (+4 more)

### Community 140 - "2. Что уже сделано (этап 2 — карточки товаров)"
Cohesion: 0.10
Nodes (19): 1.1. Что показал живой кабинет (17.08.2026), 1. Что уже сделано (этап 1 — подключение), 2.1. Порядок работы с товаром в Ozon Seller API (справочно), 2.2. Заказы (этап 3, только чтение), 2.3. Мои товары и юнит-экономика (этап 4), 2. Что уже сделано (этап 2 — карточки товаров), 3. Дальше, API CRM (+11 more)

### Community 141 - "parse_proxy"
Cohesion: 0.33
Nodes (3): parse_proxy(), Словарь для Telethon или None, если прокси не задан. Формат именно словаря…, TestParse

### Community 142 - ".constructor"
Cohesion: 0.25
Nodes (4): ELIGIBLE_ROLES, ShipmentLeadService, ShipmentLeadView, Injectable

### Community 143 - "nginx-routes.spec.ts"
Cohesion: 0.22
Nodes (4): FRONTEND, NGINX_CONF, SRC, VITE_CONF

### Community 144 - "DtoUpdateOzonCatalogTemplate"
Cohesion: 0.17
Nodes (11): DtoUpdateOzonCatalogTemplate, ArrayMaxSize, IsArray, IsBoolean, IsInt, IsObject, IsOptional, IsString (+3 more)

### Community 145 - "ImageCardGenerationService"
Cohesion: 0.12
Nodes (13): BULK_ACTIONS, BulkAction, DtoBulkCards, ArrayMaxSize, ArrayNotEmpty, IsArray, IsIn, IsUUID (+5 more)

### Community 146 - "ТЗ: раздел «Печать на холсте» на raspechatkaa.ru"
Cohesion: 0.10
Nodes (19): Берём после сезона, Берём сразу, до сезона, Блок 0. Контекст и границы, Блок 10. Интеграция с CRM, Блок 11. Что НЕ делать, Блок 12. Технологическое преимущество, Блок 1. Информационная архитектура и URL, Блок 2. Хлебные крошки и связность (+11 more)

### Community 147 - "canvas-item.service.ts"
Cohesion: 0.11
Nodes (21): CANVAS_MATERIAL_KIND_LABELS, CANVAS_PRODUCTION_PRICES, canvasContractorCost(), CanvasMaterialKind, CanvasPositionPricing, CanvasProductionPrice, canvasRetailPrice(), canvasSizeLabel() (+13 more)

### Community 148 - "auto-update.sh"
Cohesion: 0.83
Nodes (3): log(), auto-update.sh script, warm()

### Community 149 - "Первое сообщение клиенту"
Cohesion: 0.22
Nodes (8): Итоги попытки, Как работает, Настройка, О чём стоит помнить, Первое сообщение клиенту, Переменные окружения, Почему отдельный процесс, а не CRM, Текст сообщения

### Community 150 - "sign"
Cohesion: 0.36
Nodes (3): Заголовки подписи. Пустой секрет — пустой словарь: пусть CRM решает, пускать…, sign(), TestSign

### Community 151 - "delivery_line"
Cohesion: 0.43
Nodes (3): delivery_line(), Строка доставки — своя для каждого способа. Пустую строку возвращать нельзя: в…, TestDeliveryLine

### Community 152 - "OrderDetail.tsx"
Cohesion: 0.08
Nodes (38): DispatchToExecutorModal(), PayoutInfo, Props, rub(), GulianSyncBlock(), Props, STATUS_LABELS, AssignPanel() (+30 more)

### Community 153 - "items_list"
Cohesion: 0.43
Nodes (3): items_list(), Список позиций — по строке на позицию. Именно он отличает ответ на действие от…, TestItemsList

### Community 154 - "ozon-default-warehouses.ts"
Cohesion: 0.47
Nodes (3): resolveDefaultWarehouses(), WarehouseChoice, WarehouseState

### Community 155 - "canvas.pricing.ts"
Cohesion: 0.22
Nodes (13): calcCanvasUnitPrice(), calcCanvasUrgencyFee(), CANVAS_FRAME_LABELS, CANVAS_MATERIAL_LABELS, CANVAS_SIZES, CanvasFrame, CanvasMaterial, CanvasSize (+5 more)

### Community 156 - "partner-admin.controller.ts"
Cohesion: 0.47
Nodes (4): ALLOWED, EXT_CONTENT_TYPE, TECH_SPEC_MAX_BYTES, TECH_SPEC_MAX_FILES

### Community 159 - "CanvasPricingController"
Cohesion: 0.50
Nodes (3): CanvasPricingController, Controller, Get

### Community 160 - "DtoUpdateImageCard"
Cohesion: 0.25
Nodes (7): CARD_MANUAL_STATUSES, CardManualStatus, DtoUpdateImageCard, IsBoolean, IsIn, IsObject, IsOptional

### Community 162 - "OzonOrdersController"
Cohesion: 0.50
Nodes (3): OzonOrdersController, Controller, UseGuards

### Community 166 - "scenario.registry.ts"
Cohesion: 0.18
Nodes (16): DELIVERY_STEPS, NOTE_STEP, OPTIONAL, PHOTO_SCENARIO, TSHIRT_SCENARIO, ProductDefinition, PRODUCTS, AnswerValue (+8 more)

### Community 170 - "TelegramService"
Cohesion: 0.10
Nodes (14): buildPartnerButtons(), logger, proxyDispatcher(), resetTelegramProxyCache(), telegramFetch(), telegramFormData(), TelegramPollingService, TgUpdateWithId (+6 more)

### Community 172 - "DtoUpdateOzonUnitEconomics"
Cohesion: 0.22
Nodes (8): DtoUpdateOzonUnitEconomics, IsIn, IsInt, IsOptional, Max, Min, Type, IsNumber

### Community 177 - "lead-notification.ts"
Cohesion: 0.33
Nodes (6): buildLeadNotification(), escape(), LeadForNotification, NotifiableUser, pickLeadResponders(), toMention()

### Community 192 - "DtoOzonUpdateCardText"
Cohesion: 0.33
Nodes (5): DtoOzonUpdateCardText, IsOptional, IsString, MaxLength, MinLength

### Community 193 - "lead.controller.ts"
Cohesion: 0.11
Nodes (18): clientNameFromNote(), GREETING_STATUSES, GreetingStatus, isGreetingStatus(), ClientGreetingService, PendingGreeting, Injectable, telegramUsernameFromUrl() (+10 more)

### Community 195 - "scenario.controller.ts"
Cohesion: 0.13
Nodes (14): DtoDetectProduct, IsString, MaxLength, DtoSaveDraft, IsObject, IsOptional, IsString, MaxLength (+6 more)

### Community 200 - "scenario.module.ts"
Cohesion: 0.24
Nodes (7): PrismaModule, Module, ScenarioModule, Module, validateAllScenarios(), validateScenario(), Global

### Community 201 - "main.ts"
Cohesion: 0.50
Nodes (4): AppModule, Module, allowedOrigins(), bootstrap()

### Community 203 - "order-photo.controller.ts"
Cohesion: 0.16
Nodes (11): PRICE_FIELDS, strip(), StripPricesInterceptor, Injectable, DtoSetReview, IsBoolean, DtoSetShipmentLead, IsOptional (+3 more)

## Knowledge Gaps
- **811 isolated node(s):** `$schema`, `collection`, `sourceRoot`, `deleteOutDir`, `name` (+806 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **51 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Roles()` connect `Roles` to `tasks.controller.ts`, `ApprovalController`, `DtoUpdateUser`, `PrismaService`, `marketplace.module.ts`, `prisma.service.ts`, `DtoCreateExpense`, `reports.service.ts`, `AvitoService`, `partner-admin.controller.ts`, `PartnerAdminController`, `OzonOrdersController`, `ozon-photo.controller.ts`, `salary.controller.ts`, `scenario.controller.ts`, `order-photo.controller.ts`, `ImageCardBatchController`, `ImageCardTemplateService`, `MarketplaceController`, `MockupService`, `AvitoController`, `OzonCatalogController`, `OzonProductCatalogController`, `ScenarioController`?**
  _High betweenness centrality (0.275) - this node is a cross-community bridge._
- **Why does `BatchView()` connect `ApprovalController` to `getErrorMessage`?**
  _High betweenness centrality (0.239) - this node is a cross-community bridge._
- **Why does `getErrorMessage()` connect `getErrorMessage` to `ApprovalController`, `PrintEditor.tsx`, `MarketplacePage.tsx`, `PrintCardModal.tsx`, `AvitoPage.tsx`, `SettingsPage.tsx`, `OrdersPage.tsx`, `ProductsTab.tsx`, `index.ts`, `App.tsx`, `TasksPage.tsx`, `OrderDetail.tsx`, `ozonProductCatalog.ts`, `ApprovalEditor.tsx`?**
  _High betweenness centrality (0.187) - this node is a cross-community bridge._
- **What connects `$schema`, `collection`, `sourceRoot` to the rest of the system?**
  _811 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `DtoCreateOzonPrint` be split into smaller, more focused modules?**
  _Cohesion score 0.05832147937411095 - nodes in this community are weakly interconnected._
- **Should `tasks.controller.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06493506493506493 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._