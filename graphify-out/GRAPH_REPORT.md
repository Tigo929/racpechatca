# Graph Report - raspechatka  (2026-09-10)

## Corpus Check
- 484 files · ~259,493 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 3786 nodes · 7854 edges · 204 communities (156 shown, 48 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 323 edges (avg confidence: 0.79)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8dc4866d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ozon-catalog.controller.ts
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
- ozon-unit-economics.service.ts
- compilerOptions
- PrintDesignerEngine
- compilerOptions
- Аудит проекта «Распечатка» — 2026-06-14
- TasksPage.tsx
- dependencies
- ozon-bulk-stock.service.ts
- TasksService
- ApprovalEditor.tsx
- compilerOptions
- MarketplaceAccountService
- OzonCredentials
- app.module.ts
- review-reminder.service.ts
- TechSpecStorageService
- devDependencies
- get-error-message.ts
- DtoCreateLead
- marketplace.module.ts
- salary.controller.ts
- Интеграция с исполнителем-партнёром (печать футболок)
- scenario.registry.ts
- CRM «Распечатка» — как всё устроено
- CatalogTab.tsx
- auth.controller.ts
- ImageCardStorageService
- image-card-placement.ts
- ozon-product-catalog.service.ts
- OrderPhotoService
- order-photo.service.ts
- salary-integrity.spec.ts
- ReportsPage.tsx
- CreateOrderForm.tsx
- Исправленные проблемы
- crm-new/README.md
- getErrorMessage
- approval-render.service.ts
- scripts
- frontend/package.json
- Architecture
- Architecture
- ozon-orders.service.ts
- package.json
- approval/approval-geometry.ts
- image-cards.module.ts
- exclude
- Аудит финансов, кода и продакшена — 2026-07-09
- devDependencies
- ProductsTab.tsx
- nest-cli.json
- MarketplacePage.tsx
- ozonProductCatalog.ts
- gulian-outbox.service.ts
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
- TemplateSettings.tsx
- supertest
- ImageCardProcessorService
- MarketplaceController
- ts-node
- MockupService
- DtoSendAvitoMessage
- TshirtPartnerTelegramService
- OzonCatalogController
- crm-new/package.json
- printDraft.ts
- @types/supertest
- tshirt-partner-telegram.service.ts
- PdfRasterService
- OzonProductCatalogController
- DtoUpdateOzonUnitEconomics
- DtoUpdateTshirtItem
- DtoUpdateItemOrder
- typescript-eslint
- vite
- OzonOrdersController
- render
- index.ts
- @nestjs/core
- approval-state.ts
- partner-api.controller.ts
- telegram.module.ts
- passport
- pdf-lib
- DtoOzonUpdateCardText
- tg_greeter.py
- .updateStatusOrder
- ТЗ: семантика и структура страниц raspechatkaa.ru
- MarketplaceAccessGuard
- DtoUpdateOzonPrint
- @prisma/adapter-pg
- @prisma/client
- approval.service.ts
- ApprovalController
- describe
- DtoBulkCards
- partner-admin.controller.ts
- PrismaService
- ozon-product-catalog.controller.ts
- CanvasItemService
- Выкатка: репозиторий → сервер
- DtoSaveDraft
- DtoBulkStock
- 2. Что уже сделано (этап 2 — карточки товаров)
- parse_proxy
- UnitEconomicsPanel.tsx
- nginx-routes.spec.ts
- DtoUpdateOzonCatalogTemplate
- DtoUpdateImageCard
- ТЗ: раздел «Печать на холсте» на raspechatkaa.ru
- canvas-production-price.ts
- auto-update.sh
- Первое сообщение клиенту
- sign
- delivery_line
- OrderDetail.tsx
- items_list
- CardAnalytics.tsx
- canvas.pricing.ts
- TelegramService
- sharp
- undici
- DtoUpdateCanvasItem
- roboto-fontface
- jest
- DtoUpdateOrder
- ApprovalStorageService
- @nestjs/passport
- hasProductionItems
- eslint-plugin-prettier
- .createOrder
- strip-prices.interceptor.ts
- DtoUpdatePartnerSettings
- ozon-catalog-template.service.ts
- eslint-config-prettier
- @eslint/eslintrc
- DtoDetectProduct
- @nestjs/schematics
- @nestjs/testing
- class-transformer
- lead-notification.ts
- prisma
- DtoScenarioAnswers
- ts-jest
- globals
- passport-jwt
- @types/archiver
- DtoUpdateMockupTemplate
- @types/node
- prettier
- typescript-eslint
- @types/multer
- @nestjs/common
- @types/passport-jwt
- typescript
- eslint-plugin-react-refresh
- client-greeting.service.ts
- tsconfig-paths
- reflect-metadata
- pdfkit
- pg
- uuid
- web-push
- source-map-support
- tailwindcss
- @eslint/js
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
- `CreateModal()` --calls--> `getErrorMessage()`  [EXTRACTED]
  frontend/src/components/marketplace/CardTemplatesTab.tsx → frontend/src/utils/get-error-message.ts
- `AccountCard()` --calls--> `getErrorMessage()`  [EXTRACTED]
  frontend/src/components/marketplace/ConnectionTab.tsx → frontend/src/utils/get-error-message.ts
- `AccountForm()` --calls--> `getErrorMessage()`  [EXTRACTED]
  frontend/src/components/marketplace/ConnectionTab.tsx → frontend/src/utils/get-error-message.ts

## Import Cycles
- None detected.

## Communities (204 total, 48 thin omitted)

### Community 0 - "ozon-catalog.controller.ts"
Cohesion: 0.05
Nodes (40): DtoCreateOzonPrint, ArrayMaxSize, ArrayMinSize, ArrayNotEmpty, IsArray, IsEnum, IsInt, IsOptional (+32 more)

### Community 1 - "tasks.controller.ts"
Cohesion: 0.10
Nodes (23): DtoCreateTask, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength (+15 more)

### Community 2 - "dependencies"
Cohesion: 0.09
Nodes (23): archiver, bcryptjs, bwip-js, class-validator, dependencies, archiver, bcryptjs, bwip-js (+15 more)

### Community 3 - "DtoUpdateUser"
Cohesion: 0.06
Nodes (28): DtoCreateUser, IsEnum, IsString, MinLength, DtoUpdateUser, IsBoolean, IsInt, IsOptional (+20 more)

### Community 4 - "sticker.service.ts"
Cohesion: 0.12
Nodes (19): line(), computePrepayment(), DEFAULT_PREPAY_RATE, Prepayment, buildPhotoItemLines(), buildTshirtItemLines(), drawInstagramIcon(), drawTelegramIcon() (+11 more)

### Community 5 - "jest"
Cohesion: 0.12
Nodes (16): jest, collectCoverageFrom, coverageDirectory, moduleFileExtensions, moduleNameMapper, rootDir, testEnvironment, testRegex (+8 more)

### Community 6 - "DtoOzonArchive"
Cohesion: 0.27
Nodes (14): DtoOzonArchive, DtoOzonPriceItem, DtoOzonStockItem, DtoOzonUpdatePrices, DtoOzonUpdateStocks, ArrayNotEmpty, IsArray, IsBoolean (+6 more)

### Community 7 - "App.tsx"
Cohesion: 0.12
Nodes (21): authApi, AdminRoute(), App(), AppRoutes(), CrmGate(), HomeRedirect(), LoginPage, MarketplaceRoute() (+13 more)

### Community 8 - "TshirtItemsTable.tsx"
Cohesion: 0.06
Nodes (38): canvasProductionApi, CanvasProductionPricing, CanvasProductionSize, Props, ProductsTab(), CanvasItemsTable(), EditState, EMPTY (+30 more)

### Community 9 - "Roles"
Cohesion: 0.13
Nodes (15): CurrentUser, Roles(), Body, OrderPhotoController, Body, Controller, Delete, Get (+7 more)

### Community 10 - "System Map"
Cohesion: 0.05
Nodes (36): 2026-07-08, 2026-07-09, 2026-07-11, 2026-08-24, 2026-08-24 (later), 2026-08-25, Access Rules, App Modules (+28 more)

### Community 11 - "DtoCreateExpense"
Cohesion: 0.08
Nodes (20): DtoCreateExpense, IsEnum, IsInt, IsOptional, IsString, Min, ExpensesController, Body (+12 more)

### Community 12 - "reports.service.ts"
Cohesion: 0.07
Nodes (37): calcOrderProfit(), forecastSalary(), kopecksToRub(), OrderProfit, OrderProfitInput, SHEET, DECLARED_PRINTS_PER_SHEET, HALF_SHEET_WORDS (+29 more)

### Community 13 - "OrdersPage.tsx"
Cohesion: 0.08
Nodes (37): ExecutorFilter(), Props, StatusStepper(), DELIVERY_STYLES, DeliveryBadge(), Props, FilterChip(), Props (+29 more)

### Community 14 - "daily-plan-rules.ts"
Cohesion: 0.05
Nodes (62): buildDailyPlanMessage(), buildShipmentBlock(), dayMonth(), DELIVERY_LABEL, effectiveDeadline(), executorKey(), inWorkTail(), isWithinPlanWindow() (+54 more)

### Community 15 - "AvitoService"
Cohesion: 0.05
Nodes (30): AvitoController, Controller, Get, Param, Post, Query, UseGuards, AvitoMessengerService (+22 more)

### Community 16 - "Брендбук — Распечатка PRO"
Cohesion: 0.08
Nodes (24): 1. Анализ конкурентов, 2. Психология цвета, 3. Цветовая палитра, 4. Типографика, 5. Логотип и иконка, 6. Правила применения, 7. Tone of Voice, 8. Применение на сайте (будущее) (+16 more)

### Community 17 - "ozon-unit-economics.service.ts"
Cohesion: 0.14
Nodes (16): OzonProductTariffs, calculateUnitEconomics(), OzonTariffs, realSettings, settings, tariffs, UnitEconomicsLine, UnitEconomicsResult (+8 more)

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

### Community 22 - "TasksPage.tsx"
Cohesion: 0.06
Nodes (34): tasksApi, TasksQuery, TasksPage, AppShell(), NavProps, Props, AD_MGR, ADMIN (+26 more)

### Community 23 - "dependencies"
Cohesion: 0.10
Nodes (21): axios, dependencies, axios, @hookform/resolvers, lucide-react, react, react-dom, react-hook-form (+13 more)

### Community 24 - "ozon-bulk-stock.service.ts"
Cohesion: 0.07
Nodes (32): OzonBulkStockProcessorService, Injectable, buildPairs(), BulkStockMode, BulkStockValidationError, checkQuantity(), chunkPairs(), LARGE_OPERATION_THRESHOLD (+24 more)

### Community 25 - "TasksService"
Cohesion: 0.13
Nodes (11): TasksController, Body, Controller, Delete, Get, Param, Patch, Post (+3 more)

### Community 26 - "ApprovalEditor.tsx"
Cohesion: 0.08
Nodes (49): approvalsApi, mockupsApi, ApprovalEditor(), CmField(), downloadBlob(), Props, SIDE_LABELS, Sides (+41 more)

### Community 27 - "compilerOptions"
Cohesion: 0.10
Nodes (20): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+12 more)

### Community 28 - "MarketplaceAccountService"
Cohesion: 0.11
Nodes (14): ACCOUNT_INCLUDE, AccountRow, CreateAccountInput, MarketplaceAccountService, MarketplaceAccountView, Injectable, UpdateAccountInput, OzonService (+6 more)

### Community 29 - "OzonCredentials"
Cohesion: 0.21
Nodes (3): OzonCredentials, OzonProductCatalogService, Injectable

### Community 30 - "app.module.ts"
Cohesion: 0.07
Nodes (23): AppModule, Module, AvitoModule, Module, CanvasModule, Module, CanvasProductionController, Controller (+15 more)

### Community 31 - "review-reminder.service.ts"
Cohesion: 0.17
Nodes (12): isReviewReminderEligible(), REVIEW_REMINDER_CATEGORIES, REVIEW_REMINDER_DELAY_MS, REVIEW_REMINDER_PICKUP_DELAY_MS, REVIEW_REMINDER_STATUSES, reviewReminderDelayMs(), buildReviewRequestText(), categoryLabel() (+4 more)

### Community 32 - "TechSpecStorageService"
Cohesion: 0.13
Nodes (11): PartnerAdminController, Controller, Get, Param, Post, Res, UploadedFiles, UseGuards (+3 more)

### Community 33 - "devDependencies"
Cohesion: 0.11
Nodes (19): eslint-plugin-react-hooks, devDependencies, eslint, eslint-plugin-react-hooks, globals, @tailwindcss/vite, @types/node, @types/react (+11 more)

### Community 34 - "get-error-message.ts"
Cohesion: 0.06
Nodes (51): ozonBatchesApi, ozonCardsApi, CardBatchReport(), CardEditorModal(), CardFinalizePanel(), BatchList(), CardGeneratorTab(), MODE_LABELS (+43 more)

### Community 35 - "DtoCreateLead"
Cohesion: 0.09
Nodes (18): DtoCreateLead, base, meta, pipe, IsBoolean, IsEnum, IsIn, IsInt (+10 more)

### Community 36 - "marketplace.module.ts"
Cohesion: 0.10
Nodes (18): MarketplaceModule, Module, ALLOWED_INPUT, OZON_PHOTO_MAX_BYTES, OZON_PHOTO_MAX_FILES, OzonPhotoStorageService, Injectable, OzonPhotoController (+10 more)

### Community 37 - "salary.controller.ts"
Cohesion: 0.05
Nodes (36): DtoCreateBonus, IsInt, IsString, IsUUID, MaxLength, Min, MinLength, Type (+28 more)

### Community 38 - "Интеграция с исполнителем-партнёром (печать футболок)"
Cohesion: 0.12
Nodes (15): 1. Модель взаимодействия, 2. Аутентификация, 3. Webhook, который мы отправляем партнёру, 4.1 Данные заказа, 4.2 ТЗ-фото (макет), 4.3 Стикер (PDF, 58×40 мм), 4.4 Смена статуса заказа (партнёр → нам), 4. Эндпоинты, откуда партнёр забирает данные (pull) (+7 more)

### Community 39 - "scenario.registry.ts"
Cohesion: 0.05
Nodes (64): PrismaModule, Module, DELIVERY_STEPS, NOTE_STEP, OPTIONAL, PAPER_LABEL, photoToOrder(), PHOTO_SCENARIO (+56 more)

### Community 40 - "CRM «Распечатка» — как всё устроено"
Cohesion: 0.11
Nodes (18): 10. Слабые места, 11. Что дальше, 1. Что это, 2. Из чего собрано, 3. Продукты и статусы, 4. Деньги, 5. Роли, 6. Сценарии оформления (+10 more)

### Community 41 - "CatalogTab.tsx"
Cohesion: 0.19
Nodes (20): baseCodeOf(), colorCodeOf(), firstEditableWarehouse(), groupByColor(), OzonCatalogProduct, printCodeOf(), sizeOf(), sizeRank() (+12 more)

### Community 42 - "auth.controller.ts"
Cohesion: 0.13
Nodes (14): AuthController, Body, Controller, Get, Post, Throttle, UseGuards, AuthModule (+6 more)

### Community 43 - "ImageCardStorageService"
Cohesion: 0.11
Nodes (5): ImageCardBatchService, summarize(), Injectable, ImageCardStorageService, Injectable

### Community 44 - "image-card-placement.ts"
Cohesion: 0.08
Nodes (33): BULK_ACTIONS, BulkAction, describe(), ImageCardGenerationService, MODE_COLORS, Injectable, ASPECT_ALERT, CardTransform (+25 more)

### Community 45 - "ozon-product-catalog.service.ts"
Cohesion: 0.09
Nodes (21): OzonActionView, OzonCatalogProduct, OzonContentRating, OzonDemand, OzonImportAttributeBody, OzonProductCard, RawActionsResponse, RawAnalyticsResponse (+13 more)

### Community 46 - "OrderPhotoService"
Cohesion: 0.10
Nodes (15): DtoAllOrdersforQuery, IsEnum, IsIn, IsInt, IsOptional, IsString, Matches, Max (+7 more)

### Community 47 - "order-photo.service.ts"
Cohesion: 0.09
Nodes (24): IsEnum, UpdateStatus, LeadMoneyError, LeadMoneyInput, LeadMoneyResult, MAX_POSITION_TOTAL, resolveLeadMoney(), buildLeadPosition() (+16 more)

### Community 48 - "salary-integrity.spec.ts"
Cohesion: 0.14
Nodes (13): AccrualByIdRow, AsyncMock, createOrderService(), CreatePaymentArgs, createPrismaStub(), HarnessAccrual, makeOrder(), PaymentByAccrualsHarness (+5 more)

### Community 49 - "ReportsPage.tsx"
Cohesion: 0.06
Nodes (48): expensesApi, reportsApi, MySalaryBalance, salaryApi, MySalaryPage, ReportsPage, SalaryPage, buildReceiptHtml() (+40 more)

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
Nodes (29): api, partnerSettingsApi, shipmentLeadApi, usersApi, UsersPage, DailyPlanCard(), Example(), FormState (+21 more)

### Community 54 - "approval-render.service.ts"
Cohesion: 0.14
Nodes (15): PrintAreaCalibration, ApprovalRenderService, escapeXml(), formatDate(), layoutSlots(), Placement, RenderSheetInput, RenderSideInput (+7 more)

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

### Community 61 - "approval/approval-geometry.ts"
Cohesion: 0.21
Nodes (14): DPI_ACCEPTABLE, DPI_GOOD, estimateDpi(), formatCm(), formatSizeCm(), isCalibrated(), isOutsidePrintArea(), printAreaRect() (+6 more)

### Community 62 - "image-cards.module.ts"
Cohesion: 0.14
Nodes (17): DtoCreateImageCardTemplate, DtoRect, DtoUpdateImageCardTemplate, IsBoolean, IsInt, IsObject, IsOptional, IsString (+9 more)

### Community 63 - "exclude"
Cohesion: 0.25
Nodes (7): exclude, extends, dist, node_modules, **/*spec.ts, test, ./tsconfig.json

### Community 64 - "Аудит финансов, кода и продакшена — 2026-07-09"
Cohesion: 0.29
Nodes (6): Аудит финансов, кода и продакшена — 2026-07-09, Кодовый аудит, Короткий вывод, Продакшен-аудит, Следующие улучшения, Финансовый аудит

### Community 65 - "devDependencies"
Cohesion: 0.22
Nodes (9): devDependencies, eslint, @types/express, @types/jest, @types/pdfkit, eslint, @types/express, @types/jest (+1 more)

### Community 66 - "ProductsTab.tsx"
Cohesion: 0.15
Nodes (17): EditPrintModal(), draftErrors(), draftToPayload(), duplicateDraft(), emptyPrintDraft(), filledColorGroups(), nextKey(), PrintDefaults (+9 more)

### Community 67 - "nest-cli.json"
Cohesion: 0.33
Nodes (5): collection, compilerOptions, deleteOutDir, $schema, sourceRoot

### Community 68 - "MarketplacePage.tsx"
Cohesion: 0.07
Nodes (37): CreateAccountDto, EnumMarketplace, MarketplaceAccount, marketplaceApi, OzonConnectionInfo, UpdateAccountDto, OzonOrder, OzonOrderGroup (+29 more)

### Community 69 - "ozonProductCatalog.ts"
Cohesion: 0.07
Nodes (30): BulkStockHistoryRow, BulkStockInput, BulkStockItem, BulkStockMode, BulkStockOperation, BulkStockPreview, BulkStockWarehouseInput, COLOR_CODES (+22 more)

### Community 70 - "gulian-outbox.service.ts"
Cohesion: 0.12
Nodes (10): GulianOutboxProcessorService, RETRY_DELAYS_SECONDS, Injectable, GulianOutboxService, OrderForOutbox, Injectable, GulianOrderPayload, GulianResponse (+2 more)

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
Cohesion: 0.20
Nodes (9): buildShipmentReminder(), DEADLINE_METHODS, dueReminderStage(), hasDeadline(), hoursLeft(), SHIPMENT_REMINDER_STAGES_MS, ShipmentOrder, START (+1 more)

### Community 79 - "ImageCardBatchController"
Cohesion: 0.14
Nodes (12): ImageCardBatchController, Body, Controller, Delete, Get, Param, Patch, Post (+4 more)

### Community 80 - "ozon-import.service.ts"
Cohesion: 0.07
Nodes (18): OzonCatalogTemplateService, Injectable, OzonImportPollService, Injectable, OzonImportService, Injectable, IMPORT_BATCH_SIZE, OzonImportItem (+10 more)

### Community 81 - "partner-telegram-format.ts"
Cohesion: 0.27
Nodes (9): buildPartnerCaption(), calcSettlement(), esc(), PartnerOrderData, PartnerOrderItem, PRINT_LOCATION_LABELS, PRINT_TYPE_LABELS, rub() (+1 more)

### Community 82 - "ImageCardTemplateService"
Cohesion: 0.10
Nodes (14): ImageCardTemplateController, Body, Controller, Delete, Get, Param, Patch, Post (+6 more)

### Community 83 - "ozon-attributes.ts"
Cohesion: 0.11
Nodes (25): buildExtraImages(), buildImportItem(), CatalogTemplateForImport, chunk(), COLOR_CODE_BY_LABEL, DEFAULT_SIZES, dictAttr(), dictListAttr() (+17 more)

### Community 85 - "image-card-batch.service.ts"
Cohesion: 0.12
Nodes (20): CARD_MODES, CardMode, DtoCreateImageCardBatch, ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional (+12 more)

### Community 86 - "OzonApiClient"
Cohesion: 0.08
Nodes (24): humanize(), OzonApiClient, OzonApiError, OzonErrorBody, Injectable, OzonConnectionInfo, OzonProductListResponse, OzonWarehouseListResponse (+16 more)

### Community 87 - "ApprovalService"
Cohesion: 0.21
Nodes (5): ApprovalService, Injectable, ApprovalSides, filledSides(), parseSides()

### Community 88 - "TemplateSettings.tsx"
Cohesion: 0.17
Nodes (13): OzonAttributeValueOption, ozonCatalogApi, OzonCatalogTemplate, AttributeAutocomplete(), Props, PhotoUpload(), Props, ATTR (+5 more)

### Community 90 - "ImageCardProcessorService"
Cohesion: 0.15
Nodes (5): ImageCardProcessorService, parseSnapshot(), Injectable, ImageCardRenderService, Injectable

### Community 91 - "MarketplaceController"
Cohesion: 0.08
Nodes (22): DtoCreateMarketplaceAccount, IsEnum, IsString, MaxLength, MinLength, DtoUpdateMarketplaceAccount, IsBoolean, IsOptional (+14 more)

### Community 93 - "MockupService"
Cohesion: 0.11
Nodes (14): MockupController, Body, Controller, Delete, Get, Param, Patch, Post (+6 more)

### Community 94 - "DtoSendAvitoMessage"
Cohesion: 0.40
Nodes (4): DtoSendAvitoMessage, IsString, MaxLength, MinLength

### Community 95 - "TshirtPartnerTelegramService"
Cohesion: 0.23
Nodes (4): buildPartnerButtons(), Injectable, TshirtPartnerTelegramService, TelegramSendResult

### Community 96 - "OzonCatalogController"
Cohesion: 0.18
Nodes (11): OzonCatalogController, Body, Controller, Delete, Get, Param, Patch, Post (+3 more)

### Community 97 - "crm-new/package.json"
Cohesion: 0.29
Nodes (6): author, description, license, name, private, version

### Community 98 - "printDraft.ts"
Cohesion: 0.12
Nodes (25): CreateOzonPrintDto, EnumOzonSyncStatus, EnumTshirtGender, OzonColorGroupInput, OzonPrint, OzonVariant, PublishResult, SizeDimensions (+17 more)

### Community 100 - "tshirt-partner-telegram.service.ts"
Cohesion: 0.09
Nodes (29): escapeHtml(), EXT_CONTENT_TYPE, money(), PRINT_LOCATION_LABELS, PRINT_TYPE_LABELS, TechSpecAttachment, TshirtOrderWithItems, Db (+21 more)

### Community 101 - "PdfRasterService"
Cohesion: 0.21
Nodes (5): PdfRasterService, PdfRasterUnavailableError, RASTER_LONG_SIDE, run, Injectable

### Community 102 - "OzonProductCatalogController"
Cohesion: 0.19
Nodes (9): OzonProductCatalogController, Body, Controller, Get, Param, Patch, Post, Query (+1 more)

### Community 103 - "DtoUpdateOzonUnitEconomics"
Cohesion: 0.22
Nodes (8): DtoUpdateOzonUnitEconomics, IsIn, IsInt, IsOptional, Max, Min, Type, IsNumber

### Community 104 - "DtoUpdateTshirtItem"
Cohesion: 0.22
Nodes (8): DtoUpdateTshirtItem, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min, Type

### Community 105 - "DtoUpdateItemOrder"
Cohesion: 0.17
Nodes (11): DtoUpdateItemOrder, IsBoolean, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min (+3 more)

### Community 112 - "OzonOrdersController"
Cohesion: 0.25
Nodes (6): OzonOrdersController, Controller, Get, Param, Query, UseGuards

### Community 113 - "render"
Cohesion: 0.17
Nodes (9): greeting_for(), money(), Обращение целиком, а не только имя. У заявки имени может не быть — человек…, Сумма с пробелами между разрядами: 2 490, а не 2490. Ноль означает, что позиций…, Готовый текст сообщения. Неизвестные метки остаются как есть., render(), TestGreeting, TestMoney (+1 more)

### Community 114 - "index.ts"
Cohesion: 0.07
Nodes (38): avitoApi, AvitoChatQuery, AvitoPage, AvitoPage(), clientInitial(), messagePreview(), messageText(), timeLabel() (+30 more)

### Community 116 - "approval-state.ts"
Cohesion: 0.29
Nodes (5): clamp(), MAX_PRINT_MM, MIN_PRINT_MM, num(), SIDES

### Community 117 - "partner-api.controller.ts"
Cohesion: 0.06
Nodes (35): DtoPartnerStatus, IsString, PartnerApiController, Body, Controller, Get, Param, Patch (+27 more)

### Community 118 - "telegram.module.ts"
Cohesion: 0.12
Nodes (12): StickerModule, Module, TelegramModule, Module, TelegramStickerController, Controller, Get, Param (+4 more)

### Community 121 - "DtoOzonUpdateCardText"
Cohesion: 0.33
Nodes (5): DtoOzonUpdateCardText, IsOptional, IsString, MaxLength, MinLength

### Community 122 - "tg_greeter.py"
Cohesion: 0.18
Nodes (11): Exception, Crm, Fatal, load_templates(), main(), Очередь и отметки. Ошибки сети не роняют процесс — просто ждём., Одно сообщение. Возвращает итог из закрытого списка, который знает CRM. Все…, Настройки неверны — работать нельзя, перезапуск не поможет. (+3 more)

### Community 123 - ".updateStatusOrder"
Cohesion: 0.15
Nodes (11): DtoAssignExecutor, IsOptional, IsString, IsUUID, isExternalProductionCategory(), needsShipmentStatus(), calculateManagerSalarySnapshot(), calculateSalarySnapshot() (+3 more)

### Community 124 - "ТЗ: семантика и структура страниц raspechatkaa.ru"
Cohesion: 0.07
Nodes (27): P10. Холст — `/interer/holst`, P1. Где распечатать фото в Москве — `/gde-raspechatat-foto-v-moskve`, P2. Цены — `/ceny`, P3. Размеры и форматы фото — `/formaty`, P4. Печать фото А4 — `/catalog/foto-a4`, P5. Печать фото на документы — `/dokumenty`, P6. Печать фото онлайн с доставкой — `/onlayn`, P7. Бумага и качество — `/bumaga` (+19 more)

### Community 125 - "MarketplaceAccessGuard"
Cohesion: 0.47
Nodes (3): MarketplaceAccessGuard, guard_(), Injectable

### Community 126 - "DtoUpdateOzonPrint"
Cohesion: 0.17
Nodes (11): DtoUpdateOzonPrint, ArrayMaxSize, IsArray, IsEnum, IsInt, IsOptional, IsString, IsUrl (+3 more)

### Community 129 - "approval.service.ts"
Cohesion: 0.11
Nodes (18): ApprovalModule, Module, approvalInclude, SIZE_LABELS, ALLOWED_IMAGE, SavedImage, UploadedImage, DtoCreateApproval (+10 more)

### Community 130 - "ApprovalController"
Cohesion: 0.13
Nodes (16): ApprovalController, parseSide(), Body, Controller, Delete, Get, Param, Patch (+8 more)

### Community 131 - "describe"
Cohesion: 0.22
Nodes (9): describe_code_type(), describe_next(), main(), Человеческое название способа доставки кода., Чем можно переслать, если не дошло., describe(), Строка для лога — без логина и пароля., Строка для лога не должна содержать логин и пароль. (+1 more)

### Community 132 - "DtoBulkCards"
Cohesion: 0.33
Nodes (6): DtoBulkCards, ArrayMaxSize, ArrayNotEmpty, IsArray, IsIn, IsUUID

### Community 133 - "partner-admin.controller.ts"
Cohesion: 0.47
Nodes (4): ALLOWED, EXT_CONTENT_TYPE, TECH_SPEC_MAX_BYTES, TECH_SPEC_MAX_FILES

### Community 134 - "PrismaService"
Cohesion: 0.09
Nodes (14): JwtPayload, JwtStrategy, Injectable, FinancialClient, OrderFinancialIntegrityService, Injectable, ELIGIBLE_ROLES, ShipmentLeadService (+6 more)

### Community 135 - "ozon-product-catalog.controller.ts"
Cohesion: 0.19
Nodes (13): SIDES, APPROVAL_MAX_BYTES, AuthenticatedRequest, AuthenticatedUser, ROLES_KEY, JwtAuthGuard, Injectable, RolesGuard (+5 more)

### Community 136 - "CanvasItemService"
Cohesion: 0.13
Nodes (10): CanvasItemService, canvasMoney(), Injectable, OrderItemService, Injectable, calcItemPricePosition(), calcOrderTotal(), PricedItem (+2 more)

### Community 137 - "Выкатка: репозиторий → сервер"
Cohesion: 0.29
Nodes (6): Выкатка: репозиторий → сервер, Как это устроено на сервере, Команды, Откат, Почему именно так, Чего в цепочке пока нет

### Community 138 - "DtoSaveDraft"
Cohesion: 0.33
Nodes (5): DtoSaveDraft, IsObject, IsOptional, IsString, MaxLength

### Community 139 - "DtoBulkStock"
Cohesion: 0.15
Nodes (12): DtoBulkStock, DtoBulkStockWarehouse, ArrayMaxSize, ArrayNotEmpty, IsArray, IsIn, IsInt, IsString (+4 more)

### Community 140 - "2. Что уже сделано (этап 2 — карточки товаров)"
Cohesion: 0.10
Nodes (19): 1.1. Что показал живой кабинет (17.08.2026), 1. Что уже сделано (этап 1 — подключение), 2.1. Порядок работы с товаром в Ozon Seller API (справочно), 2.2. Заказы (этап 3, только чтение), 2.3. Мои товары и юнит-экономика (этап 4), 2. Что уже сделано (этап 2 — карточки товаров), 3. Дальше, API CRM (+11 more)

### Community 141 - "parse_proxy"
Cohesion: 0.33
Nodes (3): parse_proxy(), Словарь для Telethon или None, если прокси не задан. Формат именно словаря…, TestParse

### Community 142 - "UnitEconomicsPanel.tsx"
Cohesion: 0.60
Nodes (4): ProductEconomics, Line(), money(), UnitEconomicsPanel()

### Community 143 - "nginx-routes.spec.ts"
Cohesion: 0.22
Nodes (4): FRONTEND, NGINX_CONF, SRC, VITE_CONF

### Community 144 - "DtoUpdateOzonCatalogTemplate"
Cohesion: 0.17
Nodes (11): DtoUpdateOzonCatalogTemplate, ArrayMaxSize, IsArray, IsBoolean, IsInt, IsObject, IsOptional, IsString (+3 more)

### Community 145 - "DtoUpdateImageCard"
Cohesion: 0.25
Nodes (7): CARD_MANUAL_STATUSES, CardManualStatus, DtoUpdateImageCard, IsBoolean, IsIn, IsObject, IsOptional

### Community 146 - "ТЗ: раздел «Печать на холсте» на raspechatkaa.ru"
Cohesion: 0.10
Nodes (19): Берём после сезона, Берём сразу, до сезона, Блок 0. Контекст и границы, Блок 10. Интеграция с CRM, Блок 11. Что НЕ делать, Блок 12. Технологическое преимущество, Блок 1. Информационная архитектура и URL, Блок 2. Хлебные крошки и связность (+11 more)

### Community 147 - "canvas-production-price.ts"
Cohesion: 0.32
Nodes (10): CANVAS_MATERIAL_KIND_LABELS, CANVAS_PRODUCTION_PRICES, canvasContractorCost(), CanvasMaterialKind, CanvasPositionPricing, CanvasProductionPrice, canvasRetailPrice(), canvasSizeLabel() (+2 more)

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
Cohesion: 0.07
Nodes (42): ordersApi, DispatchToExecutorModal(), PayoutInfo, Props, rub(), GreetingCopyButton(), GulianSyncBlock(), Props (+34 more)

### Community 153 - "items_list"
Cohesion: 0.43
Nodes (3): items_list(), Список позиций — по строке на позицию. Именно он отличает ответ на действие от…, TestItemsList

### Community 154 - "CardAnalytics.tsx"
Cohesion: 0.60
Nodes (4): CardAnalytics(), money(), PERIODS, sumFor()

### Community 155 - "canvas.pricing.ts"
Cohesion: 0.16
Nodes (16): CanvasPricingController, Controller, Get, calcCanvasUnitPrice(), calcCanvasUrgencyFee(), CANVAS_FRAME_LABELS, CANVAS_MATERIAL_LABELS, CANVAS_SIZES (+8 more)

### Community 156 - "TelegramService"
Cohesion: 0.06
Nodes (27): calcGulianPayout(), Item, PayoutResult, toGulianStatus(), logger, proxyDispatcher(), resetTelegramProxyCache(), telegramFetch() (+19 more)

### Community 159 - "DtoUpdateCanvasItem"
Cohesion: 0.22
Nodes (8): DtoUpdateCanvasItem, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, Type

### Community 162 - "DtoUpdateOrder"
Cohesion: 0.17
Nodes (11): DtoUpdateOrder, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Matches, MaxLength (+3 more)

### Community 163 - "ApprovalStorageService"
Cohesion: 0.19
Nodes (3): scaleCalibration(), ApprovalStorageService, Injectable

### Community 165 - "hasProductionItems"
Cohesion: 0.60
Nodes (3): hasProductionItems(), NO_PRODUCTION_ITEMS_MESSAGE, OrderWithProductionItems

### Community 167 - ".createOrder"
Cohesion: 0.26
Nodes (9): buildCommunicationUrl(), buildMaxUrl(), DEFAULT_MAX_LINK_TEMPLATE, formatPhoneForDisplay(), normalizePhone(), validateCommunicationValue(), calcCanvasMoney(), escapeHtml() (+1 more)

### Community 168 - "strip-prices.interceptor.ts"
Cohesion: 0.40
Nodes (4): PRICE_FIELDS, strip(), StripPricesInterceptor, Injectable

### Community 169 - "DtoUpdatePartnerSettings"
Cohesion: 0.12
Nodes (13): DtoUpdatePartnerSettings, IsInt, IsOptional, IsString, Max, MaxLength, Min, PartnerSettingsController (+5 more)

### Community 170 - "ozon-catalog-template.service.ts"
Cohesion: 0.67
Nodes (3): DEFAULT_SIZE_DIMENSIONS, UpdateOzonCatalogTemplateInput, VariantDimensions

### Community 173 - "DtoDetectProduct"
Cohesion: 0.50
Nodes (3): DtoDetectProduct, IsString, MaxLength

### Community 177 - "lead-notification.ts"
Cohesion: 0.33
Nodes (6): buildLeadNotification(), escape(), LeadForNotification, NotifiableUser, pickLeadResponders(), toMention()

### Community 179 - "DtoScenarioAnswers"
Cohesion: 0.50
Nodes (3): DtoScenarioAnswers, IsObject, IsOptional

### Community 184 - "DtoUpdateMockupTemplate"
Cohesion: 0.26
Nodes (11): DtoCreateMockupTemplate, DtoUpdateMockupTemplate, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Matches (+3 more)

### Community 193 - "client-greeting.service.ts"
Cohesion: 0.07
Nodes (33): clientNameFromNote(), GREETING_STATUSES, GreetingStatus, isGreetingStatus(), ClientGreetingService, PendingGreeting, Injectable, telegramUsernameFromUrl() (+25 more)

## Knowledge Gaps
- **821 isolated node(s):** `$schema`, `collection`, `sourceRoot`, `deleteOutDir`, `name` (+816 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **48 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Roles()` connect `Roles` to `ozon-catalog.controller.ts`, `tasks.controller.ts`, `ApprovalController`, `DtoUpdateUser`, `partner-admin.controller.ts`, `ozon-product-catalog.controller.ts`, `DtoCreateExpense`, `reports.service.ts`, `AvitoService`, `TasksService`, `app.module.ts`, `TechSpecStorageService`, `marketplace.module.ts`, `salary.controller.ts`, `scenario.registry.ts`, `DtoUpdatePartnerSettings`, `image-cards.module.ts`, `order-photo.controller.ts`, `ImageCardBatchController`, `ImageCardTemplateService`, `MarketplaceController`, `MockupService`, `OzonCatalogController`, `OzonProductCatalogController`, `OzonOrdersController`?**
  _High betweenness centrality (0.221) - this node is a cross-community bridge._
- **Why does `BatchView()` connect `ApprovalController` to `get-error-message.ts`, `getErrorMessage`?**
  _High betweenness centrality (0.162) - this node is a cross-community bridge._
- **Why does `getErrorMessage()` connect `getErrorMessage` to `get-error-message.ts`, `ApprovalController`, `MarketplacePage.tsx`, `ozonProductCatalog.ts`, `printDraft.ts`, `ProductsTab.tsx`, `CatalogTab.tsx`, `OrdersPage.tsx`, `ReportsPage.tsx`, `index.ts`, `TasksPage.tsx`, `TemplateSettings.tsx`, `ApprovalEditor.tsx`, `OrderDetail.tsx`?**
  _High betweenness centrality (0.127) - this node is a cross-community bridge._
- **What connects `$schema`, `collection`, `sourceRoot` to the rest of the system?**
  _821 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ozon-catalog.controller.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05454545454545454 - nodes in this community are weakly interconnected._
- **Should `tasks.controller.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0967741935483871 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._