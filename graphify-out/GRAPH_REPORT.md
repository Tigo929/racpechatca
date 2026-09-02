# Graph Report - raspechatka  (2026-09-02)

## Corpus Check
- 454 files · ~242,794 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 3613 nodes · 7519 edges · 208 communities (153 shown, 55 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 316 edges (avg confidence: 0.79)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d2ecaa4a`
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
- CanvasItemsTable.tsx
- Roles
- System Map
- expenses.controller.ts
- reports.service.ts
- OrdersPage.tsx
- daily-plan-rules.ts
- AvitoService
- Брендбук — Распечатка PRO
- OrderPhotoService
- compilerOptions
- mockup.controller.ts
- compilerOptions
- Аудит проекта «Распечатка» — 2026-06-14
- AppShell.tsx
- dependencies
- ozon-bulk-stock.service.ts
- ozonProductCatalog.ts
- ApprovalEditor.tsx
- compilerOptions
- DtoCreateOrder
- OzonCredentials
- app.module.ts
- TelegramService
- PartnerAdminController
- devDependencies
- CardEditorModal.tsx
- DtoCreateLead
- OzonPhotoStorageService
- SalaryService
- Интеграция с исполнителем-партнёром (печать футболок)
- scenario-draft.service.ts
- CRM «Распечатка» — как всё устроено
- UsersPage.tsx
- auth.controller.ts
- OzonUnitEconomicsService
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
- approval/approval-geometry.ts
- exclude
- Аудит финансов, кода и продакшена — 2026-07-09
- devDependencies
- AvitoPage.tsx
- nest-cli.json
- MarketplacePage.tsx
- getErrorMessage
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
- ImageCardTemplateService
- ozon-attributes.ts
- @nestjs/cli
- image-card-batch.service.ts
- OzonWarehouseService
- ApprovalService
- scenario.mapping.ts
- supertest
- ImageCardStorageService
- MarketplaceController
- ts-node
- MockupService
- .sendMessage
- .handleUpdate
- OzonCatalogController
- crm-new/package.json
- ProductsTab.tsx
- @types/supertest
- OrdersTab.tsx
- PdfRasterService
- OzonProductCatalogController
- eslint-plugin-react-refresh
- OzonBulkStockService
- tshirt-partner-telegram.service.ts
- typescript-eslint
- vite
- DtoUpdatePartnerSettings
- TasksPage.tsx
- DtoCreatePayment
- @nestjs/core
- .list
- partner-api.controller.ts
- telegram.module.ts
- passport
- pdf-lib
- ScenarioController
- DtoUpdateItemOrder
- DtoPublishOzonPrints
- ТЗ: семантика и структура страниц raspechatkaa.ru
- OzonImportService
- DtoUpdateOzonPrint
- @prisma/adapter-pg
- @prisma/client
- lead.controller.ts
- ApprovalController
- DtoCreateBonus
- approval.service.ts
- partner.module.ts
- PrismaService
- CurrentUser
- CanvasItemService
- Выкатка: репозиторий → сервер
- scenario.engine.ts
- DtoBulkStock
- 2. Что уже сделано (этап 2 — карточки товаров)
- salary.service.ts
- DtoUpdateOrder
- nginx-routes.spec.ts
- DtoUpdateOzonCatalogTemplate
- DtoBulkCards
- ТЗ: раздел «Печать на холсте» на raspechatkaa.ru
- canvas-production-price.ts
- auto-update.sh
- .createBonus
- .createOrder
- partner-telegram-format.ts
- OrderDetail.tsx
- my-balance.spec.ts
- salary.module.ts
- canvas.pricing.ts
- ImageCardRenderService
- sharp
- undici
- @eslint/js
- ImageCardGenerationService
- jest
- archiver
- ApprovalStorageService
- bwip-js
- class-transformer
- scenario.registry.ts
- class-validator
- helmet
- @nestjs/config
- telegram.service.ts
- @nestjs/jwt
- DtoUpdateOzonUnitEconomics
- TechSpecStorageService
- @nestjs/platform-express
- @nestjs/throttler
- @types/express
- lead-notification.ts
- @types/jest
- @nestjs/mapped-types
- @types/pdfkit
- eslint
- passport-jwt
- DtoCreateOzonPrintsBulk
- @eslint/eslintrc
- globals
- prettier
- PartnerStatusPollService
- @types/multer
- @nestjs/common
- @types/passport-jwt
- typescript
- DtoOzonUpdateCardText
- LeadController
- tsconfig-paths
- DtoSaveDraft
- pdfkit
- pg
- uuid
- web-push
- scenario.module.ts
- main.ts
- HealthController
- DtoSetShipmentLead
- DtoDetectProduct
- PrismaModule
- bcryptjs
- @eslint/js

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
- `BonusForm()` --calls--> `getErrorMessage()`  [EXTRACTED]
  frontend/src/pages/SalaryPage.tsx → frontend/src/utils/get-error-message.ts

## Import Cycles
- None detected.

## Communities (208 total, 55 thin omitted)

### Community 0 - "DtoCreateOzonPrint"
Cohesion: 0.07
Nodes (28): DtoCreateOzonPrint, ArrayMaxSize, ArrayMinSize, ArrayNotEmpty, IsArray, IsEnum, IsInt, IsOptional (+20 more)

### Community 1 - "tasks.controller.ts"
Cohesion: 0.06
Nodes (31): DtoCreateTask, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength (+23 more)

### Community 2 - "dependencies"
Cohesion: 0.22
Nodes (9): dependencies, @nestjs/passport, reflect-metadata, roboto-fontface, rxjs, @nestjs/passport, reflect-metadata, roboto-fontface (+1 more)

### Community 3 - "DtoUpdateUser"
Cohesion: 0.06
Nodes (28): DtoCreateUser, IsEnum, IsString, MinLength, DtoUpdateUser, IsBoolean, IsInt, IsOptional (+20 more)

### Community 4 - "sticker.service.ts"
Cohesion: 0.16
Nodes (13): buildPhotoItemLines(), buildTshirtItemLines(), drawInstagramIcon(), drawTelegramIcon(), FONT_DIR, formatRub(), PRINT_LOCATION_LABELS, req (+5 more)

### Community 5 - "jest"
Cohesion: 0.12
Nodes (16): jest, collectCoverageFrom, coverageDirectory, moduleFileExtensions, moduleNameMapper, rootDir, testEnvironment, testRegex (+8 more)

### Community 6 - "DtoOzonArchive"
Cohesion: 0.27
Nodes (14): DtoOzonArchive, DtoOzonPriceItem, DtoOzonStockItem, DtoOzonUpdatePrices, DtoOzonUpdateStocks, ArrayNotEmpty, IsArray, IsBoolean (+6 more)

### Community 7 - "index.ts"
Cohesion: 0.07
Nodes (36): MySalaryBalance, Props, AvitoLinkedOrder, ClosedAccrualBrief, Contractors, CreateApprovalDto, CreateCanvasItemDto, CreateItemDto (+28 more)

### Community 8 - "CanvasItemsTable.tsx"
Cohesion: 0.12
Nodes (20): canvasProductionApi, CanvasProductionPricing, CanvasProductionSize, CanvasItemsTable(), EditState, EMPTY, money(), Props (+12 more)

### Community 9 - "Roles"
Cohesion: 0.14
Nodes (13): Roles(), OrderPhotoController, Body, Controller, Delete, Get, Param, Patch (+5 more)

### Community 10 - "System Map"
Cohesion: 0.05
Nodes (36): 2026-07-08, 2026-07-09, 2026-07-11, 2026-08-24, 2026-08-24 (later), 2026-08-25, Access Rules, App Modules (+28 more)

### Community 11 - "expenses.controller.ts"
Cohesion: 0.09
Nodes (19): DtoCreateExpense, IsEnum, IsInt, IsOptional, IsString, Min, ExpensesController, RequestUser (+11 more)

### Community 12 - "reports.service.ts"
Cohesion: 0.05
Nodes (52): calcOrderProfit(), forecastSalary(), kopecksToRub(), OrderProfit, OrderProfitInput, SHEET, DECLARED_PRINTS_PER_SHEET, HALF_SHEET_WORDS (+44 more)

### Community 13 - "OrdersPage.tsx"
Cohesion: 0.07
Nodes (40): OrdersPage, ExecutorFilter(), Props, OrderDetail(), StatusStepper(), DELIVERY_STYLES, DeliveryBadge(), Props (+32 more)

### Community 14 - "daily-plan-rules.ts"
Cohesion: 0.05
Nodes (62): buildDailyPlanMessage(), buildShipmentBlock(), dayMonth(), DELIVERY_LABEL, effectiveDeadline(), executorKey(), inWorkTail(), isWithinPlanWindow() (+54 more)

### Community 15 - "AvitoService"
Cohesion: 0.05
Nodes (30): AvitoController, Controller, Get, Param, Post, Query, UseGuards, AvitoMessengerService (+22 more)

### Community 16 - "Брендбук — Распечатка PRO"
Cohesion: 0.08
Nodes (24): 1. Анализ конкурентов, 2. Психология цвета, 3. Цветовая палитра, 4. Типографика, 5. Логотип и иконка, 6. Правила применения, 7. Tone of Voice, 8. Применение на сайте (будущее) (+16 more)

### Community 17 - "OrderPhotoService"
Cohesion: 0.15
Nodes (11): escapeHtml(), formatRuDate(), isExternalProductionCategory(), needsShipmentStatus(), OrderPhotoService, Injectable, calculateManagerSalarySnapshot(), calculateSalarySnapshot() (+3 more)

### Community 18 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, allowSyntheticDefaultImports, baseUrl, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, forceConsistentCasingInFileNames (+14 more)

### Community 19 - "mockup.controller.ts"
Cohesion: 0.18
Nodes (15): ALLOWED_IMAGE, APPROVAL_MAX_BYTES, SavedImage, UploadedImage, DtoCreateMockupTemplate, DtoUpdateMockupTemplate, IsBoolean, IsEnum (+7 more)

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
Cohesion: 0.06
Nodes (56): baseCodeOf(), BulkStockHistoryRow, BulkStockInput, BulkStockItem, BulkStockMode, BulkStockOperation, BulkStockPreview, BulkStockWarehouseInput (+48 more)

### Community 26 - "ApprovalEditor.tsx"
Cohesion: 0.09
Nodes (44): approvalsApi, mockupsApi, ApprovalEditor(), CmField(), downloadBlob(), Props, SIDE_LABELS, Sides (+36 more)

### Community 27 - "compilerOptions"
Cohesion: 0.10
Nodes (20): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+12 more)

### Community 28 - "DtoCreateOrder"
Cohesion: 0.13
Nodes (15): DtoCreateOrder, IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString (+7 more)

### Community 29 - "OzonCredentials"
Cohesion: 0.17
Nodes (3): OzonCredentials, OzonProductCatalogService, Injectable

### Community 30 - "app.module.ts"
Cohesion: 0.10
Nodes (22): ApprovalModule, Module, AvitoModule, Module, CanvasModule, Module, ExpensesModule, Module (+14 more)

### Community 31 - "TelegramService"
Cohesion: 0.13
Nodes (14): isReviewReminderEligible(), REVIEW_REMINDER_CATEGORIES, REVIEW_REMINDER_DELAY_MS, REVIEW_REMINDER_PICKUP_DELAY_MS, REVIEW_REMINDER_STATUSES, reviewReminderDelayMs(), buildReviewRequestText(), categoryLabel() (+6 more)

### Community 32 - "PartnerAdminController"
Cohesion: 0.21
Nodes (9): PartnerAdminController, Controller, Get, Param, Post, Res, UploadedFiles, UseGuards (+1 more)

### Community 33 - "devDependencies"
Cohesion: 0.11
Nodes (19): eslint-plugin-react-hooks, devDependencies, eslint-plugin-react-hooks, globals, tailwindcss, @tailwindcss/vite, @types/node, @types/react (+11 more)

### Community 34 - "CardEditorModal.tsx"
Cohesion: 0.06
Nodes (53): ozonBatchesApi, ozonCardsApi, CardBatchReport(), CardEditorModal(), CardFinalizePanel(), BatchList(), CardGeneratorTab(), MODE_LABELS (+45 more)

### Community 35 - "DtoCreateLead"
Cohesion: 0.07
Nodes (22): DtoCreateLead, base, meta, pipe, IsBoolean, IsEnum, IsIn, IsInt (+14 more)

### Community 36 - "OzonPhotoStorageService"
Cohesion: 0.12
Nodes (13): OzonPhotoStorageService, Injectable, OzonPhotoController, Controller, Get, Param, Post, Req (+5 more)

### Community 37 - "SalaryService"
Cohesion: 0.15
Nodes (8): SalaryController, Controller, Delete, Get, Param, UseGuards, SalaryService, Injectable

### Community 38 - "Интеграция с исполнителем-партнёром (печать футболок)"
Cohesion: 0.12
Nodes (15): 1. Модель взаимодействия, 2. Аутентификация, 3. Webhook, который мы отправляем партнёру, 4.1 Данные заказа, 4.2 ТЗ-фото (макет), 4.3 Стикер (PDF, 58×40 мм), 4.4 Смена статуса заказа (партнёр → нам), 4. Эндпоинты, откуда партнёр забирает данные (pull) (+7 more)

### Community 39 - "scenario-draft.service.ts"
Cohesion: 0.20
Nodes (10): calcOrderTotal(), DraftState, ScenarioDraftService, Injectable, FakeOrder, READY_PHOTO, READY_TSHIRT, findProduct() (+2 more)

### Community 40 - "CRM «Распечатка» — как всё устроено"
Cohesion: 0.11
Nodes (18): 10. Слабые места, 11. Что дальше, 1. Что это, 2. Из чего собрано, 3. Продукты и статусы, 4. Деньги, 5. Роли, 6. Сценарии оформления (+10 more)

### Community 41 - "UsersPage.tsx"
Cohesion: 0.23
Nodes (13): UsersPage, bpToPercent(), DesignRateEditor(), loadBadgeColor(), percentToBp(), RateEditor(), RateEditorProps, ROLE_COLORS (+5 more)

### Community 42 - "auth.controller.ts"
Cohesion: 0.11
Nodes (16): AuthController, Body, Controller, Get, Post, Throttle, UseGuards, AuthModule (+8 more)

### Community 43 - "OzonUnitEconomicsService"
Cohesion: 0.15
Nodes (11): calculateUnitEconomics(), OzonTariffs, realSettings, settings, tariffs, UnitEconomicsLine, UnitEconomicsSettings, bpToPercent() (+3 more)

### Community 44 - "image-card-placement.ts"
Cohesion: 0.12
Nodes (27): MODE_COLORS, ASPECT_ALERT, CardTransform, clamp(), containFit(), DEFAULT_FILL, DEFAULT_TRANSFORM, isOutside() (+19 more)

### Community 45 - "ozon-product-catalog.service.ts"
Cohesion: 0.09
Nodes (21): OzonActionView, OzonCatalogProduct, OzonContentRating, OzonDemand, OzonImportAttributeBody, OzonProductCard, RawActionsResponse, RawAnalyticsResponse (+13 more)

### Community 46 - "DtoAllOrdersforQuery"
Cohesion: 0.11
Nodes (13): DtoAllOrdersforQuery, IsEnum, IsIn, IsInt, IsOptional, IsString, Matches, Max (+5 more)

### Community 47 - "order-photo.service.ts"
Cohesion: 0.07
Nodes (30): DtoAssignExecutor, IsOptional, IsString, IsUUID, IsEnum, UpdateStatus, LeadMoneyError, LeadMoneyInput (+22 more)

### Community 48 - "salary-integrity.spec.ts"
Cohesion: 0.14
Nodes (13): AccrualByIdRow, AsyncMock, createOrderService(), CreatePaymentArgs, createPrismaStub(), HarnessAccrual, makeOrder(), PaymentByAccrualsHarness (+5 more)

### Community 49 - "ReportsPage.tsx"
Cohesion: 0.08
Nodes (37): expensesApi, reportsApi, ReportsPage, buildReceiptHtml(), buildReceiptTitle(), escapeHtml(), formatFilenameDate(), printReceipt() (+29 more)

### Community 50 - "CreateOrderForm.tsx"
Cohesion: 0.06
Nodes (40): partnerSettingsApi, baseSchema, canvasItemSchema, clearOrderDraft(), CreateOrderForm(), EMPTY_ORDER_FORM, FormValues, freeItemSchema (+32 more)

### Community 51 - "Исправленные проблемы"
Cohesion: 0.18
Nodes (10): CRITICAL, CRM Audit Report — 2026-06-14, HIGH, HIGH, LOW, MEDIUM, MEDIUM, Исправленные проблемы (+2 more)

### Community 52 - "crm-new/README.md"
Cohesion: 0.20
Nodes (9): Compile and run the project, Deployment, Description, License, Project setup, Resources, Run tests, Stay in touch (+1 more)

### Community 53 - "App.tsx"
Cohesion: 0.11
Nodes (22): authApi, AdminRoute(), App(), AppRoutes(), CrmGate(), HomeRedirect(), LoginPage, MarketplacePage (+14 more)

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
Cohesion: 0.13
Nodes (16): PrintAreaCalibration, ApprovalRenderService, escapeXml(), formatDate(), layoutSlots(), line(), Placement, RenderSheetInput (+8 more)

### Community 62 - "approval/approval-geometry.ts"
Cohesion: 0.21
Nodes (14): DPI_ACCEPTABLE, DPI_GOOD, estimateDpi(), formatCm(), formatSizeCm(), isCalibrated(), isOutsidePrintArea(), printAreaRect() (+6 more)

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
Cohesion: 0.10
Nodes (25): CreateAccountDto, EnumMarketplace, MarketplaceAccount, marketplaceApi, OzonConnectionInfo, UpdateAccountDto, AccountCard(), AccountForm() (+17 more)

### Community 69 - "getErrorMessage"
Cohesion: 0.19
Nodes (14): AssignPanel(), AddExpenseModal(), DailyPlanCard(), Example(), FormState, money(), ResendRemindersCard(), ROLE_LABEL (+6 more)

### Community 70 - "GulianService"
Cohesion: 0.17
Nodes (7): GulianOutboxProcessorService, RETRY_DELAYS_SECONDS, Injectable, GulianOrderPayload, GulianResponse, GulianService, Injectable

### Community 71 - "seed.js"
Cohesion: 0.40
Nodes (3): bcrypt, { Client }, { randomUUID }

### Community 72 - "order-photo.controller.ts"
Cohesion: 0.04
Nodes (50): PRICE_FIELDS, strip(), StripPricesInterceptor, Injectable, DtoCreateCanvasItem, IsIn, IsInt, IsOptional (+42 more)

### Community 73 - "OzonPrintService"
Cohesion: 0.18
Nodes (8): normalizeSlug(), slugify(), stripUnsafe(), ColorGroupInput, CreatePrintInput, OzonPrintService, PRINT_INCLUDE, Injectable

### Community 74 - "React + TypeScript + Vite"
Cohesion: 0.50
Nodes (3): Expanding the ESLint configuration, React Compiler, React + TypeScript + Vite

### Community 76 - "shipment-reminder-rules.ts"
Cohesion: 0.16
Nodes (11): buildShipmentReminder(), DEADLINE_METHODS, dueReminderStage(), hasDeadline(), hoursLeft(), SHIPMENT_REMINDER_STAGES_MS, ShipmentOrder, START (+3 more)

### Community 79 - "ImageCardBatchController"
Cohesion: 0.09
Nodes (15): ImageCardBatchController, Body, Controller, Delete, Get, Param, Patch, Post (+7 more)

### Community 80 - "marketplace.module.ts"
Cohesion: 0.05
Nodes (44): MarketplaceAccessGuard, guard_(), Injectable, ACCOUNT_INCLUDE, AccountRow, CreateAccountInput, MarketplaceAccountService, MarketplaceAccountView (+36 more)

### Community 81 - "telegram-update.service.ts"
Cohesion: 0.13
Nodes (11): GulianOutboxService, OrderForOutbox, Injectable, calcGulianPayout(), Item, PayoutResult, toGulianStatus(), buildPartnerButtons() (+3 more)

### Community 82 - "ImageCardTemplateService"
Cohesion: 0.10
Nodes (14): ImageCardTemplateController, Body, Controller, Delete, Get, Param, Patch, Post (+6 more)

### Community 83 - "ozon-attributes.ts"
Cohesion: 0.09
Nodes (29): buildExtraImages(), buildImportItem(), buildOfferId(), CatalogTemplateForImport, chunk(), COLOR_CODE_BY_LABEL, colorCodeFor(), DEFAULT_SIZES (+21 more)

### Community 85 - "image-card-batch.service.ts"
Cohesion: 0.12
Nodes (20): CARD_MODES, CardMode, DtoCreateImageCardBatch, ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional (+12 more)

### Community 86 - "OzonWarehouseService"
Cohesion: 0.13
Nodes (12): editability(), isStale(), NOT_EDITABLE, sortForPicker(), toWarehouseStates(), WAREHOUSE_CACHE_TTL_MS, WarehouseState, OzonWarehouseService (+4 more)

### Community 87 - "ApprovalService"
Cohesion: 0.15
Nodes (10): ApprovalService, Injectable, ApprovalSides, clamp(), filledSides(), MAX_PRINT_MM, MIN_PRINT_MM, num() (+2 more)

### Community 88 - "scenario.mapping.ts"
Cohesion: 0.35
Nodes (12): PAPER_LABEL, photoToOrder(), tshirtToOrder(), bool(), date(), deliveryOf(), noteOf(), num() (+4 more)

### Community 90 - "ImageCardStorageService"
Cohesion: 0.13
Nodes (5): ImageCardProcessorService, parseSnapshot(), Injectable, ImageCardStorageService, Injectable

### Community 91 - "MarketplaceController"
Cohesion: 0.06
Nodes (27): DtoCreateMarketplaceAccount, IsEnum, IsString, MaxLength, MinLength, DtoUpdateMarketplaceAccount, IsBoolean, IsOptional (+19 more)

### Community 93 - "MockupService"
Cohesion: 0.11
Nodes (14): MockupController, Body, Controller, Delete, Get, Param, Patch, Post (+6 more)

### Community 94 - ".sendMessage"
Cohesion: 0.29
Nodes (5): Body, DtoSendAvitoMessage, IsString, MaxLength, MinLength

### Community 95 - ".handleUpdate"
Cohesion: 0.15
Nodes (9): TelegramUpdateService, TgUpdate, Injectable, constantTimeEqual(), TelegramWebhookController, Body, Controller, Post (+1 more)

### Community 96 - "OzonCatalogController"
Cohesion: 0.17
Nodes (11): OzonCatalogController, Body, Controller, Delete, Get, Param, Patch, Post (+3 more)

### Community 97 - "crm-new/package.json"
Cohesion: 0.29
Nodes (6): author, description, license, name, private, version

### Community 98 - "ProductsTab.tsx"
Cohesion: 0.06
Nodes (59): CreateOzonPrintDto, EnumOzonSyncStatus, EnumTshirtGender, OzonAttributeValueOption, ozonCatalogApi, OzonCatalogTemplate, OzonColorGroupInput, OzonPrint (+51 more)

### Community 100 - "OrdersTab.tsx"
Cohesion: 0.23
Nodes (11): OzonOrder, OzonOrderGroup, OzonOrderItem, ozonOrdersApi, OzonOrdersPage, deadlineHint(), formatDateTime(), GROUPS (+3 more)

### Community 101 - "PdfRasterService"
Cohesion: 0.23
Nodes (5): PdfRasterService, PdfRasterUnavailableError, RASTER_LONG_SIDE, run, Injectable

### Community 102 - "OzonProductCatalogController"
Cohesion: 0.19
Nodes (9): OzonProductCatalogController, Body, Controller, Get, Param, Patch, Post, Query (+1 more)

### Community 104 - "OzonBulkStockService"
Cohesion: 0.15
Nodes (5): OzonBulkStockProcessorService, Injectable, keyOf(), OzonBulkStockService, Injectable

### Community 105 - "tshirt-partner-telegram.service.ts"
Cohesion: 0.11
Nodes (15): escapeHtml(), EXT_CONTENT_TYPE, money(), PRINT_LOCATION_LABELS, PRINT_TYPE_LABELS, TechSpecAttachment, Injectable, TshirtOrderWithItems (+7 more)

### Community 112 - "DtoUpdatePartnerSettings"
Cohesion: 0.12
Nodes (13): DtoUpdatePartnerSettings, IsInt, IsOptional, IsString, Max, MaxLength, Min, PartnerSettingsController (+5 more)

### Community 113 - "TasksPage.tsx"
Cohesion: 0.12
Nodes (20): api, shipmentLeadApi, tasksApi, TasksQuery, usersApi, TasksPage, daysUntil(), DeadlineChip() (+12 more)

### Community 114 - "DtoCreatePayment"
Cohesion: 0.25
Nodes (7): DtoCreatePayment, IsInt, IsOptional, IsString, IsUUID, Min, Type

### Community 116 - ".list"
Cohesion: 0.50
Nodes (3): Get, Param, Query

### Community 117 - "partner-api.controller.ts"
Cohesion: 0.16
Nodes (15): DtoPartnerStatus, IsString, Body, Patch, buildPartnerOrderPayload(), FLOW_RANK, FROM_PARTNER, fromPartnerStatus() (+7 more)

### Community 118 - "telegram.module.ts"
Cohesion: 0.14
Nodes (10): TelegramModule, Module, TelegramStickerController, Controller, Get, Param, Query, Res (+2 more)

### Community 121 - "ScenarioController"
Cohesion: 0.15
Nodes (12): DtoScenarioAnswers, IsObject, IsOptional, ScenarioController, Body, Controller, Get, Param (+4 more)

### Community 122 - "DtoUpdateItemOrder"
Cohesion: 0.17
Nodes (11): DtoUpdateItemOrder, IsBoolean, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min (+3 more)

### Community 123 - "DtoPublishOzonPrints"
Cohesion: 0.33
Nodes (5): DtoPublishOzonPrints, ArrayMinSize, ArrayNotEmpty, IsArray, IsUUID

### Community 124 - "ТЗ: семантика и структура страниц raspechatkaa.ru"
Cohesion: 0.07
Nodes (27): P10. Холст — `/interer/holst`, P1. Где распечатать фото в Москве — `/gde-raspechatat-foto-v-moskve`, P2. Цены — `/ceny`, P3. Размеры и форматы фото — `/formaty`, P4. Печать фото А4 — `/catalog/foto-a4`, P5. Печать фото на документы — `/dokumenty`, P6. Печать фото онлайн с доставкой — `/onlayn`, P7. Бумага и качество — `/bumaga` (+19 more)

### Community 125 - "OzonImportService"
Cohesion: 0.13
Nodes (7): OzonImportPollService, Injectable, OzonImportService, Injectable, resolveDefaultWarehouses(), WarehouseChoice, WarehouseState

### Community 126 - "DtoUpdateOzonPrint"
Cohesion: 0.17
Nodes (11): DtoUpdateOzonPrint, ArrayMaxSize, IsArray, IsEnum, IsInt, IsOptional, IsString, IsUrl (+3 more)

### Community 129 - "lead.controller.ts"
Cohesion: 0.30
Nodes (7): constantTimeEqual(), readBearerToken(), readHeader(), SignedRequest, SiteLeadTokenGuard, stripPrefix(), Injectable

### Community 130 - "ApprovalController"
Cohesion: 0.13
Nodes (16): ApprovalController, parseSide(), Body, Controller, Delete, Get, Param, Patch (+8 more)

### Community 131 - "DtoCreateBonus"
Cohesion: 0.25
Nodes (8): DtoCreateBonus, IsInt, IsString, IsUUID, MaxLength, Min, MinLength, Type

### Community 132 - "approval.service.ts"
Cohesion: 0.14
Nodes (13): approvalInclude, SIZE_LABELS, DtoCreateApproval, IsEnum, IsOptional, IsString, IsUUID, DtoUpdateApproval (+5 more)

### Community 133 - "partner.module.ts"
Cohesion: 0.14
Nodes (10): StickerModule, Module, PartnerModule, Module, PartnerTokenGuard, Injectable, ALLOWED, EXT_CONTENT_TYPE (+2 more)

### Community 134 - "PrismaService"
Cohesion: 0.07
Nodes (20): JwtPayload, FinancialClient, OrderFinancialIntegrityService, Injectable, calcItemPricePosition(), PricedItem, ELIGIBLE_ROLES, ShipmentLeadView (+12 more)

### Community 135 - "CurrentUser"
Cohesion: 0.09
Nodes (32): SIDES, AuthenticatedRequest, AuthenticatedUser, CurrentUser, ROLES_KEY, JwtAuthGuard, Injectable, RolesGuard (+24 more)

### Community 136 - "CanvasItemService"
Cohesion: 0.12
Nodes (9): CanvasItemService, canvasMoney(), Injectable, OrderItemService, Injectable, ShipmentLeadService, Injectable, Injectable (+1 more)

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

### Community 141 - "salary.service.ts"
Cohesion: 0.22
Nodes (6): DtoCreatePaymentByAccruals, ArrayMinSize, IsArray, IsOptional, IsString, IsUUID

### Community 142 - "DtoUpdateOrder"
Cohesion: 0.17
Nodes (11): DtoUpdateOrder, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Matches, MaxLength (+3 more)

### Community 143 - "nginx-routes.spec.ts"
Cohesion: 0.22
Nodes (4): FRONTEND, NGINX_CONF, SRC, VITE_CONF

### Community 144 - "DtoUpdateOzonCatalogTemplate"
Cohesion: 0.17
Nodes (11): DtoUpdateOzonCatalogTemplate, ArrayMaxSize, IsArray, IsBoolean, IsInt, IsObject, IsOptional, IsString (+3 more)

### Community 145 - "DtoBulkCards"
Cohesion: 0.20
Nodes (8): BULK_ACTIONS, BulkAction, DtoBulkCards, ArrayMaxSize, ArrayNotEmpty, IsArray, IsIn, IsUUID

### Community 146 - "ТЗ: раздел «Печать на холсте» на raspechatkaa.ru"
Cohesion: 0.10
Nodes (19): Берём после сезона, Берём сразу, до сезона, Блок 0. Контекст и границы, Блок 10. Интеграция с CRM, Блок 11. Что НЕ делать, Блок 12. Технологическое преимущество, Блок 1. Информационная архитектура и URL, Блок 2. Хлебные крошки и связность (+11 more)

### Community 147 - "canvas-production-price.ts"
Cohesion: 0.18
Nodes (14): CanvasProductionController, Controller, Get, UseGuards, CANVAS_MATERIAL_KIND_LABELS, CANVAS_PRODUCTION_PRICES, canvasContractorCost(), CanvasMaterialKind (+6 more)

### Community 150 - ".createOrder"
Cohesion: 0.38
Nodes (7): buildCommunicationUrl(), buildMaxUrl(), DEFAULT_MAX_LINK_TEMPLATE, formatPhoneForDisplay(), normalizePhone(), validateCommunicationValue(), calcCanvasMoney()

### Community 151 - "partner-telegram-format.ts"
Cohesion: 0.27
Nodes (9): buildPartnerCaption(), calcSettlement(), esc(), PartnerOrderData, PartnerOrderItem, PRINT_LOCATION_LABELS, PRINT_TYPE_LABELS, rub() (+1 more)

### Community 152 - "OrderDetail.tsx"
Cohesion: 0.09
Nodes (30): ordersApi, DispatchToExecutorModal(), PayoutInfo, Props, rub(), GulianSyncBlock(), Props, STATUS_LABELS (+22 more)

### Community 155 - "canvas.pricing.ts"
Cohesion: 0.16
Nodes (16): CanvasPricingController, Controller, Get, calcCanvasUnitPrice(), calcCanvasUrgencyFee(), CANVAS_FRAME_LABELS, CANVAS_MATERIAL_LABELS, CANVAS_SIZES (+8 more)

### Community 160 - "ImageCardGenerationService"
Cohesion: 0.13
Nodes (11): CARD_MANUAL_STATUSES, CardManualStatus, DtoUpdateImageCard, IsBoolean, IsIn, IsObject, IsOptional, describe() (+3 more)

### Community 163 - "ApprovalStorageService"
Cohesion: 0.19
Nodes (3): scaleCalibration(), ApprovalStorageService, Injectable

### Community 166 - "scenario.registry.ts"
Cohesion: 0.17
Nodes (17): DELIVERY_STEPS, NOTE_STEP, OPTIONAL, PHOTO_SCENARIO, TSHIRT_SCENARIO, ProductDefinition, PRODUCTS, SCENARIOS (+9 more)

### Community 170 - "telegram.service.ts"
Cohesion: 0.18
Nodes (8): logger, proxyDispatcher(), resetTelegramProxyCache(), telegramFetch(), telegramFormData(), TelegramPollingService, TgUpdateWithId, Injectable

### Community 172 - "DtoUpdateOzonUnitEconomics"
Cohesion: 0.22
Nodes (8): DtoUpdateOzonUnitEconomics, IsIn, IsInt, IsOptional, Max, Min, Type, IsNumber

### Community 177 - "lead-notification.ts"
Cohesion: 0.29
Nodes (6): buildLeadNotification(), escape(), LeadForNotification, NotifiableUser, pickLeadResponders(), toMention()

### Community 183 - "DtoCreateOzonPrintsBulk"
Cohesion: 0.29
Nodes (7): DtoCreateOzonPrintsBulk, ArrayMaxSize, ArrayMinSize, ArrayNotEmpty, IsArray, Type, ValidateNested

### Community 192 - "DtoOzonUpdateCardText"
Cohesion: 0.33
Nodes (5): DtoOzonUpdateCardText, IsOptional, IsString, MaxLength, MinLength

### Community 193 - "LeadController"
Cohesion: 0.33
Nodes (5): LeadController, Controller, Throttle, UseGuards, UsePipes

### Community 195 - "DtoSaveDraft"
Cohesion: 0.33
Nodes (5): DtoSaveDraft, IsObject, IsOptional, IsString, MaxLength

### Community 200 - "scenario.module.ts"
Cohesion: 0.40
Nodes (4): ScenarioModule, Module, validateAllScenarios(), validateScenario()

### Community 201 - "main.ts"
Cohesion: 0.50
Nodes (4): AppModule, Module, allowedOrigins(), bootstrap()

### Community 202 - "HealthController"
Cohesion: 0.40
Nodes (3): HealthController, Controller, Get

### Community 203 - "DtoSetShipmentLead"
Cohesion: 0.40
Nodes (4): DtoSetShipmentLead, IsOptional, IsString, ValidateIf

### Community 204 - "DtoDetectProduct"
Cohesion: 0.50
Nodes (3): DtoDetectProduct, IsString, MaxLength

### Community 205 - "PrismaModule"
Cohesion: 0.67
Nodes (3): PrismaModule, Module, Global

## Knowledge Gaps
- **799 isolated node(s):** `$schema`, `collection`, `sourceRoot`, `deleteOutDir`, `name` (+794 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **55 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Roles()` connect `Roles` to `tasks.controller.ts`, `ApprovalController`, `DtoUpdateUser`, `CurrentUser`, `expenses.controller.ts`, `reports.service.ts`, `AvitoService`, `mockup.controller.ts`, `canvas-production-price.ts`, `PartnerAdminController`, `OzonPhotoStorageService`, `SalaryService`, `order-photo.controller.ts`, `ImageCardBatchController`, `marketplace.module.ts`, `ImageCardTemplateService`, `MarketplaceController`, `MockupService`, `.sendMessage`, `OzonCatalogController`, `OzonProductCatalogController`, `DtoUpdatePartnerSettings`, `ScenarioController`?**
  _High betweenness centrality (0.261) - this node is a cross-community bridge._
- **Why does `BatchView()` connect `ApprovalController` to `CardEditorModal.tsx`, `getErrorMessage`?**
  _High betweenness centrality (0.250) - this node is a cross-community bridge._
- **Why does `getErrorMessage()` connect `getErrorMessage` to `CardEditorModal.tsx`, `ApprovalController`, `MarketplacePage.tsx`, `ProductsTab.tsx`, `AvitoPage.tsx`, `UsersPage.tsx`, `OrdersPage.tsx`, `ReportsPage.tsx`, `TasksPage.tsx`, `OrderDetail.tsx`, `ozonProductCatalog.ts`, `ApprovalEditor.tsx`?**
  _High betweenness centrality (0.203) - this node is a cross-community bridge._
- **What connects `$schema`, `collection`, `sourceRoot` to the rest of the system?**
  _799 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `DtoCreateOzonPrint` be split into smaller, more focused modules?**
  _Cohesion score 0.07096774193548387 - nodes in this community are weakly interconnected._
- **Should `tasks.controller.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06429070580013976 - nodes in this community are weakly interconnected._
- **Should `DtoUpdateUser` be split into smaller, more focused modules?**
  _Cohesion score 0.06387921022067364 - nodes in this community are weakly interconnected._