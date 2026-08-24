# Graph Report - racpechatca  (2026-08-24)

## Corpus Check
- 428 files · ~220,426 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 3450 nodes · 7109 edges · 201 communities (146 shown, 55 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 295 edges (avg confidence: 0.79)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `541e9bd7`
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
- AppShell.tsx
- dependencies
- sticker.service.ts
- TshirtItemsTable.tsx
- ApprovalEditor.tsx
- compilerOptions
- DtoCreateOrder
- partner-status.ts
- app.module.ts
- review-reminder.service.ts
- PartnerAdminController
- devDependencies
- getErrorMessage
- DtoCreateLead
- ozon-photo.controller.ts
- SalaryService
- Интеграция с исполнителем-партнёром (печать футболок)
- ozon-import.service.ts
- CRM «Распечатка» — как всё устроено
- partner-payload.ts
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
- approval/approval-geometry.ts
- ozonProductCatalog.ts
- exclude
- Аудит финансов, кода и продакшена — 2026-07-09
- devDependencies
- AvitoPage.tsx
- nest-cli.json
- MarketplacePage.tsx
- TemplateSettings.tsx
- GulianService
- seed.js
- order-photo.controller.ts
- scenario.registry.ts
- React + TypeScript + Vite
- backup-db.sh
- shipment-reminder-rules.ts
- ts-loader
- frontend/tsconfig.json
- OzonCredentials
- @eslint/js
- tshirt-partner-telegram.service.ts
- ImageCardTemplateService
- ozon-attributes.ts
- @nestjs/cli
- image-card-batch.service.ts
- ImageCardGenerationService
- ApprovalService
- PartnerSettingsService
- supertest
- ImageCardStorageService
- marketplace.controller.ts
- ts-node
- MockupService
- telegram.service.ts
- .webhook
- OzonCatalogController
- crm-new/package.json
- ProductsTab.tsx
- @types/supertest
- MarketplaceAccountService
- image-card-processor.service.ts
- .credentials
- eslint-plugin-react-refresh
- CardEditorModal.tsx
- tailwindcss
- typescript-eslint
- vite
- approval-render.service.ts
- partner-api.controller.ts
- TasksPage.tsx
- @nestjs/core
- @nestjs/jwt
- @nestjs/mapped-types
- @nestjs/throttler
- passport
- pdf-lib
- TechSpecStorageService
- @types/jest
- marketplace.module.ts
- ТЗ: семантика и структура страниц raspechatkaa.ru
- @types/pdfkit
- DtoUpdateOzonPrint
- @prisma/adapter-pg
- @prisma/client
- prisma.service.ts
- ApprovalController
- GulianOutboxService
- approval.service.ts
- scenario.module.ts
- PrismaService
- image-card-batch.controller.ts
- .assertOrderFinanciallyEditable
- Выкатка: репозиторий → сервер
- main.ts
- salary.service.ts
- 2. Что уже сделано (этап 2 — карточки товаров)
- DtoBulkCards
- lead.controller.ts
- nginx-routes.spec.ts
- DtoUpdateOzonCatalogTemplate
- OzonApiClient
- ТЗ: раздел «Печать на холсте» на raspechatkaa.ru
- canvas-production-price.ts
- auto-update.sh
- scenario.controller.ts
- CanvasItemsTable.tsx
- scenario-draft.service.ts
- @nestjs/config
- ScenarioController
- @nestjs/platform-express
- canvas.pricing.ts
- DtoCreatePayment
- sharp
- undici
- @eslint/js
- communication-url.ts
- jest
- scenario.mapping.ts
- ApprovalStorageService
- DtoCreateBonus
- class-transformer
- scenario.types.ts
- DtoUpdateItemOrder
- HealthController
- .createBonus
- TelegramService
- telegram-update.service.ts
- DtoUpdateOzonUnitEconomics
- DtoUpdateOrder
- DtoSaveDraft
- my-balance.spec.ts
- DtoUpdateTshirtItem
- lead-notification.ts
- salary.module.ts
- bcryptjs
- CanvasPricingController
- OrderPhotoService
- bwip-js
- class-validator
- @eslint/eslintrc
- globals
- prettier
- helmet
- @types/multer
- @nestjs/common
- @types/passport-jwt
- typescript
- LeadController
- @nestjs/passport
- tsconfig-paths
- passport-jwt
- pdfkit
- pg
- uuid
- web-push
- @types/express

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
- `Draft` --references--> `EnumTshirtSize`  [EXTRACTED]
  frontend/src/components/approval/ApprovalEditor.tsx → frontend/src/types/index.ts
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

## Communities (201 total, 55 thin omitted)

### Community 0 - "DtoCreateOzonPrint"
Cohesion: 0.06
Nodes (35): DtoCreateOzonPrint, ArrayMaxSize, ArrayMinSize, ArrayNotEmpty, IsArray, IsEnum, IsInt, IsOptional (+27 more)

### Community 1 - "tasks.controller.ts"
Cohesion: 0.06
Nodes (36): DtoCreateTask, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength (+28 more)

### Community 2 - "dependencies"
Cohesion: 0.22
Nodes (9): archiver, dependencies, archiver, reflect-metadata, roboto-fontface, rxjs, reflect-metadata, roboto-fontface (+1 more)

### Community 3 - "DtoUpdateUser"
Cohesion: 0.06
Nodes (28): DtoCreateUser, IsEnum, IsString, MinLength, DtoUpdateUser, IsBoolean, IsInt, IsOptional (+20 more)

### Community 4 - "telegram.module.ts"
Cohesion: 0.17
Nodes (8): TelegramStickerController, Controller, Get, Param, Query, Res, TelegramStickerLinkService, Injectable

### Community 5 - "jest"
Cohesion: 0.12
Nodes (16): jest, collectCoverageFrom, coverageDirectory, moduleFileExtensions, moduleNameMapper, rootDir, testEnvironment, testRegex (+8 more)

### Community 6 - "DtoOzonArchive"
Cohesion: 0.27
Nodes (14): DtoOzonArchive, DtoOzonPriceItem, DtoOzonStockItem, DtoOzonUpdatePrices, DtoOzonUpdateStocks, ArrayNotEmpty, IsArray, IsBoolean (+6 more)

### Community 7 - "index.ts"
Cohesion: 0.07
Nodes (39): authApi, api, partnerSettingsApi, shipmentLeadApi, AuthContext, AuthContextValue, AuthProvider(), AuthUser (+31 more)

### Community 8 - "OrdersPage.tsx"
Cohesion: 0.11
Nodes (26): ordersApi, ExecutorFilter(), Props, DELIVERY_STYLES, DeliveryBadge(), Props, FilterChip(), Props (+18 more)

### Community 9 - "Roles"
Cohesion: 0.14
Nodes (15): CurrentUser, Roles(), Body, OrderPhotoController, Body, Controller, Delete, Get (+7 more)

### Community 10 - "System Map"
Cohesion: 0.06
Nodes (34): 2026-07-08, 2026-07-09, 2026-07-11, 2026-08-24, 2026-08-24 (later), Access Rules, App Modules, Assignment Rules (+26 more)

### Community 11 - "DtoCreateExpense"
Cohesion: 0.08
Nodes (20): DtoCreateExpense, IsEnum, IsInt, IsOptional, IsString, Min, ExpensesController, Body (+12 more)

### Community 12 - "reports.service.ts"
Cohesion: 0.06
Nodes (44): calcOrderProfit(), forecastSalary(), kopecksToRub(), OrderProfit, OrderProfitInput, SHEET, DECLARED_PRINTS_PER_SHEET, HALF_SHEET_WORDS (+36 more)

### Community 13 - "OrderDetail.tsx"
Cohesion: 0.07
Nodes (37): DispatchToExecutorModal(), PayoutInfo, Props, rub(), GulianSyncBlock(), Props, STATUS_LABELS, COMBINING_LOW_LINE (+29 more)

### Community 14 - "daily-plan-rules.ts"
Cohesion: 0.05
Nodes (65): buildDailyPlanMessage(), buildShipmentBlock(), dayMonth(), DELIVERY_LABEL, effectiveDeadline(), executorKey(), inWorkTail(), isWithinPlanWindow() (+57 more)

### Community 15 - "AvitoService"
Cohesion: 0.05
Nodes (32): AvitoController, Controller, Get, Param, Post, Query, UseGuards, AvitoMessengerService (+24 more)

### Community 16 - "Брендбук — Распечатка PRO"
Cohesion: 0.08
Nodes (24): 1. Анализ конкурентов, 2. Психология цвета, 3. Цветовая палитра, 4. Типографика, 5. Логотип и иконка, 6. Правила применения, 7. Tone of Voice, 8. Применение на сайте (будущее) (+16 more)

### Community 17 - "DtoUpdateCanvasItem"
Cohesion: 0.14
Nodes (11): CanvasItemService, canvasMoney(), Injectable, DtoUpdateCanvasItem, IsIn, IsInt, IsOptional, IsString (+3 more)

### Community 18 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, allowSyntheticDefaultImports, baseUrl, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, forceConsistentCasingInFileNames (+14 more)

### Community 19 - "ImageCardBatchController"
Cohesion: 0.10
Nodes (13): ImageCardBatchController, Controller, Delete, Get, Param, Patch, Res, UploadedFile (+5 more)

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

### Community 24 - "sticker.service.ts"
Cohesion: 0.15
Nodes (13): buildPhotoItemLines(), buildTshirtItemLines(), drawInstagramIcon(), drawTelegramIcon(), FONT_DIR, formatRub(), PRINT_LOCATION_LABELS, req (+5 more)

### Community 25 - "TshirtItemsTable.tsx"
Cohesion: 0.10
Nodes (18): ProductsTab(), EditState, EMPTY, EMPTY_FREE, FreeState, PositionMoney(), TshirtItemsTable(), PRINT_LOCATION_LABELS (+10 more)

### Community 26 - "ApprovalEditor.tsx"
Cohesion: 0.08
Nodes (50): approvalsApi, mockupsApi, ApprovalEditor(), CmField(), downloadBlob(), Draft, Props, SIDE_LABELS (+42 more)

### Community 27 - "compilerOptions"
Cohesion: 0.10
Nodes (20): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+12 more)

### Community 28 - "DtoCreateOrder"
Cohesion: 0.08
Nodes (26): DtoCreateItemOrder, IsBoolean, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min (+18 more)

### Community 29 - "partner-status.ts"
Cohesion: 0.16
Nodes (10): FLOW_RANK, FROM_PARTNER, mapPartnerStage(), PARTNER_SETTABLE_STATUSES, PARTNER_STAGE_MAP, PartnerStatusPollService, Injectable, shouldAdvanceTo() (+2 more)

### Community 30 - "app.module.ts"
Cohesion: 0.13
Nodes (18): ApprovalModule, Module, CanvasModule, Module, GulianModule, Module, ImageCardsModule, Module (+10 more)

### Community 31 - "review-reminder.service.ts"
Cohesion: 0.24
Nodes (10): isReviewReminderEligible(), REVIEW_REMINDER_CATEGORIES, REVIEW_REMINDER_DELAY_MS, REVIEW_REMINDER_PICKUP_DELAY_MS, REVIEW_REMINDER_STATUSES, reviewReminderDelayMs(), buildReviewRequestText(), categoryLabel() (+2 more)

### Community 32 - "PartnerAdminController"
Cohesion: 0.19
Nodes (9): PartnerAdminController, Controller, Get, Param, Post, Res, UploadedFiles, UseGuards (+1 more)

### Community 33 - "devDependencies"
Cohesion: 0.11
Nodes (19): eslint-plugin-react-hooks, devDependencies, eslint, eslint-plugin-react-hooks, globals, @tailwindcss/vite, @types/node, @types/react (+11 more)

### Community 34 - "getErrorMessage"
Cohesion: 0.07
Nodes (45): ozonBatchesApi, ozonCardsApi, CardBatchReport(), CardFinalizePanel(), BatchList(), CardGeneratorTab(), MODE_LABELS, SOURCE_STATUS (+37 more)

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

### Community 39 - "ozon-import.service.ts"
Cohesion: 0.07
Nodes (19): DEFAULT_SIZE_DIMENSIONS, OzonCatalogTemplateService, Injectable, UpdateOzonCatalogTemplateInput, OzonImportPollService, Injectable, OzonImportService, Injectable (+11 more)

### Community 40 - "CRM «Распечатка» — как всё устроено"
Cohesion: 0.11
Nodes (18): 10. Слабые места, 11. Что дальше, 1. Что это, 2. Из чего собрано, 3. Продукты и статусы, 4. Деньги, 5. Роли, 6. Сценарии оформления (+10 more)

### Community 41 - "partner-payload.ts"
Cohesion: 0.19
Nodes (11): PartnerOutboundService, Injectable, buildPartnerOrderPayload(), PartnerOrderForPayload, PartnerOrderPayload, PRINT_LOCATION_LABELS, PRINT_TYPE_LABELS, getTechSpecPathAt() (+3 more)

### Community 42 - "auth.controller.ts"
Cohesion: 0.10
Nodes (17): AuthController, Body, Controller, Get, Post, Throttle, UseGuards, AuthModule (+9 more)

### Community 43 - "ozon-unit-economics.service.ts"
Cohesion: 0.14
Nodes (16): OzonProductTariffs, calculateUnitEconomics(), OzonTariffs, realSettings, settings, tariffs, UnitEconomicsLine, UnitEconomicsResult (+8 more)

### Community 44 - "image-card-placement.ts"
Cohesion: 0.11
Nodes (27): MODE_COLORS, ASPECT_ALERT, CardTransform, clamp(), containFit(), DEFAULT_FILL, DEFAULT_TRANSFORM, isOutside() (+19 more)

### Community 45 - "ozon-product-catalog.service.ts"
Cohesion: 0.09
Nodes (21): OzonActionView, OzonCatalogProduct, OzonContentRating, OzonDemand, OzonImportAttributeBody, OzonProductCard, RawActionsResponse, RawAnalyticsResponse (+13 more)

### Community 46 - "DtoAllOrdersforQuery"
Cohesion: 0.12
Nodes (13): DtoAllOrdersforQuery, IsEnum, IsIn, IsInt, IsOptional, IsString, Matches, Max (+5 more)

### Community 47 - "order-photo.service.ts"
Cohesion: 0.06
Nodes (32): DtoAssignExecutor, IsOptional, IsString, IsUUID, IsEnum, UpdateStatus, LeadMoneyError, LeadMoneyInput (+24 more)

### Community 48 - "salary-integrity.spec.ts"
Cohesion: 0.14
Nodes (13): AccrualByIdRow, AsyncMock, createOrderService(), CreatePaymentArgs, createPrismaStub(), HarnessAccrual, makeOrder(), PaymentByAccrualsHarness (+5 more)

### Community 49 - "ReportsPage.tsx"
Cohesion: 0.06
Nodes (47): expensesApi, reportsApi, MySalaryBalance, salaryApi, MySalaryPage, ReportsPage, SalaryPage, buildReceiptHtml() (+39 more)

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
Cohesion: 0.10
Nodes (29): usersApi, AdminRoute(), App(), AppRoutes(), CrmGate(), HomeRedirect(), LoginPage, MarketplaceRoute() (+21 more)

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

### Community 61 - "approval/approval-geometry.ts"
Cohesion: 0.11
Nodes (23): DPI_ACCEPTABLE, DPI_GOOD, estimateDpi(), formatCm(), formatSizeCm(), isCalibrated(), isOutsidePrintArea(), PrintAreaCalibration (+15 more)

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

### Community 69 - "TemplateSettings.tsx"
Cohesion: 0.18
Nodes (13): OzonAttributeValueOption, ozonCatalogApi, OzonCatalogTemplate, AttributeAutocomplete(), Props, PhotoUpload(), Props, ATTR (+5 more)

### Community 70 - "GulianService"
Cohesion: 0.17
Nodes (7): GulianOutboxProcessorService, RETRY_DELAYS_SECONDS, Injectable, GulianOrderPayload, GulianResponse, GulianService, Injectable

### Community 71 - "seed.js"
Cohesion: 0.40
Nodes (3): bcrypt, { Client }, { randomUUID }

### Community 72 - "order-photo.controller.ts"
Cohesion: 0.08
Nodes (24): DtoCreateCanvasItem, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, Type (+16 more)

### Community 73 - "scenario.registry.ts"
Cohesion: 0.29
Nodes (10): DELIVERY_STEPS, NOTE_STEP, OPTIONAL, PHOTO_SCENARIO, TSHIRT_SCENARIO, ScenarioOrderMapping, ProductDefinition, PRODUCTS (+2 more)

### Community 74 - "React + TypeScript + Vite"
Cohesion: 0.50
Nodes (3): Expanding the ESLint configuration, React Compiler, React + TypeScript + Vite

### Community 76 - "shipment-reminder-rules.ts"
Cohesion: 0.16
Nodes (11): buildShipmentReminder(), DEADLINE_METHODS, dueReminderStage(), hasDeadline(), hoursLeft(), SHIPMENT_REMINDER_STAGES_MS, ShipmentOrder, START (+3 more)

### Community 79 - "OzonCredentials"
Cohesion: 0.20
Nodes (3): OzonCredentials, OzonProductCatalogService, Injectable

### Community 81 - "tshirt-partner-telegram.service.ts"
Cohesion: 0.10
Nodes (20): buildPartnerButtons(), buildPartnerCaption(), calcSettlement(), esc(), PartnerOrderData, PartnerOrderItem, PRINT_LOCATION_LABELS, PRINT_TYPE_LABELS (+12 more)

### Community 82 - "ImageCardTemplateService"
Cohesion: 0.10
Nodes (14): ImageCardTemplateController, Body, Controller, Delete, Get, Param, Patch, Post (+6 more)

### Community 83 - "ozon-attributes.ts"
Cohesion: 0.09
Nodes (32): buildExtraImages(), buildImportItem(), buildOfferId(), CatalogTemplateForImport, COLOR_CODE_BY_LABEL, colorCodeFor(), DEFAULT_SIZES, dictAttr() (+24 more)

### Community 85 - "image-card-batch.service.ts"
Cohesion: 0.11
Nodes (23): CARD_MODES, CardMode, DtoCreateImageCardBatch, ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional (+15 more)

### Community 86 - "ImageCardGenerationService"
Cohesion: 0.11
Nodes (13): CARD_MANUAL_STATUSES, CardManualStatus, DtoUpdateImageCard, IsBoolean, IsIn, IsObject, IsOptional, Body (+5 more)

### Community 87 - "ApprovalService"
Cohesion: 0.22
Nodes (5): ApprovalService, Injectable, ApprovalSides, filledSides(), parseSides()

### Community 88 - "PartnerSettingsService"
Cohesion: 0.07
Nodes (24): CanvasProductionController, Controller, UseGuards, DtoUpdatePartnerSettings, IsInt, IsOptional, IsString, Max (+16 more)

### Community 90 - "ImageCardStorageService"
Cohesion: 0.14
Nodes (5): ImageCardProcessorService, parseSnapshot(), Injectable, ImageCardStorageService, Injectable

### Community 91 - "marketplace.controller.ts"
Cohesion: 0.08
Nodes (22): DtoCreateMarketplaceAccount, IsEnum, IsString, MaxLength, MinLength, DtoUpdateMarketplaceAccount, IsBoolean, IsOptional (+14 more)

### Community 93 - "MockupService"
Cohesion: 0.07
Nodes (26): UploadedImage, DtoCreateMockupTemplate, DtoUpdateMockupTemplate, IsBoolean, IsEnum, IsInt, IsOptional, IsString (+18 more)

### Community 94 - "telegram.service.ts"
Cohesion: 0.13
Nodes (10): logger, proxyDispatcher(), resetTelegramProxyCache(), telegramFetch(), telegramFormData(), TelegramPollingService, TgUpdateWithId, Injectable (+2 more)

### Community 95 - ".webhook"
Cohesion: 0.24
Nodes (7): TgUpdate, constantTimeEqual(), TelegramWebhookController, Body, Controller, Post, Headers

### Community 96 - "OzonCatalogController"
Cohesion: 0.12
Nodes (12): OzonCatalogController, Body, Controller, Delete, Get, Param, Patch, Post (+4 more)

### Community 97 - "crm-new/package.json"
Cohesion: 0.29
Nodes (6): author, description, license, name, private, version

### Community 98 - "ProductsTab.tsx"
Cohesion: 0.08
Nodes (42): CreateOzonPrintDto, EnumOzonSyncStatus, EnumTshirtGender, OzonColorGroupInput, OzonPrint, OzonVariant, PublishResult, SizeDimensions (+34 more)

### Community 100 - "MarketplaceAccountService"
Cohesion: 0.11
Nodes (14): ACCOUNT_INCLUDE, AccountRow, CreateAccountInput, MarketplaceAccountService, MarketplaceAccountView, Injectable, UpdateAccountInput, OzonService (+6 more)

### Community 101 - "image-card-processor.service.ts"
Cohesion: 0.13
Nodes (11): MarketplaceImagePreset, OZON_MAIN_IMAGE_PRESET, good, validateAgainstPreset(), ValidationInput, ValidationResult, PdfRasterService, PdfRasterUnavailableError (+3 more)

### Community 102 - ".credentials"
Cohesion: 0.17
Nodes (12): Get, Param, Query, OzonProductCatalogController, Body, Controller, Get, Param (+4 more)

### Community 104 - "CardEditorModal.tsx"
Cohesion: 0.19
Nodes (18): CardEditorModal(), CORNERS, Props, StageRect, TransformStage(), CardRect, CardTransform, cardPlacementRect() (+10 more)

### Community 112 - "approval-render.service.ts"
Cohesion: 0.16
Nodes (13): ApprovalRenderService, escapeXml(), formatDate(), layoutSlots(), line(), Placement, RenderSheetInput, scaleCalibration() (+5 more)

### Community 113 - "partner-api.controller.ts"
Cohesion: 0.18
Nodes (8): DtoPartnerStatus, IsString, Body, Patch, fromPartnerStatus(), toPartnerStatus(), PartnerTokenGuard, Injectable

### Community 114 - "TasksPage.tsx"
Cohesion: 0.16
Nodes (16): tasksApi, TasksQuery, TasksPage, daysUntil(), DeadlineChip(), EMPTY_FORM, FILTERS, FormState (+8 more)

### Community 123 - "marketplace.module.ts"
Cohesion: 0.11
Nodes (16): DtoPublishOzonPrints, ArrayMinSize, ArrayNotEmpty, IsArray, IsUUID, DtoOzonUpdateCardText, IsOptional, IsString (+8 more)

### Community 124 - "ТЗ: семантика и структура страниц raspechatkaa.ru"
Cohesion: 0.07
Nodes (27): P10. Холст — `/interer/holst`, P1. Где распечатать фото в Москве — `/gde-raspechatat-foto-v-moskve`, P2. Цены — `/ceny`, P3. Размеры и форматы фото — `/formaty`, P4. Печать фото А4 — `/catalog/foto-a4`, P5. Печать фото на документы — `/dokumenty`, P6. Печать фото онлайн с доставкой — `/onlayn`, P7. Бумага и качество — `/bumaga` (+19 more)

### Community 126 - "DtoUpdateOzonPrint"
Cohesion: 0.17
Nodes (11): DtoUpdateOzonPrint, ArrayMaxSize, IsArray, IsEnum, IsInt, IsOptional, IsString, IsUrl (+3 more)

### Community 129 - "prisma.service.ts"
Cohesion: 0.18
Nodes (12): DtoCreateImageCardTemplate, DtoRect, DtoUpdateImageCardTemplate, IsBoolean, IsInt, IsObject, IsOptional, IsString (+4 more)

### Community 130 - "ApprovalController"
Cohesion: 0.13
Nodes (16): ApprovalController, parseSide(), Body, Controller, Delete, Get, Param, Patch (+8 more)

### Community 132 - "approval.service.ts"
Cohesion: 0.14
Nodes (13): approvalInclude, SIZE_LABELS, DtoCreateApproval, IsEnum, IsOptional, IsString, IsUUID, DtoUpdateApproval (+5 more)

### Community 133 - "scenario.module.ts"
Cohesion: 0.24
Nodes (7): PrismaModule, Module, ScenarioModule, Module, validateAllScenarios(), validateScenario(), Global

### Community 134 - "PrismaService"
Cohesion: 0.09
Nodes (10): OrderFinancialIntegrityService, Injectable, ReviewReminderService, Injectable, ELIGIBLE_ROLES, ShipmentLeadService, ShipmentLeadView, Injectable (+2 more)

### Community 135 - "image-card-batch.controller.ts"
Cohesion: 0.09
Nodes (26): SIDES, ALLOWED_IMAGE, APPROVAL_MAX_BYTES, SavedImage, AuthenticatedRequest, AuthenticatedUser, ROLES_KEY, JwtAuthGuard (+18 more)

### Community 136 - ".assertOrderFinanciallyEditable"
Cohesion: 0.20
Nodes (7): OrderItemService, Injectable, calcItemPricePosition(), calcOrderTotal(), PricedItem, Injectable, TshirtItemService

### Community 137 - "Выкатка: репозиторий → сервер"
Cohesion: 0.29
Nodes (6): Выкатка: репозиторий → сервер, Как это устроено на сервере, Команды, Откат, Почему именно так, Чего в цепочке пока нет

### Community 138 - "main.ts"
Cohesion: 0.50
Nodes (4): AppModule, Module, allowedOrigins(), bootstrap()

### Community 139 - "salary.service.ts"
Cohesion: 0.22
Nodes (6): DtoCreatePaymentByAccruals, ArrayMinSize, IsArray, IsOptional, IsString, IsUUID

### Community 140 - "2. Что уже сделано (этап 2 — карточки товаров)"
Cohesion: 0.10
Nodes (19): 1.1. Что показал живой кабинет (17.08.2026), 1. Что уже сделано (этап 1 — подключение), 2.1. Порядок работы с товаром в Ozon Seller API (справочно), 2.2. Заказы (этап 3, только чтение), 2.3. Мои товары и юнит-экономика (этап 4), 2. Что уже сделано (этап 2 — карточки товаров), 3. Дальше, API CRM (+11 more)

### Community 141 - "DtoBulkCards"
Cohesion: 0.22
Nodes (8): BULK_ACTIONS, BulkAction, DtoBulkCards, ArrayMaxSize, ArrayNotEmpty, IsArray, IsIn, IsUUID

### Community 142 - "lead.controller.ts"
Cohesion: 0.30
Nodes (7): constantTimeEqual(), readBearerToken(), readHeader(), SignedRequest, SiteLeadTokenGuard, stripPrefix(), Injectable

### Community 143 - "nginx-routes.spec.ts"
Cohesion: 0.22
Nodes (4): FRONTEND, NGINX_CONF, SRC, VITE_CONF

### Community 144 - "DtoUpdateOzonCatalogTemplate"
Cohesion: 0.17
Nodes (11): DtoUpdateOzonCatalogTemplate, ArrayMaxSize, IsArray, IsBoolean, IsInt, IsObject, IsOptional, IsString (+3 more)

### Community 145 - "OzonApiClient"
Cohesion: 0.18
Nodes (8): humanize(), OzonApiClient, OzonApiError, OzonErrorBody, Injectable, OzonConnectionInfo, OzonProductListResponse, OzonWarehouseListResponse

### Community 146 - "ТЗ: раздел «Печать на холсте» на raspechatkaa.ru"
Cohesion: 0.10
Nodes (19): Берём после сезона, Берём сразу, до сезона, Блок 0. Контекст и границы, Блок 10. Интеграция с CRM, Блок 11. Что НЕ делать, Блок 12. Технологическое преимущество, Блок 1. Информационная архитектура и URL, Блок 2. Хлебные крошки и связность (+11 more)

### Community 147 - "canvas-production-price.ts"
Cohesion: 0.25
Nodes (11): Get, CANVAS_MATERIAL_KIND_LABELS, CANVAS_PRODUCTION_PRICES, canvasContractorCost(), CanvasMaterialKind, CanvasPositionPricing, CanvasProductionPrice, canvasRetailPrice() (+3 more)

### Community 149 - "scenario.controller.ts"
Cohesion: 0.22
Nodes (8): DtoDetectProduct, IsString, MaxLength, DtoScenarioAnswers, IsObject, IsOptional, ORDER_ROLES, RequestUser

### Community 150 - "CanvasItemsTable.tsx"
Cohesion: 0.12
Nodes (20): canvasProductionApi, CanvasProductionPricing, CanvasProductionSize, CanvasItemsTable(), EditState, EMPTY, money(), Props (+12 more)

### Community 151 - "scenario-draft.service.ts"
Cohesion: 0.21
Nodes (9): DraftState, ScenarioDraftService, Injectable, FakeOrder, READY_PHOTO, READY_TSHIRT, findProduct(), Answers (+1 more)

### Community 153 - "ScenarioController"
Cohesion: 0.20
Nodes (9): ScenarioController, Body, Controller, Get, Param, Patch, Post, UseGuards (+1 more)

### Community 155 - "canvas.pricing.ts"
Cohesion: 0.22
Nodes (13): calcCanvasUnitPrice(), calcCanvasUrgencyFee(), CANVAS_FRAME_LABELS, CANVAS_MATERIAL_LABELS, CANVAS_SIZES, CanvasFrame, CanvasMaterial, CanvasSize (+5 more)

### Community 156 - "DtoCreatePayment"
Cohesion: 0.25
Nodes (7): DtoCreatePayment, IsInt, IsOptional, IsString, IsUUID, Min, Type

### Community 160 - "communication-url.ts"
Cohesion: 0.50
Nodes (6): buildCommunicationUrl(), buildMaxUrl(), DEFAULT_MAX_LINK_TEMPLATE, formatPhoneForDisplay(), normalizePhone(), validateCommunicationValue()

### Community 162 - "scenario.mapping.ts"
Cohesion: 0.37
Nodes (11): PAPER_LABEL, photoToOrder(), tshirtToOrder(), bool(), date(), deliveryOf(), noteOf(), num() (+3 more)

### Community 164 - "DtoCreateBonus"
Cohesion: 0.25
Nodes (8): DtoCreateBonus, IsInt, IsString, IsUUID, MaxLength, Min, MinLength, Type

### Community 166 - "scenario.types.ts"
Cohesion: 0.20
Nodes (18): detectProduct(), evaluateCondition(), evaluateScenario(), isFilled(), isStepRequired(), isStepVisible(), normalize(), pickRelevantAnswers() (+10 more)

### Community 167 - "DtoUpdateItemOrder"
Cohesion: 0.18
Nodes (11): DtoUpdateItemOrder, IsBoolean, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min (+3 more)

### Community 168 - "HealthController"
Cohesion: 0.33
Nodes (3): HealthController, Controller, Get

### Community 170 - "TelegramService"
Cohesion: 0.25
Nodes (3): describeTelegramError(), TelegramService, Injectable

### Community 171 - "telegram-update.service.ts"
Cohesion: 0.24
Nodes (8): OrderForOutbox, calcGulianPayout(), Item, PayoutResult, toGulianStatus(), ACTION_STATUS, STATUS_TOAST, TelegramCallback

### Community 172 - "DtoUpdateOzonUnitEconomics"
Cohesion: 0.22
Nodes (8): DtoUpdateOzonUnitEconomics, IsIn, IsInt, IsOptional, Max, Min, Type, IsNumber

### Community 173 - "DtoUpdateOrder"
Cohesion: 0.17
Nodes (11): DtoUpdateOrder, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Matches, MaxLength (+3 more)

### Community 174 - "DtoSaveDraft"
Cohesion: 0.33
Nodes (5): DtoSaveDraft, IsObject, IsOptional, IsString, MaxLength

### Community 176 - "DtoUpdateTshirtItem"
Cohesion: 0.25
Nodes (8): DtoUpdateTshirtItem, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min, Type

### Community 177 - "lead-notification.ts"
Cohesion: 0.36
Nodes (6): buildLeadNotification(), escape(), LeadForNotification, NotifiableUser, pickLeadResponders(), toMention()

### Community 180 - "CanvasPricingController"
Cohesion: 0.50
Nodes (3): CanvasPricingController, Controller, Get

### Community 181 - "OrderPhotoService"
Cohesion: 0.12
Nodes (9): isExternalProductionCategory(), OrderPhotoService, Injectable, Get, calculateManagerSalarySnapshot(), calculateSalarySnapshot(), earnsStaffSalary(), ManagerSalarySnapshot (+1 more)

### Community 192 - "LeadController"
Cohesion: 0.20
Nodes (8): LeadController, Body, Controller, Post, Throttle, UseGuards, HttpCode, UsePipes

## Knowledge Gaps
- **773 isolated node(s):** `$schema`, `collection`, `sourceRoot`, `deleteOutDir`, `name` (+768 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **55 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Roles()` connect `Roles` to `tasks.controller.ts`, `ApprovalController`, `DtoUpdateUser`, `image-card-batch.controller.ts`, `DtoCreateExpense`, `reports.service.ts`, `AvitoService`, `ImageCardBatchController`, `scenario.controller.ts`, `ScenarioController`, `PartnerAdminController`, `ozon-photo.controller.ts`, `SalaryService`, `order-photo.controller.ts`, `ImageCardTemplateService`, `PartnerSettingsService`, `marketplace.controller.ts`, `MockupService`, `OzonCatalogController`, `.credentials`, `marketplace.module.ts`?**
  _High betweenness centrality (0.273) - this node is a cross-community bridge._
- **Why does `BatchView()` connect `ApprovalController` to `getErrorMessage`?**
  _High betweenness centrality (0.259) - this node is a cross-community bridge._
- **Why does `getErrorMessage()` connect `getErrorMessage` to `ApprovalController`, `ProductsTab.tsx`, `MarketplacePage.tsx`, `TemplateSettings.tsx`, `AvitoPage.tsx`, `CardEditorModal.tsx`, `OrdersPage.tsx`, `OrderDetail.tsx`, `ReportsPage.tsx`, `TasksPage.tsx`, `App.tsx`, `ApprovalEditor.tsx`, `ozonProductCatalog.ts`?**
  _High betweenness centrality (0.188) - this node is a cross-community bridge._
- **What connects `$schema`, `collection`, `sourceRoot` to the rest of the system?**
  _773 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `DtoCreateOzonPrint` be split into smaller, more focused modules?**
  _Cohesion score 0.05832147937411095 - nodes in this community are weakly interconnected._
- **Should `tasks.controller.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05901639344262295 - nodes in this community are weakly interconnected._
- **Should `DtoUpdateUser` be split into smaller, more focused modules?**
  _Cohesion score 0.06387921022067364 - nodes in this community are weakly interconnected._