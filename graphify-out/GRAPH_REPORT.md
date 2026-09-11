# Graph Report - raspechatka  (2026-09-11)

## Corpus Check
- 488 files · ~260,697 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 3795 nodes · 7872 edges · 211 communities (162 shown, 49 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 323 edges (avg confidence: 0.79)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `cf412dde`
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
- App.tsx
- TshirtItemsTable.tsx
- Roles
- System Map
- DtoCreateExpense
- reports.service.ts
- OrdersPage.tsx
- daily-plan-rules.ts
- AvitoService
- Брендбук — Распечатка PRO
- OzonCredentials
- compilerOptions
- PrintDesignerEngine
- compilerOptions
- Аудит проекта «Распечатка» — 2026-06-14
- AppShell.tsx
- dependencies
- ozon-bulk-stock.service.ts
- image-card-placement.ts
- ApprovalEditor.tsx
- compilerOptions
- MarketplaceAccountService
- PrintCardModal.tsx
- app.module.ts
- review-reminder.service.ts
- PartnerAdminController
- devDependencies
- CardEditorModal.tsx
- DtoCreateLead
- OzonPhotoStorageService
- salary.controller.ts
- Интеграция с исполнителем-партнёром (печать футболок)
- scenario.registry.ts
- CRM «Распечатка» — как всё устроено
- CatalogTab.tsx
- auth.controller.ts
- TasksPage.tsx
- prisma.service.ts
- ozon-product-catalog.service.ts
- OrderPhotoService
- order-photo.service.ts
- salary-integrity.spec.ts
- ReportsPage.tsx
- CreateOrderForm.tsx
- Исправленные проблемы
- crm-new/README.md
- getErrorMessage
- partner-outbound.service.ts
- scripts
- frontend/package.json
- Architecture
- Architecture
- ozon-orders.service.ts
- package.json
- approval-render.service.ts
- image-cards.module.ts
- exclude
- Аудит финансов, кода и продакшена — 2026-07-09
- devDependencies
- order-photo/photo-material.ts
- nest-cli.json
- MarketplacePage.tsx
- ozonProductCatalog.ts
- GulianService
- seed.js
- order-photo.controller.ts
- OzonPrintService
- React + TypeScript + Vite
- backup-db.sh
- shipment-reminder-rules.ts
- ts-loader
- frontend/tsconfig.json
- ImageCardBatchController
- ozon-import.service.ts
- partner-telegram-format.ts
- ImageCardTemplateService
- ozon-attributes.ts
- @nestjs/cli
- image-card-batch.service.ts
- OzonApiClient
- ApprovalService
- PrintEditor.tsx
- supertest
- ImageCardStorageService
- MarketplaceController
- ts-node
- MockupService
- .sendMessage
- TshirtPartnerTelegramService
- OzonCatalogController
- crm-new/package.json
- ProductsTab.tsx
- @types/supertest
- partner-settings.service.ts
- PdfRasterService
- OzonProductCatalogController
- DtoUpdateOzonUnitEconomics
- tshirt-partner-telegram.service.ts
- DtoUpdateItemOrder
- typescript-eslint
- vite
- OzonOrdersController
- render
- index.ts
- @nestjs/core
- DtoOzonColorGroup
- partner-status.ts
- telegram.module.ts
- passport
- pdf-lib
- DtoOzonUpdateCardText
- tg_greeter.py
- DtoUpdateMockupTemplate
- ТЗ: семантика и структура страниц raspechatkaa.ru
- .handleUpdate
- DtoUpdateOzonPrint
- @prisma/adapter-pg
- @prisma/client
- DtoUpdateApproval
- ApprovalController
- describe
- ScenarioController
- partner-api.controller.ts
- PrismaService
- marketplace.module.ts
- .get
- Выкатка: репозиторий → сервер
- LeadController
- DtoBulkStock
- 2. Что уже сделано (этап 2 — карточки товаров)
- parse_proxy
- TelegramService
- nginx-routes.spec.ts
- DtoUpdateOzonCatalogTemplate
- site-lead-token.guard.ts
- ТЗ: раздел «Печать на холсте» на raspechatkaa.ru
- canvas-production-price.ts
- auto-update.sh
- Первое сообщение клиенту
- sign
- delivery_line
- OrderDetail.tsx
- items_list
- ReportsController
- canvas.pricing.ts
- telegram.service.ts
- sharp
- undici
- telegram-update.service.ts
- roboto-fontface
- jest
- DtoUpdateOrder
- approval.service.ts
- @nestjs/passport
- greeting-message.ts
- PartnerApiController
- .createOrder
- StripPricesInterceptor
- DtoUpdatePartnerSettings
- TechSpecStorageService
- eslint-config-prettier
- @eslint/eslintrc
- scenario.module.ts
- @nestjs/schematics
- @nestjs/testing
- class-transformer
- lead-notification.ts
- prisma
- .webhook
- ts-jest
- globals
- passport-jwt
- @types/archiver
- .constructor
- @types/node
- prettier
- typescript-eslint
- @types/multer
- DtoPublishOzonPrints
- @types/passport-jwt
- typescript
- eslint-plugin-react-refresh
- client-greeting.service.ts
- tsconfig-paths
- DtoCreateApproval
- pdfkit
- pg
- uuid
- web-push
- source-map-support
- HealthController
- tailwindcss
- .list
- main.ts
- @nestjs/mapped-types
- eslint
- eslint
- CanvasPricingController
- @nestjs/common
- @eslint/js

## God Nodes (most connected - your core abstractions)
1. `PrismaService` - 103 edges
2. `Roles()` - 89 edges
3. `getErrorMessage()` - 68 edges
4. `OzonCredentials` - 42 edges
5. `CurrentUser` - 40 edges
6. `OrderPhotoController` - 37 edges
7. `OzonProductCatalogService` - 32 edges
8. `useAuth()` - 31 edges
9. `PartnerSettingsService` - 29 edges
10. `TelegramService` - 29 edges

## Surprising Connections (you probably didn't know these)
- `splitLeadNote()` --indirect_call--> `line()`  [INFERRED]
  frontend/src/components/orders/OrderDetail.tsx → crm-new/src/approval/approval-render.service.ts
- `BatchList()` --calls--> `getErrorMessage()`  [EXTRACTED]
  frontend/src/components/marketplace/CardGeneratorTab.tsx → frontend/src/utils/get-error-message.ts
- `AccountCard()` --calls--> `getErrorMessage()`  [EXTRACTED]
  frontend/src/components/marketplace/ConnectionTab.tsx → frontend/src/utils/get-error-message.ts
- `AccountForm()` --calls--> `getErrorMessage()`  [EXTRACTED]
  frontend/src/components/marketplace/ConnectionTab.tsx → frontend/src/utils/get-error-message.ts
- `AssignPanel()` --calls--> `getErrorMessage()`  [EXTRACTED]
  frontend/src/components/orders/OrderDetail.tsx → frontend/src/utils/get-error-message.ts

## Import Cycles
- None detected.

## Communities (211 total, 49 thin omitted)

### Community 0 - "DtoCreateOzonPrint"
Cohesion: 0.09
Nodes (22): DtoCreateOzonPrint, ArrayMaxSize, ArrayMinSize, ArrayNotEmpty, IsArray, IsEnum, IsInt, IsOptional (+14 more)

### Community 1 - "tasks.controller.ts"
Cohesion: 0.06
Nodes (34): DtoCreateTask, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength (+26 more)

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

### Community 7 - "App.tsx"
Cohesion: 0.10
Nodes (25): authApi, salaryApi, AdminRoute(), App(), AppRoutes(), CrmGate(), HomeRedirect(), LoginPage (+17 more)

### Community 8 - "TshirtItemsTable.tsx"
Cohesion: 0.06
Nodes (38): canvasProductionApi, CanvasProductionPricing, CanvasProductionSize, Props, ProductsTab(), CanvasItemsTable(), EditState, EMPTY (+30 more)

### Community 9 - "Roles"
Cohesion: 0.14
Nodes (14): CurrentUser, Roles(), OrderPhotoController, Body, Controller, Delete, Get, Param (+6 more)

### Community 10 - "System Map"
Cohesion: 0.05
Nodes (36): 2026-07-08, 2026-07-09, 2026-07-11, 2026-08-24, 2026-08-24 (later), 2026-08-25, Access Rules, App Modules (+28 more)

### Community 11 - "DtoCreateExpense"
Cohesion: 0.08
Nodes (20): DtoCreateExpense, IsEnum, IsInt, IsOptional, IsString, Min, ExpensesController, Body (+12 more)

### Community 12 - "reports.service.ts"
Cohesion: 0.18
Nodes (16): addExpense(), addOrder(), CostSettings, deliveryPaidFor(), emptyBucket(), ExpenseRow, finalize(), isRevenueRealized() (+8 more)

### Community 13 - "OrdersPage.tsx"
Cohesion: 0.08
Nodes (37): OrdersPage, ExecutorFilter(), Props, StatusStepper(), DELIVERY_STYLES, DeliveryBadge(), Props, FilterChip() (+29 more)

### Community 14 - "daily-plan-rules.ts"
Cohesion: 0.05
Nodes (62): buildDailyPlanMessage(), buildShipmentBlock(), dayMonth(), DELIVERY_LABEL, effectiveDeadline(), executorKey(), inWorkTail(), isWithinPlanWindow() (+54 more)

### Community 15 - "AvitoService"
Cohesion: 0.05
Nodes (32): AvitoController, Controller, Get, Param, Post, Query, UseGuards, AvitoMessengerService (+24 more)

### Community 16 - "Брендбук — Распечатка PRO"
Cohesion: 0.08
Nodes (24): 1. Анализ конкурентов, 2. Психология цвета, 3. Цветовая палитра, 4. Типографика, 5. Логотип и иконка, 6. Правила применения, 7. Tone of Voice, 8. Применение на сайте (будущее) (+16 more)

### Community 17 - "OzonCredentials"
Cohesion: 0.08
Nodes (19): OzonCredentials, OzonProductCatalogService, OzonProductTariffs, Injectable, calculateUnitEconomics(), OzonTariffs, realSettings, settings (+11 more)

### Community 18 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, allowSyntheticDefaultImports, baseUrl, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, forceConsistentCasingInFileNames (+14 more)

### Community 19 - "PrintDesignerEngine"
Cohesion: 0.14
Nodes (8): PrintDesignerPage, PrintDesignerEngine, Slot, COLORS, EXPORT_SCALES, PrintDesignerPage(), PRINT_TEMPLATES, PrintTemplate

### Community 20 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection, moduleResolution (+14 more)

### Community 21 - "Аудит проекта «Распечатка» — 2026-06-14"
Cohesion: 0.09
Nodes (21): 10.1 Почему PDF «не формировался» и долго генерировался, 10.2 Декомпозиция API-слоя (был god-файл), 10.3 Группировка компонентов, 10.4 Автоматические бэкапы БД (рекомендация №1), 10.5 Итоговая структура фронта, 10.6 Деплой раунда 2, 10. Раунд 2 — PDF, декомпозиция API/компонентов, бэкапы (тот же день), 1. Резюме и метрики (+13 more)

### Community 22 - "AppShell.tsx"
Cohesion: 0.09
Nodes (21): AppShell(), NavProps, Props, LeadNotifyBell(), AD_MGR, ADMIN, ALL, BadgeKey (+13 more)

### Community 23 - "dependencies"
Cohesion: 0.10
Nodes (21): axios, dependencies, axios, @hookform/resolvers, lucide-react, react, react-dom, react-hook-form (+13 more)

### Community 24 - "ozon-bulk-stock.service.ts"
Cohesion: 0.07
Nodes (32): OzonBulkStockProcessorService, Injectable, buildPairs(), BulkStockMode, BulkStockValidationError, checkQuantity(), chunkPairs(), LARGE_OPERATION_THRESHOLD (+24 more)

### Community 25 - "image-card-placement.ts"
Cohesion: 0.11
Nodes (25): ASPECT_ALERT, CardTransform, clamp(), containFit(), DEFAULT_FILL, DEFAULT_TRANSFORM, isOutside(), MAX_SCALE (+17 more)

### Community 26 - "ApprovalEditor.tsx"
Cohesion: 0.08
Nodes (48): approvalsApi, mockupsApi, ApprovalEditor(), CmField(), downloadBlob(), Props, SIDE_LABELS, Sides (+40 more)

### Community 27 - "compilerOptions"
Cohesion: 0.10
Nodes (20): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+12 more)

### Community 28 - "MarketplaceAccountService"
Cohesion: 0.12
Nodes (14): ACCOUNT_INCLUDE, AccountRow, CreateAccountInput, MarketplaceAccountService, MarketplaceAccountView, Injectable, UpdateAccountInput, OzonService (+6 more)

### Community 29 - "PrintCardModal.tsx"
Cohesion: 0.19
Nodes (18): colorCodeOf(), firstEditableWarehouse(), groupByColor(), OzonCatalogProduct, ProductEconomics, sizeOf(), sizeRank(), CardAnalytics() (+10 more)

### Community 30 - "app.module.ts"
Cohesion: 0.10
Nodes (22): ApprovalModule, Module, CanvasModule, Module, GulianModule, Module, ImageCardsModule, Module (+14 more)

### Community 31 - "review-reminder.service.ts"
Cohesion: 0.26
Nodes (10): isReviewReminderEligible(), REVIEW_REMINDER_CATEGORIES, REVIEW_REMINDER_DELAY_MS, REVIEW_REMINDER_PICKUP_DELAY_MS, REVIEW_REMINDER_STATUSES, reviewReminderDelayMs(), buildReviewRequestText(), categoryLabel() (+2 more)

### Community 32 - "PartnerAdminController"
Cohesion: 0.19
Nodes (9): PartnerAdminController, Controller, Get, Param, Post, Res, UploadedFiles, UseGuards (+1 more)

### Community 33 - "devDependencies"
Cohesion: 0.11
Nodes (19): eslint-plugin-react-hooks, devDependencies, @eslint/js, eslint-plugin-react-hooks, globals, @tailwindcss/vite, @types/node, @types/react (+11 more)

### Community 34 - "CardEditorModal.tsx"
Cohesion: 0.07
Nodes (44): ozonBatchesApi, ozonCardsApi, CardBatchReport(), CardEditorModal(), CardFinalizePanel(), BatchList(), CardGeneratorTab(), MODE_LABELS (+36 more)

### Community 35 - "DtoCreateLead"
Cohesion: 0.09
Nodes (18): DtoCreateLead, base, meta, pipe, IsBoolean, IsEnum, IsIn, IsInt (+10 more)

### Community 36 - "OzonPhotoStorageService"
Cohesion: 0.12
Nodes (13): OzonPhotoStorageService, Injectable, OzonPhotoController, Controller, Get, Param, Post, Req (+5 more)

### Community 37 - "salary.controller.ts"
Cohesion: 0.05
Nodes (34): DtoCreateBonus, IsInt, IsString, IsUUID, MaxLength, Min, MinLength, Type (+26 more)

### Community 38 - "Интеграция с исполнителем-партнёром (печать футболок)"
Cohesion: 0.12
Nodes (15): 1. Модель взаимодействия, 2. Аутентификация, 3. Webhook, который мы отправляем партнёру, 4.1 Данные заказа, 4.2 ТЗ-фото (макет), 4.3 Стикер (PDF, 58×40 мм), 4.4 Смена статуса заказа (партнёр → нам), 4. Эндпоинты, откуда партнёр забирает данные (pull) (+7 more)

### Community 39 - "scenario.registry.ts"
Cohesion: 0.08
Nodes (50): DELIVERY_STEPS, NOTE_STEP, OPTIONAL, PAPER_LABEL, photoToOrder(), PHOTO_SCENARIO, tshirtToOrder(), TSHIRT_SCENARIO (+42 more)

### Community 40 - "CRM «Распечатка» — как всё устроено"
Cohesion: 0.11
Nodes (18): 10. Слабые места, 11. Что дальше, 1. Что это, 2. Из чего собрано, 3. Продукты и статусы, 4. Деньги, 5. Роли, 6. Сценарии оформления (+10 more)

### Community 41 - "CatalogTab.tsx"
Cohesion: 0.15
Nodes (16): baseCodeOf(), BulkStockHistoryRow, ozonProductCatalogApi, printCodeOf(), UnitEconomicsSettings, CatalogTab(), colorsOf(), FILTERS (+8 more)

### Community 42 - "auth.controller.ts"
Cohesion: 0.10
Nodes (17): AuthController, Body, Controller, Get, Post, Throttle, UseGuards, AuthModule (+9 more)

### Community 43 - "TasksPage.tsx"
Cohesion: 0.14
Nodes (18): tasksApi, TasksQuery, TasksPage, Modal(), Props, daysUntil(), DeadlineChip(), EMPTY_FORM (+10 more)

### Community 44 - "prisma.service.ts"
Cohesion: 0.07
Nodes (24): CARD_MODES, CardMode, BULK_ACTIONS, BulkAction, DtoBulkCards, ArrayMaxSize, ArrayNotEmpty, IsArray (+16 more)

### Community 45 - "ozon-product-catalog.service.ts"
Cohesion: 0.09
Nodes (21): OzonActionView, OzonCatalogProduct, OzonContentRating, OzonDemand, OzonImportAttributeBody, OzonProductCard, RawActionsResponse, RawAnalyticsResponse (+13 more)

### Community 46 - "OrderPhotoService"
Cohesion: 0.11
Nodes (15): DtoAllOrdersforQuery, IsEnum, IsIn, IsInt, IsOptional, IsString, Matches, Max (+7 more)

### Community 47 - "order-photo.service.ts"
Cohesion: 0.06
Nodes (33): DtoAssignExecutor, IsOptional, IsString, IsUUID, IsEnum, UpdateStatus, FREE_DELIVERY_FROM, leadDeliveryCost() (+25 more)

### Community 48 - "salary-integrity.spec.ts"
Cohesion: 0.09
Nodes (20): FinancialClient, needsShipmentStatus(), calculateManagerSalarySnapshot(), calculateSalarySnapshot(), earnsStaffSalary(), ManagerSalarySnapshot, SalarySnapshot, AccrualByIdRow (+12 more)

### Community 49 - "ReportsPage.tsx"
Cohesion: 0.09
Nodes (34): expensesApi, ReportsPage, SalaryPage, buildReceiptHtml(), buildReceiptTitle(), escapeHtml(), formatFilenameDate(), printReceipt() (+26 more)

### Community 50 - "CreateOrderForm.tsx"
Cohesion: 0.10
Nodes (26): baseSchema, canvasItemSchema, clearOrderDraft(), CreateOrderForm(), EMPTY_ORDER_FORM, FormValues, freeItemSchema, fullSchema (+18 more)

### Community 51 - "Исправленные проблемы"
Cohesion: 0.18
Nodes (10): CRITICAL, CRM Audit Report — 2026-06-14, HIGH, HIGH, LOW, MEDIUM, MEDIUM, Исправленные проблемы (+2 more)

### Community 52 - "crm-new/README.md"
Cohesion: 0.20
Nodes (9): Compile and run the project, Deployment, Description, License, Project setup, Resources, Run tests, Stay in touch (+1 more)

### Community 53 - "getErrorMessage"
Cohesion: 0.11
Nodes (32): usersApi, UsersPage, clamp(), CreateModal(), isReady(), PlacementModal(), rectOf(), TemplateRow() (+24 more)

### Community 54 - "partner-outbound.service.ts"
Cohesion: 0.18
Nodes (9): hasProductionItems(), NO_PRODUCTION_ITEMS_MESSAGE, OrderWithProductionItems, PartnerOutboundService, Injectable, getTechSpecPathAt(), getTechSpecPaths(), hasTechSpecFiles() (+1 more)

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
Cohesion: 0.11
Nodes (27): DPI_ACCEPTABLE, DPI_GOOD, estimateDpi(), formatCm(), formatSizeCm(), isCalibrated(), isOutsidePrintArea(), PrintAreaCalibration (+19 more)

### Community 62 - "image-cards.module.ts"
Cohesion: 0.16
Nodes (15): DtoCreateImageCardTemplate, DtoRect, DtoUpdateImageCardTemplate, IsBoolean, IsInt, IsObject, IsOptional, IsString (+7 more)

### Community 63 - "exclude"
Cohesion: 0.25
Nodes (7): exclude, extends, dist, node_modules, **/*spec.ts, test, ./tsconfig.json

### Community 64 - "Аудит финансов, кода и продакшена — 2026-07-09"
Cohesion: 0.29
Nodes (6): Аудит финансов, кода и продакшена — 2026-07-09, Кодовый аудит, Короткий вывод, Продакшен-аудит, Следующие улучшения, Финансовый аудит

### Community 65 - "devDependencies"
Cohesion: 0.22
Nodes (9): devDependencies, eslint-plugin-prettier, @types/express, @types/jest, @types/pdfkit, eslint-plugin-prettier, @types/express, @types/jest (+1 more)

### Community 66 - "order-photo/photo-material.ts"
Cohesion: 0.19
Nodes (14): calcOrderProfit(), forecastSalary(), kopecksToRub(), OrderProfit, OrderProfitInput, SHEET, DECLARED_PRINTS_PER_SHEET, HALF_SHEET_WORDS (+6 more)

### Community 67 - "nest-cli.json"
Cohesion: 0.33
Nodes (5): collection, compilerOptions, deleteOutDir, $schema, sourceRoot

### Community 68 - "MarketplacePage.tsx"
Cohesion: 0.07
Nodes (37): CreateAccountDto, EnumMarketplace, MarketplaceAccount, marketplaceApi, OzonConnectionInfo, UpdateAccountDto, OzonOrder, OzonOrderGroup (+29 more)

### Community 69 - "ozonProductCatalog.ts"
Cohesion: 0.10
Nodes (22): BulkStockInput, BulkStockItem, BulkStockMode, BulkStockOperation, BulkStockPreview, BulkStockWarehouseInput, COLOR_CODES, COLOR_SUFFIX (+14 more)

### Community 70 - "GulianService"
Cohesion: 0.17
Nodes (7): GulianOutboxProcessorService, RETRY_DELAYS_SECONDS, Injectable, GulianOrderPayload, GulianResponse, GulianService, Injectable

### Community 71 - "seed.js"
Cohesion: 0.40
Nodes (3): bcrypt, { Client }, { randomUUID }

### Community 72 - "order-photo.controller.ts"
Cohesion: 0.05
Nodes (49): DtoCreateCanvasItem, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, Type (+41 more)

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
Cohesion: 0.08
Nodes (15): ImageCardBatchController, Body, Controller, Delete, Get, Param, Patch, Post (+7 more)

### Community 80 - "ozon-import.service.ts"
Cohesion: 0.07
Nodes (21): DEFAULT_SIZE_DIMENSIONS, OzonCatalogTemplateService, Injectable, UpdateOzonCatalogTemplateInput, OzonImportPollService, Injectable, OzonImportService, Injectable (+13 more)

### Community 81 - "partner-telegram-format.ts"
Cohesion: 0.27
Nodes (9): buildPartnerCaption(), calcSettlement(), esc(), PartnerOrderData, PartnerOrderItem, PRINT_LOCATION_LABELS, PRINT_TYPE_LABELS, rub() (+1 more)

### Community 82 - "ImageCardTemplateService"
Cohesion: 0.11
Nodes (15): isUsableArea(), ImageCardTemplateController, Body, Controller, Delete, Get, Param, Patch (+7 more)

### Community 83 - "ozon-attributes.ts"
Cohesion: 0.12
Nodes (24): buildExtraImages(), buildImportItem(), CatalogTemplateForImport, COLOR_CODE_BY_LABEL, DEFAULT_SIZES, dictAttr(), dictListAttr(), dictListAttrFromLabels() (+16 more)

### Community 85 - "image-card-batch.service.ts"
Cohesion: 0.14
Nodes (18): DtoCreateImageCardBatch, ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, IsUUID (+10 more)

### Community 86 - "OzonApiClient"
Cohesion: 0.08
Nodes (24): humanize(), OzonApiClient, OzonApiError, OzonErrorBody, Injectable, OzonConnectionInfo, OzonProductListResponse, OzonWarehouseListResponse (+16 more)

### Community 87 - "ApprovalService"
Cohesion: 0.15
Nodes (10): ApprovalService, Injectable, ApprovalSides, clamp(), filledSides(), MAX_PRINT_MM, MIN_PRINT_MM, num() (+2 more)

### Community 88 - "PrintEditor.tsx"
Cohesion: 0.09
Nodes (31): CreateOzonPrintDto, EnumOzonSyncStatus, OzonAttributeValueOption, ozonCatalogApi, OzonCatalogTemplate, OzonColorGroupInput, OzonVariant, PublishResult (+23 more)

### Community 90 - "ImageCardStorageService"
Cohesion: 0.10
Nodes (5): ImageCardProcessorService, parseSnapshot(), Injectable, ImageCardStorageService, Injectable

### Community 91 - "MarketplaceController"
Cohesion: 0.08
Nodes (22): DtoCreateMarketplaceAccount, IsEnum, IsString, MaxLength, MinLength, DtoUpdateMarketplaceAccount, IsBoolean, IsOptional (+14 more)

### Community 93 - "MockupService"
Cohesion: 0.10
Nodes (14): MockupController, Body, Controller, Delete, Get, Param, Patch, Post (+6 more)

### Community 94 - ".sendMessage"
Cohesion: 0.29
Nodes (5): Body, DtoSendAvitoMessage, IsString, MaxLength, MinLength

### Community 95 - "TshirtPartnerTelegramService"
Cohesion: 0.21
Nodes (4): buildPartnerButtons(), Injectable, TshirtPartnerTelegramService, TelegramSendResult

### Community 96 - "OzonCatalogController"
Cohesion: 0.16
Nodes (12): OzonCatalogController, Body, Controller, Delete, Get, Param, Patch, Post (+4 more)

### Community 97 - "crm-new/package.json"
Cohesion: 0.29
Nodes (6): author, description, license, name, private, version

### Community 98 - "ProductsTab.tsx"
Cohesion: 0.13
Nodes (25): EnumTshirtGender, OzonPrint, EditPrintModal(), COLOR_CODE_BY_LABEL, colorCodeFor(), DEFAULT_SIZES, draftErrors(), draftToPayload() (+17 more)

### Community 100 - "partner-settings.service.ts"
Cohesion: 0.11
Nodes (18): buildPartnerOrderPayload(), PartnerOrderForPayload, PartnerOrderPayload, PRINT_LOCATION_LABELS, PRINT_TYPE_LABELS, Db, AnyMock, call() (+10 more)

### Community 101 - "PdfRasterService"
Cohesion: 0.21
Nodes (5): PdfRasterService, PdfRasterUnavailableError, RASTER_LONG_SIDE, run, Injectable

### Community 102 - "OzonProductCatalogController"
Cohesion: 0.19
Nodes (9): OzonProductCatalogController, Body, Controller, Get, Param, Patch, Post, Query (+1 more)

### Community 103 - "DtoUpdateOzonUnitEconomics"
Cohesion: 0.22
Nodes (8): DtoUpdateOzonUnitEconomics, IsIn, IsInt, IsOptional, Max, Min, Type, IsNumber

### Community 104 - "tshirt-partner-telegram.service.ts"
Cohesion: 0.16
Nodes (14): escapeHtml(), EXT_CONTENT_TYPE, money(), PRINT_LOCATION_LABELS, PRINT_TYPE_LABELS, TechSpecAttachment, TshirtOrderWithItems, DEFAULT_PARTNER_RATE_BASIS_POINTS (+6 more)

### Community 105 - "DtoUpdateItemOrder"
Cohesion: 0.17
Nodes (11): DtoUpdateItemOrder, IsBoolean, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min (+3 more)

### Community 112 - "OzonOrdersController"
Cohesion: 0.50
Nodes (3): OzonOrdersController, Controller, UseGuards

### Community 113 - "render"
Cohesion: 0.17
Nodes (9): greeting_for(), money(), Обращение целиком, а не только имя. У заявки имени может не быть — человек…, Сумма с пробелами между разрядами: 2 490, а не 2490. Ноль означает, что позиций…, Готовый текст сообщения. Неизвестные метки остаются как есть., render(), TestGreeting, TestMoney (+1 more)

### Community 114 - "index.ts"
Cohesion: 0.06
Nodes (50): avitoApi, AvitoChatQuery, api, reportsApi, MySalaryBalance, shipmentLeadApi, AvitoPage, AvitoPage() (+42 more)

### Community 116 - "DtoOzonColorGroup"
Cohesion: 0.14
Nodes (13): DtoOzonColorGroup, ArrayMinSize, ArrayNotEmpty, IsArray, IsEnum, IsInt, IsOptional, IsString (+5 more)

### Community 117 - "partner-status.ts"
Cohesion: 0.13
Nodes (14): Body, Patch, FLOW_RANK, FROM_PARTNER, fromPartnerStatus(), mapPartnerStage(), PARTNER_SETTABLE_STATUSES, PARTNER_STAGE_MAP (+6 more)

### Community 118 - "telegram.module.ts"
Cohesion: 0.16
Nodes (8): TelegramStickerController, Controller, Get, Param, Query, Res, TelegramStickerLinkService, Injectable

### Community 121 - "DtoOzonUpdateCardText"
Cohesion: 0.33
Nodes (5): DtoOzonUpdateCardText, IsOptional, IsString, MaxLength, MinLength

### Community 122 - "tg_greeter.py"
Cohesion: 0.18
Nodes (11): Exception, Crm, Fatal, load_templates(), main(), Очередь и отметки. Ошибки сети не роняют процесс — просто ждём., Одно сообщение. Возвращает итог из закрытого списка, который знает CRM. Все…, Настройки неверны — работать нельзя, перезапуск не поможет. (+3 more)

### Community 123 - "DtoUpdateMockupTemplate"
Cohesion: 0.22
Nodes (11): DtoCreateMockupTemplate, DtoUpdateMockupTemplate, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Matches (+3 more)

### Community 124 - "ТЗ: семантика и структура страниц raspechatkaa.ru"
Cohesion: 0.07
Nodes (27): P10. Холст — `/interer/holst`, P1. Где распечатать фото в Москве — `/gde-raspechatat-foto-v-moskve`, P2. Цены — `/ceny`, P3. Размеры и форматы фото — `/formaty`, P4. Печать фото А4 — `/catalog/foto-a4`, P5. Печать фото на документы — `/dokumenty`, P6. Печать фото онлайн с доставкой — `/onlayn`, P7. Бумага и качество — `/bumaga` (+19 more)

### Community 125 - ".handleUpdate"
Cohesion: 0.18
Nodes (4): TelegramPollingService, Injectable, TelegramUpdateService, Injectable

### Community 126 - "DtoUpdateOzonPrint"
Cohesion: 0.17
Nodes (11): DtoUpdateOzonPrint, ArrayMaxSize, IsArray, IsEnum, IsInt, IsOptional, IsString, IsUrl (+3 more)

### Community 129 - "DtoUpdateApproval"
Cohesion: 0.29
Nodes (6): DtoUpdateApproval, IsEnum, IsObject, IsOptional, IsString, MaxLength

### Community 130 - "ApprovalController"
Cohesion: 0.12
Nodes (16): ApprovalController, parseSide(), Body, Controller, Delete, Get, Param, Patch (+8 more)

### Community 131 - "describe"
Cohesion: 0.22
Nodes (9): describe_code_type(), describe_next(), main(), Человеческое название способа доставки кода., Чем можно переслать, если не дошло., describe(), Строка для лога — без логина и пароля., Строка для лога не должна содержать логин и пароль. (+1 more)

### Community 132 - "ScenarioController"
Cohesion: 0.09
Nodes (20): DtoDetectProduct, IsString, MaxLength, DtoSaveDraft, IsObject, IsOptional, IsString, MaxLength (+12 more)

### Community 133 - "partner-api.controller.ts"
Cohesion: 0.15
Nodes (10): StickerModule, Module, DtoPartnerStatus, IsString, PartnerTokenGuard, Injectable, ALLOWED, EXT_CONTENT_TYPE (+2 more)

### Community 134 - "PrismaService"
Cohesion: 0.07
Nodes (19): GulianOutboxService, Injectable, CanvasItemService, canvasMoney(), Injectable, DtoUpdateCanvasItem, IsIn, IsInt (+11 more)

### Community 135 - "marketplace.module.ts"
Cohesion: 0.12
Nodes (20): SIDES, APPROVAL_MAX_BYTES, AuthenticatedRequest, AuthenticatedUser, ROLES_KEY, JwtAuthGuard, Injectable, RolesGuard (+12 more)

### Community 136 - ".get"
Cohesion: 0.12
Nodes (15): DtoUpdateTshirtItem, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min, Type (+7 more)

### Community 137 - "Выкатка: репозиторий → сервер"
Cohesion: 0.29
Nodes (6): Выкатка: репозиторий → сервер, Как это устроено на сервере, Команды, Откат, Почему именно так, Чего в цепочке пока нет

### Community 138 - "LeadController"
Cohesion: 0.19
Nodes (10): LeadController, Body, Controller, Get, Post, Query, Throttle, UseGuards (+2 more)

### Community 139 - "DtoBulkStock"
Cohesion: 0.15
Nodes (12): DtoBulkStock, DtoBulkStockWarehouse, ArrayMaxSize, ArrayNotEmpty, IsArray, IsIn, IsInt, IsString (+4 more)

### Community 140 - "2. Что уже сделано (этап 2 — карточки товаров)"
Cohesion: 0.10
Nodes (19): 1.1. Что показал живой кабинет (17.08.2026), 1. Что уже сделано (этап 1 — подключение), 2.1. Порядок работы с товаром в Ozon Seller API (справочно), 2.2. Заказы (этап 3, только чтение), 2.3. Мои товары и юнит-экономика (этап 4), 2. Что уже сделано (этап 2 — карточки товаров), 3. Дальше, API CRM (+11 more)

### Community 141 - "parse_proxy"
Cohesion: 0.33
Nodes (3): parse_proxy(), Словарь для Telethon или None, если прокси не задан. Формат именно словаря…, TestParse

### Community 142 - "TelegramService"
Cohesion: 0.22
Nodes (4): ReviewReminderService, Injectable, TelegramService, Injectable

### Community 143 - "nginx-routes.spec.ts"
Cohesion: 0.22
Nodes (4): FRONTEND, NGINX_CONF, SRC, VITE_CONF

### Community 144 - "DtoUpdateOzonCatalogTemplate"
Cohesion: 0.17
Nodes (11): DtoUpdateOzonCatalogTemplate, ArrayMaxSize, IsArray, IsBoolean, IsInt, IsObject, IsOptional, IsString (+3 more)

### Community 145 - "site-lead-token.guard.ts"
Cohesion: 0.33
Nodes (7): constantTimeEqual(), readBearerToken(), readHeader(), SignedRequest, SiteLeadTokenGuard, stripPrefix(), Injectable

### Community 146 - "ТЗ: раздел «Печать на холсте» на raspechatkaa.ru"
Cohesion: 0.10
Nodes (19): Берём после сезона, Берём сразу, до сезона, Блок 0. Контекст и границы, Блок 10. Интеграция с CRM, Блок 11. Что НЕ делать, Блок 12. Технологическое преимущество, Блок 1. Информационная архитектура и URL, Блок 2. Хлебные крошки и связность (+11 more)

### Community 147 - "canvas-production-price.ts"
Cohesion: 0.18
Nodes (14): CanvasProductionController, Controller, Get, UseGuards, CANVAS_MATERIAL_KIND_LABELS, CANVAS_PRODUCTION_PRICES, canvasContractorCost(), CanvasMaterialKind (+6 more)

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
Cohesion: 0.06
Nodes (46): ordersApi, partnerSettingsApi, DispatchToExecutorModal(), PayoutInfo, Props, rub(), GreetingCopyButton(), GulianSyncBlock() (+38 more)

### Community 153 - "items_list"
Cohesion: 0.43
Nodes (3): items_list(), Список позиций — по строке на позицию. Именно он отличает ответ на действие от…, TestItemsList

### Community 154 - "ReportsController"
Cohesion: 0.24
Nodes (5): ReportsController, Controller, Get, Query, UseGuards

### Community 155 - "canvas.pricing.ts"
Cohesion: 0.22
Nodes (13): calcCanvasUnitPrice(), calcCanvasUrgencyFee(), CANVAS_FRAME_LABELS, CANVAS_MATERIAL_LABELS, CANVAS_SIZES, CanvasFrame, CanvasMaterial, CanvasSize (+5 more)

### Community 156 - "telegram.service.ts"
Cohesion: 0.28
Nodes (7): logger, proxyDispatcher(), resetTelegramProxyCache(), telegramFetch(), telegramFormData(), TgUpdateWithId, describeTelegramError()

### Community 159 - "telegram-update.service.ts"
Cohesion: 0.24
Nodes (8): OrderForOutbox, calcGulianPayout(), Item, PayoutResult, toGulianStatus(), ACTION_STATUS, STATUS_TOAST, TelegramCallback

### Community 162 - "DtoUpdateOrder"
Cohesion: 0.17
Nodes (11): DtoUpdateOrder, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Matches, MaxLength (+3 more)

### Community 163 - "approval.service.ts"
Cohesion: 0.12
Nodes (10): ApprovalRenderService, Injectable, CALIBRATION, approvalInclude, SIZE_LABELS, ALLOWED_IMAGE, ApprovalStorageService, SavedImage (+2 more)

### Community 165 - "greeting-message.ts"
Cohesion: 0.42
Nodes (8): deliveryLine(), GreetingData, greetingFor(), GreetingItem, itemsList(), money(), renderGreeting(), TEMPLATES

### Community 166 - "PartnerApiController"
Cohesion: 0.36
Nodes (6): PartnerApiController, Controller, Get, Param, Res, UseGuards

### Community 167 - ".createOrder"
Cohesion: 0.35
Nodes (7): buildCommunicationUrl(), buildMaxUrl(), DEFAULT_MAX_LINK_TEMPLATE, formatPhoneForDisplay(), normalizePhone(), validateCommunicationValue(), calcCanvasMoney()

### Community 168 - "StripPricesInterceptor"
Cohesion: 0.50
Nodes (3): strip(), StripPricesInterceptor, Injectable

### Community 169 - "DtoUpdatePartnerSettings"
Cohesion: 0.11
Nodes (13): DtoUpdatePartnerSettings, IsInt, IsOptional, IsString, Max, MaxLength, Min, PartnerSettingsController (+5 more)

### Community 173 - "scenario.module.ts"
Cohesion: 0.29
Nodes (5): PrismaModule, Module, ScenarioModule, Module, Global

### Community 177 - "lead-notification.ts"
Cohesion: 0.33
Nodes (6): buildLeadNotification(), escape(), LeadForNotification, NotifiableUser, pickLeadResponders(), toMention()

### Community 179 - ".webhook"
Cohesion: 0.24
Nodes (7): TgUpdate, constantTimeEqual(), TelegramWebhookController, Body, Controller, Post, Headers

### Community 184 - ".constructor"
Cohesion: 0.25
Nodes (4): ELIGIBLE_ROLES, ShipmentLeadService, ShipmentLeadView, Injectable

### Community 189 - "DtoPublishOzonPrints"
Cohesion: 0.33
Nodes (5): DtoPublishOzonPrints, ArrayMinSize, ArrayNotEmpty, IsArray, IsUUID

### Community 193 - "client-greeting.service.ts"
Cohesion: 0.21
Nodes (8): clientNameFromNote(), GREETING_STATUSES, GreetingStatus, isGreetingStatus(), ClientGreetingService, PendingGreeting, Injectable, telegramUsernameFromUrl()

### Community 195 - "DtoCreateApproval"
Cohesion: 0.33
Nodes (5): DtoCreateApproval, IsEnum, IsOptional, IsString, IsUUID

### Community 201 - "HealthController"
Cohesion: 0.33
Nodes (3): HealthController, Controller, Get

### Community 203 - ".list"
Cohesion: 0.50
Nodes (3): Get, Param, Query

### Community 204 - "main.ts"
Cohesion: 0.50
Nodes (4): AppModule, Module, allowedOrigins(), bootstrap()

### Community 208 - "CanvasPricingController"
Cohesion: 0.50
Nodes (3): CanvasPricingController, Controller, Get

## Knowledge Gaps
- **821 isolated node(s):** `$schema`, `collection`, `sourceRoot`, `deleteOutDir`, `name` (+816 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **49 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Roles()` connect `Roles` to `tasks.controller.ts`, `ApprovalController`, `DtoUpdateUser`, `ScenarioController`, `marketplace.module.ts`, `DtoCreateExpense`, `AvitoService`, `canvas-production-price.ts`, `ReportsController`, `PartnerAdminController`, `OzonPhotoStorageService`, `salary.controller.ts`, `DtoUpdatePartnerSettings`, `image-cards.module.ts`, `order-photo.controller.ts`, `ImageCardBatchController`, `ImageCardTemplateService`, `MarketplaceController`, `MockupService`, `.sendMessage`, `OzonCatalogController`, `OzonProductCatalogController`, `OzonOrdersController`, `DtoUpdateMockupTemplate`?**
  _High betweenness centrality (0.214) - this node is a cross-community bridge._
- **Why does `BatchView()` connect `ApprovalController` to `CardEditorModal.tsx`, `getErrorMessage`?**
  _High betweenness centrality (0.162) - this node is a cross-community bridge._
- **Why does `getErrorMessage()` connect `getErrorMessage` to `CardEditorModal.tsx`, `ApprovalController`, `MarketplacePage.tsx`, `ozonProductCatalog.ts`, `ProductsTab.tsx`, `CatalogTab.tsx`, `TasksPage.tsx`, `OrdersPage.tsx`, `ReportsPage.tsx`, `OrderDetail.tsx`, `index.ts`, `PrintEditor.tsx`, `ApprovalEditor.tsx`, `PrintCardModal.tsx`?**
  _High betweenness centrality (0.132) - this node is a cross-community bridge._
- **What connects `$schema`, `collection`, `sourceRoot` to the rest of the system?**
  _821 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `DtoCreateOzonPrint` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._
- **Should `tasks.controller.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06170598911070781 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._