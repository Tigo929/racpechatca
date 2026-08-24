# Graph Report - racpechatca  (2026-08-24)

## Corpus Check
- 394 files · ~197,659 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 3135 nodes · 6343 edges · 195 communities (143 shown, 52 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 245 edges (avg confidence: 0.79)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e92d124f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ozon-catalog.controller.ts
- TasksService
- dependencies
- DtoUpdateUser
- telegram.module.ts
- jest
- ozon-product-catalog.controller.ts
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
- CurrentUser
- compilerOptions
- tasks.controller.ts
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
- marketplace.module.ts
- review-reminder.service.ts
- PartnerAdminController
- devDependencies
- getErrorMessage
- DtoCreateLead
- OzonPhotoStorageService
- salary.controller.ts
- Интеграция с исполнителем-партнёром (печать футболок)
- OzonImportService
- CRM «Распечатка» — как всё устроено
- partner-payload.ts
- auth.controller.ts
- ozon-unit-economics.service.ts
- tshirt-partner-telegram.service.ts
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
- ozonProductCatalog.ts
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
- scenario.registry.ts
- React + TypeScript + Vite
- backup-db.sh
- shipment-reminder-rules.ts
- ts-loader
- frontend/tsconfig.json
- OzonCredentials
- @eslint/js
- partner-telegram-format.ts
- ozon-import.service.ts
- ozon-attributes.ts
- @nestjs/cli
- @nestjs/schematics
- @nestjs/testing
- ApprovalService
- PartnerSettingsService
- supertest
- ts-jest
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
- typescript-eslint
- .credentials
- eslint-plugin-react-refresh
- OzonPrintService
- tailwindcss
- typescript-eslint
- vite
- AvitoMessengerService
- partner.module.ts
- DtoUpdatePartnerSettings
- @nestjs/core
- @nestjs/jwt
- @nestjs/mapped-types
- @nestjs/throttler
- passport
- pdf-lib
- partner-admin.controller.ts
- @types/jest
- current-user.decorator.ts
- ТЗ: семантика и структура страниц raspechatkaa.ru
- @types/pdfkit
- DtoUpdateOzonPrint
- @prisma/adapter-pg
- @prisma/client
- reflect-metadata
- ApprovalController
- TshirtPartnerTelegramService
- approval.service.ts
- TelegramPollingService
- PrismaService
- roles.guard.ts
- CanvasItemService
- Выкатка: репозиторий → сервер
- main.ts
- prisma
- 2. Что уже сделано (этап 2 — карточки товаров)
- OzonOrdersController
- site-lead-token.guard.ts
- nginx-routes.spec.ts
- DtoUpdateOzonCatalogTemplate
- OzonApiClient
- ТЗ: раздел «Печать на холсте» на raspechatkaa.ru
- canvas-production.controller.ts
- auto-update.sh
- scenario.controller.ts
- usePersistentState
- scenario-draft.service.ts
- @nestjs/config
- ScenarioController
- @nestjs/platform-express
- canvas.pricing.ts
- rxjs
- sharp
- undici
- @eslint/js
- avito.service.ts
- jest
- scenario.mapping.ts
- ApprovalStorageService
- mockup.controller.ts
- class-transformer
- scenario.engine.ts
- DtoUpdateItemOrder
- UsersPage.tsx
- DtoAvitoChatQuery
- TelegramService
- telegram-update.service.ts
- DtoUpdateOzonUnitEconomics
- DtoUpdateOrder
- AvitoController
- lead.controller.ts
- DtoUpdateTshirtItem
- lead-notification.ts
- DtoUpdateMarketplaceAccount
- DtoSendAvitoMessage
- CanvasPricingController
- .createLead
- eslint
- PartnerStatusPollService
- @eslint/eslintrc
- globals
- prettier
- source-map-support
- @types/multer
- @types/node
- @types/passport-jwt
- typescript
- LeadController
- @nestjs/passport
- tsconfig-paths

## God Nodes (most connected - your core abstractions)
1. `PrismaService` - 88 edges
2. `Roles()` - 79 edges
3. `getErrorMessage()` - 52 edges
4. `CurrentUser` - 36 edges
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
- `AssignPanel()` --calls--> `getErrorMessage()`  [EXTRACTED]
  frontend/src/components/orders/OrderDetail.tsx → frontend/src/utils/get-error-message.ts
- `AddExpenseModal()` --calls--> `getErrorMessage()`  [EXTRACTED]
  frontend/src/pages/ReportsPage.tsx → frontend/src/utils/get-error-message.ts
- `BonusForm()` --calls--> `getErrorMessage()`  [EXTRACTED]
  frontend/src/pages/SalaryPage.tsx → frontend/src/utils/get-error-message.ts

## Import Cycles
- None detected.

## Communities (195 total, 52 thin omitted)

### Community 0 - "ozon-catalog.controller.ts"
Cohesion: 0.05
Nodes (40): DtoCreateOzonPrint, ArrayMaxSize, ArrayMinSize, ArrayNotEmpty, IsArray, IsEnum, IsInt, IsOptional (+32 more)

### Community 1 - "TasksService"
Cohesion: 0.11
Nodes (12): TasksController, Body, Controller, Delete, Get, Param, Patch, Post (+4 more)

### Community 2 - "dependencies"
Cohesion: 0.09
Nodes (23): bcryptjs, bwip-js, class-validator, dependencies, bcryptjs, bwip-js, class-validator, helmet (+15 more)

### Community 3 - "DtoUpdateUser"
Cohesion: 0.06
Nodes (28): DtoCreateUser, IsEnum, IsString, MinLength, DtoUpdateUser, IsBoolean, IsInt, IsOptional (+20 more)

### Community 4 - "telegram.module.ts"
Cohesion: 0.15
Nodes (10): TelegramModule, Module, TelegramStickerController, Controller, Get, Param, Query, Res (+2 more)

### Community 5 - "jest"
Cohesion: 0.12
Nodes (16): jest, collectCoverageFrom, coverageDirectory, moduleFileExtensions, moduleNameMapper, rootDir, testEnvironment, testRegex (+8 more)

### Community 6 - "ozon-product-catalog.controller.ts"
Cohesion: 0.17
Nodes (19): DtoOzonArchive, DtoOzonPriceItem, DtoOzonStockItem, DtoOzonUpdatePrices, DtoOzonUpdateStocks, ArrayNotEmpty, IsArray, IsBoolean (+11 more)

### Community 7 - "index.ts"
Cohesion: 0.08
Nodes (36): api, partnerSettingsApi, reportsApi, MySalaryBalance, AvitoLinkedOrder, ClosedAccrualBrief, CreateCanvasItemDto, CreateItemDto (+28 more)

### Community 8 - "OrdersPage.tsx"
Cohesion: 0.09
Nodes (32): ExecutorFilter(), Props, DELIVERY_STYLES, DeliveryBadge(), Props, FilterChip(), Props, Props (+24 more)

### Community 9 - "Roles"
Cohesion: 0.24
Nodes (6): Roles(), Body, Delete, Param, Patch, Post

### Community 10 - "System Map"
Cohesion: 0.06
Nodes (32): 2026-07-08, 2026-07-09, 2026-07-11, 2026-08-24, Access Rules, App Modules, Assignment Rules, Backend API Map (+24 more)

### Community 11 - "DtoCreateExpense"
Cohesion: 0.08
Nodes (20): DtoCreateExpense, IsEnum, IsInt, IsOptional, IsString, Min, ExpensesController, Body (+12 more)

### Community 12 - "reports.service.ts"
Cohesion: 0.07
Nodes (34): calcOrderProfit(), forecastSalary(), kopecksToRub(), OrderProfit, OrderProfitInput, SHEET, DECLARED_PRINTS_PER_SHEET, HALF_SHEET_WORDS (+26 more)

### Community 13 - "OrderDetail.tsx"
Cohesion: 0.08
Nodes (33): ordersApi, DispatchToExecutorModal(), PayoutInfo, Props, rub(), GulianSyncBlock(), Props, STATUS_LABELS (+25 more)

### Community 14 - "daily-plan-rules.ts"
Cohesion: 0.05
Nodes (65): buildDailyPlanMessage(), buildShipmentBlock(), dayMonth(), DELIVERY_LABEL, effectiveDeadline(), executorKey(), inWorkTail(), isWithinPlanWindow() (+57 more)

### Community 16 - "Брендбук — Распечатка PRO"
Cohesion: 0.08
Nodes (24): 1. Анализ конкурентов, 2. Психология цвета, 3. Цветовая палитра, 4. Типографика, 5. Логотип и иконка, 6. Правила применения, 7. Tone of Voice, 8. Применение на сайте (будущее) (+16 more)

### Community 17 - "CurrentUser"
Cohesion: 0.16
Nodes (8): CurrentUser, OrderPhotoController, Controller, Get, Query, Res, UseGuards, UseInterceptors

### Community 18 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, allowSyntheticDefaultImports, baseUrl, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, forceConsistentCasingInFileNames (+14 more)

### Community 19 - "tasks.controller.ts"
Cohesion: 0.12
Nodes (20): DtoCreateTask, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength (+12 more)

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
Cohesion: 0.16
Nodes (14): line(), buildPhotoItemLines(), buildTshirtItemLines(), drawInstagramIcon(), drawTelegramIcon(), FONT_DIR, formatRub(), PRINT_LOCATION_LABELS (+6 more)

### Community 25 - "TshirtItemsTable.tsx"
Cohesion: 0.08
Nodes (23): Props, EditState, ItemsTable(), Props, AssignPanelProps, Props, EditState, EMPTY (+15 more)

### Community 26 - "ApprovalEditor.tsx"
Cohesion: 0.08
Nodes (49): approvalsApi, mockupsApi, ApprovalEditor(), CmField(), downloadBlob(), Props, SIDE_LABELS, Sides (+41 more)

### Community 27 - "compilerOptions"
Cohesion: 0.10
Nodes (20): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+12 more)

### Community 28 - "DtoCreateOrder"
Cohesion: 0.08
Nodes (26): DtoCreateItemOrder, IsBoolean, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min (+18 more)

### Community 29 - "partner-api.controller.ts"
Cohesion: 0.16
Nodes (14): DtoPartnerStatus, IsString, Body, Patch, FLOW_RANK, FROM_PARTNER, fromPartnerStatus(), mapPartnerStage() (+6 more)

### Community 30 - "marketplace.module.ts"
Cohesion: 0.09
Nodes (23): ApprovalModule, Module, CanvasModule, Module, MarketplaceModule, Module, OrderPhotoModule, Module (+15 more)

### Community 31 - "review-reminder.service.ts"
Cohesion: 0.17
Nodes (12): isReviewReminderEligible(), REVIEW_REMINDER_CATEGORIES, REVIEW_REMINDER_DELAY_MS, REVIEW_REMINDER_PICKUP_DELAY_MS, REVIEW_REMINDER_STATUSES, reviewReminderDelayMs(), buildReviewRequestText(), categoryLabel() (+4 more)

### Community 32 - "PartnerAdminController"
Cohesion: 0.19
Nodes (9): PartnerAdminController, Controller, Get, Param, Post, Res, UploadedFiles, UseGuards (+1 more)

### Community 33 - "devDependencies"
Cohesion: 0.11
Nodes (19): eslint-plugin-react-hooks, devDependencies, eslint, eslint-plugin-react-hooks, globals, @tailwindcss/vite, @types/node, @types/react (+11 more)

### Community 34 - "getErrorMessage"
Cohesion: 0.15
Nodes (16): UnitEconomicsSettings, shipmentLeadApi, SettingsPage, EconomicsSettings(), DailyPlanCard(), Example(), FormState, money() (+8 more)

### Community 35 - "DtoCreateLead"
Cohesion: 0.13
Nodes (15): DtoCreateLead, IsBoolean, IsEnum, IsIn, IsInt, IsObject, IsOptional, IsString (+7 more)

### Community 36 - "OzonPhotoStorageService"
Cohesion: 0.12
Nodes (13): OzonPhotoStorageService, Injectable, OzonPhotoController, Controller, Get, Param, Post, Req (+5 more)

### Community 37 - "salary.controller.ts"
Cohesion: 0.05
Nodes (34): DtoCreateBonus, IsInt, IsString, IsUUID, MaxLength, Min, MinLength, Type (+26 more)

### Community 38 - "Интеграция с исполнителем-партнёром (печать футболок)"
Cohesion: 0.12
Nodes (15): 1. Модель взаимодействия, 2. Аутентификация, 3. Webhook, который мы отправляем партнёру, 4.1 Данные заказа, 4.2 ТЗ-фото (макет), 4.3 Стикер (PDF, 58×40 мм), 4.4 Смена статуса заказа (партнёр → нам), 4. Эндпоинты, откуда партнёр забирает данные (pull) (+7 more)

### Community 39 - "OzonImportService"
Cohesion: 0.14
Nodes (6): OzonImportPollService, Injectable, OzonImportService, Injectable, OzonCatalogService, Injectable

### Community 40 - "CRM «Распечатка» — как всё устроено"
Cohesion: 0.11
Nodes (18): 10. Слабые места, 11. Что дальше, 1. Что это, 2. Из чего собрано, 3. Продукты и статусы, 4. Деньги, 5. Роли, 6. Сценарии оформления (+10 more)

### Community 41 - "partner-payload.ts"
Cohesion: 0.19
Nodes (11): PartnerOutboundService, Injectable, buildPartnerOrderPayload(), PartnerOrderForPayload, PartnerOrderPayload, PRINT_LOCATION_LABELS, PRINT_TYPE_LABELS, getTechSpecPathAt() (+3 more)

### Community 42 - "auth.controller.ts"
Cohesion: 0.13
Nodes (14): AuthController, Body, Controller, Get, Post, Throttle, UseGuards, AuthModule (+6 more)

### Community 43 - "ozon-unit-economics.service.ts"
Cohesion: 0.14
Nodes (16): OzonProductTariffs, calculateUnitEconomics(), OzonTariffs, realSettings, settings, tariffs, UnitEconomicsLine, UnitEconomicsResult (+8 more)

### Community 44 - "tshirt-partner-telegram.service.ts"
Cohesion: 0.15
Nodes (18): escapeHtml(), EXT_CONTENT_TYPE, money(), PRINT_LOCATION_LABELS, PRINT_TYPE_LABELS, TechSpecAttachment, TshirtOrderWithItems, Db (+10 more)

### Community 45 - "ozon-product-catalog.service.ts"
Cohesion: 0.09
Nodes (21): OzonActionView, OzonCatalogProduct, OzonContentRating, OzonDemand, OzonImportAttributeBody, OzonProductCard, RawActionsResponse, RawAnalyticsResponse (+13 more)

### Community 46 - "OrderPhotoService"
Cohesion: 0.09
Nodes (16): DtoAllOrdersforQuery, IsEnum, IsIn, IsInt, IsOptional, IsString, Matches, Max (+8 more)

### Community 47 - "order-photo.service.ts"
Cohesion: 0.07
Nodes (36): buildCommunicationUrl(), buildMaxUrl(), DEFAULT_MAX_LINK_TEMPLATE, formatPhoneForDisplay(), normalizePhone(), validateCommunicationValue(), DtoAssignExecutor, IsOptional (+28 more)

### Community 48 - "salary-integrity.spec.ts"
Cohesion: 0.11
Nodes (17): calculateSalarySnapshot(), earnsStaffSalary(), ManagerSalarySnapshot, SalarySnapshot, AccrualByIdRow, AsyncMock, createOrderService(), CreatePaymentArgs (+9 more)

### Community 49 - "ReportsPage.tsx"
Cohesion: 0.09
Nodes (32): expensesApi, SalaryPage, buildReceiptHtml(), buildReceiptTitle(), escapeHtml(), formatFilenameDate(), printReceipt(), sanitizeFilenamePart() (+24 more)

### Community 50 - "CreateOrderForm.tsx"
Cohesion: 0.10
Nodes (25): baseSchema, canvasItemSchema, clearOrderDraft(), CreateOrderForm(), EMPTY_ORDER_FORM, FormValues, freeItemSchema, fullSchema (+17 more)

### Community 51 - "Исправленные проблемы"
Cohesion: 0.18
Nodes (10): CRITICAL, CRM Audit Report — 2026-06-14, HIGH, HIGH, LOW, MEDIUM, MEDIUM, Исправленные проблемы (+2 more)

### Community 52 - "crm-new/README.md"
Cohesion: 0.20
Nodes (9): Compile and run the project, Deployment, Description, License, Project setup, Resources, Run tests, Stay in touch (+1 more)

### Community 53 - "App.tsx"
Cohesion: 0.09
Nodes (27): authApi, salaryApi, AdminRoute(), App(), AppRoutes(), CrmGate(), HomeRedirect(), LoginPage (+19 more)

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
Cohesion: 0.10
Nodes (29): DPI_ACCEPTABLE, DPI_GOOD, estimateDpi(), formatCm(), formatSizeCm(), isCalibrated(), isOutsidePrintArea(), PrintAreaCalibration (+21 more)

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
Cohesion: 0.29
Nodes (7): devDependencies, eslint-config-prettier, eslint-plugin-prettier, @types/express, eslint-config-prettier, eslint-plugin-prettier, @types/express

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
Cohesion: 0.15
Nodes (9): GulianModule, Module, GulianOutboxProcessorService, RETRY_DELAYS_SECONDS, Injectable, GulianOrderPayload, GulianResponse, GulianService (+1 more)

### Community 71 - "seed.js"
Cohesion: 0.40
Nodes (3): bcrypt, { Client }, { randomUUID }

### Community 72 - "order-photo.controller.ts"
Cohesion: 0.06
Nodes (33): DtoCreateCanvasItem, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, Type (+25 more)

### Community 73 - "scenario.registry.ts"
Cohesion: 0.15
Nodes (18): DELIVERY_STEPS, NOTE_STEP, OPTIONAL, PHOTO_SCENARIO, TSHIRT_SCENARIO, ProductDefinition, PRODUCTS, validateAllScenarios() (+10 more)

### Community 74 - "React + TypeScript + Vite"
Cohesion: 0.50
Nodes (3): Expanding the ESLint configuration, React Compiler, React + TypeScript + Vite

### Community 76 - "shipment-reminder-rules.ts"
Cohesion: 0.16
Nodes (11): buildShipmentReminder(), DEADLINE_METHODS, dueReminderStage(), hasDeadline(), hoursLeft(), SHIPMENT_REMINDER_STAGES_MS, ShipmentOrder, START (+3 more)

### Community 79 - "OzonCredentials"
Cohesion: 0.23
Nodes (3): OzonCredentials, OzonProductCatalogService, Injectable

### Community 81 - "partner-telegram-format.ts"
Cohesion: 0.21
Nodes (10): buildPartnerButtons(), buildPartnerCaption(), calcSettlement(), esc(), PartnerOrderData, PartnerOrderItem, PRINT_LOCATION_LABELS, PRINT_TYPE_LABELS (+2 more)

### Community 82 - "ozon-import.service.ts"
Cohesion: 0.13
Nodes (12): DEFAULT_SIZE_DIMENSIONS, OzonCatalogTemplateService, Injectable, UpdateOzonCatalogTemplateInput, IMPORT_BATCH_SIZE, OzonImportItem, VariantDimensions, OzonAttributeValueOption (+4 more)

### Community 83 - "ozon-attributes.ts"
Cohesion: 0.10
Nodes (33): buildExtraImages(), buildImportItem(), buildOfferId(), CatalogTemplateForImport, chunk(), COLOR_CODE_BY_LABEL, colorCodeFor(), DEFAULT_SIZES (+25 more)

### Community 87 - "ApprovalService"
Cohesion: 0.22
Nodes (5): ApprovalService, Injectable, ApprovalSides, filledSides(), parseSides()

### Community 88 - "PartnerSettingsService"
Cohesion: 0.12
Nodes (12): PartnerSettingsController, Body, Controller, Get, Patch, UseGuards, PartnerSettingsService, AnyMock (+4 more)

### Community 91 - "MarketplaceController"
Cohesion: 0.11
Nodes (16): DtoCreateMarketplaceAccount, IsEnum, IsString, MaxLength, MinLength, MarketplaceController, Body, Controller (+8 more)

### Community 93 - "MockupService"
Cohesion: 0.11
Nodes (14): MockupController, Body, Controller, Delete, Get, Param, Patch, Post (+6 more)

### Community 94 - "telegram.service.ts"
Cohesion: 0.21
Nodes (8): logger, proxyDispatcher(), resetTelegramProxyCache(), telegramFetch(), telegramFormData(), TgUpdateWithId, describeTelegramError(), TelegramSendResult

### Community 95 - ".webhook"
Cohesion: 0.24
Nodes (7): TgUpdate, constantTimeEqual(), TelegramWebhookController, Body, Controller, Post, Headers

### Community 96 - "OzonCatalogController"
Cohesion: 0.19
Nodes (10): OzonCatalogController, Body, Controller, Delete, Get, Param, Patch, Post (+2 more)

### Community 97 - "crm-new/package.json"
Cohesion: 0.29
Nodes (6): author, description, license, name, private, version

### Community 98 - "ProductsTab.tsx"
Cohesion: 0.10
Nodes (35): EnumTshirtGender, OzonColorGroupInput, OzonPrint, OzonVariant, Draft, EditPrintModal(), ALL_SIZES, COLOR_CODE_BY_LABEL (+27 more)

### Community 100 - "MarketplaceAccountService"
Cohesion: 0.12
Nodes (14): ACCOUNT_INCLUDE, AccountRow, CreateAccountInput, MarketplaceAccountService, MarketplaceAccountView, Injectable, UpdateAccountInput, OzonService (+6 more)

### Community 102 - ".credentials"
Cohesion: 0.22
Nodes (9): OzonProductCatalogController, Body, Controller, Get, Param, Patch, Post, Query (+1 more)

### Community 112 - "AvitoMessengerService"
Cohesion: 0.25
Nodes (3): AvitoMessengerService, Injectable, AvitoMessage

### Community 113 - "partner.module.ts"
Cohesion: 0.27
Nodes (4): StickerModule, Module, PartnerTokenGuard, Injectable

### Community 114 - "DtoUpdatePartnerSettings"
Cohesion: 0.25
Nodes (7): DtoUpdatePartnerSettings, IsInt, IsOptional, IsString, Max, MaxLength, Min

### Community 121 - "partner-admin.controller.ts"
Cohesion: 0.22
Nodes (6): ALLOWED, EXT_CONTENT_TYPE, TECH_SPEC_MAX_BYTES, TECH_SPEC_MAX_FILES, TechSpecStorageService, Injectable

### Community 123 - "current-user.decorator.ts"
Cohesion: 0.16
Nodes (9): AuthenticatedRequest, AuthenticatedUser, PRICE_FIELDS, strip(), StripPricesInterceptor, Injectable, MarketplaceAccessGuard, guard_() (+1 more)

### Community 124 - "ТЗ: семантика и структура страниц raspechatkaa.ru"
Cohesion: 0.07
Nodes (27): P10. Холст — `/interer/holst`, P1. Где распечатать фото в Москве — `/gde-raspechatat-foto-v-moskve`, P2. Цены — `/ceny`, P3. Размеры и форматы фото — `/formaty`, P4. Печать фото А4 — `/catalog/foto-a4`, P5. Печать фото на документы — `/dokumenty`, P6. Печать фото онлайн с доставкой — `/onlayn`, P7. Бумага и качество — `/bumaga` (+19 more)

### Community 126 - "DtoUpdateOzonPrint"
Cohesion: 0.17
Nodes (11): DtoUpdateOzonPrint, ArrayMaxSize, IsArray, IsEnum, IsInt, IsOptional, IsString, IsUrl (+3 more)

### Community 130 - "ApprovalController"
Cohesion: 0.13
Nodes (15): ApprovalController, parseSide(), Body, Controller, Delete, Get, Param, Patch (+7 more)

### Community 131 - "TshirtPartnerTelegramService"
Cohesion: 0.17
Nodes (4): GulianOutboxService, Injectable, Injectable, TshirtPartnerTelegramService

### Community 132 - "approval.service.ts"
Cohesion: 0.15
Nodes (14): SIDES, approvalInclude, SIZE_LABELS, DtoCreateApproval, IsEnum, IsOptional, IsString, IsUUID (+6 more)

### Community 134 - "PrismaService"
Cohesion: 0.10
Nodes (15): JwtPayload, JwtStrategy, Injectable, HealthController, Controller, Get, FinancialClient, OrderFinancialIntegrityService (+7 more)

### Community 135 - "roles.guard.ts"
Cohesion: 0.21
Nodes (10): ROLES_KEY, JwtAuthGuard, Injectable, RolesGuard, Injectable, RequestUser, ALLOWED_INPUT, OZON_PHOTO_MAX_BYTES (+2 more)

### Community 136 - "CanvasItemService"
Cohesion: 0.13
Nodes (10): CanvasItemService, canvasMoney(), Injectable, OrderItemService, Injectable, ShipmentLeadService, Injectable, Injectable (+2 more)

### Community 137 - "Выкатка: репозиторий → сервер"
Cohesion: 0.29
Nodes (6): Выкатка: репозиторий → сервер, Как это устроено на сервере, Команды, Откат, Почему именно так, Чего в цепочке пока нет

### Community 138 - "main.ts"
Cohesion: 0.50
Nodes (4): AppModule, Module, allowedOrigins(), bootstrap()

### Community 140 - "2. Что уже сделано (этап 2 — карточки товаров)"
Cohesion: 0.10
Nodes (19): 1.1. Что показал живой кабинет (17.08.2026), 1. Что уже сделано (этап 1 — подключение), 2.1. Порядок работы с товаром в Ozon Seller API (справочно), 2.2. Заказы (этап 3, только чтение), 2.3. Мои товары и юнит-экономика (этап 4), 2. Что уже сделано (этап 2 — карточки товаров), 3. Дальше, API CRM (+11 more)

### Community 141 - "OzonOrdersController"
Cohesion: 0.25
Nodes (6): OzonOrdersController, Controller, Get, Param, Query, UseGuards

### Community 142 - "site-lead-token.guard.ts"
Cohesion: 0.33
Nodes (7): constantTimeEqual(), readBearerToken(), readHeader(), SignedRequest, SiteLeadTokenGuard, stripPrefix(), Injectable

### Community 143 - "nginx-routes.spec.ts"
Cohesion: 0.22
Nodes (4): FRONTEND, NGINX_CONF, SRC, VITE_CONF

### Community 144 - "DtoUpdateOzonCatalogTemplate"
Cohesion: 0.17
Nodes (11): DtoUpdateOzonCatalogTemplate, ArrayMaxSize, IsArray, IsBoolean, IsInt, IsObject, IsOptional, IsString (+3 more)

### Community 145 - "OzonApiClient"
Cohesion: 0.15
Nodes (8): humanize(), OzonApiClient, OzonApiError, OzonErrorBody, Injectable, OzonConnectionInfo, OzonProductListResponse, OzonWarehouseListResponse

### Community 146 - "ТЗ: раздел «Печать на холсте» на raspechatkaa.ru"
Cohesion: 0.10
Nodes (19): Берём после сезона, Берём сразу, до сезона, Блок 0. Контекст и границы, Блок 10. Интеграция с CRM, Блок 11. Что НЕ делать, Блок 12. Технологическое преимущество, Блок 1. Информационная архитектура и URL, Блок 2. Хлебные крошки и связность (+11 more)

### Community 147 - "canvas-production.controller.ts"
Cohesion: 0.19
Nodes (14): CanvasProductionController, Controller, Get, UseGuards, CANVAS_MATERIAL_KIND_LABELS, CANVAS_PRODUCTION_PRICES, canvasContractorCost(), CanvasMaterialKind (+6 more)

### Community 149 - "scenario.controller.ts"
Cohesion: 0.13
Nodes (14): DtoDetectProduct, IsString, MaxLength, DtoSaveDraft, IsObject, IsOptional, IsString, MaxLength (+6 more)

### Community 150 - "usePersistentState"
Cohesion: 0.16
Nodes (15): canvasProductionApi, CanvasProductionPricing, CanvasProductionSize, ProductsTab(), CanvasItemsTable(), EditState, EMPTY, money() (+7 more)

### Community 151 - "scenario-draft.service.ts"
Cohesion: 0.20
Nodes (10): calcOrderTotal(), DraftState, ScenarioDraftService, Injectable, FakeOrder, READY_PHOTO, READY_TSHIRT, findProduct() (+2 more)

### Community 153 - "ScenarioController"
Cohesion: 0.20
Nodes (9): ScenarioController, Body, Controller, Get, Param, Patch, Post, UseGuards (+1 more)

### Community 155 - "canvas.pricing.ts"
Cohesion: 0.23
Nodes (12): calcCanvasUnitPrice(), calcCanvasUrgencyFee(), CANVAS_FRAME_LABELS, CANVAS_MATERIAL_LABELS, CANVAS_SIZES, CanvasFrame, CanvasMaterial, CanvasSize (+4 more)

### Community 160 - "avito.service.ts"
Cohesion: 0.12
Nodes (12): AvitoModule, Module, AvitoAccount, AvitoChat, AvitoChatUser, AvitoNotConfiguredError, AvitoRating, AvitoReview (+4 more)

### Community 162 - "scenario.mapping.ts"
Cohesion: 0.35
Nodes (12): PAPER_LABEL, photoToOrder(), tshirtToOrder(), bool(), date(), deliveryOf(), noteOf(), num() (+4 more)

### Community 163 - "ApprovalStorageService"
Cohesion: 0.12
Nodes (8): ApprovalRenderService, formatDate(), layoutSlots(), scaleCalibration(), Injectable, wrap(), ApprovalStorageService, Injectable

### Community 164 - "mockup.controller.ts"
Cohesion: 0.18
Nodes (15): ALLOWED_IMAGE, APPROVAL_MAX_BYTES, SavedImage, UploadedImage, DtoCreateMockupTemplate, DtoUpdateMockupTemplate, IsBoolean, IsEnum (+7 more)

### Community 166 - "scenario.engine.ts"
Cohesion: 0.41
Nodes (10): detectProduct(), evaluateCondition(), evaluateScenario(), isFilled(), isStepRequired(), isStepVisible(), normalize(), pickRelevantAnswers() (+2 more)

### Community 167 - "DtoUpdateItemOrder"
Cohesion: 0.17
Nodes (11): DtoUpdateItemOrder, IsBoolean, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min (+3 more)

### Community 168 - "UsersPage.tsx"
Cohesion: 0.21
Nodes (14): usersApi, UsersPage, bpToPercent(), DesignRateEditor(), loadBadgeColor(), percentToBp(), RateEditor(), RateEditorProps (+6 more)

### Community 169 - "DtoAvitoChatQuery"
Cohesion: 0.16
Nodes (10): Get, Query, DtoAvitoChatQuery, IsBoolean, IsInt, IsOptional, IsString, Max (+2 more)

### Community 170 - "TelegramService"
Cohesion: 0.22
Nodes (4): TelegramService, Injectable, TelegramUpdateService, Injectable

### Community 171 - "telegram-update.service.ts"
Cohesion: 0.24
Nodes (8): OrderForOutbox, calcGulianPayout(), Item, PayoutResult, toGulianStatus(), ACTION_STATUS, STATUS_TOAST, TelegramCallback

### Community 172 - "DtoUpdateOzonUnitEconomics"
Cohesion: 0.22
Nodes (8): DtoUpdateOzonUnitEconomics, IsIn, IsInt, IsOptional, Max, Min, Type, IsNumber

### Community 173 - "DtoUpdateOrder"
Cohesion: 0.17
Nodes (11): DtoUpdateOrder, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Matches, MaxLength (+3 more)

### Community 174 - "AvitoController"
Cohesion: 0.27
Nodes (6): AvitoController, Body, Controller, Param, Post, UseGuards

### Community 175 - "lead.controller.ts"
Cohesion: 0.22
Nodes (3): base, meta, pipe

### Community 176 - "DtoUpdateTshirtItem"
Cohesion: 0.22
Nodes (8): DtoUpdateTshirtItem, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min, Type

### Community 177 - "lead-notification.ts"
Cohesion: 0.36
Nodes (6): buildLeadNotification(), escape(), LeadForNotification, NotifiableUser, pickLeadResponders(), toMention()

### Community 178 - "DtoUpdateMarketplaceAccount"
Cohesion: 0.29
Nodes (6): DtoUpdateMarketplaceAccount, IsBoolean, IsOptional, IsString, MaxLength, MinLength

### Community 179 - "DtoSendAvitoMessage"
Cohesion: 0.40
Nodes (4): DtoSendAvitoMessage, IsString, MaxLength, MinLength

### Community 180 - "CanvasPricingController"
Cohesion: 0.50
Nodes (3): CanvasPricingController, Controller, Get

### Community 181 - ".createLead"
Cohesion: 0.29
Nodes (4): Body, Post, isUniqueViolation(), HttpCode

### Community 192 - "LeadController"
Cohesion: 0.33
Nodes (5): LeadController, Controller, Throttle, UseGuards, UsePipes

## Knowledge Gaps
- **736 isolated node(s):** `$schema`, `collection`, `sourceRoot`, `deleteOutDir`, `name` (+731 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **52 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Roles()` connect `Roles` to `ozon-catalog.controller.ts`, `TasksService`, `ApprovalController`, `DtoUpdateUser`, `approval.service.ts`, `ozon-product-catalog.controller.ts`, `roles.guard.ts`, `DtoCreateExpense`, `reports.service.ts`, `OzonOrdersController`, `CurrentUser`, `canvas-production.controller.ts`, `tasks.controller.ts`, `scenario.controller.ts`, `ScenarioController`, `PartnerAdminController`, `mockup.controller.ts`, `OzonPhotoStorageService`, `salary.controller.ts`, `DtoAvitoChatQuery`, `AvitoController`, `order-photo.controller.ts`, `PartnerSettingsService`, `MarketplaceController`, `MockupService`, `OzonCatalogController`, `.credentials`, `partner-admin.controller.ts`?**
  _High betweenness centrality (0.098) - this node is a cross-community bridge._
- **Why does `PrismaService` connect `PrismaService` to `TasksService`, `TshirtPartnerTelegramService`, `approval.service.ts`, `DtoUpdateUser`, `CanvasItemService`, `DtoCreateExpense`, `reports.service.ts`, `daily-plan-rules.ts`, `AvitoService`, `tasks.controller.ts`, `scenario-draft.service.ts`, `sticker.service.ts`, `partner-api.controller.ts`, `marketplace.module.ts`, `review-reminder.service.ts`, `PartnerAdminController`, `ApprovalStorageService`, `mockup.controller.ts`, `salary.controller.ts`, `OzonImportService`, `partner-payload.ts`, `auth.controller.ts`, `telegram-update.service.ts`, `ozon-unit-economics.service.ts`, `tshirt-partner-telegram.service.ts`, `OrderPhotoService`, `order-photo.service.ts`, `salary-integrity.spec.ts`, `TelegramService`, `PartnerApiController`, `PartnerStatusPollService`, `GulianService`, `shipment-reminder-rules.ts`, `ozon-import.service.ts`, `ozon-attributes.ts`, `PartnerSettingsService`, `MockupService`, `MarketplaceAccountService`, `OzonPrintService`, `partner-admin.controller.ts`, `current-user.decorator.ts`?**
  _High betweenness centrality (0.077) - this node is a cross-community bridge._
- **Why does `PartnerAdminController` connect `PartnerAdminController` to `partner-admin.controller.ts`, `Roles`, `partner.module.ts`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **What connects `$schema`, `collection`, `sourceRoot` to the rest of the system?**
  _736 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ozon-catalog.controller.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05454545454545454 - nodes in this community are weakly interconnected._
- **Should `TasksService` be split into smaller, more focused modules?**
  _Cohesion score 0.11397849462365592 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._