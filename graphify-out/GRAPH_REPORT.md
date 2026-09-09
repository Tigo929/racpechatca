# Graph Report - raspechatka  (2026-09-09)

## Corpus Check
- 484 files · ~259,263 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 3783 nodes · 7849 edges · 203 communities (153 shown, 50 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 322 edges (avg confidence: 0.79)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `120d815c`
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
- task-reminder-rules.ts
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
- AppShell.tsx
- dependencies
- ozon-bulk-stock.service.ts
- CardEditorModal.tsx
- ApprovalEditor.tsx
- compilerOptions
- MarketplaceAccountService
- OzonCredentials
- app.module.ts
- review-reminder.service.ts
- TechSpecStorageService
- devDependencies
- getErrorMessage
- DtoCreateLead
- OzonPhotoStorageService
- SalaryService
- Интеграция с исполнителем-партнёром (печать футболок)
- scenario.registry.ts
- CRM «Распечатка» — как всё устроено
- usePersistentState
- auth.controller.ts
- ImageCardBatchService
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
- DailyPlanService
- scripts
- frontend/package.json
- Architecture
- Architecture
- ozon-orders.service.ts
- package.json
- approval-render.service.ts
- DtoOzonColorGroup
- exclude
- Аудит финансов, кода и продакшена — 2026-07-09
- devDependencies
- AvitoPage.tsx
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
- marketplace.module.ts
- telegram-update.service.ts
- image-card-batch.controller.ts
- ozon-attributes.ts
- @nestjs/cli
- DtoCreateImageCardBatch
- OzonApiClient
- ApprovalService
- DtoCreatePayment
- supertest
- ImageCardStorageService
- MarketplaceController
- ts-node
- MockupService
- AvitoController
- TshirtPartnerTelegramService
- OzonCatalogController
- crm-new/package.json
- ProductsTab.tsx
- @types/supertest
- tshirt-partner-telegram.service.ts
- PdfRasterService
- OzonProductCatalogController
- image-card-naming.ts
- task-reminder.service.spec.ts
- DtoUpdateItemOrder
- typescript-eslint
- vite
- DtoCreateBonus
- render
- index.ts
- @nestjs/core
- salary.service.ts
- partner-api.controller.ts
- TelegramStickerLinkService
- passport
- pdf-lib
- PartnerSettingsService
- tg_greeter.py
- .updateStatusOrder
- ТЗ: семантика и структура страниц raspechatkaa.ru
- DtoPublishOzonPrints
- DtoUpdateOzonPrint
- @prisma/adapter-pg
- @prisma/client
- approval.service.ts
- Param
- describe
- DtoBulkCards
- SalaryController
- PrismaService
- scenario.controller.ts
- .get
- Выкатка: репозиторий → сервер
- ApprovalController
- ozon-product-catalog.controller.ts
- 2. Что уже сделано (этап 2 — карточки товаров)
- parse_proxy
- my-balance.spec.ts
- nginx-routes.spec.ts
- DtoUpdateOzonCatalogTemplate
- image-card-generation.service.ts
- ТЗ: раздел «Печать на холсте» на raspechatkaa.ru
- canvas-production-price.ts
- auto-update.sh
- Первое сообщение клиенту
- sign
- delivery_line
- OrderDetail.tsx
- items_list
- salary.module.ts
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
- partner-outbound.service.ts
- eslint-plugin-prettier
- .createOrder
- StripPricesInterceptor
- DtoUpdatePartnerSettings
- PartnerApiController
- eslint-config-prettier
- @eslint/eslintrc
- TelegramUpdateService
- @nestjs/schematics
- @nestjs/testing
- class-transformer
- lead-notification.ts
- prisma
- @nestjs/mapped-types
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
- `Props` --references--> `ItemTshirt`  [EXTRACTED]
  frontend/src/components/approval/ApprovalsBlock.tsx → frontend/src/types/index.ts
- `AccountCard()` --calls--> `getErrorMessage()`  [EXTRACTED]
  frontend/src/components/marketplace/ConnectionTab.tsx → frontend/src/utils/get-error-message.ts
- `AccountForm()` --calls--> `getErrorMessage()`  [EXTRACTED]
  frontend/src/components/marketplace/ConnectionTab.tsx → frontend/src/utils/get-error-message.ts
- `AddExpenseModal()` --calls--> `getErrorMessage()`  [EXTRACTED]
  frontend/src/pages/ReportsPage.tsx → frontend/src/utils/get-error-message.ts
- `BonusForm()` --calls--> `getErrorMessage()`  [EXTRACTED]
  frontend/src/pages/SalaryPage.tsx → frontend/src/utils/get-error-message.ts

## Import Cycles
- None detected.

## Communities (203 total, 50 thin omitted)

### Community 0 - "DtoCreateOzonPrint"
Cohesion: 0.09
Nodes (22): DtoCreateOzonPrint, ArrayMaxSize, ArrayMinSize, ArrayNotEmpty, IsArray, IsEnum, IsInt, IsOptional (+14 more)

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
Cohesion: 0.15
Nodes (16): computePrepayment(), DEFAULT_PREPAY_RATE, Prepayment, buildPhotoItemLines(), buildTshirtItemLines(), drawInstagramIcon(), drawTelegramIcon(), FONT_DIR (+8 more)

### Community 5 - "jest"
Cohesion: 0.12
Nodes (16): jest, collectCoverageFrom, coverageDirectory, moduleFileExtensions, moduleNameMapper, rootDir, testEnvironment, testRegex (+8 more)

### Community 6 - "DtoOzonArchive"
Cohesion: 0.27
Nodes (14): DtoOzonArchive, DtoOzonPriceItem, DtoOzonStockItem, DtoOzonUpdatePrices, DtoOzonUpdateStocks, ArrayNotEmpty, IsArray, IsBoolean (+6 more)

### Community 7 - "task-reminder-rules.ts"
Cohesion: 0.16
Nodes (21): buildDigestMessage(), daysUntilDeadline(), deadlineMarker(), DIGEST_HOUR, DIGEST_LAST_HOUR, DigestGroup, DigestTask, formatDeadlineLabel() (+13 more)

### Community 8 - "TshirtItemsTable.tsx"
Cohesion: 0.08
Nodes (24): Props, CLIENT_ITEM_PRINT_NAME, FREE_PRICE_HINT, EditState, ItemsTable(), Props, AssignPanelProps, Props (+16 more)

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
Cohesion: 0.07
Nodes (37): calcOrderProfit(), forecastSalary(), kopecksToRub(), OrderProfit, OrderProfitInput, SHEET, DECLARED_PRINTS_PER_SHEET, HALF_SHEET_WORDS (+29 more)

### Community 13 - "OrdersPage.tsx"
Cohesion: 0.07
Nodes (42): OrdersPage, ExecutorFilter(), Props, OrderDetail(), StatusStepper(), DELIVERY_STYLES, DeliveryBadge(), Props (+34 more)

### Community 14 - "daily-plan-rules.ts"
Cohesion: 0.12
Nodes (31): buildDailyPlanMessage(), buildShipmentBlock(), dayMonth(), DELIVERY_LABEL, effectiveDeadline(), executorKey(), inWorkTail(), moscowHm() (+23 more)

### Community 15 - "AvitoService"
Cohesion: 0.05
Nodes (27): Get, Query, AvitoMessengerService, Injectable, AvitoModule, Module, AvitoAccount, AvitoChat (+19 more)

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

### Community 22 - "AppShell.tsx"
Cohesion: 0.08
Nodes (23): salaryApi, MySalaryPage, AppShell(), NavProps, Props, AD_MGR, ADMIN, ALL (+15 more)

### Community 23 - "dependencies"
Cohesion: 0.10
Nodes (21): axios, dependencies, axios, @hookform/resolvers, lucide-react, react, react-dom, react-hook-form (+13 more)

### Community 24 - "ozon-bulk-stock.service.ts"
Cohesion: 0.07
Nodes (32): OzonBulkStockProcessorService, Injectable, buildPairs(), BulkStockMode, BulkStockValidationError, checkQuantity(), chunkPairs(), LARGE_OPERATION_THRESHOLD (+24 more)

### Community 25 - "CardEditorModal.tsx"
Cohesion: 0.18
Nodes (19): CardEditorModal(), CORNERS, Props, StageRect, TransformStage(), CardRect, CardTransform, ImageCardGenerated (+11 more)

### Community 26 - "ApprovalEditor.tsx"
Cohesion: 0.08
Nodes (48): approvalsApi, mockupsApi, ApprovalEditor(), CmField(), downloadBlob(), Props, SIDE_LABELS, Sides (+40 more)

### Community 27 - "compilerOptions"
Cohesion: 0.10
Nodes (20): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+12 more)

### Community 28 - "MarketplaceAccountService"
Cohesion: 0.11
Nodes (14): ACCOUNT_INCLUDE, AccountRow, CreateAccountInput, MarketplaceAccountService, MarketplaceAccountView, Injectable, UpdateAccountInput, OzonService (+6 more)

### Community 29 - "OzonCredentials"
Cohesion: 0.20
Nodes (3): OzonCredentials, OzonProductCatalogService, Injectable

### Community 30 - "app.module.ts"
Cohesion: 0.07
Nodes (31): AppModule, Module, ApprovalModule, Module, CanvasModule, Module, CanvasPricingController, Controller (+23 more)

### Community 31 - "review-reminder.service.ts"
Cohesion: 0.16
Nodes (12): isReviewReminderEligible(), REVIEW_REMINDER_CATEGORIES, REVIEW_REMINDER_DELAY_MS, REVIEW_REMINDER_PICKUP_DELAY_MS, REVIEW_REMINDER_STATUSES, reviewReminderDelayMs(), buildReviewRequestText(), categoryLabel() (+4 more)

### Community 32 - "TechSpecStorageService"
Cohesion: 0.10
Nodes (15): PartnerAdminController, Controller, Get, Param, Post, Res, UploadedFiles, UseGuards (+7 more)

### Community 33 - "devDependencies"
Cohesion: 0.11
Nodes (19): eslint-plugin-react-hooks, devDependencies, eslint, eslint-plugin-react-hooks, globals, @tailwindcss/vite, @types/node, @types/react (+11 more)

### Community 34 - "getErrorMessage"
Cohesion: 0.08
Nodes (39): ozonBatchesApi, ozonCardsApi, CardBatchReport(), CardFinalizePanel(), BatchList(), CardGeneratorTab(), MODE_LABELS, SOURCE_STATUS (+31 more)

### Community 35 - "DtoCreateLead"
Cohesion: 0.09
Nodes (18): DtoCreateLead, base, meta, pipe, IsBoolean, IsEnum, IsIn, IsInt (+10 more)

### Community 36 - "OzonPhotoStorageService"
Cohesion: 0.12
Nodes (13): OzonPhotoStorageService, Injectable, OzonPhotoController, Controller, Get, Param, Post, Req (+5 more)

### Community 37 - "SalaryService"
Cohesion: 0.16
Nodes (5): Delete, Get, Param, SalaryService, Injectable

### Community 38 - "Интеграция с исполнителем-партнёром (печать футболок)"
Cohesion: 0.12
Nodes (15): 1. Модель взаимодействия, 2. Аутентификация, 3. Webhook, который мы отправляем партнёру, 4.1 Данные заказа, 4.2 ТЗ-фото (макет), 4.3 Стикер (PDF, 58×40 мм), 4.4 Смена статуса заказа (партнёр → нам), 4. Эндпоинты, откуда партнёр забирает данные (pull) (+7 more)

### Community 39 - "scenario.registry.ts"
Cohesion: 0.06
Nodes (61): DtoSaveDraft, IsObject, IsOptional, IsString, MaxLength, DELIVERY_STEPS, NOTE_STEP, OPTIONAL (+53 more)

### Community 40 - "CRM «Распечатка» — как всё устроено"
Cohesion: 0.11
Nodes (18): 10. Слабые места, 11. Что дальше, 1. Что это, 2. Из чего собрано, 3. Продукты и статусы, 4. Деньги, 5. Роли, 6. Сценарии оформления (+10 more)

### Community 41 - "usePersistentState"
Cohesion: 0.17
Nodes (14): canvasProductionApi, CanvasProductionPricing, CanvasProductionSize, CanvasItemsTable(), EditState, EMPTY, money(), toDto() (+6 more)

### Community 42 - "auth.controller.ts"
Cohesion: 0.11
Nodes (16): AuthController, Body, Controller, Get, Post, Throttle, UseGuards, AuthModule (+8 more)

### Community 43 - "ImageCardBatchService"
Cohesion: 0.16
Nodes (3): ImageCardBatchService, summarize(), Injectable

### Community 44 - "image-card-placement.ts"
Cohesion: 0.10
Nodes (25): ASPECT_ALERT, CardTransform, clamp(), containFit(), DEFAULT_FILL, DEFAULT_TRANSFORM, isOutside(), isUsableArea() (+17 more)

### Community 45 - "ozon-product-catalog.service.ts"
Cohesion: 0.09
Nodes (21): OzonActionView, OzonCatalogProduct, OzonContentRating, OzonDemand, OzonImportAttributeBody, OzonProductCard, RawActionsResponse, RawAnalyticsResponse (+13 more)

### Community 46 - "OrderPhotoService"
Cohesion: 0.10
Nodes (15): DtoAllOrdersforQuery, IsEnum, IsIn, IsInt, IsOptional, IsString, Matches, Max (+7 more)

### Community 47 - "order-photo.service.ts"
Cohesion: 0.07
Nodes (28): DtoAssignExecutor, IsOptional, IsString, IsUUID, LeadMoneyError, LeadMoneyInput, LeadMoneyResult, MAX_POSITION_TOTAL (+20 more)

### Community 48 - "salary-integrity.spec.ts"
Cohesion: 0.14
Nodes (13): AccrualByIdRow, AsyncMock, createOrderService(), CreatePaymentArgs, createPrismaStub(), HarnessAccrual, makeOrder(), PaymentByAccrualsHarness (+5 more)

### Community 49 - "ReportsPage.tsx"
Cohesion: 0.09
Nodes (34): expensesApi, ReportsPage, SalaryPage, buildReceiptHtml(), buildReceiptTitle(), escapeHtml(), formatFilenameDate(), printReceipt() (+26 more)

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
Cohesion: 0.07
Nodes (44): usersApi, AdminRoute(), App(), AppRoutes(), CrmGate(), HomeRedirect(), LoginPage, MarketplaceRoute() (+36 more)

### Community 54 - "DailyPlanService"
Cohesion: 0.17
Nodes (5): isWithinPlanWindow(), DailyPlanService, Injectable, ShipmentLeadService, Injectable

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
Cohesion: 0.10
Nodes (20): OzonOrdersController, Controller, Get, Param, Query, UseGuards, GROUP_BY_STATUS, groupForStatus() (+12 more)

### Community 60 - "package.json"
Cohesion: 0.25
Nodes (7): concurrently, devDependencies, concurrently, name, private, scripts, dev

### Community 61 - "approval-render.service.ts"
Cohesion: 0.11
Nodes (28): DPI_ACCEPTABLE, DPI_GOOD, estimateDpi(), formatCm(), formatSizeCm(), isCalibrated(), isOutsidePrintArea(), PrintAreaCalibration (+20 more)

### Community 62 - "DtoOzonColorGroup"
Cohesion: 0.14
Nodes (13): DtoOzonColorGroup, ArrayMinSize, ArrayNotEmpty, IsArray, IsEnum, IsInt, IsOptional, IsString (+5 more)

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
Nodes (38): CreateAccountDto, EnumMarketplace, MarketplaceAccount, marketplaceApi, OzonConnectionInfo, UpdateAccountDto, OzonOrder, OzonOrderGroup (+30 more)

### Community 69 - "ozonProductCatalog.ts"
Cohesion: 0.06
Nodes (56): baseCodeOf(), BulkStockHistoryRow, BulkStockInput, BulkStockItem, BulkStockMode, BulkStockOperation, BulkStockPreview, BulkStockWarehouseInput (+48 more)

### Community 70 - "GulianService"
Cohesion: 0.23
Nodes (4): GulianOutboxProcessorService, Injectable, GulianService, Injectable

### Community 71 - "seed.js"
Cohesion: 0.40
Nodes (3): bcrypt, { Client }, { randomUUID }

### Community 72 - "order-photo.controller.ts"
Cohesion: 0.04
Nodes (59): DtoCreateCanvasItem, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, Type (+51 more)

### Community 73 - "OzonPrintService"
Cohesion: 0.22
Nodes (6): colorCodeFor(), normalizeSlug(), slugify(), stripUnsafe(), OzonPrintService, Injectable

### Community 74 - "React + TypeScript + Vite"
Cohesion: 0.50
Nodes (3): Expanding the ESLint configuration, React Compiler, React + TypeScript + Vite

### Community 76 - "shipment-reminder-rules.ts"
Cohesion: 0.16
Nodes (11): buildShipmentReminder(), DEADLINE_METHODS, dueReminderStage(), hasDeadline(), hoursLeft(), SHIPMENT_REMINDER_STAGES_MS, ShipmentOrder, START (+3 more)

### Community 79 - "ImageCardBatchController"
Cohesion: 0.14
Nodes (12): ImageCardBatchController, Body, Controller, Delete, Get, Param, Patch, Post (+4 more)

### Community 80 - "marketplace.module.ts"
Cohesion: 0.07
Nodes (23): MarketplaceAccessGuard, guard_(), Injectable, DEFAULT_SIZE_DIMENSIONS, OzonCatalogTemplateService, Injectable, UpdateOzonCatalogTemplateInput, OzonImportPollService (+15 more)

### Community 81 - "telegram-update.service.ts"
Cohesion: 0.11
Nodes (19): OrderForOutbox, calcGulianPayout(), Item, PayoutResult, GulianOrderPayload, GulianResponse, toGulianStatus(), buildPartnerCaption() (+11 more)

### Community 82 - "image-card-batch.controller.ts"
Cohesion: 0.06
Nodes (31): DtoCreateImageCardTemplate, DtoRect, DtoUpdateImageCardTemplate, IsBoolean, IsInt, IsObject, IsOptional, IsString (+23 more)

### Community 83 - "ozon-attributes.ts"
Cohesion: 0.10
Nodes (27): buildExtraImages(), buildImportItem(), buildOfferId(), CatalogTemplateForImport, chunk(), COLOR_CODE_BY_LABEL, DEFAULT_SIZES, dictAttr() (+19 more)

### Community 85 - "DtoCreateImageCardBatch"
Cohesion: 0.18
Nodes (10): DtoCreateImageCardBatch, ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, IsUUID (+2 more)

### Community 86 - "OzonApiClient"
Cohesion: 0.08
Nodes (24): humanize(), OzonApiClient, OzonApiError, OzonErrorBody, Injectable, OzonConnectionInfo, OzonProductListResponse, OzonWarehouseListResponse (+16 more)

### Community 87 - "ApprovalService"
Cohesion: 0.11
Nodes (13): Body, Patch, ApprovalService, Injectable, ApprovalSides, clamp(), filledSides(), MAX_PRINT_MM (+5 more)

### Community 88 - "DtoCreatePayment"
Cohesion: 0.25
Nodes (7): DtoCreatePayment, IsInt, IsOptional, IsString, IsUUID, Min, Type

### Community 90 - "ImageCardStorageService"
Cohesion: 0.14
Nodes (5): ImageCardProcessorService, parseSnapshot(), Injectable, ImageCardStorageService, Injectable

### Community 91 - "MarketplaceController"
Cohesion: 0.08
Nodes (22): DtoCreateMarketplaceAccount, IsEnum, IsString, MaxLength, MinLength, DtoUpdateMarketplaceAccount, IsBoolean, IsOptional (+14 more)

### Community 93 - "MockupService"
Cohesion: 0.10
Nodes (14): MockupController, Body, Controller, Delete, Get, Param, Patch, Post (+6 more)

### Community 94 - "AvitoController"
Cohesion: 0.16
Nodes (10): AvitoController, Body, Controller, Param, Post, UseGuards, DtoSendAvitoMessage, IsString (+2 more)

### Community 95 - "TshirtPartnerTelegramService"
Cohesion: 0.33
Nodes (3): Injectable, TshirtPartnerTelegramService, TelegramSendResult

### Community 96 - "OzonCatalogController"
Cohesion: 0.17
Nodes (11): OzonCatalogController, Body, Controller, Delete, Get, Param, Patch, Post (+3 more)

### Community 97 - "crm-new/package.json"
Cohesion: 0.29
Nodes (6): author, description, license, name, private, version

### Community 98 - "ProductsTab.tsx"
Cohesion: 0.06
Nodes (55): CreateOzonPrintDto, EnumOzonSyncStatus, EnumTshirtGender, OzonAttributeValueOption, ozonCatalogApi, OzonCatalogTemplate, OzonColorGroupInput, OzonPrint (+47 more)

### Community 100 - "tshirt-partner-telegram.service.ts"
Cohesion: 0.10
Nodes (26): escapeHtml(), EXT_CONTENT_TYPE, money(), PRINT_LOCATION_LABELS, PRINT_TYPE_LABELS, TechSpecAttachment, TshirtOrderWithItems, buildPartnerOrderPayload() (+18 more)

### Community 101 - "PdfRasterService"
Cohesion: 0.21
Nodes (5): PdfRasterService, PdfRasterUnavailableError, RASTER_LONG_SIDE, run, Injectable

### Community 102 - "OzonProductCatalogController"
Cohesion: 0.19
Nodes (9): OzonProductCatalogController, Body, Controller, Get, Param, Patch, Post, Query (+1 more)

### Community 103 - "image-card-naming.ts"
Cohesion: 0.44
Nodes (6): cardFileName(), cleanBaseName(), sniffSourceType(), sourceTypeByMime(), TRANSLIT, uniqueBaseName()

### Community 104 - "task-reminder.service.spec.ts"
Cohesion: 0.25
Nodes (7): AsyncMock, AT_TEN, BEFORE_TEN, createStub(), LATE_NIGHT, setup(), Stub

### Community 105 - "DtoUpdateItemOrder"
Cohesion: 0.17
Nodes (11): DtoUpdateItemOrder, IsBoolean, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min (+3 more)

### Community 112 - "DtoCreateBonus"
Cohesion: 0.25
Nodes (8): DtoCreateBonus, IsInt, IsString, IsUUID, MaxLength, Min, MinLength, Type

### Community 113 - "render"
Cohesion: 0.17
Nodes (9): greeting_for(), money(), Обращение целиком, а не только имя. У заявки имени может не быть — человек…, Сумма с пробелами между разрядами: 2 490, а не 2490. Ноль означает, что позиций…, Готовый текст сообщения. Неизвестные метки остаются как есть., render(), TestGreeting, TestMoney (+1 more)

### Community 114 - "index.ts"
Cohesion: 0.06
Nodes (53): authApi, api, partnerSettingsApi, reportsApi, MySalaryBalance, shipmentLeadApi, tasksApi, TasksQuery (+45 more)

### Community 116 - "salary.service.ts"
Cohesion: 0.20
Nodes (6): DtoCreatePaymentByAccruals, ArrayMinSize, IsArray, IsOptional, IsString, IsUUID

### Community 117 - "partner-api.controller.ts"
Cohesion: 0.09
Nodes (18): DtoPartnerStatus, IsString, Body, Patch, FLOW_RANK, FROM_PARTNER, fromPartnerStatus(), mapPartnerStage() (+10 more)

### Community 118 - "TelegramStickerLinkService"
Cohesion: 0.16
Nodes (8): TelegramStickerController, Controller, Get, Param, Query, Res, TelegramStickerLinkService, Injectable

### Community 121 - "PartnerSettingsService"
Cohesion: 0.09
Nodes (12): CanvasProductionController, Controller, Get, UseGuards, GulianOutboxService, Injectable, PartnerSettingsService, AnyMock (+4 more)

### Community 122 - "tg_greeter.py"
Cohesion: 0.18
Nodes (11): Exception, Crm, Fatal, load_templates(), main(), Очередь и отметки. Ошибки сети не роняют процесс — просто ждём., Одно сообщение. Возвращает итог из закрытого списка, который знает CRM. Все…, Настройки неверны — работать нельзя, перезапуск не поможет. (+3 more)

### Community 123 - ".updateStatusOrder"
Cohesion: 0.24
Nodes (7): isExternalProductionCategory(), needsShipmentStatus(), calculateManagerSalarySnapshot(), calculateSalarySnapshot(), earnsStaffSalary(), ManagerSalarySnapshot, SalarySnapshot

### Community 124 - "ТЗ: семантика и структура страниц raspechatkaa.ru"
Cohesion: 0.07
Nodes (27): P10. Холст — `/interer/holst`, P1. Где распечатать фото в Москве — `/gde-raspechatat-foto-v-moskve`, P2. Цены — `/ceny`, P3. Размеры и форматы фото — `/formaty`, P4. Печать фото А4 — `/catalog/foto-a4`, P5. Печать фото на документы — `/dokumenty`, P6. Печать фото онлайн с доставкой — `/onlayn`, P7. Бумага и качество — `/bumaga` (+19 more)

### Community 125 - "DtoPublishOzonPrints"
Cohesion: 0.33
Nodes (5): DtoPublishOzonPrints, ArrayMinSize, ArrayNotEmpty, IsArray, IsUUID

### Community 126 - "DtoUpdateOzonPrint"
Cohesion: 0.17
Nodes (11): DtoUpdateOzonPrint, ArrayMaxSize, IsArray, IsEnum, IsInt, IsOptional, IsString, IsUrl (+3 more)

### Community 129 - "approval.service.ts"
Cohesion: 0.14
Nodes (13): approvalInclude, SIZE_LABELS, DtoCreateApproval, IsEnum, IsOptional, IsString, IsUUID, DtoUpdateApproval (+5 more)

### Community 130 - "Param"
Cohesion: 0.13
Nodes (11): parseSide(), Delete, Get, Param, Post, Query, Res, UploadedFile (+3 more)

### Community 131 - "describe"
Cohesion: 0.22
Nodes (9): describe_code_type(), describe_next(), main(), Человеческое название способа доставки кода., Чем можно переслать, если не дошло., describe(), Строка для лога — без логина и пароля., Строка для лога не должна содержать логин и пароль. (+1 more)

### Community 132 - "DtoBulkCards"
Cohesion: 0.33
Nodes (6): DtoBulkCards, ArrayMaxSize, ArrayNotEmpty, IsArray, IsIn, IsUUID

### Community 133 - "SalaryController"
Cohesion: 0.33
Nodes (5): SalaryController, Body, Controller, Post, UseGuards

### Community 134 - "PrismaService"
Cohesion: 0.07
Nodes (24): JwtPayload, RETRY_DELAYS_SECONDS, HealthController, Controller, Get, ColorGroupInput, CreatePrintInput, PRINT_INCLUDE (+16 more)

### Community 135 - "scenario.controller.ts"
Cohesion: 0.10
Nodes (24): SIDES, APPROVAL_MAX_BYTES, AuthenticatedRequest, AuthenticatedUser, ROLES_KEY, JwtAuthGuard, Injectable, RolesGuard (+16 more)

### Community 136 - ".get"
Cohesion: 0.12
Nodes (9): CanvasItemService, canvasMoney(), Injectable, OrderFinancialIntegrityService, Injectable, OrderItemService, Injectable, Injectable (+1 more)

### Community 137 - "Выкатка: репозиторий → сервер"
Cohesion: 0.29
Nodes (6): Выкатка: репозиторий → сервер, Как это устроено на сервере, Команды, Откат, Почему именно так, Чего в цепочке пока нет

### Community 138 - "ApprovalController"
Cohesion: 0.50
Nodes (3): ApprovalController, Controller, UseGuards

### Community 139 - "ozon-product-catalog.controller.ts"
Cohesion: 0.08
Nodes (25): DtoBulkStock, DtoBulkStockWarehouse, ArrayMaxSize, ArrayNotEmpty, IsArray, IsIn, IsInt, IsString (+17 more)

### Community 140 - "2. Что уже сделано (этап 2 — карточки товаров)"
Cohesion: 0.10
Nodes (19): 1.1. Что показал живой кабинет (17.08.2026), 1. Что уже сделано (этап 1 — подключение), 2.1. Порядок работы с товаром в Ozon Seller API (справочно), 2.2. Заказы (этап 3, только чтение), 2.3. Мои товары и юнит-экономика (этап 4), 2. Что уже сделано (этап 2 — карточки товаров), 3. Дальше, API CRM (+11 more)

### Community 141 - "parse_proxy"
Cohesion: 0.33
Nodes (3): parse_proxy(), Словарь для Telethon или None, если прокси не задан. Формат именно словаря…, TestParse

### Community 143 - "nginx-routes.spec.ts"
Cohesion: 0.22
Nodes (4): FRONTEND, NGINX_CONF, SRC, VITE_CONF

### Community 144 - "DtoUpdateOzonCatalogTemplate"
Cohesion: 0.17
Nodes (11): DtoUpdateOzonCatalogTemplate, ArrayMaxSize, IsArray, IsBoolean, IsInt, IsObject, IsOptional, IsString (+3 more)

### Community 145 - "image-card-generation.service.ts"
Cohesion: 0.10
Nodes (19): CARD_MODES, CardMode, BULK_ACTIONS, BulkAction, CARD_MANUAL_STATUSES, CardManualStatus, DtoUpdateImageCard, IsBoolean (+11 more)

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
Cohesion: 0.08
Nodes (38): ordersApi, DispatchToExecutorModal(), PayoutInfo, Props, rub(), GreetingCopyButton(), GulianSyncBlock(), Props (+30 more)

### Community 153 - "items_list"
Cohesion: 0.43
Nodes (3): items_list(), Список позиций — по строке на позицию. Именно он отличает ответ на действие от…, TestItemsList

### Community 155 - "canvas.pricing.ts"
Cohesion: 0.22
Nodes (13): calcCanvasUnitPrice(), calcCanvasUrgencyFee(), CANVAS_FRAME_LABELS, CANVAS_MATERIAL_LABELS, CANVAS_SIZES, CanvasFrame, CanvasMaterial, CanvasSize (+5 more)

### Community 156 - "TelegramService"
Cohesion: 0.16
Nodes (9): buildPartnerButtons(), logger, proxyDispatcher(), resetTelegramProxyCache(), telegramFetch(), telegramFormData(), describeTelegramError(), TelegramService (+1 more)

### Community 159 - "DtoUpdateCanvasItem"
Cohesion: 0.22
Nodes (8): DtoUpdateCanvasItem, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, Type

### Community 162 - "DtoUpdateOrder"
Cohesion: 0.17
Nodes (11): DtoUpdateOrder, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Matches, MaxLength (+3 more)

### Community 163 - "ApprovalStorageService"
Cohesion: 0.14
Nodes (7): ApprovalRenderService, Injectable, CALIBRATION, ALLOWED_IMAGE, ApprovalStorageService, SavedImage, Injectable

### Community 165 - "partner-outbound.service.ts"
Cohesion: 0.18
Nodes (9): hasProductionItems(), NO_PRODUCTION_ITEMS_MESSAGE, OrderWithProductionItems, PartnerOutboundService, Injectable, getTechSpecPathAt(), getTechSpecPaths(), hasTechSpecFiles() (+1 more)

### Community 167 - ".createOrder"
Cohesion: 0.38
Nodes (7): buildCommunicationUrl(), buildMaxUrl(), DEFAULT_MAX_LINK_TEMPLATE, formatPhoneForDisplay(), normalizePhone(), validateCommunicationValue(), calcCanvasMoney()

### Community 168 - "StripPricesInterceptor"
Cohesion: 0.50
Nodes (3): strip(), StripPricesInterceptor, Injectable

### Community 169 - "DtoUpdatePartnerSettings"
Cohesion: 0.11
Nodes (13): DtoUpdatePartnerSettings, IsInt, IsOptional, IsString, Max, MaxLength, Min, PartnerSettingsController (+5 more)

### Community 170 - "PartnerApiController"
Cohesion: 0.32
Nodes (6): PartnerApiController, Controller, Get, Param, Res, UseGuards

### Community 173 - "TelegramUpdateService"
Cohesion: 0.12
Nodes (12): TelegramPollingService, TgUpdateWithId, Injectable, TelegramUpdateService, TgUpdate, Injectable, constantTimeEqual(), TelegramWebhookController (+4 more)

### Community 177 - "lead-notification.ts"
Cohesion: 0.33
Nodes (6): buildLeadNotification(), escape(), LeadForNotification, NotifiableUser, pickLeadResponders(), toMention()

### Community 184 - "DtoUpdateMockupTemplate"
Cohesion: 0.26
Nodes (11): DtoCreateMockupTemplate, DtoUpdateMockupTemplate, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Matches (+3 more)

### Community 193 - "client-greeting.service.ts"
Cohesion: 0.07
Nodes (33): clientNameFromNote(), GREETING_STATUSES, GreetingStatus, isGreetingStatus(), ClientGreetingService, PendingGreeting, Injectable, telegramUsernameFromUrl() (+25 more)

## Knowledge Gaps
- **820 isolated node(s):** `$schema`, `collection`, `sourceRoot`, `deleteOutDir`, `name` (+815 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **50 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Roles()` connect `Roles` to `tasks.controller.ts`, `DtoUpdateUser`, `SalaryController`, `scenario.controller.ts`, `ApprovalController`, `DtoCreateExpense`, `ozon-product-catalog.controller.ts`, `reports.service.ts`, `AvitoService`, `TechSpecStorageService`, `OzonPhotoStorageService`, `scenario.registry.ts`, `DtoUpdatePartnerSettings`, `ozon-orders.service.ts`, `order-photo.controller.ts`, `ImageCardBatchController`, `marketplace.module.ts`, `image-card-batch.controller.ts`, `MarketplaceController`, `MockupService`, `AvitoController`, `OzonCatalogController`, `OzonProductCatalogController`, `PartnerSettingsService`?**
  _High betweenness centrality (0.259) - this node is a cross-community bridge._
- **Why does `BatchView()` connect `Param` to `getErrorMessage`?**
  _High betweenness centrality (0.230) - this node is a cross-community bridge._
- **Why does `getErrorMessage()` connect `getErrorMessage` to `Param`, `ProductsTab.tsx`, `MarketplacePage.tsx`, `ozonProductCatalog.ts`, `AvitoPage.tsx`, `OrdersPage.tsx`, `ReportsPage.tsx`, `App.tsx`, `OrderDetail.tsx`, `CardEditorModal.tsx`, `ApprovalEditor.tsx`?**
  _High betweenness centrality (0.168) - this node is a cross-community bridge._
- **What connects `$schema`, `collection`, `sourceRoot` to the rest of the system?**
  _820 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `DtoCreateOzonPrint` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._
- **Should `tasks.controller.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06493506493506493 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._