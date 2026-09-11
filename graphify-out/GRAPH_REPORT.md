# Graph Report - raspechatka  (2026-09-11)

## Corpus Check
- 494 files · ~262,075 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 3831 nodes · 7953 edges · 208 communities (156 shown, 52 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 328 edges (avg confidence: 0.79)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7e7ff86d`
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
- ozon-unit-economics.service.ts
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
- OzonCredentials
- app.module.ts
- review-reminder.service.ts
- TechSpecStorageService
- devDependencies
- get-error-message.ts
- DtoCreateLead
- ozon-photo.controller.ts
- SalaryService
- Интеграция с исполнителем-партнёром (печать футболок)
- scenario.registry.ts
- CRM «Распечатка» — как всё устроено
- PushService
- auth.controller.ts
- TasksPage.tsx
- image-card-generation.service.ts
- ozon-product-catalog.service.ts
- OrderPhotoService
- order-photo.service.ts
- salary-integrity.spec.ts
- ReportsPage.tsx
- CreateOrderForm.tsx
- Исправленные проблемы
- crm-new/README.md
- SettingsPage.tsx
- partner-payload.ts
- scripts
- frontend/package.json
- Architecture
- Architecture
- OzonApiClient
- package.json
- approval-render.service.ts
- task-reminder-rules.ts
- exclude
- Аудит финансов, кода и продакшена — 2026-07-09
- devDependencies
- CardEditorModal.tsx
- nest-cli.json
- getErrorMessage
- ozonProductCatalog.ts
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
- OzonImportService
- image-card-template.service.ts
- ozon-attributes.ts
- @nestjs/cli
- image-card-batch.service.ts
- ozon-warehouse.service.ts
- ApprovalService
- ProductsTab.tsx
- supertest
- ImageCardStorageService
- MarketplaceController
- ts-node
- MockupService
- avito.controller.ts
- TshirtPartnerTelegramService
- OzonCatalogController
- crm-new/package.json
- ImageCardBatchService
- @types/supertest
- tshirt-partner-telegram.service.ts
- PdfRasterService
- OzonProductCatalogController
- DtoUpdateOzonUnitEconomics
- task-reminder.service.spec.ts
- DtoUpdateItemOrder
- typescript-eslint
- vite
- AvitoPage.tsx
- render
- index.ts
- @nestjs/core
- OrdersTab.tsx
- partner-api.controller.ts
- telegram.module.ts
- passport
- pdf-lib
- DtoOzonUpdateCardText
- tg_greeter.py
- DtoUpdateMockupTemplate
- ТЗ: семантика и структура страниц raspechatkaa.ru
- TelegramService
- DtoUpdateOzonPrint
- @prisma/adapter-pg
- @prisma/client
- approval.service.ts
- Param
- describe
- scenario.controller.ts
- DailyPlanService
- canvas-item.service.ts
- marketplace.module.ts
- PrismaService
- Выкатка: репозиторий → сервер
- .updateStatusOrder
- DtoBulkStock
- 2. Что уже сделано (этап 2 — карточки товаров)
- parse_proxy
- salary.service.ts
- nginx-routes.spec.ts
- DtoUpdateOzonCatalogTemplate
- DtoAssignExecutor
- ТЗ: раздел «Печать на холсте» на raspechatkaa.ru
- DtoCreateBonus
- auto-update.sh
- Первое сообщение клиенту
- sign
- delivery_line
- OrderDetail.tsx
- items_list
- DtoCreatePaymentByAccruals
- canvas.pricing.ts
- webpush.ts
- ozon-default-warehouses.ts
- undici
- telegram-update.service.ts
- roboto-fontface
- jest
- DtoUpdateOrder
- ApprovalStorageService
- @nestjs/passport
- .createBonus
- PartnerApiController
- .createOrder
- order-photo.controller.ts
- DtoUpdatePartnerSettings
- ApprovalController
- my-balance.spec.ts
- @eslint/eslintrc
- salary.module.ts
- archiver
- bwip-js
- class-transformer
- lead-notification.ts
- class-validator
- helmet
- @nestjs/config
- globals
- passport-jwt
- @nestjs/jwt
- @nestjs/platform-express
- @nestjs/throttler
- prettier
- @types/web-push
- @types/multer
- DtoPublishOzonPrints
- @types/passport-jwt
- typescript
- eslint-plugin-react-refresh
- client-greeting.service.ts
- tsconfig-paths
- @types/express
- pdfkit
- pg
- uuid
- web-push
- @types/jest
- @types/pdfkit
- tailwindcss
- .list
- @eslint/js
- @nestjs/mapped-types
- @nestjs/common
- @eslint/js

## God Nodes (most connected - your core abstractions)
1. `PrismaService` - 105 edges
2. `Roles()` - 89 edges
3. `getErrorMessage()` - 68 edges
4. `CurrentUser` - 42 edges
5. `OzonCredentials` - 42 edges
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
- `AssignPanel()` --calls--> `getErrorMessage()`  [EXTRACTED]
  frontend/src/components/orders/OrderDetail.tsx → frontend/src/utils/get-error-message.ts
- `ReportsPage()` --calls--> `usePersistentState()`  [EXTRACTED]
  frontend/src/pages/ReportsPage.tsx → frontend/src/hooks/usePersistentState.ts

## Import Cycles
- None detected.

## Communities (208 total, 52 thin omitted)

### Community 0 - "DtoCreateOzonPrint"
Cohesion: 0.06
Nodes (35): DtoCreateOzonPrint, ArrayMaxSize, ArrayMinSize, ArrayNotEmpty, IsArray, IsEnum, IsInt, IsOptional (+27 more)

### Community 1 - "tasks.controller.ts"
Cohesion: 0.07
Nodes (32): DtoCreateTask, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength (+24 more)

### Community 2 - "dependencies"
Cohesion: 0.22
Nodes (9): bcryptjs, dependencies, bcryptjs, reflect-metadata, rxjs, sharp, reflect-metadata, rxjs (+1 more)

### Community 3 - "DtoUpdateUser"
Cohesion: 0.06
Nodes (28): DtoCreateUser, IsEnum, IsString, MinLength, DtoUpdateUser, IsBoolean, IsInt, IsOptional (+20 more)

### Community 4 - "sticker.service.ts"
Cohesion: 0.14
Nodes (17): line(), computePrepayment(), DEFAULT_PREPAY_RATE, Prepayment, buildPhotoItemLines(), buildTshirtItemLines(), drawInstagramIcon(), drawTelegramIcon() (+9 more)

### Community 5 - "jest"
Cohesion: 0.12
Nodes (16): jest, collectCoverageFrom, coverageDirectory, moduleFileExtensions, moduleNameMapper, rootDir, testEnvironment, testRegex (+8 more)

### Community 6 - "DtoOzonArchive"
Cohesion: 0.27
Nodes (14): DtoOzonArchive, DtoOzonPriceItem, DtoOzonStockItem, DtoOzonUpdatePrices, DtoOzonUpdateStocks, ArrayNotEmpty, IsArray, IsBoolean (+6 more)

### Community 7 - "App.tsx"
Cohesion: 0.13
Nodes (19): authApi, AdminRoute(), App(), AppRoutes(), CrmGate(), HomeRedirect(), LoginPage, MarketplaceRoute() (+11 more)

### Community 8 - "TshirtItemsTable.tsx"
Cohesion: 0.12
Nodes (15): Props, CLIENT_ITEM_PRINT_NAME, FREE_PRICE_HINT, EditState, EMPTY, EMPTY_FREE, FreeState, PositionMoney() (+7 more)

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
Nodes (39): OrdersPage, ExecutorFilter(), Props, StatusStepper(), DELIVERY_STYLES, DeliveryBadge(), Props, FilterChip() (+31 more)

### Community 14 - "daily-plan-rules.ts"
Cohesion: 0.12
Nodes (31): buildDailyPlanMessage(), buildShipmentBlock(), dayMonth(), DELIVERY_LABEL, effectiveDeadline(), executorKey(), inWorkTail(), moscowHm() (+23 more)

### Community 15 - "AvitoService"
Cohesion: 0.05
Nodes (32): AvitoController, Controller, Get, Param, Post, Query, UseGuards, AvitoMessengerService (+24 more)

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
Cohesion: 0.09
Nodes (20): AppShell(), NavProps, Props, AD_MGR, ADMIN, ALL, BadgeKey, MARKETPLACE (+12 more)

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
Cohesion: 0.11
Nodes (14): ACCOUNT_INCLUDE, AccountRow, CreateAccountInput, MarketplaceAccountService, MarketplaceAccountView, Injectable, UpdateAccountInput, OzonService (+6 more)

### Community 29 - "OzonCredentials"
Cohesion: 0.19
Nodes (3): OzonCredentials, OzonProductCatalogService, Injectable

### Community 30 - "app.module.ts"
Cohesion: 0.07
Nodes (31): AppModule, Module, ApprovalModule, Module, CanvasModule, Module, GulianModule, Module (+23 more)

### Community 31 - "review-reminder.service.ts"
Cohesion: 0.16
Nodes (12): isReviewReminderEligible(), REVIEW_REMINDER_CATEGORIES, REVIEW_REMINDER_DELAY_MS, REVIEW_REMINDER_PICKUP_DELAY_MS, REVIEW_REMINDER_STATUSES, reviewReminderDelayMs(), buildReviewRequestText(), categoryLabel() (+4 more)

### Community 32 - "TechSpecStorageService"
Cohesion: 0.14
Nodes (11): PartnerAdminController, Controller, Get, Param, Post, Res, UploadedFiles, UseGuards (+3 more)

### Community 33 - "devDependencies"
Cohesion: 0.11
Nodes (19): eslint-plugin-react-hooks, devDependencies, eslint, eslint-plugin-react-hooks, globals, @tailwindcss/vite, @types/node, @types/react (+11 more)

### Community 34 - "get-error-message.ts"
Cohesion: 0.08
Nodes (32): ozonBatchesApi, ozonCardsApi, CardBatchReport(), CardFinalizePanel(), BatchList(), CardGeneratorTab(), MODE_LABELS, SOURCE_STATUS (+24 more)

### Community 35 - "DtoCreateLead"
Cohesion: 0.09
Nodes (18): DtoCreateLead, base, meta, pipe, IsBoolean, IsEnum, IsIn, IsInt (+10 more)

### Community 36 - "ozon-photo.controller.ts"
Cohesion: 0.10
Nodes (16): ALLOWED_INPUT, OZON_PHOTO_MAX_BYTES, OZON_PHOTO_MAX_FILES, OzonPhotoStorageService, Injectable, OzonPhotoController, Controller, Get (+8 more)

### Community 37 - "SalaryService"
Cohesion: 0.15
Nodes (8): SalaryController, Controller, Delete, Get, Param, UseGuards, SalaryService, Injectable

### Community 38 - "Интеграция с исполнителем-партнёром (печать футболок)"
Cohesion: 0.12
Nodes (15): 1. Модель взаимодействия, 2. Аутентификация, 3. Webhook, который мы отправляем партнёру, 4.1 Данные заказа, 4.2 ТЗ-фото (макет), 4.3 Стикер (PDF, 58×40 мм), 4.4 Смена статуса заказа (партнёр → нам), 4. Эндпоинты, откуда партнёр забирает данные (pull) (+7 more)

### Community 39 - "scenario.registry.ts"
Cohesion: 0.08
Nodes (50): DELIVERY_STEPS, NOTE_STEP, OPTIONAL, PAPER_LABEL, photoToOrder(), PHOTO_SCENARIO, tshirtToOrder(), TSHIRT_SCENARIO (+42 more)

### Community 40 - "CRM «Распечатка» — как всё устроено"
Cohesion: 0.11
Nodes (18): 10. Слабые места, 11. Что дальше, 1. Что это, 2. Из чего собрано, 3. Продукты и статусы, 4. Деньги, 5. Роли, 6. Сценарии оформления (+10 more)

### Community 41 - "PushService"
Cohesion: 0.13
Nodes (10): PushController, Body, Controller, Get, Post, Res, UseGuards, BrowserSubscription (+2 more)

### Community 42 - "auth.controller.ts"
Cohesion: 0.13
Nodes (14): AuthController, Body, Controller, Get, Post, Throttle, UseGuards, AuthModule (+6 more)

### Community 43 - "TasksPage.tsx"
Cohesion: 0.13
Nodes (19): tasksApi, TasksQuery, TasksPage, ProductsTab(), read(), usePersistentState(), daysUntil(), DeadlineChip() (+11 more)

### Community 44 - "image-card-generation.service.ts"
Cohesion: 0.08
Nodes (24): CARD_MODES, CardMode, BULK_ACTIONS, BulkAction, DtoBulkCards, ArrayMaxSize, ArrayNotEmpty, IsArray (+16 more)

### Community 45 - "ozon-product-catalog.service.ts"
Cohesion: 0.09
Nodes (21): OzonActionView, OzonCatalogProduct, OzonContentRating, OzonDemand, OzonImportAttributeBody, OzonProductCard, RawActionsResponse, RawAnalyticsResponse (+13 more)

### Community 46 - "OrderPhotoService"
Cohesion: 0.10
Nodes (15): DtoAllOrdersforQuery, IsEnum, IsIn, IsInt, IsOptional, IsString, Matches, Max (+7 more)

### Community 47 - "order-photo.service.ts"
Cohesion: 0.09
Nodes (24): FREE_DELIVERY_FROM, leadDeliveryCost(), LeadMoneyError, LeadMoneyInput, LeadMoneyResult, MAX_POSITION_TOTAL, resolveLeadMoney(), buildLeadPosition() (+16 more)

### Community 48 - "salary-integrity.spec.ts"
Cohesion: 0.14
Nodes (13): AccrualByIdRow, AsyncMock, createOrderService(), CreatePaymentArgs, createPrismaStub(), HarnessAccrual, makeOrder(), PaymentByAccrualsHarness (+5 more)

### Community 49 - "ReportsPage.tsx"
Cohesion: 0.06
Nodes (49): expensesApi, reportsApi, MySalaryBalance, salaryApi, MySalaryPage, ReportsPage, SalaryPage, buildReceiptHtml() (+41 more)

### Community 50 - "CreateOrderForm.tsx"
Cohesion: 0.11
Nodes (24): baseSchema, canvasItemSchema, clearOrderDraft(), CreateOrderForm(), EMPTY_ORDER_FORM, FormValues, freeItemSchema, fullSchema (+16 more)

### Community 51 - "Исправленные проблемы"
Cohesion: 0.18
Nodes (10): CRITICAL, CRM Audit Report — 2026-06-14, HIGH, HIGH, LOW, MEDIUM, MEDIUM, Исправленные проблемы (+2 more)

### Community 52 - "crm-new/README.md"
Cohesion: 0.20
Nodes (9): Compile and run the project, Deployment, Description, License, Project setup, Resources, Run tests, Stay in touch (+1 more)

### Community 53 - "SettingsPage.tsx"
Cohesion: 0.09
Nodes (30): api, partnerSettingsApi, shipmentLeadApi, usersApi, SettingsPage, UsersPage, MockupTemplatesCard(), DailyPlanCard() (+22 more)

### Community 54 - "partner-payload.ts"
Cohesion: 0.13
Nodes (14): hasProductionItems(), NO_PRODUCTION_ITEMS_MESSAGE, OrderWithProductionItems, PartnerOutboundService, Injectable, buildPartnerOrderPayload(), PartnerOrderForPayload, PartnerOrderPayload (+6 more)

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

### Community 59 - "OzonApiClient"
Cohesion: 0.09
Nodes (22): humanize(), OzonApiClient, OzonApiError, OzonErrorBody, Injectable, GROUP_BY_STATUS, groupForStatus(), isShipmentOverdue() (+14 more)

### Community 60 - "package.json"
Cohesion: 0.25
Nodes (7): concurrently, devDependencies, concurrently, name, private, scripts, dev

### Community 61 - "approval-render.service.ts"
Cohesion: 0.11
Nodes (27): DPI_ACCEPTABLE, DPI_GOOD, estimateDpi(), formatCm(), formatSizeCm(), isCalibrated(), isOutsidePrintArea(), PrintAreaCalibration (+19 more)

### Community 62 - "task-reminder-rules.ts"
Cohesion: 0.21
Nodes (19): buildDigestMessage(), daysUntilDeadline(), deadlineMarker(), DIGEST_HOUR, DIGEST_LAST_HOUR, DigestGroup, DigestTask, formatDeadlineLabel() (+11 more)

### Community 63 - "exclude"
Cohesion: 0.25
Nodes (7): exclude, extends, dist, node_modules, **/*spec.ts, test, ./tsconfig.json

### Community 64 - "Аудит финансов, кода и продакшена — 2026-07-09"
Cohesion: 0.29
Nodes (6): Аудит финансов, кода и продакшена — 2026-07-09, Кодовый аудит, Короткий вывод, Продакшен-аудит, Следующие улучшения, Финансовый аудит

### Community 65 - "devDependencies"
Cohesion: 0.09
Nodes (23): devDependencies, eslint, eslint-config-prettier, eslint-plugin-prettier, @nestjs/schematics, @nestjs/testing, prisma, source-map-support (+15 more)

### Community 66 - "CardEditorModal.tsx"
Cohesion: 0.19
Nodes (18): CardEditorModal(), CORNERS, Props, StageRect, TransformStage(), CardRect, CardTransform, cardPlacementRect() (+10 more)

### Community 67 - "nest-cli.json"
Cohesion: 0.33
Nodes (5): collection, compilerOptions, deleteOutDir, $schema, sourceRoot

### Community 68 - "getErrorMessage"
Cohesion: 0.10
Nodes (28): CreateAccountDto, EnumMarketplace, MarketplaceAccount, marketplaceApi, OzonConnectionInfo, UpdateAccountDto, MarketplacePage, CardsSection() (+20 more)

### Community 69 - "ozonProductCatalog.ts"
Cohesion: 0.06
Nodes (58): baseCodeOf(), BulkStockHistoryRow, BulkStockInput, BulkStockItem, BulkStockMode, BulkStockOperation, BulkStockPreview, BulkStockWarehouseInput (+50 more)

### Community 70 - "GulianService"
Cohesion: 0.17
Nodes (7): GulianOutboxProcessorService, RETRY_DELAYS_SECONDS, Injectable, GulianOrderPayload, GulianResponse, GulianService, Injectable

### Community 71 - "seed.js"
Cohesion: 0.40
Nodes (3): bcrypt, { Client }, { randomUUID }

### Community 72 - "DtoCreateOrder"
Cohesion: 0.05
Nodes (42): DtoCreateCanvasItem, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, Type (+34 more)

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

### Community 81 - "OzonImportService"
Cohesion: 0.19
Nodes (4): OzonImportPollService, Injectable, OzonImportService, Injectable

### Community 82 - "image-card-template.service.ts"
Cohesion: 0.08
Nodes (27): DtoCreateImageCardTemplate, DtoRect, DtoUpdateImageCardTemplate, IsBoolean, IsInt, IsObject, IsOptional, IsString (+19 more)

### Community 83 - "ozon-attributes.ts"
Cohesion: 0.11
Nodes (25): buildExtraImages(), buildImportItem(), CatalogTemplateForImport, chunk(), COLOR_CODE_BY_LABEL, DEFAULT_SIZES, dictAttr(), dictListAttr() (+17 more)

### Community 85 - "image-card-batch.service.ts"
Cohesion: 0.12
Nodes (21): DtoCreateImageCardBatch, ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, IsUUID (+13 more)

### Community 86 - "ozon-warehouse.service.ts"
Cohesion: 0.12
Nodes (16): editability(), isStale(), NOT_EDITABLE, RawWarehouse, sortForPicker(), toWarehouseStates(), WAREHOUSE_CACHE_TTL_MS, WarehouseState (+8 more)

### Community 87 - "ApprovalService"
Cohesion: 0.11
Nodes (12): Body, Patch, ApprovalService, Injectable, ApprovalSides, clamp(), filledSides(), MAX_PRINT_MM (+4 more)

### Community 88 - "ProductsTab.tsx"
Cohesion: 0.06
Nodes (56): CreateOzonPrintDto, EnumOzonSyncStatus, EnumTshirtGender, OzonAttributeValueOption, ozonCatalogApi, OzonCatalogTemplate, OzonColorGroupInput, OzonPrint (+48 more)

### Community 90 - "ImageCardStorageService"
Cohesion: 0.10
Nodes (5): ImageCardProcessorService, parseSnapshot(), Injectable, ImageCardStorageService, Injectable

### Community 91 - "MarketplaceController"
Cohesion: 0.08
Nodes (22): DtoCreateMarketplaceAccount, IsEnum, IsString, MaxLength, MinLength, DtoUpdateMarketplaceAccount, IsBoolean, IsOptional (+14 more)

### Community 93 - "MockupService"
Cohesion: 0.11
Nodes (14): MockupController, Body, Controller, Delete, Get, Param, Patch, Post (+6 more)

### Community 94 - "avito.controller.ts"
Cohesion: 0.29
Nodes (5): Body, DtoSendAvitoMessage, IsString, MaxLength, MinLength

### Community 95 - "TshirtPartnerTelegramService"
Cohesion: 0.29
Nodes (3): Injectable, TshirtPartnerTelegramService, TelegramSendResult

### Community 96 - "OzonCatalogController"
Cohesion: 0.17
Nodes (11): OzonCatalogController, Body, Controller, Delete, Get, Param, Patch, Post (+3 more)

### Community 97 - "crm-new/package.json"
Cohesion: 0.29
Nodes (6): author, description, license, name, private, version

### Community 98 - "ImageCardBatchService"
Cohesion: 0.18
Nodes (3): ImageCardBatchService, summarize(), Injectable

### Community 100 - "tshirt-partner-telegram.service.ts"
Cohesion: 0.08
Nodes (33): CanvasProductionController, Controller, Get, UseGuards, escapeHtml(), EXT_CONTENT_TYPE, money(), PRINT_LOCATION_LABELS (+25 more)

### Community 101 - "PdfRasterService"
Cohesion: 0.21
Nodes (5): PdfRasterService, PdfRasterUnavailableError, RASTER_LONG_SIDE, run, Injectable

### Community 102 - "OzonProductCatalogController"
Cohesion: 0.19
Nodes (9): OzonProductCatalogController, Body, Controller, Get, Param, Patch, Post, Query (+1 more)

### Community 103 - "DtoUpdateOzonUnitEconomics"
Cohesion: 0.22
Nodes (8): DtoUpdateOzonUnitEconomics, IsIn, IsInt, IsOptional, Max, Min, Type, IsNumber

### Community 104 - "task-reminder.service.spec.ts"
Cohesion: 0.15
Nodes (9): AsyncMock, AT_TEN, BEFORE_TEN, createStub(), LATE_NIGHT, setup(), Stub, TaskReminderService (+1 more)

### Community 105 - "DtoUpdateItemOrder"
Cohesion: 0.17
Nodes (11): DtoUpdateItemOrder, IsBoolean, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min (+3 more)

### Community 112 - "AvitoPage.tsx"
Cohesion: 0.22
Nodes (11): avitoApi, AvitoChatQuery, AvitoPage, AvitoPage(), clientInitial(), messagePreview(), messageText(), timeLabel() (+3 more)

### Community 113 - "render"
Cohesion: 0.17
Nodes (9): greeting_for(), money(), Обращение целиком, а не только имя. У заявки имени может не быть — человек…, Сумма с пробелами между разрядами: 2 490, а не 2490. Ноль означает, что позиций…, Готовый текст сообщения. Неизвестные метки остаются как есть., render(), TestGreeting, TestMoney (+1 more)

### Community 114 - "index.ts"
Cohesion: 0.06
Nodes (46): canvasProductionApi, CanvasProductionPricing, CanvasProductionSize, CanvasItemsTable(), EditState, EMPTY, money(), Props (+38 more)

### Community 116 - "OrdersTab.tsx"
Cohesion: 0.23
Nodes (11): OzonOrder, OzonOrderGroup, OzonOrderItem, ozonOrdersApi, OzonOrdersPage, deadlineHint(), formatDateTime(), GROUPS (+3 more)

### Community 117 - "partner-api.controller.ts"
Cohesion: 0.09
Nodes (18): DtoPartnerStatus, IsString, Body, Patch, FLOW_RANK, FROM_PARTNER, fromPartnerStatus(), mapPartnerStage() (+10 more)

### Community 118 - "telegram.module.ts"
Cohesion: 0.14
Nodes (10): TelegramModule, Module, TelegramStickerController, Controller, Get, Param, Query, Res (+2 more)

### Community 121 - "DtoOzonUpdateCardText"
Cohesion: 0.33
Nodes (5): DtoOzonUpdateCardText, IsOptional, IsString, MaxLength, MinLength

### Community 122 - "tg_greeter.py"
Cohesion: 0.18
Nodes (11): Exception, Crm, Fatal, load_templates(), main(), Очередь и отметки. Ошибки сети не роняют процесс — просто ждём., Одно сообщение. Возвращает итог из закрытого списка, который знает CRM. Все…, Настройки неверны — работать нельзя, перезапуск не поможет. (+3 more)

### Community 123 - "DtoUpdateMockupTemplate"
Cohesion: 0.23
Nodes (12): UploadedImage, DtoCreateMockupTemplate, DtoUpdateMockupTemplate, IsBoolean, IsEnum, IsInt, IsOptional, IsString (+4 more)

### Community 124 - "ТЗ: семантика и структура страниц raspechatkaa.ru"
Cohesion: 0.07
Nodes (27): P10. Холст — `/interer/holst`, P1. Где распечатать фото в Москве — `/gde-raspechatat-foto-v-moskve`, P2. Цены — `/ceny`, P3. Размеры и форматы фото — `/formaty`, P4. Печать фото А4 — `/catalog/foto-a4`, P5. Печать фото на документы — `/dokumenty`, P6. Печать фото онлайн с доставкой — `/onlayn`, P7. Бумага и качество — `/bumaga` (+19 more)

### Community 125 - "TelegramService"
Cohesion: 0.08
Nodes (20): logger, proxyDispatcher(), resetTelegramProxyCache(), telegramFetch(), telegramFormData(), TelegramPollingService, TgUpdateWithId, Injectable (+12 more)

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

### Community 132 - "scenario.controller.ts"
Cohesion: 0.09
Nodes (22): DtoDetectProduct, IsString, MaxLength, DtoSaveDraft, IsObject, IsOptional, IsString, MaxLength (+14 more)

### Community 133 - "DailyPlanService"
Cohesion: 0.29
Nodes (3): isWithinPlanWindow(), DailyPlanService, Injectable

### Community 134 - "canvas-item.service.ts"
Cohesion: 0.11
Nodes (21): CANVAS_MATERIAL_KIND_LABELS, CANVAS_PRODUCTION_PRICES, canvasContractorCost(), CanvasMaterialKind, CanvasPositionPricing, CanvasProductionPrice, canvasRetailPrice(), canvasSizeLabel() (+13 more)

### Community 135 - "marketplace.module.ts"
Cohesion: 0.10
Nodes (25): SIDES, ALLOWED_IMAGE, APPROVAL_MAX_BYTES, SavedImage, AuthenticatedRequest, AuthenticatedUser, ROLES_KEY, JwtAuthGuard (+17 more)

### Community 136 - "PrismaService"
Cohesion: 0.05
Nodes (30): JwtPayload, JwtStrategy, Injectable, HealthController, Controller, Get, DtoUpdateTshirtItem, IsBoolean (+22 more)

### Community 137 - "Выкатка: репозиторий → сервер"
Cohesion: 0.29
Nodes (6): Выкатка: репозиторий → сервер, Как это устроено на сервере, Команды, Откат, Почему именно так, Чего в цепочке пока нет

### Community 138 - ".updateStatusOrder"
Cohesion: 0.25
Nodes (6): needsShipmentStatus(), calculateManagerSalarySnapshot(), calculateSalarySnapshot(), earnsStaffSalary(), ManagerSalarySnapshot, SalarySnapshot

### Community 139 - "DtoBulkStock"
Cohesion: 0.15
Nodes (12): DtoBulkStock, DtoBulkStockWarehouse, ArrayMaxSize, ArrayNotEmpty, IsArray, IsIn, IsInt, IsString (+4 more)

### Community 140 - "2. Что уже сделано (этап 2 — карточки товаров)"
Cohesion: 0.10
Nodes (19): 1.1. Что показал живой кабинет (17.08.2026), 1. Что уже сделано (этап 1 — подключение), 2.1. Порядок работы с товаром в Ozon Seller API (справочно), 2.2. Заказы (этап 3, только чтение), 2.3. Мои товары и юнит-экономика (этап 4), 2. Что уже сделано (этап 2 — карточки товаров), 3. Дальше, API CRM (+11 more)

### Community 141 - "parse_proxy"
Cohesion: 0.33
Nodes (3): parse_proxy(), Словарь для Telethon или None, если прокси не задан. Формат именно словаря…, TestParse

### Community 142 - "salary.service.ts"
Cohesion: 0.20
Nodes (7): DtoCreatePayment, IsInt, IsOptional, IsString, IsUUID, Min, Type

### Community 143 - "nginx-routes.spec.ts"
Cohesion: 0.22
Nodes (4): FRONTEND, NGINX_CONF, SRC, VITE_CONF

### Community 144 - "DtoUpdateOzonCatalogTemplate"
Cohesion: 0.17
Nodes (11): DtoUpdateOzonCatalogTemplate, ArrayMaxSize, IsArray, IsBoolean, IsInt, IsObject, IsOptional, IsString (+3 more)

### Community 145 - "DtoAssignExecutor"
Cohesion: 0.20
Nodes (7): DtoAssignExecutor, IsOptional, IsString, IsUUID, escapeHtml(), formatRuDate(), isExternalProductionCategory()

### Community 146 - "ТЗ: раздел «Печать на холсте» на raspechatkaa.ru"
Cohesion: 0.10
Nodes (19): Берём после сезона, Берём сразу, до сезона, Блок 0. Контекст и границы, Блок 10. Интеграция с CRM, Блок 11. Что НЕ делать, Блок 12. Технологическое преимущество, Блок 1. Информационная архитектура и URL, Блок 2. Хлебные крошки и связность (+11 more)

### Community 147 - "DtoCreateBonus"
Cohesion: 0.25
Nodes (8): DtoCreateBonus, IsInt, IsString, IsUUID, MaxLength, Min, MinLength, Type

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
Nodes (44): ordersApi, DispatchToExecutorModal(), PayoutInfo, Props, rub(), GreetingCopyButton(), GulianSyncBlock(), Props (+36 more)

### Community 153 - "items_list"
Cohesion: 0.43
Nodes (3): items_list(), Список позиций — по строке на позицию. Именно он отличает ответ на действие от…, TestItemsList

### Community 154 - "DtoCreatePaymentByAccruals"
Cohesion: 0.29
Nodes (6): DtoCreatePaymentByAccruals, ArrayMinSize, IsArray, IsOptional, IsString, IsUUID

### Community 155 - "canvas.pricing.ts"
Cohesion: 0.16
Nodes (16): CanvasPricingController, Controller, Get, calcCanvasUnitPrice(), calcCanvasUrgencyFee(), CANVAS_FRAME_LABELS, CANVAS_MATERIAL_LABELS, CANVAS_SIZES (+8 more)

### Community 156 - "webpush.ts"
Cohesion: 0.50
Nodes (5): pushApi, LeadNotifyBell(), enableWebPush(), pushSupported(), urlBase64ToUint8Array()

### Community 157 - "ozon-default-warehouses.ts"
Cohesion: 0.47
Nodes (3): resolveDefaultWarehouses(), WarehouseChoice, WarehouseState

### Community 159 - "telegram-update.service.ts"
Cohesion: 0.09
Nodes (20): GulianOutboxService, OrderForOutbox, Injectable, calcGulianPayout(), Item, PayoutResult, toGulianStatus(), buildPartnerButtons() (+12 more)

### Community 162 - "DtoUpdateOrder"
Cohesion: 0.17
Nodes (11): DtoUpdateOrder, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Matches, MaxLength (+3 more)

### Community 163 - "ApprovalStorageService"
Cohesion: 0.18
Nodes (5): ApprovalRenderService, layoutSlots(), Injectable, ApprovalStorageService, Injectable

### Community 166 - "PartnerApiController"
Cohesion: 0.32
Nodes (6): PartnerApiController, Controller, Get, Param, Res, UseGuards

### Community 167 - ".createOrder"
Cohesion: 0.38
Nodes (7): buildCommunicationUrl(), buildMaxUrl(), DEFAULT_MAX_LINK_TEMPLATE, formatPhoneForDisplay(), normalizePhone(), validateCommunicationValue(), calcCanvasMoney()

### Community 168 - "order-photo.controller.ts"
Cohesion: 0.14
Nodes (12): strip(), StripPricesInterceptor, Injectable, DtoSetReview, IsBoolean, DtoSetShipmentLead, IsOptional, IsString (+4 more)

### Community 169 - "DtoUpdatePartnerSettings"
Cohesion: 0.12
Nodes (13): DtoUpdatePartnerSettings, IsInt, IsOptional, IsString, Max, MaxLength, Min, PartnerSettingsController (+5 more)

### Community 170 - "ApprovalController"
Cohesion: 0.50
Nodes (3): ApprovalController, Controller, UseGuards

### Community 177 - "lead-notification.ts"
Cohesion: 0.33
Nodes (6): buildLeadNotification(), escape(), LeadForNotification, NotifiableUser, pickLeadResponders(), toMention()

### Community 189 - "DtoPublishOzonPrints"
Cohesion: 0.33
Nodes (5): DtoPublishOzonPrints, ArrayMinSize, ArrayNotEmpty, IsArray, IsUUID

### Community 193 - "client-greeting.service.ts"
Cohesion: 0.07
Nodes (33): clientNameFromNote(), GREETING_STATUSES, GreetingStatus, isGreetingStatus(), ClientGreetingService, PendingGreeting, Injectable, telegramUsernameFromUrl() (+25 more)

### Community 203 - ".list"
Cohesion: 0.50
Nodes (3): Get, Param, Query

## Knowledge Gaps
- **822 isolated node(s):** `$schema`, `collection`, `sourceRoot`, `deleteOutDir`, `name` (+817 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **52 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Roles()` connect `Roles` to `tasks.controller.ts`, `DtoUpdateUser`, `scenario.controller.ts`, `marketplace.module.ts`, `DtoCreateExpense`, `reports.service.ts`, `AvitoService`, `TechSpecStorageService`, `ozon-photo.controller.ts`, `SalaryService`, `order-photo.controller.ts`, `DtoUpdatePartnerSettings`, `ApprovalController`, `ImageCardBatchController`, `image-card-template.service.ts`, `MarketplaceController`, `MockupService`, `avito.controller.ts`, `OzonCatalogController`, `tshirt-partner-telegram.service.ts`, `OzonProductCatalogController`?**
  _High betweenness centrality (0.227) - this node is a cross-community bridge._
- **Why does `BatchView()` connect `Param` to `get-error-message.ts`, `getErrorMessage`?**
  _High betweenness centrality (0.160) - this node is a cross-community bridge._
- **Why does `PrismaService` connect `PrismaService` to `approval.service.ts`, `tasks.controller.ts`, `DtoUpdateUser`, `sticker.service.ts`, `DailyPlanService`, `canvas-item.service.ts`, `marketplace.module.ts`, `DtoCreateExpense`, `reports.service.ts`, `daily-plan-rules.ts`, `AvitoService`, `salary.service.ts`, `ozon-unit-economics.service.ts`, `ozon-bulk-stock.service.ts`, `image-card-placement.ts`, `MarketplaceAccountService`, `app.module.ts`, `telegram-update.service.ts`, `review-reminder.service.ts`, `ApprovalStorageService`, `SalaryService`, `PartnerApiController`, `scenario.registry.ts`, `PushService`, `auth.controller.ts`, `my-balance.spec.ts`, `image-card-generation.service.ts`, `order-photo.service.ts`, `salary-integrity.spec.ts`, `partner-payload.ts`, `OzonApiClient`, `task-reminder-rules.ts`, `client-greeting.service.ts`, `GulianService`, `OzonPrintService`, `shipment-reminder-rules.ts`, `ozon-import.service.ts`, `image-card-template.service.ts`, `image-card-batch.service.ts`, `ozon-warehouse.service.ts`, `ImageCardStorageService`, `MockupService`, `TshirtPartnerTelegramService`, `ImageCardBatchService`, `tshirt-partner-telegram.service.ts`, `PdfRasterService`, `task-reminder.service.spec.ts`, `partner-api.controller.ts`, `DtoUpdateMockupTemplate`, `TelegramService`?**
  _High betweenness centrality (0.126) - this node is a cross-community bridge._
- **What connects `$schema`, `collection`, `sourceRoot` to the rest of the system?**
  _822 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `DtoCreateOzonPrint` be split into smaller, more focused modules?**
  _Cohesion score 0.05832147937411095 - nodes in this community are weakly interconnected._
- **Should `tasks.controller.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06516290726817042 - nodes in this community are weakly interconnected._
- **Should `DtoUpdateUser` be split into smaller, more focused modules?**
  _Cohesion score 0.06387921022067364 - nodes in this community are weakly interconnected._