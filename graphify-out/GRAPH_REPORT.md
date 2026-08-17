# Graph Report - raspechatka  (2026-08-17)

## Corpus Check
- 331 files · ~140,265 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2539 nodes · 4918 edges · 164 communities (112 shown, 52 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 159 edges (avg confidence: 0.79)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9a0b7ca3`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- DtoCreateOzonPrint
- CurrentUser
- dependencies
- DtoUpdateUser
- TelegramStickerLinkService
- jest
- TelegramService
- index.ts
- OrdersPage.tsx
- OrderPhotoController
- System Map
- expenses.controller.ts
- reports.service.ts
- OrderDetail.tsx
- daily-plan-rules.ts
- AvitoService
- Брендбук — Распечатка PRO
- .assertOrderFinanciallyEditable
- compilerOptions
- TasksPage.tsx
- compilerOptions
- Аудит проекта «Распечатка» — 2026-06-14
- AppShell.tsx
- dependencies
- sticker.service.ts
- TshirtItemsTable.tsx
- tasks.controller.ts
- compilerOptions
- DtoCreateOrder
- partner-status.ts
- order-photo.module.ts
- review-reminder.service.ts
- TechSpecStorageService
- devDependencies
- getErrorMessage
- DtoCreateLead
- marketplace.module.ts
- SalaryService
- Интеграция с исполнителем-партнёром (печать футболок)
- ozon-catalog.service.ts
- CRM «Распечатка» — как всё устроено
- partner-api.controller.ts
- auth.controller.ts
- OrderPhotoService
- tshirt-partner-telegram.service.ts
- lead.controller.ts
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
- order-photo.controller.ts
- current-user.decorator.ts
- exclude
- Аудит финансов, кода и продакшена — 2026-07-09
- devDependencies
- AvitoPage.tsx
- nest-cli.json
- MarketplacePage.tsx
- ProductsTab.tsx
- gulian-outbox.service.ts
- seed.js
- DtoUpdateOrder
- scenario.registry.ts
- React + TypeScript + Vite
- backup-db.sh
- shipment-reminder-rules.ts
- ts-loader
- frontend/tsconfig.json
- ozon-api.client.ts
- @eslint/js
- telegram-update.service.ts
- .createOrder
- ozon-attributes.ts
- @nestjs/cli
- @nestjs/schematics
- @nestjs/testing
- .sendMessage
- DtoUpdatePartnerSettings
- supertest
- ts-jest
- MarketplaceController
- ts-node
- tsconfig-paths
- telegram.service.ts
- .webhook
- OzonCatalogController
- crm-new/package.json
- CanvasItemService
- @types/supertest
- marketplace-account.service.ts
- typescript-eslint
- MarketplaceAccountService
- eslint-plugin-react-refresh
- OzonPrintService
- tailwindcss
- typescript-eslint
- vite
- lead-notification.ts
- OzonImportService
- DtoUpdateTshirtItem
- @nestjs/core
- @nestjs/jwt
- @nestjs/mapped-types
- @nestjs/throttler
- passport
- pdf-lib
- LeadController
- @types/jest
- ozon-import.service.ts
- DtoCreateMarketplaceAccount
- @types/pdfkit
- DtoUpdateOzonPrint
- @prisma/adapter-pg
- @prisma/client
- reflect-metadata
- ScenarioController
- PrismaService
- DtoPublishOzonPrints
- DtoUpdateMarketplaceAccount
- DtoCreateItemOrder
- Roles
- DtoUpdateItemOrder
- Выкатка: репозиторий → сервер
- tech-spec-storage.service.ts
- prisma
- 2. Что уже сделано (этап 2 — карточки товаров)
- .list
- eslint-config-prettier
- nginx-routes.spec.ts
- DtoUpdateOzonCatalogTemplate
- @eslint/eslintrc
- globals
- prettier
- auto-update.sh
- source-map-support
- @types/multer
- @types/node
- @nestjs/config
- @types/passport-jwt
- @nestjs/platform-express
- typescript
- rxjs
- sharp
- undici
- @eslint/js
- web-push
- jest
- .constructor
- class-transformer

## God Nodes (most connected - your core abstractions)
1. `PrismaService` - 80 edges
2. `Roles()` - 64 edges
3. `getErrorMessage()` - 37 edges
4. `CurrentUser` - 34 edges
5. `OrderPhotoController` - 34 edges
6. `TelegramService` - 29 edges
7. `useAuth()` - 27 edges
8. `OrderPhotoService` - 26 edges
9. `PartnerSettingsService` - 24 edges
10. `AvitoService` - 23 edges

## Surprising Connections (you probably didn't know these)
- `AccountCard()` --calls--> `getErrorMessage()`  [EXTRACTED]
  frontend/src/components/marketplace/ConnectionTab.tsx → frontend/src/utils/get-error-message.ts
- `AccountForm()` --calls--> `getErrorMessage()`  [EXTRACTED]
  frontend/src/components/marketplace/ConnectionTab.tsx → frontend/src/utils/get-error-message.ts
- `PrintsList()` --calls--> `getErrorMessage()`  [EXTRACTED]
  frontend/src/components/marketplace/ProductsTab.tsx → frontend/src/utils/get-error-message.ts
- `AvitoController` --references--> `Roles()`  [EXTRACTED]
  crm-new/src/avito/avito.controller.ts → crm-new/src/auth/decorators/roles.decorator.ts
- `ExpensesController` --references--> `Roles()`  [EXTRACTED]
  crm-new/src/expenses/expenses.controller.ts → crm-new/src/auth/decorators/roles.decorator.ts

## Import Cycles
- None detected.

## Communities (164 total, 52 thin omitted)

### Community 0 - "DtoCreateOzonPrint"
Cohesion: 0.06
Nodes (33): DtoCreateOzonPrint, ArrayMaxSize, ArrayMinSize, ArrayNotEmpty, IsArray, IsEnum, IsInt, IsOptional (+25 more)

### Community 1 - "CurrentUser"
Cohesion: 0.11
Nodes (13): CurrentUser, TasksController, Body, Controller, Delete, Get, Param, Patch (+5 more)

### Community 2 - "dependencies"
Cohesion: 0.09
Nodes (23): bcryptjs, bwip-js, class-validator, dependencies, bcryptjs, bwip-js, class-validator, helmet (+15 more)

### Community 3 - "DtoUpdateUser"
Cohesion: 0.06
Nodes (28): DtoCreateUser, IsEnum, IsString, MinLength, DtoUpdateUser, IsBoolean, IsInt, IsOptional (+20 more)

### Community 4 - "TelegramStickerLinkService"
Cohesion: 0.16
Nodes (8): TelegramStickerController, Controller, Get, Param, Query, Res, TelegramStickerLinkService, Injectable

### Community 5 - "jest"
Cohesion: 0.12
Nodes (16): jest, collectCoverageFrom, coverageDirectory, moduleFileExtensions, moduleNameMapper, rootDir, testEnvironment, testRegex (+8 more)

### Community 6 - "TelegramService"
Cohesion: 0.15
Nodes (5): buildPartnerButtons(), Injectable, TshirtPartnerTelegramService, TelegramService, Injectable

### Community 7 - "index.ts"
Cohesion: 0.07
Nodes (39): api, expensesApi, reportsApi, MySalaryBalance, shipmentLeadApi, AvitoLinkedOrder, ClosedAccrualBrief, CreateCanvasItemDto (+31 more)

### Community 8 - "OrdersPage.tsx"
Cohesion: 0.10
Nodes (30): OrdersPage, DELIVERY_STYLES, DeliveryBadge(), Props, Props, STATUS_STYLES, StatusBadge(), CANVAS_STATUS_FLOW (+22 more)

### Community 9 - "OrderPhotoController"
Cohesion: 0.12
Nodes (12): OrderPhotoController, Body, Controller, Delete, Get, Param, Patch, Post (+4 more)

### Community 10 - "System Map"
Cohesion: 0.06
Nodes (30): 2026-07-08, 2026-07-09, 2026-07-11, Access Rules, App Modules, Assignment Rules, Backend API Map, Backend Map (+22 more)

### Community 11 - "expenses.controller.ts"
Cohesion: 0.09
Nodes (21): DtoCreateExpense, IsEnum, IsInt, IsOptional, IsString, Min, ExpensesController, RequestUser (+13 more)

### Community 12 - "reports.service.ts"
Cohesion: 0.07
Nodes (36): calcOrderProfit(), forecastSalary(), kopecksToRub(), OrderProfit, OrderProfitInput, SHEET, DECLARED_PRINTS_PER_SHEET, HALF_SHEET_WORDS (+28 more)

### Community 13 - "OrderDetail.tsx"
Cohesion: 0.09
Nodes (32): ordersApi, DispatchToExecutorModal(), PayoutInfo, Props, rub(), GulianSyncBlock(), Props, STATUS_LABELS (+24 more)

### Community 14 - "daily-plan-rules.ts"
Cohesion: 0.05
Nodes (65): buildDailyPlanMessage(), buildShipmentBlock(), dayMonth(), DELIVERY_LABEL, effectiveDeadline(), executorKey(), inWorkTail(), isWithinPlanWindow() (+57 more)

### Community 15 - "AvitoService"
Cohesion: 0.05
Nodes (32): AvitoController, Controller, Get, Param, Post, Query, UseGuards, AvitoMessengerService (+24 more)

### Community 16 - "Брендбук — Распечатка PRO"
Cohesion: 0.08
Nodes (24): 1. Анализ конкурентов, 2. Психология цвета, 3. Цветовая палитра, 4. Типографика, 5. Логотип и иконка, 6. Правила применения, 7. Tone of Voice, 8. Применение на сайте (будущее) (+16 more)

### Community 17 - ".assertOrderFinanciallyEditable"
Cohesion: 0.23
Nodes (5): OrderItemService, Injectable, Injectable, TshirtItemService, calculateManagerSalarySnapshot()

### Community 18 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, allowSyntheticDefaultImports, baseUrl, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, forceConsistentCasingInFileNames (+14 more)

### Community 19 - "TasksPage.tsx"
Cohesion: 0.14
Nodes (18): tasksApi, TasksQuery, TasksPage, Modal(), Props, daysUntil(), DeadlineChip(), EMPTY_FORM (+10 more)

### Community 20 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection, moduleResolution (+14 more)

### Community 21 - "Аудит проекта «Распечатка» — 2026-06-14"
Cohesion: 0.09
Nodes (21): 10.1 Почему PDF «не формировался» и долго генерировался, 10.2 Декомпозиция API-слоя (был god-файл), 10.3 Группировка компонентов, 10.4 Автоматические бэкапы БД (рекомендация №1), 10.5 Итоговая структура фронта, 10.6 Деплой раунда 2, 10. Раунд 2 — PDF, декомпозиция API/компонентов, бэкапы (тот же день), 1. Резюме и метрики (+13 more)

### Community 22 - "AppShell.tsx"
Cohesion: 0.10
Nodes (20): salaryApi, MySalaryPage, AppShell(), NavProps, Props, AD_MGR, ADMIN, ALL (+12 more)

### Community 23 - "dependencies"
Cohesion: 0.10
Nodes (21): axios, dependencies, axios, @hookform/resolvers, lucide-react, react, react-dom, react-hook-form (+13 more)

### Community 24 - "sticker.service.ts"
Cohesion: 0.18
Nodes (13): buildPhotoItemLines(), buildTshirtItemLines(), drawInstagramIcon(), drawTelegramIcon(), FONT_DIR, formatRub(), PRINT_LOCATION_LABELS, req (+5 more)

### Community 25 - "TshirtItemsTable.tsx"
Cohesion: 0.08
Nodes (24): CanvasItemsTable(), EditState, EMPTY, money(), Props, toDto(), EditState, ItemsTable() (+16 more)

### Community 26 - "tasks.controller.ts"
Cohesion: 0.12
Nodes (20): DtoCreateTask, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength (+12 more)

### Community 27 - "compilerOptions"
Cohesion: 0.10
Nodes (20): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+12 more)

### Community 28 - "DtoCreateOrder"
Cohesion: 0.09
Nodes (23): DtoCreateOrder, IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString (+15 more)

### Community 29 - "partner-status.ts"
Cohesion: 0.13
Nodes (13): Body, Patch, FLOW_RANK, FROM_PARTNER, fromPartnerStatus(), mapPartnerStage(), PARTNER_SETTABLE_STATUSES, PARTNER_STAGE_MAP (+5 more)

### Community 30 - "order-photo.module.ts"
Cohesion: 0.10
Nodes (23): AppModule, Module, GulianModule, Module, allowedOrigins(), bootstrap(), MarketplaceModule, Module (+15 more)

### Community 31 - "review-reminder.service.ts"
Cohesion: 0.16
Nodes (12): isReviewReminderEligible(), REVIEW_REMINDER_CATEGORIES, REVIEW_REMINDER_DELAY_MS, REVIEW_REMINDER_PICKUP_DELAY_MS, REVIEW_REMINDER_STATUSES, reviewReminderDelayMs(), buildReviewRequestText(), categoryLabel() (+4 more)

### Community 32 - "TechSpecStorageService"
Cohesion: 0.13
Nodes (11): PartnerAdminController, Controller, Get, Param, Post, Res, UploadedFiles, UseGuards (+3 more)

### Community 33 - "devDependencies"
Cohesion: 0.11
Nodes (19): eslint-plugin-react-hooks, devDependencies, eslint, eslint-plugin-react-hooks, globals, @tailwindcss/vite, @types/node, @types/react (+11 more)

### Community 34 - "getErrorMessage"
Cohesion: 0.09
Nodes (33): partnerSettingsApi, usersApi, SettingsPage, UsersPage, AssignPanel(), StatusStepper(), AddExpenseModal(), BonusForm() (+25 more)

### Community 35 - "DtoCreateLead"
Cohesion: 0.11
Nodes (16): DtoCreateLead, base, meta, pipe, IsBoolean, IsEnum, IsIn, IsInt (+8 more)

### Community 36 - "marketplace.module.ts"
Cohesion: 0.09
Nodes (19): OzonOrdersController, Controller, UseGuards, ALLOWED_INPUT, OZON_PHOTO_MAX_BYTES, OZON_PHOTO_MAX_FILES, OzonPhotoStorageService, Injectable (+11 more)

### Community 37 - "SalaryService"
Cohesion: 0.05
Nodes (33): DtoCreateBonus, IsInt, IsString, IsUUID, MaxLength, Min, MinLength, Type (+25 more)

### Community 38 - "Интеграция с исполнителем-партнёром (печать футболок)"
Cohesion: 0.12
Nodes (15): 1. Модель взаимодействия, 2. Аутентификация, 3. Webhook, который мы отправляем партнёру, 4.1 Данные заказа, 4.2 ТЗ-фото (макет), 4.3 Стикер (PDF, 58×40 мм), 4.4 Смена статуса заказа (партнёр → нам), 4. Эндпоинты, откуда партнёр забирает данные (pull) (+7 more)

### Community 39 - "ozon-catalog.service.ts"
Cohesion: 0.17
Nodes (9): OzonCredentials, OzonImportItem, OzonAttributeValueOption, OzonAttributeValuesSearchResponse, OzonCatalogService, OzonImportInfoItem, OzonImportInfoResponse, OzonImportResponse (+1 more)

### Community 40 - "CRM «Распечатка» — как всё устроено"
Cohesion: 0.11
Nodes (18): 10. Слабые места, 11. Что дальше, 1. Что это, 2. Из чего собрано, 3. Продукты и статусы, 4. Деньги, 5. Роли, 6. Сценарии оформления (+10 more)

### Community 41 - "partner-api.controller.ts"
Cohesion: 0.12
Nodes (16): DtoPartnerStatus, IsString, PartnerOutboundService, Injectable, buildPartnerOrderPayload(), PartnerOrderForPayload, PartnerOrderPayload, PRINT_LOCATION_LABELS (+8 more)

### Community 42 - "auth.controller.ts"
Cohesion: 0.13
Nodes (14): AuthController, Body, Controller, Get, Post, Throttle, UseGuards, AuthModule (+6 more)

### Community 43 - "OrderPhotoService"
Cohesion: 0.22
Nodes (6): escapeHtml(), formatRuDate(), isExternalProductionCategory(), needsShipmentStatus(), OrderPhotoService, Injectable

### Community 44 - "tshirt-partner-telegram.service.ts"
Cohesion: 0.09
Nodes (24): escapeHtml(), EXT_CONTENT_TYPE, money(), PRINT_LOCATION_LABELS, PRINT_TYPE_LABELS, TechSpecAttachment, TshirtOrderWithItems, Db (+16 more)

### Community 45 - "lead.controller.ts"
Cohesion: 0.30
Nodes (7): constantTimeEqual(), readBearerToken(), readHeader(), SignedRequest, SiteLeadTokenGuard, stripPrefix(), Injectable

### Community 46 - "DtoAllOrdersforQuery"
Cohesion: 0.14
Nodes (11): DtoAllOrdersforQuery, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength (+3 more)

### Community 47 - "order-photo.service.ts"
Cohesion: 0.09
Nodes (22): DtoAssignExecutor, IsOptional, IsString, IsUUID, IsEnum, UpdateStatus, LeadMoneyError, LeadMoneyInput (+14 more)

### Community 48 - "salary-integrity.spec.ts"
Cohesion: 0.11
Nodes (17): calculateSalarySnapshot(), earnsStaffSalary(), ManagerSalarySnapshot, SalarySnapshot, AccrualByIdRow, AsyncMock, createOrderService(), CreatePaymentArgs (+9 more)

### Community 49 - "ReportsPage.tsx"
Cohesion: 0.10
Nodes (28): ReportsPage, SalaryPage, buildReceiptHtml(), buildReceiptTitle(), escapeHtml(), formatFilenameDate(), printReceipt(), sanitizeFilenamePart() (+20 more)

### Community 50 - "CreateOrderForm.tsx"
Cohesion: 0.12
Nodes (21): baseSchema, canvasItemSchema, CreateOrderForm(), FormValues, freeItemSchema, fullSchema, isRussianPhone(), photoItemSchema (+13 more)

### Community 51 - "Исправленные проблемы"
Cohesion: 0.18
Nodes (10): CRITICAL, CRM Audit Report — 2026-06-14, HIGH, HIGH, LOW, MEDIUM, MEDIUM, Исправленные проблемы (+2 more)

### Community 52 - "crm-new/README.md"
Cohesion: 0.20
Nodes (9): Compile and run the project, Deployment, Description, License, Project setup, Resources, Run tests, Stay in touch (+1 more)

### Community 53 - "App.tsx"
Cohesion: 0.14
Nodes (17): authApi, AdminRoute(), App(), AppRoutes(), CrmGate(), LoginPage, OrderStaffRoute(), PrivateRoute() (+9 more)

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

### Community 61 - "order-photo.controller.ts"
Cohesion: 0.10
Nodes (20): DtoCreateCanvasItem, IsInt, IsString, MaxLength, Min, Type, DtoSetReview, IsBoolean (+12 more)

### Community 62 - "current-user.decorator.ts"
Cohesion: 0.29
Nodes (6): AuthenticatedRequest, AuthenticatedUser, PRICE_FIELDS, strip(), StripPricesInterceptor, Injectable

### Community 63 - "exclude"
Cohesion: 0.25
Nodes (7): exclude, extends, dist, node_modules, **/*spec.ts, test, ./tsconfig.json

### Community 64 - "Аудит финансов, кода и продакшена — 2026-07-09"
Cohesion: 0.29
Nodes (6): Аудит финансов, кода и продакшена — 2026-07-09, Кодовый аудит, Короткий вывод, Продакшен-аудит, Следующие улучшения, Финансовый аудит

### Community 65 - "devDependencies"
Cohesion: 0.29
Nodes (7): devDependencies, eslint, eslint-plugin-prettier, @types/express, eslint, eslint-plugin-prettier, @types/express

### Community 66 - "AvitoPage.tsx"
Cohesion: 0.22
Nodes (11): avitoApi, AvitoChatQuery, AvitoPage, AvitoPage(), clientInitial(), messagePreview(), messageText(), timeLabel() (+3 more)

### Community 67 - "nest-cli.json"
Cohesion: 0.33
Nodes (5): collection, compilerOptions, deleteOutDir, $schema, sourceRoot

### Community 68 - "MarketplacePage.tsx"
Cohesion: 0.07
Nodes (38): CreateAccountDto, EnumMarketplace, MarketplaceAccount, marketplaceApi, OzonConnectionInfo, UpdateAccountDto, OzonOrder, OzonOrderGroup (+30 more)

### Community 69 - "ProductsTab.tsx"
Cohesion: 0.08
Nodes (43): CreateOzonPrintDto, EnumOzonSyncStatus, EnumTshirtGender, OzonAttributeValueOption, ozonCatalogApi, OzonCatalogTemplate, OzonColorGroupInput, OzonPrint (+35 more)

### Community 70 - "gulian-outbox.service.ts"
Cohesion: 0.10
Nodes (11): GulianOutboxProcessorService, RETRY_DELAYS_SECONDS, Injectable, GulianOutboxService, OrderForOutbox, Injectable, GulianOrderPayload, GulianResponse (+3 more)

### Community 71 - "seed.js"
Cohesion: 0.40
Nodes (3): bcrypt, { Client }, { randomUUID }

### Community 72 - "DtoUpdateOrder"
Cohesion: 0.17
Nodes (11): DtoUpdateOrder, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Matches, MaxLength (+3 more)

### Community 73 - "scenario.registry.ts"
Cohesion: 0.07
Nodes (53): calcOrderTotal(), DELIVERY_STEPS, NOTE_STEP, OPTIONAL, PAPER_LABEL, photoToOrder(), PHOTO_SCENARIO, tshirtToOrder() (+45 more)

### Community 74 - "React + TypeScript + Vite"
Cohesion: 0.50
Nodes (3): Expanding the ESLint configuration, React Compiler, React + TypeScript + Vite

### Community 76 - "shipment-reminder-rules.ts"
Cohesion: 0.15
Nodes (11): buildShipmentReminder(), DEADLINE_METHODS, dueReminderStage(), hasDeadline(), hoursLeft(), SHIPMENT_REMINDER_STAGES_MS, ShipmentOrder, START (+3 more)

### Community 79 - "ozon-api.client.ts"
Cohesion: 0.14
Nodes (10): humanize(), OzonApiClient, OzonApiError, OzonErrorBody, Injectable, OzonConnectionInfo, OzonProductListResponse, OzonService (+2 more)

### Community 81 - "telegram-update.service.ts"
Cohesion: 0.14
Nodes (15): calcGulianPayout(), Item, PayoutResult, buildPartnerCaption(), calcSettlement(), esc(), PartnerOrderData, PartnerOrderItem (+7 more)

### Community 82 - ".createOrder"
Cohesion: 0.38
Nodes (7): buildCommunicationUrl(), buildMaxUrl(), DEFAULT_MAX_LINK_TEMPLATE, formatPhoneForDisplay(), normalizePhone(), validateCommunicationValue(), calcCanvasMoney()

### Community 83 - "ozon-attributes.ts"
Cohesion: 0.10
Nodes (32): buildExtraImages(), buildImportItem(), buildOfferId(), CatalogTemplateForImport, COLOR_CODE_BY_LABEL, colorCodeFor(), DEFAULT_SIZES, dictAttr() (+24 more)

### Community 87 - ".sendMessage"
Cohesion: 0.29
Nodes (5): Body, DtoSendAvitoMessage, IsString, MaxLength, MinLength

### Community 88 - "DtoUpdatePartnerSettings"
Cohesion: 0.12
Nodes (13): DtoUpdatePartnerSettings, IsInt, IsOptional, IsString, Max, MaxLength, Min, PartnerSettingsController (+5 more)

### Community 91 - "MarketplaceController"
Cohesion: 0.16
Nodes (10): MarketplaceController, Body, Controller, Delete, Get, Param, Patch, Post (+2 more)

### Community 94 - "telegram.service.ts"
Cohesion: 0.14
Nodes (9): logger, proxyDispatcher(), resetTelegramProxyCache(), telegramFetch(), TelegramPollingService, TgUpdateWithId, Injectable, TelegramUpdateService (+1 more)

### Community 95 - ".webhook"
Cohesion: 0.24
Nodes (7): TgUpdate, constantTimeEqual(), TelegramWebhookController, Body, Controller, Post, Headers

### Community 96 - "OzonCatalogController"
Cohesion: 0.20
Nodes (10): OzonCatalogController, Body, Controller, Delete, Get, Param, Patch, Post (+2 more)

### Community 97 - "crm-new/package.json"
Cohesion: 0.29
Nodes (6): author, description, license, name, private, version

### Community 98 - "CanvasItemService"
Cohesion: 0.48
Nodes (3): CanvasItemService, canvasMoney(), Injectable

### Community 100 - "marketplace-account.service.ts"
Cohesion: 0.24
Nodes (9): AccountRow, CreateAccountInput, MarketplaceAccountView, UpdateAccountInput, decryptSecret(), deriveKey(), encryptSecret(), secretHint() (+1 more)

### Community 112 - "lead-notification.ts"
Cohesion: 0.33
Nodes (6): buildLeadNotification(), escape(), LeadForNotification, NotifiableUser, pickLeadResponders(), toMention()

### Community 113 - "OzonImportService"
Cohesion: 0.20
Nodes (5): OzonImportPollService, Injectable, OzonImportService, Injectable, chunk()

### Community 114 - "DtoUpdateTshirtItem"
Cohesion: 0.22
Nodes (8): DtoUpdateTshirtItem, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min, Type

### Community 121 - "LeadController"
Cohesion: 0.17
Nodes (9): LeadController, Body, Controller, Post, Throttle, UseGuards, isUniqueViolation(), HttpCode (+1 more)

### Community 123 - "ozon-import.service.ts"
Cohesion: 0.24
Nodes (6): DEFAULT_SIZE_DIMENSIONS, OzonCatalogTemplateService, Injectable, UpdateOzonCatalogTemplateInput, IMPORT_BATCH_SIZE, VariantDimensions

### Community 124 - "DtoCreateMarketplaceAccount"
Cohesion: 0.33
Nodes (5): DtoCreateMarketplaceAccount, IsEnum, IsString, MaxLength, MinLength

### Community 126 - "DtoUpdateOzonPrint"
Cohesion: 0.17
Nodes (11): DtoUpdateOzonPrint, ArrayMaxSize, IsArray, IsEnum, IsInt, IsOptional, IsString, IsUrl (+3 more)

### Community 130 - "ScenarioController"
Cohesion: 0.09
Nodes (20): DtoDetectProduct, IsString, MaxLength, DtoSaveDraft, IsObject, IsOptional, IsString, MaxLength (+12 more)

### Community 131 - "PrismaService"
Cohesion: 0.08
Nodes (17): JwtPayload, JwtStrategy, Injectable, HealthController, Controller, Get, FinancialClient, OrderFinancialIntegrityService (+9 more)

### Community 132 - "DtoPublishOzonPrints"
Cohesion: 0.33
Nodes (5): DtoPublishOzonPrints, ArrayMinSize, ArrayNotEmpty, IsArray, IsUUID

### Community 133 - "DtoUpdateMarketplaceAccount"
Cohesion: 0.29
Nodes (6): DtoUpdateMarketplaceAccount, IsBoolean, IsOptional, IsString, MaxLength, MinLength

### Community 134 - "DtoCreateItemOrder"
Cohesion: 0.18
Nodes (11): DtoCreateItemOrder, IsBoolean, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min (+3 more)

### Community 135 - "Roles"
Cohesion: 0.25
Nodes (10): Roles(), ROLES_KEY, JwtAuthGuard, Injectable, RolesGuard, Injectable, RequestUser, ORDER_ROLES (+2 more)

### Community 136 - "DtoUpdateItemOrder"
Cohesion: 0.17
Nodes (11): DtoUpdateItemOrder, IsBoolean, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min (+3 more)

### Community 137 - "Выкатка: репозиторий → сервер"
Cohesion: 0.29
Nodes (6): Выкатка: репозиторий → сервер, Как это устроено на сервере, Команды, Откат, Почему именно так, Чего в цепочке пока нет

### Community 138 - "tech-spec-storage.service.ts"
Cohesion: 0.40
Nodes (4): ALLOWED, EXT_CONTENT_TYPE, TECH_SPEC_MAX_BYTES, TECH_SPEC_MAX_FILES

### Community 140 - "2. Что уже сделано (этап 2 — карточки товаров)"
Cohesion: 0.11
Nodes (17): 1.1. Что показал живой кабинет (17.08.2026), 1. Что уже сделано (этап 1 — подключение), 2.1. Порядок работы с товаром в Ozon Seller API (справочно), 2.2. Заказы (этап 3, только чтение), 2. Что уже сделано (этап 2 — карточки товаров), 3. Дальше, API CRM, API CRM (+9 more)

### Community 141 - ".list"
Cohesion: 0.50
Nodes (3): Get, Param, Query

### Community 144 - "DtoUpdateOzonCatalogTemplate"
Cohesion: 0.17
Nodes (11): DtoUpdateOzonCatalogTemplate, ArrayMaxSize, IsArray, IsBoolean, IsInt, IsObject, IsOptional, IsString (+3 more)

## Knowledge Gaps
- **607 isolated node(s):** `$schema`, `collection`, `sourceRoot`, `deleteOutDir`, `name` (+602 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **52 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Roles()` connect `Roles` to `OzonCatalogController`, `TechSpecStorageService`, `CurrentUser`, `ScenarioController`, `marketplace.module.ts`, `.constructor`, `SalaryService`, `DtoUpdateUser`, `OrderPhotoController`, `expenses.controller.ts`, `reports.service.ts`, `AvitoService`, `.sendMessage`, `DtoUpdatePartnerSettings`, `tasks.controller.ts`, `MarketplaceController`, `order-photo.controller.ts`?**
  _High betweenness centrality (0.094) - this node is a cross-community bridge._
- **Why does `PrismaService` connect `PrismaService` to `CurrentUser`, `DtoUpdateUser`, `TelegramService`, `Roles`, `expenses.controller.ts`, `reports.service.ts`, `daily-plan-rules.ts`, `AvitoService`, `sticker.service.ts`, `tasks.controller.ts`, `partner-status.ts`, `order-photo.module.ts`, `review-reminder.service.ts`, `TechSpecStorageService`, `.constructor`, `SalaryService`, `ozon-catalog.service.ts`, `partner-api.controller.ts`, `auth.controller.ts`, `tshirt-partner-telegram.service.ts`, `order-photo.service.ts`, `salary-integrity.spec.ts`, `order-photo.controller.ts`, `gulian-outbox.service.ts`, `scenario.registry.ts`, `shipment-reminder-rules.ts`, `ozon-api.client.ts`, `telegram-update.service.ts`, `ozon-attributes.ts`, `telegram.service.ts`, `marketplace-account.service.ts`, `OzonPrintService`, `ozon-import.service.ts`?**
  _High betweenness centrality (0.085) - this node is a cross-community bridge._
- **Why does `OrderPhotoService` connect `OrderPhotoService` to `.constructor`, `gulian-outbox.service.ts`, `lead.controller.ts`, `DtoAllOrdersforQuery`, `order-photo.service.ts`, `lead-notification.ts`, `salary-integrity.spec.ts`, `.createOrder`, `LeadController`, `order-photo.controller.ts`, `order-photo.module.ts`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **What connects `$schema`, `collection`, `sourceRoot` to the rest of the system?**
  _607 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `DtoCreateOzonPrint` be split into smaller, more focused modules?**
  _Cohesion score 0.06190476190476191 - nodes in this community are weakly interconnected._
- **Should `CurrentUser` be split into smaller, more focused modules?**
  _Cohesion score 0.11174242424242424 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._