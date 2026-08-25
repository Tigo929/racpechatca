# Graph Report - raspechatka  (2026-08-25)

## Corpus Check
- 442 files · ~235,144 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 3583 nodes · 7434 edges · 199 communities (148 shown, 51 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 314 edges (avg confidence: 0.79)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `652321de`
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
- OrdersPage.tsx
- Roles
- System Map
- DtoCreateExpense
- reports.service.ts
- OrderDetail.tsx
- daily-plan-rules.ts
- AvitoService
- Брендбук — Распечатка PRO
- CanvasItemService
- compilerOptions
- ImageCardBatchController
- compilerOptions
- Аудит проекта «Распечатка» — 2026-06-14
- AppShell.tsx
- dependencies
- ozon-bulk-stock.service.ts
- ozonProductCatalog.ts
- ApprovalEditor.tsx
- compilerOptions
- DtoCreateOrder
- partner-payload.ts
- app.module.ts
- review-reminder.service.ts
- PartnerAdminController
- devDependencies
- getErrorMessage
- DtoCreateLead
- marketplace.module.ts
- SalaryService
- Интеграция с исполнителем-партнёром (печать футболок)
- ozon-import.service.ts
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
- CatalogTab.tsx
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
- OzonCredentials
- @eslint/js
- telegram-update.service.ts
- ImageCardTemplateService
- ozon-attributes.ts
- @nestjs/cli
- image-card-batch.service.ts
- ozon-warehouse.service.ts
- ApprovalService
- tshirt-partner-telegram.service.ts
- supertest
- ImageCardStorageService
- MarketplaceController
- ts-node
- DtoUpdateMockupTemplate
- AvitoController
- .webhook
- Param
- crm-new/package.json
- ProductsTab.tsx
- @types/supertest
- MarketplaceAccountService
- image-card-processor.service.ts
- OzonProductCatalogController
- eslint-plugin-react-refresh
- TshirtPartnerTelegramService
- tailwindcss
- typescript-eslint
- vite
- DtoUpdatePartnerSettings
- TasksPage.tsx
- OzonBulkStockService
- @nestjs/core
- .list
- partner-api.controller.ts
- @nestjs/throttler
- passport
- pdf-lib
- scenario.controller.ts
- DtoOzonUpdateCardText
- DtoPublishOzonPrints
- ТЗ: семантика и структура страниц raspechatkaa.ru
- OzonImportService
- DtoUpdateOzonPrint
- @prisma/adapter-pg
- @prisma/client
- DtoOzonColorGroup
- ApprovalController
- scenario.mapping.ts
- approval.service.ts
- partner.module.ts
- PrismaService
- ozon-product-catalog.controller.ts
- DtoUpdateItemOrder
- Выкатка: репозиторий → сервер
- PartnerSettingsService
- DtoBulkStock
- 2. Что уже сделано (этап 2 — карточки товаров)
- DtoBulkCards
- site-lead-token.guard.ts
- nginx-routes.spec.ts
- DtoUpdateOzonCatalogTemplate
- scenario-draft.service.ts
- ТЗ: раздел «Печать на холсте» на raspechatkaa.ru
- canvas-production-price.ts
- auto-update.sh
- scenario.engine.ts
- CanvasItemsTable.tsx
- DtoUpdateTshirtItem
- @nestjs/config
- ScenarioController
- TechSpecStorageService
- canvas.pricing.ts
- task-reminder.service.spec.ts
- sharp
- undici
- @eslint/js
- DtoUpdateImageCard
- jest
- PartnerStatusPollService
- ApprovalStorageService
- scenario.module.ts
- class-transformer
- scenario.registry.ts
- UnitEconomicsPanel.tsx
- CanvasProductionController
- StripPricesInterceptor
- TelegramService
- archiver
- DtoUpdateOzonUnitEconomics
- DtoUpdateOrder
- bwip-js
- class-validator
- helmet
- lead-notification.ts
- @nestjs/jwt
- @nestjs/mapped-types
- @nestjs/platform-express
- OrderPhotoService
- passport-jwt
- @types/express
- @eslint/eslintrc
- globals
- prettier
- @types/jest
- @types/multer
- @nestjs/common
- @types/passport-jwt
- typescript
- @types/pdfkit
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
9. `TelegramService` - 29 edges
10. `OrderPhotoService` - 28 edges

## Surprising Connections (you probably didn't know these)
- `AccountCard()` --calls--> `getErrorMessage()`  [EXTRACTED]
  frontend/src/components/marketplace/ConnectionTab.tsx → frontend/src/utils/get-error-message.ts
- `AccountForm()` --calls--> `getErrorMessage()`  [EXTRACTED]
  frontend/src/components/marketplace/ConnectionTab.tsx → frontend/src/utils/get-error-message.ts
- `AddExpenseModal()` --calls--> `getErrorMessage()`  [EXTRACTED]
  frontend/src/pages/ReportsPage.tsx → frontend/src/utils/get-error-message.ts
- `ShipmentLeadCard()` --calls--> `getErrorMessage()`  [EXTRACTED]
  frontend/src/pages/SettingsPage.tsx → frontend/src/utils/get-error-message.ts
- `DailyPlanCard()` --calls--> `getErrorMessage()`  [EXTRACTED]
  frontend/src/pages/SettingsPage.tsx → frontend/src/utils/get-error-message.ts

## Import Cycles
- None detected.

## Communities (199 total, 51 thin omitted)

### Community 0 - "DtoCreateOzonPrint"
Cohesion: 0.09
Nodes (22): DtoCreateOzonPrint, ArrayMaxSize, ArrayMinSize, ArrayNotEmpty, IsArray, IsEnum, IsInt, IsOptional (+14 more)

### Community 1 - "tasks.controller.ts"
Cohesion: 0.07
Nodes (32): DtoCreateTask, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength (+24 more)

### Community 2 - "dependencies"
Cohesion: 0.22
Nodes (9): bcryptjs, dependencies, bcryptjs, reflect-metadata, roboto-fontface, rxjs, reflect-metadata, roboto-fontface (+1 more)

### Community 3 - "DtoUpdateUser"
Cohesion: 0.06
Nodes (28): DtoCreateUser, IsEnum, IsString, MinLength, DtoUpdateUser, IsBoolean, IsInt, IsOptional (+20 more)

### Community 4 - "sticker.service.ts"
Cohesion: 0.08
Nodes (25): StickerModule, Module, buildPhotoItemLines(), buildTshirtItemLines(), drawInstagramIcon(), drawTelegramIcon(), FONT_DIR, formatRub() (+17 more)

### Community 5 - "jest"
Cohesion: 0.12
Nodes (16): jest, collectCoverageFrom, coverageDirectory, moduleFileExtensions, moduleNameMapper, rootDir, testEnvironment, testRegex (+8 more)

### Community 6 - "DtoOzonArchive"
Cohesion: 0.27
Nodes (14): DtoOzonArchive, DtoOzonPriceItem, DtoOzonStockItem, DtoOzonUpdatePrices, DtoOzonUpdateStocks, ArrayNotEmpty, IsArray, IsBoolean (+6 more)

### Community 7 - "index.ts"
Cohesion: 0.07
Nodes (39): MySalaryBalance, Props, AvitoLinkedOrder, ClosedAccrualBrief, CreateCanvasItemDto, CreateItemDto, CreatePaymentByAccrualsDto, CreatePaymentDto (+31 more)

### Community 8 - "OrdersPage.tsx"
Cohesion: 0.05
Nodes (50): ordersApi, ProductsTab(), Props, ExecutorFilter(), Props, EditState, ItemsTable(), Props (+42 more)

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
Nodes (36): calcOrderProfit(), forecastSalary(), kopecksToRub(), OrderProfit, OrderProfitInput, SHEET, DECLARED_PRINTS_PER_SHEET, HALF_SHEET_WORDS (+28 more)

### Community 13 - "OrderDetail.tsx"
Cohesion: 0.07
Nodes (37): DispatchToExecutorModal(), PayoutInfo, Props, rub(), GulianSyncBlock(), Props, STATUS_LABELS, COMBINING_LOW_LINE (+29 more)

### Community 14 - "daily-plan-rules.ts"
Cohesion: 0.06
Nodes (55): buildDailyPlanMessage(), buildShipmentBlock(), dayMonth(), DELIVERY_LABEL, effectiveDeadline(), executorKey(), inWorkTail(), isWithinPlanWindow() (+47 more)

### Community 15 - "AvitoService"
Cohesion: 0.07
Nodes (17): AvitoMessengerService, Injectable, AvitoModule, Module, AvitoAccount, AvitoChat, AvitoChatUser, AvitoMessage (+9 more)

### Community 16 - "Брендбук — Распечатка PRO"
Cohesion: 0.08
Nodes (24): 1. Анализ конкурентов, 2. Психология цвета, 3. Цветовая палитра, 4. Типографика, 5. Логотип и иконка, 6. Правила применения, 7. Tone of Voice, 8. Применение на сайте (будущее) (+16 more)

### Community 17 - "CanvasItemService"
Cohesion: 0.17
Nodes (5): CanvasItemService, canvasMoney(), Injectable, ShipmentLeadService, Injectable

### Community 18 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, allowSyntheticDefaultImports, baseUrl, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, forceConsistentCasingInFileNames (+14 more)

### Community 19 - "ImageCardBatchController"
Cohesion: 0.09
Nodes (15): ImageCardBatchController, Body, Controller, Delete, Get, Param, Patch, Post (+7 more)

### Community 20 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection, moduleResolution (+14 more)

### Community 21 - "Аудит проекта «Распечатка» — 2026-06-14"
Cohesion: 0.09
Nodes (21): 10.1 Почему PDF «не формировался» и долго генерировался, 10.2 Декомпозиция API-слоя (был god-файл), 10.3 Группировка компонентов, 10.4 Автоматические бэкапы БД (рекомендация №1), 10.5 Итоговая структура фронта, 10.6 Деплой раунда 2, 10. Раунд 2 — PDF, декомпозиция API/компонентов, бэкапы (тот же день), 1. Резюме и метрики (+13 more)

### Community 22 - "AppShell.tsx"
Cohesion: 0.09
Nodes (21): salaryApi, MySalaryPage, AppShell(), NavProps, Props, AD_MGR, ADMIN, ALL (+13 more)

### Community 23 - "dependencies"
Cohesion: 0.10
Nodes (21): axios, dependencies, axios, @hookform/resolvers, lucide-react, react, react-dom, react-hook-form (+13 more)

### Community 24 - "ozon-bulk-stock.service.ts"
Cohesion: 0.10
Nodes (27): buildPairs(), BulkStockMode, BulkStockValidationError, checkQuantity(), chunkPairs(), LARGE_OPERATION_THRESHOLD, MAX_QUANTITY, MIN_PAIR_INTERVAL_MS (+19 more)

### Community 25 - "ozonProductCatalog.ts"
Cohesion: 0.07
Nodes (30): BulkStockHistoryRow, BulkStockInput, BulkStockItem, BulkStockMode, BulkStockOperation, BulkStockPreview, BulkStockWarehouseInput, COLOR_CODES (+22 more)

### Community 26 - "ApprovalEditor.tsx"
Cohesion: 0.09
Nodes (44): approvalsApi, mockupsApi, ApprovalEditor(), CmField(), downloadBlob(), Props, SIDE_LABELS, Sides (+36 more)

### Community 27 - "compilerOptions"
Cohesion: 0.10
Nodes (20): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+12 more)

### Community 28 - "DtoCreateOrder"
Cohesion: 0.08
Nodes (26): DtoCreateItemOrder, IsBoolean, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min (+18 more)

### Community 29 - "partner-payload.ts"
Cohesion: 0.19
Nodes (11): PartnerOutboundService, Injectable, buildPartnerOrderPayload(), PartnerOrderForPayload, PartnerOrderPayload, PRINT_LOCATION_LABELS, PRINT_TYPE_LABELS, getTechSpecPathAt() (+3 more)

### Community 30 - "app.module.ts"
Cohesion: 0.11
Nodes (21): AppModule, Module, ApprovalModule, Module, CanvasModule, Module, GulianModule, Module (+13 more)

### Community 31 - "review-reminder.service.ts"
Cohesion: 0.16
Nodes (12): isReviewReminderEligible(), REVIEW_REMINDER_CATEGORIES, REVIEW_REMINDER_DELAY_MS, REVIEW_REMINDER_PICKUP_DELAY_MS, REVIEW_REMINDER_STATUSES, reviewReminderDelayMs(), buildReviewRequestText(), categoryLabel() (+4 more)

### Community 32 - "PartnerAdminController"
Cohesion: 0.19
Nodes (9): PartnerAdminController, Controller, Get, Param, Post, Res, UploadedFiles, UseGuards (+1 more)

### Community 33 - "devDependencies"
Cohesion: 0.11
Nodes (19): eslint-plugin-react-hooks, devDependencies, eslint, eslint-plugin-react-hooks, globals, @tailwindcss/vite, @types/node, @types/react (+11 more)

### Community 34 - "getErrorMessage"
Cohesion: 0.06
Nodes (58): ozonBatchesApi, ozonCardsApi, CardBatchReport(), CardEditorModal(), CardFinalizePanel(), BatchList(), CardGeneratorTab(), MODE_LABELS (+50 more)

### Community 35 - "DtoCreateLead"
Cohesion: 0.06
Nodes (26): DtoCreateLead, base, meta, pipe, IsBoolean, IsEnum, IsIn, IsInt (+18 more)

### Community 36 - "marketplace.module.ts"
Cohesion: 0.07
Nodes (24): OzonCatalogController, Controller, UseGuards, OzonOrdersController, Controller, UseGuards, OzonCatalogService, Injectable (+16 more)

### Community 37 - "SalaryService"
Cohesion: 0.05
Nodes (33): DtoCreateBonus, IsInt, IsString, IsUUID, MaxLength, Min, MinLength, Type (+25 more)

### Community 38 - "Интеграция с исполнителем-партнёром (печать футболок)"
Cohesion: 0.12
Nodes (15): 1. Модель взаимодействия, 2. Аутентификация, 3. Webhook, который мы отправляем партнёру, 4.1 Данные заказа, 4.2 ТЗ-фото (макет), 4.3 Стикер (PDF, 58×40 мм), 4.4 Смена статуса заказа (партнёр → нам), 4. Эндпоинты, откуда партнёр забирает данные (pull) (+7 more)

### Community 39 - "ozon-import.service.ts"
Cohesion: 0.09
Nodes (19): DEFAULT_SIZE_DIMENSIONS, OzonCatalogTemplateService, Injectable, UpdateOzonCatalogTemplateInput, humanize(), OzonApiClient, OzonApiError, OzonErrorBody (+11 more)

### Community 40 - "CRM «Распечатка» — как всё устроено"
Cohesion: 0.11
Nodes (18): 10. Слабые места, 11. Что дальше, 1. Что это, 2. Из чего собрано, 3. Продукты и статусы, 4. Деньги, 5. Роли, 6. Сценарии оформления (+10 more)

### Community 41 - "SettingsPage.tsx"
Cohesion: 0.09
Nodes (29): partnerSettingsApi, shipmentLeadApi, usersApi, SettingsPage, UsersPage, MockupTemplatesCard(), DailyPlanCard(), Example() (+21 more)

### Community 42 - "auth.controller.ts"
Cohesion: 0.14
Nodes (14): AuthController, Body, Controller, Get, Post, Throttle, UseGuards, AuthModule (+6 more)

### Community 43 - "ozon-unit-economics.service.ts"
Cohesion: 0.13
Nodes (16): OzonProductTariffs, calculateUnitEconomics(), OzonTariffs, realSettings, settings, tariffs, UnitEconomicsLine, UnitEconomicsResult (+8 more)

### Community 44 - "image-card-placement.ts"
Cohesion: 0.09
Nodes (27): BULK_ACTIONS, BulkAction, describe(), ImageCardGenerationService, MODE_COLORS, Injectable, ASPECT_ALERT, clamp() (+19 more)

### Community 45 - "ozon-product-catalog.service.ts"
Cohesion: 0.09
Nodes (21): OzonActionView, OzonCatalogProduct, OzonContentRating, OzonDemand, OzonImportAttributeBody, OzonProductCard, RawActionsResponse, RawAnalyticsResponse (+13 more)

### Community 46 - "DtoAllOrdersforQuery"
Cohesion: 0.12
Nodes (13): DtoAllOrdersforQuery, IsEnum, IsIn, IsInt, IsOptional, IsString, Matches, Max (+5 more)

### Community 47 - "order-photo.service.ts"
Cohesion: 0.07
Nodes (35): buildCommunicationUrl(), buildMaxUrl(), DEFAULT_MAX_LINK_TEMPLATE, formatPhoneForDisplay(), normalizePhone(), validateCommunicationValue(), DtoAssignExecutor, IsOptional (+27 more)

### Community 48 - "salary-integrity.spec.ts"
Cohesion: 0.14
Nodes (13): AccrualByIdRow, AsyncMock, createOrderService(), CreatePaymentArgs, createPrismaStub(), HarnessAccrual, makeOrder(), PaymentByAccrualsHarness (+5 more)

### Community 49 - "ReportsPage.tsx"
Cohesion: 0.09
Nodes (33): api, expensesApi, reportsApi, ReportsPage, buildReceiptHtml(), buildReceiptTitle(), escapeHtml(), formatFilenameDate() (+25 more)

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
Cohesion: 0.11
Nodes (22): authApi, AdminRoute(), App(), AppRoutes(), CrmGate(), HomeRedirect(), LoginPage, MarketplaceRoute() (+14 more)

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
Nodes (31): DPI_ACCEPTABLE, DPI_GOOD, estimateDpi(), formatCm(), formatSizeCm(), isCalibrated(), isOutsidePrintArea(), PrintAreaCalibration (+23 more)

### Community 62 - "CatalogTab.tsx"
Cohesion: 0.17
Nodes (22): baseCodeOf(), colorCodeOf(), firstEditableWarehouse(), groupByColor(), OzonCatalogProduct, printCodeOf(), sizeOf(), sizeRank() (+14 more)

### Community 63 - "exclude"
Cohesion: 0.25
Nodes (7): exclude, extends, dist, node_modules, **/*spec.ts, test, ./tsconfig.json

### Community 64 - "Аудит финансов, кода и продакшена — 2026-07-09"
Cohesion: 0.29
Nodes (6): Аудит финансов, кода и продакшена — 2026-07-09, Кодовый аудит, Короткий вывод, Продакшен-аудит, Следующие улучшения, Финансовый аудит

### Community 65 - "devDependencies"
Cohesion: 0.09
Nodes (23): devDependencies, eslint, eslint-config-prettier, eslint-plugin-prettier, @nestjs/schematics, @nestjs/testing, prisma, source-map-support (+15 more)

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

### Community 70 - "GulianService"
Cohesion: 0.17
Nodes (7): GulianOutboxProcessorService, RETRY_DELAYS_SECONDS, Injectable, GulianOrderPayload, GulianResponse, GulianService, Injectable

### Community 71 - "seed.js"
Cohesion: 0.40
Nodes (3): bcrypt, { Client }, { randomUUID }

### Community 72 - "order-photo.controller.ts"
Cohesion: 0.06
Nodes (33): DtoCreateCanvasItem, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, Type (+25 more)

### Community 73 - "OzonPrintService"
Cohesion: 0.17
Nodes (10): buildOfferId(), colorCodeFor(), normalizeSlug(), slugify(), stripUnsafe(), ColorGroupInput, CreatePrintInput, OzonPrintService (+2 more)

### Community 74 - "React + TypeScript + Vite"
Cohesion: 0.50
Nodes (3): Expanding the ESLint configuration, React Compiler, React + TypeScript + Vite

### Community 76 - "shipment-reminder-rules.ts"
Cohesion: 0.16
Nodes (11): buildShipmentReminder(), DEADLINE_METHODS, dueReminderStage(), hasDeadline(), hoursLeft(), SHIPMENT_REMINDER_STAGES_MS, ShipmentOrder, START (+3 more)

### Community 79 - "OzonCredentials"
Cohesion: 0.15
Nodes (5): OzonCredentials, chunk(), OzonImportItem, OzonProductCatalogService, Injectable

### Community 81 - "telegram-update.service.ts"
Cohesion: 0.09
Nodes (20): GulianOutboxService, OrderForOutbox, Injectable, calcGulianPayout(), Item, PayoutResult, toGulianStatus(), buildPartnerButtons() (+12 more)

### Community 82 - "ImageCardTemplateService"
Cohesion: 0.07
Nodes (26): DtoCreateImageCardTemplate, DtoRect, DtoUpdateImageCardTemplate, IsBoolean, IsInt, IsObject, IsOptional, IsString (+18 more)

### Community 83 - "ozon-attributes.ts"
Cohesion: 0.12
Nodes (24): buildExtraImages(), buildImportItem(), CatalogTemplateForImport, COLOR_CODE_BY_LABEL, DEFAULT_SIZES, dictAttr(), dictListAttr(), dictListAttrFromLabels() (+16 more)

### Community 85 - "image-card-batch.service.ts"
Cohesion: 0.12
Nodes (20): CARD_MODES, CardMode, DtoCreateImageCardBatch, ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional (+12 more)

### Community 86 - "ozon-warehouse.service.ts"
Cohesion: 0.12
Nodes (16): editability(), isStale(), NOT_EDITABLE, RawWarehouse, sortForPicker(), toWarehouseStates(), WAREHOUSE_CACHE_TTL_MS, WarehouseState (+8 more)

### Community 87 - "ApprovalService"
Cohesion: 0.15
Nodes (10): ApprovalService, Injectable, ApprovalSides, clamp(), filledSides(), MAX_PRINT_MM, MIN_PRINT_MM, num() (+2 more)

### Community 88 - "tshirt-partner-telegram.service.ts"
Cohesion: 0.14
Nodes (18): escapeHtml(), EXT_CONTENT_TYPE, money(), PRINT_LOCATION_LABELS, PRINT_TYPE_LABELS, TechSpecAttachment, TshirtOrderWithItems, Db (+10 more)

### Community 90 - "ImageCardStorageService"
Cohesion: 0.15
Nodes (5): ImageCardProcessorService, parseSnapshot(), Injectable, ImageCardStorageService, Injectable

### Community 91 - "MarketplaceController"
Cohesion: 0.08
Nodes (22): DtoCreateMarketplaceAccount, IsEnum, IsString, MaxLength, MinLength, DtoUpdateMarketplaceAccount, IsBoolean, IsOptional (+14 more)

### Community 93 - "DtoUpdateMockupTemplate"
Cohesion: 0.09
Nodes (23): DtoCreateMockupTemplate, DtoUpdateMockupTemplate, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Matches (+15 more)

### Community 94 - "AvitoController"
Cohesion: 0.09
Nodes (20): AvitoController, Body, Controller, Get, Param, Post, Query, UseGuards (+12 more)

### Community 95 - ".webhook"
Cohesion: 0.24
Nodes (7): TgUpdate, constantTimeEqual(), TelegramWebhookController, Body, Controller, Post, Headers

### Community 96 - "Param"
Cohesion: 0.17
Nodes (7): Body, Delete, Get, Param, Patch, Post, Query

### Community 97 - "crm-new/package.json"
Cohesion: 0.29
Nodes (6): author, description, license, name, private, version

### Community 98 - "ProductsTab.tsx"
Cohesion: 0.10
Nodes (36): EnumTshirtGender, OzonColorGroupInput, OzonPrint, OzonVariant, Draft, EditPrintModal(), ALL_SIZES, COLOR_CODE_BY_LABEL (+28 more)

### Community 100 - "MarketplaceAccountService"
Cohesion: 0.12
Nodes (14): ACCOUNT_INCLUDE, AccountRow, CreateAccountInput, MarketplaceAccountService, MarketplaceAccountView, Injectable, UpdateAccountInput, OzonService (+6 more)

### Community 101 - "image-card-processor.service.ts"
Cohesion: 0.10
Nodes (15): CardTransform, Rect, CardTemplateSnapshot, FINAL_LONG_SIDE, ImageCardRenderService, PREVIEW_LONG_SIDE, RawImage, Injectable (+7 more)

### Community 102 - "OzonProductCatalogController"
Cohesion: 0.19
Nodes (9): OzonProductCatalogController, Body, Controller, Get, Param, Patch, Post, Query (+1 more)

### Community 104 - "TshirtPartnerTelegramService"
Cohesion: 0.26
Nodes (3): Injectable, TshirtPartnerTelegramService, TelegramSendResult

### Community 112 - "DtoUpdatePartnerSettings"
Cohesion: 0.12
Nodes (13): DtoUpdatePartnerSettings, IsInt, IsOptional, IsString, Max, MaxLength, Min, PartnerSettingsController (+5 more)

### Community 113 - "TasksPage.tsx"
Cohesion: 0.14
Nodes (18): tasksApi, TasksQuery, TasksPage, Modal(), Props, daysUntil(), DeadlineChip(), EMPTY_FORM (+10 more)

### Community 114 - "OzonBulkStockService"
Cohesion: 0.15
Nodes (5): OzonBulkStockProcessorService, Injectable, keyOf(), OzonBulkStockService, Injectable

### Community 116 - ".list"
Cohesion: 0.50
Nodes (3): Get, Param, Query

### Community 117 - "partner-api.controller.ts"
Cohesion: 0.16
Nodes (14): DtoPartnerStatus, IsString, Body, Patch, FLOW_RANK, FROM_PARTNER, fromPartnerStatus(), mapPartnerStage() (+6 more)

### Community 121 - "scenario.controller.ts"
Cohesion: 0.13
Nodes (14): DtoDetectProduct, IsString, MaxLength, DtoSaveDraft, IsObject, IsOptional, IsString, MaxLength (+6 more)

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

### Community 129 - "DtoOzonColorGroup"
Cohesion: 0.14
Nodes (13): DtoOzonColorGroup, ArrayMinSize, ArrayNotEmpty, IsArray, IsEnum, IsInt, IsOptional, IsString (+5 more)

### Community 130 - "ApprovalController"
Cohesion: 0.13
Nodes (16): ApprovalController, parseSide(), Body, Controller, Delete, Get, Param, Patch (+8 more)

### Community 131 - "scenario.mapping.ts"
Cohesion: 0.35
Nodes (12): PAPER_LABEL, photoToOrder(), tshirtToOrder(), bool(), date(), deliveryOf(), noteOf(), num() (+4 more)

### Community 132 - "approval.service.ts"
Cohesion: 0.12
Nodes (16): approvalInclude, SIZE_LABELS, ALLOWED_IMAGE, SavedImage, UploadedImage, DtoCreateApproval, IsEnum, IsOptional (+8 more)

### Community 133 - "partner.module.ts"
Cohesion: 0.16
Nodes (8): PartnerModule, Module, PartnerTokenGuard, Injectable, ALLOWED, EXT_CONTENT_TYPE, TECH_SPEC_MAX_BYTES, TECH_SPEC_MAX_FILES

### Community 134 - "PrismaService"
Cohesion: 0.08
Nodes (15): JwtPayload, JwtStrategy, Injectable, HealthController, Controller, Get, ELIGIBLE_ROLES, ShipmentLeadView (+7 more)

### Community 135 - "ozon-product-catalog.controller.ts"
Cohesion: 0.12
Nodes (19): SIDES, APPROVAL_MAX_BYTES, AuthenticatedRequest, AuthenticatedUser, ROLES_KEY, JwtAuthGuard, Injectable, RolesGuard (+11 more)

### Community 136 - "DtoUpdateItemOrder"
Cohesion: 0.09
Nodes (20): DtoUpdateItemOrder, IsBoolean, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min (+12 more)

### Community 137 - "Выкатка: репозиторий → сервер"
Cohesion: 0.29
Nodes (6): Выкатка: репозиторий → сервер, Как это устроено на сервере, Команды, Откат, Почему именно так, Чего в цепочке пока нет

### Community 138 - "PartnerSettingsService"
Cohesion: 0.20
Nodes (6): PartnerSettingsService, AnyMock, call(), items, JULY, Injectable

### Community 139 - "DtoBulkStock"
Cohesion: 0.15
Nodes (12): DtoBulkStock, DtoBulkStockWarehouse, ArrayMaxSize, ArrayNotEmpty, IsArray, IsIn, IsInt, IsString (+4 more)

### Community 140 - "2. Что уже сделано (этап 2 — карточки товаров)"
Cohesion: 0.10
Nodes (19): 1.1. Что показал живой кабинет (17.08.2026), 1. Что уже сделано (этап 1 — подключение), 2.1. Порядок работы с товаром в Ozon Seller API (справочно), 2.2. Заказы (этап 3, только чтение), 2.3. Мои товары и юнит-экономика (этап 4), 2. Что уже сделано (этап 2 — карточки товаров), 3. Дальше, API CRM (+11 more)

### Community 141 - "DtoBulkCards"
Cohesion: 0.33
Nodes (6): DtoBulkCards, ArrayMaxSize, ArrayNotEmpty, IsArray, IsIn, IsUUID

### Community 142 - "site-lead-token.guard.ts"
Cohesion: 0.33
Nodes (7): constantTimeEqual(), readBearerToken(), readHeader(), SignedRequest, SiteLeadTokenGuard, stripPrefix(), Injectable

### Community 143 - "nginx-routes.spec.ts"
Cohesion: 0.22
Nodes (4): FRONTEND, NGINX_CONF, SRC, VITE_CONF

### Community 144 - "DtoUpdateOzonCatalogTemplate"
Cohesion: 0.17
Nodes (11): DtoUpdateOzonCatalogTemplate, ArrayMaxSize, IsArray, IsBoolean, IsInt, IsObject, IsOptional, IsString (+3 more)

### Community 145 - "scenario-draft.service.ts"
Cohesion: 0.33
Nodes (6): DraftState, ScenarioDraftService, Injectable, findProduct(), Answers, ScenarioProgress

### Community 146 - "ТЗ: раздел «Печать на холсте» на raspechatkaa.ru"
Cohesion: 0.10
Nodes (19): Берём после сезона, Берём сразу, до сезона, Блок 0. Контекст и границы, Блок 10. Интеграция с CRM, Блок 11. Что НЕ делать, Блок 12. Технологическое преимущество, Блок 1. Информационная архитектура и URL, Блок 2. Хлебные крошки и связность (+11 more)

### Community 147 - "canvas-production-price.ts"
Cohesion: 0.25
Nodes (11): Get, CANVAS_MATERIAL_KIND_LABELS, CANVAS_PRODUCTION_PRICES, canvasContractorCost(), CanvasMaterialKind, CanvasPositionPricing, CanvasProductionPrice, canvasRetailPrice() (+3 more)

### Community 149 - "scenario.engine.ts"
Cohesion: 0.41
Nodes (10): detectProduct(), evaluateCondition(), evaluateScenario(), isFilled(), isStepRequired(), isStepVisible(), normalize(), pickRelevantAnswers() (+2 more)

### Community 150 - "CanvasItemsTable.tsx"
Cohesion: 0.26
Nodes (10): canvasProductionApi, CanvasProductionPricing, CanvasProductionSize, CanvasItemsTable(), EditState, EMPTY, money(), toDto() (+2 more)

### Community 151 - "DtoUpdateTshirtItem"
Cohesion: 0.22
Nodes (8): DtoUpdateTshirtItem, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min, Type

### Community 153 - "ScenarioController"
Cohesion: 0.20
Nodes (9): ScenarioController, Body, Controller, Get, Param, Patch, Post, UseGuards (+1 more)

### Community 155 - "canvas.pricing.ts"
Cohesion: 0.16
Nodes (16): CanvasPricingController, Controller, Get, calcCanvasUnitPrice(), calcCanvasUrgencyFee(), CANVAS_FRAME_LABELS, CANVAS_MATERIAL_LABELS, CANVAS_SIZES (+8 more)

### Community 156 - "task-reminder.service.spec.ts"
Cohesion: 0.25
Nodes (7): AsyncMock, AT_TEN, BEFORE_TEN, createStub(), LATE_NIGHT, setup(), Stub

### Community 160 - "DtoUpdateImageCard"
Cohesion: 0.25
Nodes (7): CARD_MANUAL_STATUSES, CardManualStatus, DtoUpdateImageCard, IsBoolean, IsIn, IsObject, IsOptional

### Community 163 - "ApprovalStorageService"
Cohesion: 0.14
Nodes (4): ApprovalStorageService, Injectable, MockupService, Injectable

### Community 164 - "scenario.module.ts"
Cohesion: 0.40
Nodes (4): ScenarioModule, Module, validateAllScenarios(), validateScenario()

### Community 166 - "scenario.registry.ts"
Cohesion: 0.18
Nodes (16): DELIVERY_STEPS, NOTE_STEP, OPTIONAL, PHOTO_SCENARIO, TSHIRT_SCENARIO, ProductDefinition, PRODUCTS, AnswerValue (+8 more)

### Community 167 - "UnitEconomicsPanel.tsx"
Cohesion: 0.60
Nodes (4): ProductEconomics, Line(), money(), UnitEconomicsPanel()

### Community 168 - "CanvasProductionController"
Cohesion: 0.50
Nodes (3): CanvasProductionController, Controller, UseGuards

### Community 169 - "StripPricesInterceptor"
Cohesion: 0.50
Nodes (3): strip(), StripPricesInterceptor, Injectable

### Community 170 - "TelegramService"
Cohesion: 0.11
Nodes (13): logger, proxyDispatcher(), resetTelegramProxyCache(), telegramFetch(), telegramFormData(), TelegramPollingService, TgUpdateWithId, Injectable (+5 more)

### Community 172 - "DtoUpdateOzonUnitEconomics"
Cohesion: 0.22
Nodes (8): DtoUpdateOzonUnitEconomics, IsIn, IsInt, IsOptional, Max, Min, Type, IsNumber

### Community 173 - "DtoUpdateOrder"
Cohesion: 0.17
Nodes (11): DtoUpdateOrder, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Matches, MaxLength (+3 more)

### Community 177 - "lead-notification.ts"
Cohesion: 0.36
Nodes (6): buildLeadNotification(), escape(), LeadForNotification, NotifiableUser, pickLeadResponders(), toMention()

### Community 181 - "OrderPhotoService"
Cohesion: 0.12
Nodes (10): FinancialClient, isExternalProductionCategory(), needsShipmentStatus(), OrderPhotoService, Injectable, calculateManagerSalarySnapshot(), calculateSalarySnapshot(), earnsStaffSalary() (+2 more)

## Knowledge Gaps
- **793 isolated node(s):** `$schema`, `collection`, `sourceRoot`, `deleteOutDir`, `name` (+788 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **51 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Roles()` connect `Roles` to `tasks.controller.ts`, `ApprovalController`, `DtoUpdateUser`, `ozon-product-catalog.controller.ts`, `DtoCreateExpense`, `reports.service.ts`, `ImageCardBatchController`, `ScenarioController`, `PartnerAdminController`, `marketplace.module.ts`, `SalaryService`, `CanvasProductionController`, `order-photo.controller.ts`, `ImageCardTemplateService`, `MarketplaceController`, `DtoUpdateMockupTemplate`, `AvitoController`, `OzonProductCatalogController`, `DtoUpdatePartnerSettings`, `scenario.controller.ts`?**
  _High betweenness centrality (0.260) - this node is a cross-community bridge._
- **Why does `BatchView()` connect `ApprovalController` to `getErrorMessage`?**
  _High betweenness centrality (0.241) - this node is a cross-community bridge._
- **Why does `getErrorMessage()` connect `getErrorMessage` to `ProductsTab.tsx`, `ApprovalController`, `MarketplacePage.tsx`, `ozonCatalog.ts`, `AvitoPage.tsx`, `OrdersPage.tsx`, `SettingsPage.tsx`, `OrderDetail.tsx`, `ReportsPage.tsx`, `TasksPage.tsx`, `App.tsx`, `ozonProductCatalog.ts`, `ApprovalEditor.tsx`, `CatalogTab.tsx`?**
  _High betweenness centrality (0.183) - this node is a cross-community bridge._
- **What connects `$schema`, `collection`, `sourceRoot` to the rest of the system?**
  _793 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `DtoCreateOzonPrint` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._
- **Should `tasks.controller.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06516290726817042 - nodes in this community are weakly interconnected._
- **Should `DtoUpdateUser` be split into smaller, more focused modules?**
  _Cohesion score 0.06387921022067364 - nodes in this community are weakly interconnected._