# Graph Report - raspechatka  (2026-08-27)

## Corpus Check
- 448 files · ~238,586 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 3599 nodes · 7488 edges · 194 communities (139 shown, 55 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 317 edges (avg confidence: 0.79)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4f4cfa98`
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
- index.ts
- usePersistentState
- Roles
- System Map
- DtoCreateExpense
- reports.service.ts
- OrderDetail.tsx
- daily-plan-rules.ts
- AvitoService
- Брендбук — Распечатка PRO
- ImageCardTemplateService
- compilerOptions
- ImageCardBatchService
- compilerOptions
- Аудит проекта «Распечатка» — 2026-06-14
- AppShell.tsx
- dependencies
- ozon-bulk-stock.service.ts
- ozonProductCatalog.ts
- ApprovalEditor.tsx
- compilerOptions
- DtoCreateOrder
- partner-outbound.service.ts
- marketplace.module.ts
- review-reminder.service.ts
- TechSpecStorageService
- devDependencies
- CardEditorModal.tsx
- DtoCreateLead
- OzonPhotoStorageService
- SalaryService
- Интеграция с исполнителем-партнёром (печать футболок)
- ozon-import.service.ts
- CRM «Распечатка» — как всё устроено
- getErrorMessage
- auth.controller.ts
- OzonCredentials
- image-card-placement.ts
- ozon-product-catalog.service.ts
- OrderPhotoService
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
- PrintCardModal.tsx
- exclude
- Аудит финансов, кода и продакшена — 2026-07-09
- devDependencies
- AvitoPage.tsx
- nest-cli.json
- MarketplacePage.tsx
- ozonCatalog.ts
- GulianService
- seed.js
- order-photo.controller.ts
- OzonPrintService
- React + TypeScript + Vite
- backup-db.sh
- shipment-reminder-rules.ts
- ts-loader
- frontend/tsconfig.json
- Param
- @eslint/js
- telegram-update.service.ts
- ImageCardBatchController
- ozon-attributes.ts
- @nestjs/cli
- image-card-batch.service.ts
- OzonApiClient
- ApprovalService
- tshirt-partner-telegram.service.ts
- supertest
- ImageCardStorageService
- MarketplaceController
- ts-node
- DtoUpdateMockupTemplate
- .sendMessage
- telegram.module.ts
- OzonCatalogController
- crm-new/package.json
- ProductsTab.tsx
- @types/supertest
- MarketplaceAccountService
- PdfRasterService
- OzonProductCatalogController
- eslint-plugin-react-refresh
- OrdersTab.tsx
- tailwindcss
- typescript-eslint
- vite
- DtoUpdatePartnerSettings
- TasksPage.tsx
- salary.service.ts
- @nestjs/core
- OzonOrdersController
- partner-api.controller.ts
- TelegramStickerLinkService
- passport
- pdf-lib
- DtoScenarioAnswers
- DtoOzonUpdateCardText
- DtoPublishOzonPrints
- ТЗ: семантика и структура страниц raspechatkaa.ru
- OzonImportService
- DtoUpdateOzonPrint
- @prisma/adapter-pg
- @prisma/client
- ImageCardRenderService
- ApprovalController
- DtoCreateBonus
- approval.service.ts
- partner-admin.controller.ts
- PrismaService
- ozon-product-catalog.controller.ts
- CanvasItemService
- Выкатка: репозиторий → сервер
- PartnerSettingsService
- DtoBulkStock
- 2. Что уже сделано (этап 2 — карточки товаров)
- DtoCreatePaymentByAccruals
- DtoCreateOzonPrintsBulk
- nginx-routes.spec.ts
- DtoUpdateOzonCatalogTemplate
- TelegramPollingService
- ТЗ: раздел «Печать на холсте» на raspechatkaa.ru
- canvas-production-price.ts
- auto-update.sh
- .createBonus
- CanvasItemsTable.tsx
- main.ts
- DispatchToExecutorModal.tsx
- my-balance.spec.ts
- salary.module.ts
- canvas.pricing.ts
- task-reminder.service.spec.ts
- sharp
- undici
- @eslint/js
- image-card-generation.service.ts
- jest
- roboto-fontface
- ApprovalStorageService
- eslint
- class-transformer
- scenario.registry.ts
- eslint-config-prettier
- @nestjs/schematics
- @nestjs/testing
- TelegramService
- prisma
- DtoUpdateOzonUnitEconomics
- source-map-support
- ts-jest
- @types/archiver
- @types/node
- lead-notification.ts
- typescript-eslint
- @nestjs/mapped-types
- passport-jwt
- @eslint/eslintrc
- globals
- prettier
- @types/multer
- @nestjs/common
- @types/passport-jwt
- typescript
- @nestjs/passport
- tsconfig-paths
- pdfkit
- pg
- uuid
- web-push

## God Nodes (most connected - your core abstractions)
1. `PrismaService` - 101 edges
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
- `BatchList()` --calls--> `getErrorMessage()`  [EXTRACTED]
  frontend/src/components/marketplace/CardGeneratorTab.tsx → frontend/src/utils/get-error-message.ts
- `CreateModal()` --calls--> `getErrorMessage()`  [EXTRACTED]
  frontend/src/components/marketplace/CardTemplatesTab.tsx → frontend/src/utils/get-error-message.ts
- `AccountCard()` --calls--> `getErrorMessage()`  [EXTRACTED]
  frontend/src/components/marketplace/ConnectionTab.tsx → frontend/src/utils/get-error-message.ts
- `AccountForm()` --calls--> `getErrorMessage()`  [EXTRACTED]
  frontend/src/components/marketplace/ConnectionTab.tsx → frontend/src/utils/get-error-message.ts
- `Props` --references--> `OrderPhoto`  [EXTRACTED]
  frontend/src/components/orders/CanvasItemsTable.tsx → frontend/src/types/index.ts

## Import Cycles
- None detected.

## Communities (194 total, 55 thin omitted)

### Community 0 - "DtoCreateOzonPrint"
Cohesion: 0.07
Nodes (28): DtoCreateOzonPrint, ArrayMaxSize, ArrayMinSize, ArrayNotEmpty, IsArray, IsEnum, IsInt, IsOptional (+20 more)

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
Cohesion: 0.11
Nodes (19): buildPhotoItemLines(), buildTshirtItemLines(), drawInstagramIcon(), drawTelegramIcon(), FONT_DIR, formatRub(), PRINT_LOCATION_LABELS, req (+11 more)

### Community 5 - "jest"
Cohesion: 0.12
Nodes (16): jest, collectCoverageFrom, coverageDirectory, moduleFileExtensions, moduleNameMapper, rootDir, testEnvironment, testRegex (+8 more)

### Community 6 - "DtoOzonArchive"
Cohesion: 0.27
Nodes (14): DtoOzonArchive, DtoOzonPriceItem, DtoOzonStockItem, DtoOzonUpdatePrices, DtoOzonUpdateStocks, ArrayNotEmpty, IsArray, IsBoolean (+6 more)

### Community 7 - "index.ts"
Cohesion: 0.09
Nodes (30): ExecutorFilter(), Props, AvitoLinkedOrder, ClosedAccrualBrief, CreateCanvasItemDto, CreateItemDto, CreateTshirtItemDto, EnumAccrualKind (+22 more)

### Community 8 - "usePersistentState"
Cohesion: 0.33
Nodes (5): ProductsTab(), TshirtItemsTable(), read(), usePersistentState(), ReportsPage()

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
Nodes (34): calcOrderProfit(), forecastSalary(), kopecksToRub(), OrderProfit, OrderProfitInput, SHEET, DECLARED_PRINTS_PER_SHEET, HALF_SHEET_WORDS (+26 more)

### Community 13 - "OrderDetail.tsx"
Cohesion: 0.05
Nodes (61): ordersApi, OrdersPage, GulianSyncBlock(), Props, STATUS_LABELS, AssignPanel(), AssignPanelProps, COMBINING_LOW_LINE (+53 more)

### Community 14 - "daily-plan-rules.ts"
Cohesion: 0.06
Nodes (55): buildDailyPlanMessage(), buildShipmentBlock(), dayMonth(), DELIVERY_LABEL, effectiveDeadline(), executorKey(), inWorkTail(), isWithinPlanWindow() (+47 more)

### Community 15 - "AvitoService"
Cohesion: 0.05
Nodes (32): AvitoController, Controller, Get, Param, Post, Query, UseGuards, AvitoMessengerService (+24 more)

### Community 16 - "Брендбук — Распечатка PRO"
Cohesion: 0.08
Nodes (24): 1. Анализ конкурентов, 2. Психология цвета, 3. Цветовая палитра, 4. Типографика, 5. Логотип и иконка, 6. Правила применения, 7. Tone of Voice, 8. Применение на сайте (будущее) (+16 more)

### Community 17 - "ImageCardTemplateService"
Cohesion: 0.14
Nodes (7): describe(), ImageCardGenerationService, Injectable, isUsableArea(), parseRect(), ImageCardTemplateService, Injectable

### Community 18 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, allowSyntheticDefaultImports, baseUrl, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, forceConsistentCasingInFileNames (+14 more)

### Community 19 - "ImageCardBatchService"
Cohesion: 0.12
Nodes (5): Get, Res, ImageCardBatchService, summarize(), Injectable

### Community 20 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection, moduleResolution (+14 more)

### Community 21 - "Аудит проекта «Распечатка» — 2026-06-14"
Cohesion: 0.09
Nodes (21): 10.1 Почему PDF «не формировался» и долго генерировался, 10.2 Декомпозиция API-слоя (был god-файл), 10.3 Группировка компонентов, 10.4 Автоматические бэкапы БД (рекомендация №1), 10.5 Итоговая структура фронта, 10.6 Деплой раунда 2, 10. Раунд 2 — PDF, декомпозиция API/компонентов, бэкапы (тот же день), 1. Резюме и метрики (+13 more)

### Community 22 - "AppShell.tsx"
Cohesion: 0.11
Nodes (16): AppShell(), NavProps, Props, AD_MGR, ADMIN, ALL, BadgeKey, MARKETPLACE (+8 more)

### Community 23 - "dependencies"
Cohesion: 0.10
Nodes (21): axios, dependencies, axios, @hookform/resolvers, lucide-react, react, react-dom, react-hook-form (+13 more)

### Community 24 - "ozon-bulk-stock.service.ts"
Cohesion: 0.07
Nodes (32): OzonBulkStockProcessorService, Injectable, buildPairs(), BulkStockMode, BulkStockValidationError, checkQuantity(), chunkPairs(), LARGE_OPERATION_THRESHOLD (+24 more)

### Community 25 - "ozonProductCatalog.ts"
Cohesion: 0.07
Nodes (37): baseCodeOf(), BulkStockHistoryRow, BulkStockInput, BulkStockItem, BulkStockMode, BulkStockOperation, BulkStockPreview, BulkStockWarehouseInput (+29 more)

### Community 26 - "ApprovalEditor.tsx"
Cohesion: 0.07
Nodes (52): approvalsApi, mockupsApi, ApprovalEditor(), CmField(), downloadBlob(), Props, SIDE_LABELS, Sides (+44 more)

### Community 27 - "compilerOptions"
Cohesion: 0.10
Nodes (20): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+12 more)

### Community 28 - "DtoCreateOrder"
Cohesion: 0.05
Nodes (42): DtoCreateCanvasItem, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, Type (+34 more)

### Community 29 - "partner-outbound.service.ts"
Cohesion: 0.25
Nodes (5): hasProductionItems(), NO_PRODUCTION_ITEMS_MESSAGE, OrderWithProductionItems, PartnerOutboundService, Injectable

### Community 30 - "marketplace.module.ts"
Cohesion: 0.10
Nodes (21): ApprovalModule, Module, AuthModule, Module, CanvasModule, Module, ImageCardsModule, Module (+13 more)

### Community 31 - "review-reminder.service.ts"
Cohesion: 0.16
Nodes (12): isReviewReminderEligible(), REVIEW_REMINDER_CATEGORIES, REVIEW_REMINDER_DELAY_MS, REVIEW_REMINDER_PICKUP_DELAY_MS, REVIEW_REMINDER_STATUSES, reviewReminderDelayMs(), buildReviewRequestText(), categoryLabel() (+4 more)

### Community 32 - "TechSpecStorageService"
Cohesion: 0.13
Nodes (11): PartnerAdminController, Controller, Get, Param, Post, Res, UploadedFiles, UseGuards (+3 more)

### Community 33 - "devDependencies"
Cohesion: 0.11
Nodes (19): eslint-plugin-react-hooks, devDependencies, eslint, eslint-plugin-react-hooks, globals, @tailwindcss/vite, @types/node, @types/react (+11 more)

### Community 34 - "CardEditorModal.tsx"
Cohesion: 0.07
Nodes (46): ozonBatchesApi, ozonCardsApi, CardBatchReport(), CardEditorModal(), CardFinalizePanel(), BatchList(), CardGeneratorTab(), MODE_LABELS (+38 more)

### Community 35 - "DtoCreateLead"
Cohesion: 0.06
Nodes (33): DtoCreateLead, base, meta, pipe, IsBoolean, IsEnum, IsIn, IsInt (+25 more)

### Community 36 - "OzonPhotoStorageService"
Cohesion: 0.12
Nodes (13): OzonPhotoStorageService, Injectable, OzonPhotoController, Controller, Get, Param, Post, Req (+5 more)

### Community 37 - "SalaryService"
Cohesion: 0.15
Nodes (8): SalaryController, Controller, Delete, Get, Param, UseGuards, SalaryService, Injectable

### Community 38 - "Интеграция с исполнителем-партнёром (печать футболок)"
Cohesion: 0.12
Nodes (15): 1. Модель взаимодействия, 2. Аутентификация, 3. Webhook, который мы отправляем партнёру, 4.1 Данные заказа, 4.2 ТЗ-фото (макет), 4.3 Стикер (PDF, 58×40 мм), 4.4 Смена статуса заказа (партнёр → нам), 4. Эндпоинты, откуда партнёр забирает данные (pull) (+7 more)

### Community 39 - "ozon-import.service.ts"
Cohesion: 0.13
Nodes (14): DEFAULT_SIZE_DIMENSIONS, OzonCatalogTemplateService, Injectable, UpdateOzonCatalogTemplateInput, IMPORT_BATCH_SIZE, OzonImportItem, VariantDimensions, OzonAttributeValueOption (+6 more)

### Community 40 - "CRM «Распечатка» — как всё устроено"
Cohesion: 0.11
Nodes (18): 10. Слабые места, 11. Что дальше, 1. Что это, 2. Из чего собрано, 3. Продукты и статусы, 4. Деньги, 5. Роли, 6. Сценарии оформления (+10 more)

### Community 41 - "getErrorMessage"
Cohesion: 0.10
Nodes (31): api, partnerSettingsApi, shipmentLeadApi, usersApi, SettingsPage, DailyPlanCard(), Example(), FormState (+23 more)

### Community 42 - "auth.controller.ts"
Cohesion: 0.15
Nodes (12): AuthController, Body, Controller, Get, Post, Throttle, UseGuards, AuthService (+4 more)

### Community 43 - "OzonCredentials"
Cohesion: 0.08
Nodes (19): OzonCredentials, OzonProductCatalogService, OzonProductTariffs, Injectable, calculateUnitEconomics(), OzonTariffs, realSettings, settings (+11 more)

### Community 44 - "image-card-placement.ts"
Cohesion: 0.12
Nodes (23): ASPECT_ALERT, CardTransform, clamp(), containFit(), DEFAULT_FILL, DEFAULT_TRANSFORM, isOutside(), MAX_SCALE (+15 more)

### Community 45 - "ozon-product-catalog.service.ts"
Cohesion: 0.09
Nodes (21): OzonActionView, OzonCatalogProduct, OzonContentRating, OzonDemand, OzonImportAttributeBody, OzonProductCard, RawActionsResponse, RawAnalyticsResponse (+13 more)

### Community 46 - "OrderPhotoService"
Cohesion: 0.08
Nodes (19): DtoAllOrdersforQuery, IsEnum, IsIn, IsInt, IsOptional, IsString, Matches, Max (+11 more)

### Community 47 - "order-photo.service.ts"
Cohesion: 0.06
Nodes (39): buildCommunicationUrl(), buildMaxUrl(), DEFAULT_MAX_LINK_TEMPLATE, formatPhoneForDisplay(), normalizePhone(), validateCommunicationValue(), DtoUpdateOrder, IsBoolean (+31 more)

### Community 48 - "salary-integrity.spec.ts"
Cohesion: 0.10
Nodes (18): calculateManagerSalarySnapshot(), calculateSalarySnapshot(), earnsStaffSalary(), ManagerSalarySnapshot, SalarySnapshot, AccrualByIdRow, AsyncMock, createOrderService() (+10 more)

### Community 49 - "ReportsPage.tsx"
Cohesion: 0.06
Nodes (47): expensesApi, reportsApi, MySalaryBalance, salaryApi, MySalaryPage, ReportsPage, SalaryPage, buildReceiptHtml() (+39 more)

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
Cohesion: 0.10
Nodes (25): authApi, AdminRoute(), App(), AppRoutes(), CrmGate(), HomeRedirect(), LoginPage, MarketplaceRoute() (+17 more)

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

### Community 61 - "approval-render.service.ts"
Cohesion: 0.09
Nodes (31): DPI_ACCEPTABLE, DPI_GOOD, estimateDpi(), formatCm(), formatSizeCm(), isCalibrated(), isOutsidePrintArea(), PrintAreaCalibration (+23 more)

### Community 62 - "PrintCardModal.tsx"
Cohesion: 0.15
Nodes (21): colorCodeOf(), firstEditableWarehouse(), groupByColor(), OzonCatalogProduct, printCodeOf(), ProductEconomics, sizeOf(), sizeRank() (+13 more)

### Community 63 - "exclude"
Cohesion: 0.25
Nodes (7): exclude, extends, dist, node_modules, **/*spec.ts, test, ./tsconfig.json

### Community 64 - "Аудит финансов, кода и продакшена — 2026-07-09"
Cohesion: 0.29
Nodes (6): Аудит финансов, кода и продакшена — 2026-07-09, Кодовый аудит, Короткий вывод, Продакшен-аудит, Следующие улучшения, Финансовый аудит

### Community 65 - "devDependencies"
Cohesion: 0.22
Nodes (9): devDependencies, eslint-plugin-prettier, @types/express, @types/jest, @types/pdfkit, eslint-plugin-prettier, @types/express, @types/jest (+1 more)

### Community 66 - "AvitoPage.tsx"
Cohesion: 0.22
Nodes (11): avitoApi, AvitoChatQuery, AvitoPage, AvitoPage(), clientInitial(), messagePreview(), messageText(), timeLabel() (+3 more)

### Community 67 - "nest-cli.json"
Cohesion: 0.33
Nodes (5): collection, compilerOptions, deleteOutDir, $schema, sourceRoot

### Community 68 - "MarketplacePage.tsx"
Cohesion: 0.10
Nodes (26): CreateAccountDto, EnumMarketplace, MarketplaceAccount, marketplaceApi, OzonConnectionInfo, UpdateAccountDto, MarketplacePage, AccountCard() (+18 more)

### Community 69 - "ozonCatalog.ts"
Cohesion: 0.13
Nodes (19): CreateOzonPrintDto, EnumOzonSyncStatus, OzonAttributeValueOption, ozonCatalogApi, OzonCatalogTemplate, PublishResult, SizeDimensions, UpdateOzonCatalogTemplateDto (+11 more)

### Community 70 - "GulianService"
Cohesion: 0.15
Nodes (9): GulianModule, Module, GulianOutboxProcessorService, RETRY_DELAYS_SECONDS, Injectable, GulianOrderPayload, GulianResponse, GulianService (+1 more)

### Community 71 - "seed.js"
Cohesion: 0.40
Nodes (3): bcrypt, { Client }, { randomUUID }

### Community 72 - "order-photo.controller.ts"
Cohesion: 0.04
Nodes (44): PRICE_FIELDS, strip(), StripPricesInterceptor, Injectable, DtoAssignExecutor, IsOptional, IsString, IsUUID (+36 more)

### Community 73 - "OzonPrintService"
Cohesion: 0.16
Nodes (10): buildOfferId(), colorCodeFor(), normalizeSlug(), slugify(), stripUnsafe(), ColorGroupInput, CreatePrintInput, OzonPrintService (+2 more)

### Community 74 - "React + TypeScript + Vite"
Cohesion: 0.50
Nodes (3): Expanding the ESLint configuration, React Compiler, React + TypeScript + Vite

### Community 76 - "shipment-reminder-rules.ts"
Cohesion: 0.15
Nodes (11): buildShipmentReminder(), DEADLINE_METHODS, dueReminderStage(), hasDeadline(), hoursLeft(), SHIPMENT_REMINDER_STAGES_MS, ShipmentOrder, START (+3 more)

### Community 79 - "Param"
Cohesion: 0.15
Nodes (7): Body, Delete, Param, Patch, Post, UploadedFile, UseInterceptors

### Community 81 - "telegram-update.service.ts"
Cohesion: 0.12
Nodes (18): OrderForOutbox, calcGulianPayout(), Item, PayoutResult, toGulianStatus(), buildPartnerButtons(), buildPartnerCaption(), calcSettlement() (+10 more)

### Community 82 - "ImageCardBatchController"
Cohesion: 0.07
Nodes (30): DtoCreateImageCardTemplate, DtoRect, DtoUpdateImageCardTemplate, IsBoolean, IsInt, IsObject, IsOptional, IsString (+22 more)

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

### Community 88 - "tshirt-partner-telegram.service.ts"
Cohesion: 0.08
Nodes (31): escapeHtml(), EXT_CONTENT_TYPE, money(), PRINT_LOCATION_LABELS, PRINT_TYPE_LABELS, TechSpecAttachment, Injectable, TshirtOrderWithItems (+23 more)

### Community 90 - "ImageCardStorageService"
Cohesion: 0.15
Nodes (5): ImageCardProcessorService, parseSnapshot(), Injectable, ImageCardStorageService, Injectable

### Community 91 - "MarketplaceController"
Cohesion: 0.08
Nodes (22): DtoCreateMarketplaceAccount, IsEnum, IsString, MaxLength, MinLength, DtoUpdateMarketplaceAccount, IsBoolean, IsOptional (+14 more)

### Community 93 - "DtoUpdateMockupTemplate"
Cohesion: 0.09
Nodes (23): DtoCreateMockupTemplate, DtoUpdateMockupTemplate, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Matches (+15 more)

### Community 94 - ".sendMessage"
Cohesion: 0.29
Nodes (5): Body, DtoSendAvitoMessage, IsString, MaxLength, MinLength

### Community 95 - "telegram.module.ts"
Cohesion: 0.12
Nodes (15): StickerModule, Module, TasksModule, Module, TelegramModule, Module, TelegramUpdateService, TgUpdate (+7 more)

### Community 96 - "OzonCatalogController"
Cohesion: 0.16
Nodes (11): OzonCatalogController, Body, Controller, Delete, Get, Param, Patch, Post (+3 more)

### Community 97 - "crm-new/package.json"
Cohesion: 0.29
Nodes (6): author, description, license, name, private, version

### Community 98 - "ProductsTab.tsx"
Cohesion: 0.10
Nodes (36): EnumTshirtGender, OzonColorGroupInput, OzonPrint, OzonVariant, Draft, EditPrintModal(), ALL_SIZES, COLOR_CODE_BY_LABEL (+28 more)

### Community 100 - "MarketplaceAccountService"
Cohesion: 0.12
Nodes (14): ACCOUNT_INCLUDE, AccountRow, CreateAccountInput, MarketplaceAccountService, MarketplaceAccountView, Injectable, UpdateAccountInput, OzonService (+6 more)

### Community 101 - "PdfRasterService"
Cohesion: 0.23
Nodes (5): PdfRasterService, PdfRasterUnavailableError, RASTER_LONG_SIDE, run, Injectable

### Community 102 - "OzonProductCatalogController"
Cohesion: 0.19
Nodes (9): OzonProductCatalogController, Body, Controller, Get, Param, Patch, Post, Query (+1 more)

### Community 104 - "OrdersTab.tsx"
Cohesion: 0.23
Nodes (11): OzonOrder, OzonOrderGroup, OzonOrderItem, ozonOrdersApi, OzonOrdersPage, deadlineHint(), formatDateTime(), GROUPS (+3 more)

### Community 112 - "DtoUpdatePartnerSettings"
Cohesion: 0.12
Nodes (13): DtoUpdatePartnerSettings, IsInt, IsOptional, IsString, Max, MaxLength, Min, PartnerSettingsController (+5 more)

### Community 113 - "TasksPage.tsx"
Cohesion: 0.14
Nodes (18): tasksApi, TasksQuery, TasksPage, FilterChip(), Props, daysUntil(), DeadlineChip(), EMPTY_FORM (+10 more)

### Community 114 - "salary.service.ts"
Cohesion: 0.20
Nodes (7): DtoCreatePayment, IsInt, IsOptional, IsString, IsUUID, Min, Type

### Community 116 - "OzonOrdersController"
Cohesion: 0.25
Nodes (6): OzonOrdersController, Controller, Get, Param, Query, UseGuards

### Community 117 - "partner-api.controller.ts"
Cohesion: 0.09
Nodes (20): DtoPartnerStatus, IsString, Body, Patch, PartnerSettingsModule, Module, FLOW_RANK, FROM_PARTNER (+12 more)

### Community 121 - "DtoScenarioAnswers"
Cohesion: 0.50
Nodes (3): DtoScenarioAnswers, IsObject, IsOptional

### Community 122 - "DtoOzonUpdateCardText"
Cohesion: 0.33
Nodes (5): DtoOzonUpdateCardText, IsOptional, IsString, MaxLength, MinLength

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

### Community 130 - "ApprovalController"
Cohesion: 0.13
Nodes (16): ApprovalController, parseSide(), Body, Controller, Delete, Get, Param, Patch (+8 more)

### Community 131 - "DtoCreateBonus"
Cohesion: 0.25
Nodes (8): DtoCreateBonus, IsInt, IsString, IsUUID, MaxLength, Min, MinLength, Type

### Community 132 - "approval.service.ts"
Cohesion: 0.12
Nodes (16): approvalInclude, SIZE_LABELS, ALLOWED_IMAGE, SavedImage, UploadedImage, DtoCreateApproval, IsEnum, IsOptional (+8 more)

### Community 133 - "partner-admin.controller.ts"
Cohesion: 0.47
Nodes (4): ALLOWED, EXT_CONTENT_TYPE, TECH_SPEC_MAX_BYTES, TECH_SPEC_MAX_FILES

### Community 134 - "PrismaService"
Cohesion: 0.08
Nodes (17): JwtPayload, JwtStrategy, Injectable, GulianOutboxService, Injectable, HealthController, Controller, Get (+9 more)

### Community 135 - "ozon-product-catalog.controller.ts"
Cohesion: 0.11
Nodes (23): SIDES, APPROVAL_MAX_BYTES, AuthenticatedRequest, AuthenticatedUser, ROLES_KEY, JwtAuthGuard, Injectable, RolesGuard (+15 more)

### Community 136 - "CanvasItemService"
Cohesion: 0.11
Nodes (10): CanvasItemService, canvasMoney(), Injectable, OrderItemService, Injectable, calcItemPricePosition(), ShipmentLeadService, Injectable (+2 more)

### Community 137 - "Выкатка: репозиторий → сервер"
Cohesion: 0.29
Nodes (6): Выкатка: репозиторий → сервер, Как это устроено на сервере, Команды, Откат, Почему именно так, Чего в цепочке пока нет

### Community 138 - "PartnerSettingsService"
Cohesion: 0.14
Nodes (11): CanvasProductionController, Controller, Get, UseGuards, PartnerSettingsService, AnyMock, call(), items (+3 more)

### Community 139 - "DtoBulkStock"
Cohesion: 0.15
Nodes (12): DtoBulkStock, DtoBulkStockWarehouse, ArrayMaxSize, ArrayNotEmpty, IsArray, IsIn, IsInt, IsString (+4 more)

### Community 140 - "2. Что уже сделано (этап 2 — карточки товаров)"
Cohesion: 0.10
Nodes (19): 1.1. Что показал живой кабинет (17.08.2026), 1. Что уже сделано (этап 1 — подключение), 2.1. Порядок работы с товаром в Ozon Seller API (справочно), 2.2. Заказы (этап 3, только чтение), 2.3. Мои товары и юнит-экономика (этап 4), 2. Что уже сделано (этап 2 — карточки товаров), 3. Дальше, API CRM (+11 more)

### Community 141 - "DtoCreatePaymentByAccruals"
Cohesion: 0.29
Nodes (6): DtoCreatePaymentByAccruals, ArrayMinSize, IsArray, IsOptional, IsString, IsUUID

### Community 142 - "DtoCreateOzonPrintsBulk"
Cohesion: 0.29
Nodes (7): DtoCreateOzonPrintsBulk, ArrayMaxSize, ArrayMinSize, ArrayNotEmpty, IsArray, Type, ValidateNested

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

### Community 150 - "CanvasItemsTable.tsx"
Cohesion: 0.23
Nodes (11): canvasProductionApi, CanvasProductionPricing, CanvasProductionSize, CanvasItemsTable(), EditState, EMPTY, money(), Props (+3 more)

### Community 151 - "main.ts"
Cohesion: 0.50
Nodes (4): AppModule, Module, allowedOrigins(), bootstrap()

### Community 152 - "DispatchToExecutorModal.tsx"
Cohesion: 0.50
Nodes (4): DispatchToExecutorModal(), PayoutInfo, Props, rub()

### Community 155 - "canvas.pricing.ts"
Cohesion: 0.16
Nodes (16): CanvasPricingController, Controller, Get, calcCanvasUnitPrice(), calcCanvasUrgencyFee(), CANVAS_FRAME_LABELS, CANVAS_MATERIAL_LABELS, CANVAS_SIZES (+8 more)

### Community 156 - "task-reminder.service.spec.ts"
Cohesion: 0.25
Nodes (7): AsyncMock, AT_TEN, BEFORE_TEN, createStub(), LATE_NIGHT, setup(), Stub

### Community 160 - "image-card-generation.service.ts"
Cohesion: 0.09
Nodes (20): CARD_MODES, CardMode, BULK_ACTIONS, BulkAction, DtoBulkCards, ArrayMaxSize, ArrayNotEmpty, IsArray (+12 more)

### Community 163 - "ApprovalStorageService"
Cohesion: 0.14
Nodes (4): ApprovalStorageService, Injectable, MockupService, Injectable

### Community 166 - "scenario.registry.ts"
Cohesion: 0.05
Nodes (66): calcOrderTotal(), PricedItem, DtoSaveDraft, IsObject, IsOptional, IsString, MaxLength, DELIVERY_STEPS (+58 more)

### Community 170 - "TelegramService"
Cohesion: 0.13
Nodes (10): logger, proxyDispatcher(), resetTelegramProxyCache(), telegramFetch(), telegramFormData(), TgUpdateWithId, describeTelegramError(), TelegramSendResult (+2 more)

### Community 172 - "DtoUpdateOzonUnitEconomics"
Cohesion: 0.22
Nodes (8): DtoUpdateOzonUnitEconomics, IsIn, IsInt, IsOptional, Max, Min, Type, IsNumber

### Community 177 - "lead-notification.ts"
Cohesion: 0.26
Nodes (7): buildLeadNotification(), escape(), LeadForNotification, NotifiableUser, pickLeadResponders(), toMention(), isUniqueViolation()

## Knowledge Gaps
- **796 isolated node(s):** `$schema`, `collection`, `sourceRoot`, `deleteOutDir`, `name` (+791 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **55 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Roles()` connect `Roles` to `tasks.controller.ts`, `ApprovalController`, `DtoUpdateUser`, `partner-admin.controller.ts`, `ozon-product-catalog.controller.ts`, `PartnerSettingsService`, `DtoCreateExpense`, `reports.service.ts`, `AvitoService`, `TechSpecStorageService`, `OzonPhotoStorageService`, `SalaryService`, `scenario.registry.ts`, `order-photo.controller.ts`, `ImageCardBatchController`, `MarketplaceController`, `DtoUpdateMockupTemplate`, `.sendMessage`, `OzonCatalogController`, `OzonProductCatalogController`, `DtoUpdatePartnerSettings`, `OzonOrdersController`?**
  _High betweenness centrality (0.259) - this node is a cross-community bridge._
- **Why does `BatchView()` connect `ApprovalController` to `getErrorMessage`, `CardEditorModal.tsx`?**
  _High betweenness centrality (0.241) - this node is a cross-community bridge._
- **Why does `getErrorMessage()` connect `getErrorMessage` to `CardEditorModal.tsx`, `ApprovalController`, `MarketplacePage.tsx`, `ProductsTab.tsx`, `ozonCatalog.ts`, `AvitoPage.tsx`, `OrderDetail.tsx`, `ReportsPage.tsx`, `TasksPage.tsx`, `ozonProductCatalog.ts`, `ApprovalEditor.tsx`, `PrintCardModal.tsx`?**
  _High betweenness centrality (0.192) - this node is a cross-community bridge._
- **What connects `$schema`, `collection`, `sourceRoot` to the rest of the system?**
  _796 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `DtoCreateOzonPrint` be split into smaller, more focused modules?**
  _Cohesion score 0.07096774193548387 - nodes in this community are weakly interconnected._
- **Should `tasks.controller.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06493506493506493 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._