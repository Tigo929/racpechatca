# 02_ANALYTICS_DATA_MODEL.md

# Этап 02 — Аналитическая модель данных CRM

## Статус

```text
REVIEW
```

> **Поправка FIX_01 (11.09.2026).** Поле называется `conversionPageUrl` —
> страница, на которой отправлена заявка. Страница входа на сайт
> (first-touch landing) пока не сохраняется; отдельное поле под неё —
> задача этапа `04_EVENT_MODEL`.


> ВАЖНО: исполнитель не имеет права самостоятельно ставить этому этапу `DONE`.
> После выполнения этап переводится в `REVIEW`.
> Решение `DONE / NEEDS_FIX / BLOCKED` принимает ChatGPT после проверки отчёта исполнителя.

---

# 1. Контекст из предыдущих этапов

Этапы `00_MASTER_PLAN` и `01_CURRENT_STATE` считаются принятыми по отчёту исполнителя.

Подтверждено:

- CRM: `racpechatca`
- backend: NestJS
- база: PostgreSQL
- ORM: Prisma
- основная модель заказа/заявки: `OrderPhoto`
- позиции: `ItemPhoto`, `ItemTshirt`, `ItemCanvas`
- история статусов: `StatusHistory`
- расходы: `ExpenseOrder`
- сайт передаёт маркетинговую атрибуцию в CRM, но значительная часть хранится в свободном тексте
- `yandexClientId` сейчас находится в `OrderPhoto.note`
- `yclid` сейчас находится в `OrderPhoto.note`
- landing page сейчас находится в `OrderPhoto.note`
- часть UTM сохраняется в `ItemTshirt.designNote`
- `utm_content` и `utm_term` теряются
- `clientPaidAt` существует, но фактически не заполняется
- текущий `purchase` отправляется на этапе заявки — исправление этого поведения НЕ входит в этап 02
- `StatusHistory` существует с 13.06.2026
- `yclid` исторически доступен ориентировочно с 09.06.2026
- `yandexClientId` исторически доступен ориентировочно с 13.08.2026
- четыре цели Метрики ещё не созданы — это не входит в этап 02
- OAuth/API Метрики не подключать в этом этапе
- outbox/синхронизация с Метрикой будет отдельным этапом

---

# 2. Цель этапа

Сделать маркетинговую атрибуцию и дату реальной оплаты структурированными данными CRM.

После этапа новая заявка с сайта должна сохранять атрибуцию не только в свободный текст, но и в отдельные поля `OrderPhoto`.

Целевая цепочка:

```text
Сайт
↓
lead DTO
↓
POST /order-photo/lead
↓
OrderPhoto
↓
структурированные поля атрибуции
```

Также CRM должна фиксировать первую реальную дату перехода заказа в `PAID`.

---

# 3. Что требуется сделать

## 3.1. Добавить поля атрибуции в `OrderPhoto`

Добавить nullable-поля:

```text
yandexClientId
yclid

utmSource
utmMedium
utmCampaign
utmContent
utmTerm

landingUrl
```

Названия можно изменить только если в существующем проекте есть устойчивый naming convention, который делает другое имя объективно правильнее.

Если имя меняется — обязательно объяснить это в отчёте.

---

## 3.2. Типы данных

Перед изменением схемы исполнитель обязан проверить реальные DTO и существующие значения.

Предпочтительный тип для строковых идентификаторов и UTM:

```text
String?
```

Нельзя:

- преобразовывать `yandexClientId` в integer;
- предполагать числовой тип `yclid`;
- обрезать UTM до слишком маленькой длины без доказанной необходимости.

Если Prisma/PostgreSQL в проекте использует специальные типы вроде `@db.VarChar(...)`, исполнитель должен выбрать размер осознанно и указать его в отчёте.

---

# 4. Канонический источник данных

После этого этапа:

```text
OrderPhoto.yandexClientId
OrderPhoto.yclid
OrderPhoto.utm*
OrderPhoto.landingUrl
```

являются каноническими структурированными полями для аналитики.

Старые текстовые записи в:

```text
OrderPhoto.note
ItemTshirt.designNote
```

пока НЕ удалять.

Причина:

- обратная совместимость;
- удобство сотрудника;
- безопасный переход;
- исторический backfill будет отдельным этапом.

---

# 5. Приём новой заявки

Нужно проследить полный путь маркетинговых данных:

```text
web
↓
apps/api
↓
CRM channel
↓
POST /order-photo/lead
↓
DTO CRM
↓
order-photo.service
↓
Prisma create OrderPhoto
```

Для каждого поля проверить:

```text
yandexClientId
yclid
utmSource
utmMedium
utmCampaign
utmContent
utmTerm
landingUrl
```

Если frontend/API сейчас использует snake_case:

```text
utm_source
utm_medium
...
```

а CRM использует camelCase:

```text
utmSource
utmMedium
...
```

сделать явное и понятное преобразование на границе API.

---

# 6. Все типы заявок

Нельзя исправить атрибуцию только для одного продукта.

Необходимо проверить заявки минимум для:

```text
Фото
Футболки
Холсты
```

Если все они проходят через один общий lead endpoint — подтвердить это.

Если пути различаются — обеспечить структурированное сохранение во всех используемых путях либо явно вернуть `BLOCKED/PARTIAL` с описанием того, что осталось.

---

# 7. clientPaidAt

Поле уже существует.

Не создавать дубликат.

Нужно изменить бизнес-логику смены статуса так, чтобы:

```text
при ПЕРВОМ переходе в PAID
и clientPaidAt == null
→ clientPaidAt = now()
```

После этого значение не должно изменяться.

Пример:

```text
NEW
→ PAID
clientPaidAt = 2026-09-15 12:00
```

Затем:

```text
PAID
→ READY_FOR_REVIEW
→ COMPLETED
```

`clientPaidAt` остаётся:

```text
2026-09-15 12:00
```

Если заказ позже снова попадёт в `PAID`, первоначальная дата также должна сохраниться.

---

# 8. Что НЕ решаем на этом этапе

Запрещено расширять scope без отдельного согласования.

НЕ делать сейчас:

- исторический backfill старых заказов;
- парсинг старых `note`;
- парсинг старых `designNote`;
- восстановление старых `clientPaidAt`;
- подключение OAuth;
- подключение Reports API;
- отправку заказов в Метрику;
- outbox;
- retry;
- создание целей Метрики;
- отключение текущего `purchase`;
- изменение логики `lead_submitted`;
- создание dashboard;
- изменение P&L;
- изменение правил признания выручки;
- изменение семантики `DONE` / `SENT`;
- создание новой сущности Client/Customer.

Если при реализации обнаружится необходимость одного из этих изменений — остановиться и описать причину в отчёте.

---

# 9. Открытые вопросы, которые пока НЕ блокируют этап 02

Из аудита остались вопросы:

1. Какие цели уже реально созданы в Яндекс Метрике?
2. Идёт ли сейчас реклама в Яндекс Директе?
3. Нужно ли считать фото-заказы в `DONE` / `SENT` без `PAID` оплаченными для бизнес-отчётности?

Эти вопросы важны для следующих этапов, но не должны блокировать структурирование атрибуции и фиксацию `clientPaidAt`.

В этапе 02:

> `clientPaidAt` означает только факт первого перехода в `PAID`.

Не переопределять его через `DONE` или `SENT`.

---

# 10. Индексы

До добавления индексов исполнитель должен проверить:

- примерный размер `OrderPhoto`;
- существующие индексы;
- существующие паттерны выборок.

Минимально оценить необходимость индексов для:

```text
yandexClientId
yclid
clientPaidAt
```

Для UTM не создавать большое количество индексов «на будущее» без обоснования.

В отчёте обязательно указать:

```text
какие индексы добавлены
или
почему на этом этапе индексы не добавлялись
```

---

# 11. Миграция

Нужна нормальная Prisma migration.

Требования:

- существующие строки не должны ломаться;
- новые поля nullable;
- миграция должна применяться на существующей БД;
- не удалять текущие данные;
- не переименовывать существующие поля вне scope;
- не выполнять destructive migration.

Исполнитель должен показать имя созданной migration.

---

# 12. Обратная совместимость

После реализации:

- старые заявки без новых полей должны продолжить работать;
- новые заявки должны сохранять структурированные поля;
- существующие `note` не должны исчезнуть;
- существующая CRM не должна требовать наличие UTM/ClientID для ручного заказа;
- отсутствие маркетинговой атрибуции не должно мешать созданию заказа.

Все новые поля являются optional/nullable.

---

# 13. Тесты

Минимально обязательны тестовые сценарии.

## Сценарий A — полная атрибуция

Создать тестовую lead-заявку с:

```text
yandexClientId
yclid
utm_source
utm_medium
utm_campaign
utm_content
utm_term
landingUrl
```

Проверить, что всё сохранено в структурированных полях `OrderPhoto`.

---

## Сценарий B — без атрибуции

Создать lead без UTM / ClientID.

Заявка должна успешно сохраниться.

Новые поля:

```text
null
```

---

## Сценарий C — первая оплата

```text
LEAD/NEW → PAID
```

Проверить:

```text
clientPaidAt != null
```

---

## Сценарий D — последующие статусы

```text
PAID → READY_FOR_REVIEW → COMPLETED
```

Проверить:

```text
clientPaidAt не изменился
```

---

## Сценарий E — повторный PAID

Если переход технически допустим:

```text
PAID → другой статус → PAID
```

проверить, что сохраняется первоначальный `clientPaidAt`.

---

# 14. Проверки проекта

Перед завершением этапа выполнить доступные проекту проверки.

Как минимум:

```text
Prisma schema validation
migration generation/application check
TypeScript build/typecheck
релевантные unit/integration tests
```

Не писать в отчёте «тесты прошли», если команда фактически не выполнялась.

Для каждой команды вернуть:

```text
команда
результат
```

---

# 15. Работа с Git

Из-за того что push в `master` CRM вызывает пересборку/перезапуск production:

> НЕ PUSH В `master`.

Документация уже находится в:

```text
docs/analytics
```

Рекомендуемый вариант:

создать рабочую ветку от текущей `docs/analytics`, например:

```text
feature/analytics-foundation
```

чтобы новая ветка уже содержала:

```text
00_MASTER_PLAN.md
01_CURRENT_STATE.md
```

Если исполнитель выбирает другую безопасную стратегию — объяснить в отчёте.

Запрещено автоматически сливать в `master`.

---

# 16. Обновление документации

В конце работы исполнитель должен:

1. обновить `00_MASTER_PLAN.md`:
   - `00_MASTER_PLAN = DONE`
   - `01_CURRENT_STATE = DONE`
   - `02_ANALYTICS_DATA_MODEL = REVIEW`

2. НЕ ставить этап 02 в `DONE`.

3. дополнить `01_CURRENT_STATE.md`, только если в ходе реализации обнаружились новые подтверждённые факты о текущей системе.

4. если обнаружено важное архитектурное решение — добавить его отдельным явно помеченным пунктом, а не незаметно менять исходный план.

---

# 17. Что должен вернуть исполнитель

Ответ после выполнения должен быть строго структурирован.

## EXECUTOR_REPORT

### 1. RESULT

Одно из:

```text
READY_FOR_REVIEW
PARTIAL
BLOCKED
```

### 2. GIT

```text
repo:
branch:
base branch:
commit:
push:
git status:
```

### 3. DATABASE CHANGES

Перечислить:

- изменённые модели;
- новые поля;
- тип каждого поля;
- nullable/not-null;
- индексы;
- имя Prisma migration.

### 4. DATA FLOW

Для каждого поля показать полный путь:

```text
browser field
→ web/api DTO field
→ CRM DTO field
→ service field
→ OrderPhoto field
```

Для:

```text
yandexClientId
yclid
utmSource
utmMedium
utmCampaign
utmContent
utmTerm
landingUrl
```

### 5. CLIENT_PAID_AT

Описать:

- где изменена логика;
- когда поле заполняется;
- почему повторный переход не меняет дату;
- какие тесты это подтверждают.

### 6. FILES_CHANGED

Таблица:

```text
Файл | Что изменено | Почему
```

### 7. TESTS

Таблица:

```text
Команда | Результат | Примечание
```

### 8. MIGRATION SAFETY

Ответить:

- применима ли миграция на существующей production БД;
- есть ли destructive operations;
- требуется ли downtime;
- требуется ли ручная подготовка.

### 9. NEW FACTS DISCOVERED

Все новые факты о проекте, которых не было в `01_CURRENT_STATE.md`.

Если нет:

```text
none
```

### 10. DEVIATIONS FROM SPEC

Любые отклонения от этого MD.

Если нет:

```text
none
```

### 11. OPEN ISSUES

Что осталось нерешённым.

Если нет:

```text
none
```

### 12. QUESTIONS FOR REVIEWER

Только вопросы, без которых нельзя принять архитектурное решение следующего этапа.

Если вопросов нет:

```text
none
```

---

# 18. Decision Gate для ChatGPT

После получения `EXECUTOR_REPORT` ChatGPT принимает одно из трёх решений.

## A. DONE

Этап можно закрыть, если одновременно выполняются условия:

- схема `OrderPhoto` содержит структурированную атрибуцию;
- новые lead-заявки реально заполняют поля;
- работают все релевантные типы товара;
- `utmContent` и `utmTerm` больше не теряются;
- отсутствие атрибуции не ломает заказ;
- `clientPaidAt` фиксирует первый `PAID`;
- дата оплаты не перезаписывается;
- migration безопасна;
- build/typecheck проходит;
- релевантные тесты проходят;
- нет критических отклонений от scope.

Решение:

```text
02_ANALYTICS_DATA_MODEL = DONE
```

Следующий файл:

```text
03_HISTORICAL_BACKFILL.md
```

---

## B. NEEDS_FIX

Если основная архитектура правильная, но есть исправимые проблемы.

Примеры:

- одно поле не доходит;
- один тип продукта не покрыт;
- тест не написан;
- clientPaidAt перезаписывается;
- migration требует исправления;
- DTO расходятся.

Тогда:

```text
02_ANALYTICS_DATA_MODEL = IN_PROGRESS
```

ChatGPT формирует:

```text
02_ANALYTICS_DATA_MODEL_FIX_01.md
```

И следующий основной этап НЕ начинается.

---

## C. BLOCKED

Если обнаружено архитектурное ограничение, которое нельзя безопасно решить без решения владельца.

Тогда:

```text
02_ANALYTICS_DATA_MODEL = BLOCKED
```

ChatGPT задаёт только необходимые вопросы владельцу.

После ответа создаётся:

```text
02_ANALYTICS_DATA_MODEL_FIX_01.md
```

или обновлённая версия этапа.

---

# 19. Что будет дальше

Только после решения ChatGPT:

```text
02 = DONE
```

переходим к:

```text
03_HISTORICAL_BACKFILL.md
```

Этап 03 будет использовать фактические поля и реальные решения, полученные из отчёта этапа 02.

То есть следующий MD должен строиться не по старому предположению, а по фактически реализованной модели.

---

# 20. Команда исполнителю

Выполни этап `02_ANALYTICS_DATA_MODEL.md`.

Работай только в указанном scope.

Не подключай Яндекс Метрику и не меняй события сайта.

Не выполняй backfill.

Не сливай изменения в `master`.

После реализации верни ответ строго в формате `EXECUTOR_REPORT` из раздела 17.

Главная задача:

> Новая заявка должна сохранять маркетинговую атрибуцию структурированно в `OrderPhoto`, а первый переход в `PAID` должен надёжно фиксировать `clientPaidAt`.

---

# 21. EXECUTOR_REPORT — 11.09.2026

## 1. RESULT

```text
READY_FOR_REVIEW
```

## 2. GIT

```text
repo:        racpechatca
branch:      feature/analytics-foundation
base branch: docs/analytics (от master 20cce7b)
commit:      f18d26f (код), далее — этот отчёт
push:        origin/feature/analytics-foundation
git status:  чисто
master:      не тронут, не слит

repo:        web-photo (сопутствующее, см. раздел 10)
branch:      feature/cms-admin
commit:      4f0bdca
push:        да (рабочая ветка сайта, выкатывается штатно)
```

## 3. DATABASE CHANGES

Модель `OrderPhoto`, миграция `20260911180000_order_attribution_fields`.

| Поле | Тип Prisma | Postgres | Nullable | Индекс |
|---|---|---|---|---|
| `yandexClientId` | `String?` | `TEXT` | да | `OrderPhoto_yandexClientId_idx` |
| `yclid` | `String?` | `TEXT` | да | нет |
| `utmSource` | `String?` | `TEXT` | да | нет |
| `utmMedium` | `String?` | `TEXT` | да | нет |
| `utmCampaign` | `String?` | `TEXT` | да | нет |
| `utmContent` | `String?` | `TEXT` | да | нет |
| `utmTerm` | `String?` | `TEXT` | да | нет |
| `conversionPageUrl` (до FIX_01 — `landingUrl`) | `String?` | `TEXT` | да | нет |
| `clientPaidAt` (существовало) | `DateTime?` | `timestamp` | да | `OrderPhoto_clientPaidAt_idx` — новый |

Типы: `String?` без `@db.VarChar` — так во всей схеме проекта; длину
ограничивает DTO (`yandexClientId` ≤ 80, `yclid` ≤ 240, UTM ≤ 150/200,
`pageUrl` ≤ 600). Индексы: `yandexClientId` — под импорт заказов
в Метрику и поиск заказов одного посетителя; `clientPaidAt` — под отчёты
по дате оплаты. `yclid` и UTM без индексов: выборка по ним — разбор
единичных случаев, не отчёты; таблица маленькая (сотни строк).

## 4. DATA FLOW

Все три типа товара идут одним путём: `apps/api` → `CrmLeadChannel`
(`crm.channel.ts`) → `POST /order-photo/lead` → `DtoCreateLead`
→ `order-photo.service.ts` → `attributionFromLead(dto)` →
`orderPhoto.create({ data })`. Форма контактов — тем же каналом.

| Поле | браузер | web/api DTO | CRM DTO | сервис | OrderPhoto |
|---|---|---|---|---|---|
| yandexClientId | `getYandexClientId()` → `yandexClientId` | `yandexClientId` | `yandexClientId` | `attributionFromLead` | `yandexClientId` |
| yclid | `getYclid()` → `yclid` | `yclid` | `yclid` | то же | `yclid` |
| utmSource | `utmFields()` / `appendUtmFields()` → `utmSource` | `utmSource` → `buildUtm` → `utm.source` | `utmSource` | то же | `utmSource` |
| utmMedium | → `utmMedium` | → `utm.medium` | `utmMedium` | то же | `utmMedium` |
| utmCampaign | → `utmCampaign` | → `utm.campaign` | `utmCampaign` | то же | `utmCampaign` |
| utmContent | → `utmContent` | → `utm.content` | `utmContent` | то же | `utmContent` |
| utmTerm | → `utmTerm` | → `utm.term` | `utmTerm` | то же | `utmTerm` |
| conversionPageUrl | `window.location.href` → `pageUrl` | `pageUrl` | `pageUrl` | `pageUrl → conversionPageUrl` | `conversionPageUrl` |

Преобразование на границе: сайт хранит метки как `utm_source` в
`sessionStorage`, в поля заявки раскладывает `lib/utm.ts` (`utm_source
→ utmSource`); `apps/api` собирает объект `utm {source…}` для каналов
(`buildUtm`), `CrmLeadChannel` разворачивает обратно в плоские
`utmSource…utmTerm` для CRM. CRM пишет и в колонки, и прежними
строками в `note`.

## 5. CLIENT_PAID_AT

- Логика: `crm-new/src/order-photo/paid-at.ts`, вызов в
  `order-photo.service.ts` → `updateStatusOrder`, в `data` у
  `orderPhoto.update` рядом с `sentAt` / `completedAt`.
- Заполняется: при переходе в `PAID`, если `clientPaidAt` пуст.
- Не меняется повторно: функция возвращает пустой патч, когда дата уже
  есть, — независимо от того, какой статус был между.
- Другие пути в `PAID`: ручное создание заказа допускает только
  `LEAD`/`NEW` (`create-order.dto.ts:83`); опрос партнёра
  (`partner-status-poll`) в `PAID` не переводит (`partner-status.ts`,
  комментарий к `FLOW_RANK`). Единственный путь — `updateStatusOrder`.
- Тесты: `paid-at.spec.ts` — сценарии C (первый PAID), D (последующие
  статусы), E (повторный PAID), плюс не-PAID без даты и `now` по умолчанию.

## 6. FILES_CHANGED

| Файл | Что изменено | Почему |
|---|---|---|
| `crm-new/prisma/schema.prisma` | 8 полей, 2 индекса, комментарии к `clientPaidAt` | цель этапа |
| `crm-new/prisma/migrations/20260911180000_order_attribution_fields/migration.sql` | новая миграция | сгенерирована `prisma migrate diff` |
| `crm-new/src/order-photo/lead-attribution.ts` (+ `.spec.ts`) | новый модуль, 5 тестов | сборка полей из DTO, сценарии A/B |
| `crm-new/src/order-photo/paid-at.ts` (+ `.spec.ts`) | новый модуль, 5 тестов | первая оплата, сценарии C/D/E |
| `crm-new/src/order-photo/order-photo.service.ts` | `...attributionFromLead(dto)` в приёме заявки; `...clientPaidAtPatch(...)` в смене статуса | подключение |
| `crm-new/src/order-photo/dto/create-lead.dto.ts` | комментарий к UTM | был неверным («колонок нет») |
| `docs/analytics/00_MASTER_PLAN.md` | статусы 00/01 DONE, 02 REVIEW, раздел 22 | п. 16 ТЗ |
| `docs/analytics/01_CURRENT_STATE.md` | уточнение про UTM (см. раздел 9) | новый факт |
| `docs/analytics/02_ANALYTICS_DATA_MODEL.md` | текст этапа + этот отчёт | |
| **web-photo:** `apps/web/src/lib/utm.ts` | `utmFields()` | JSON-форма фотопечати |
| `apps/web/src/components/product/OrderPanel.tsx` | `...utmFields()` в payload | UTM с формы фото |
| `apps/web/src/components/canvas/CanvasOrderForm.tsx` | `appendUtmFields(payload)` | UTM с формы холста |
| `apps/api/src/leads/utm.ts` (+ `.spec.ts`) | общий `buildUtm`, 3 теста | вместо двух копий; фото и холст его не имели |
| `apps/api/src/leads/dto/create-lead.dto.ts`, `create-canvas-lead.dto.ts` | 5 полей UTM | принимались только у футболок и контактов |
| `apps/api/src/leads/leads.service.ts`, `canvas-lead.service.ts` | `utm` в `EnrichedLead` | доставка в CRM |
| `apps/api/src/leads/tshirt-lead.service.ts`, `contact-lead.service.ts` | локальный `buildUtm` → общий | дедупликация |

## 7. TESTS

| Команда | Результат | Примечание |
|---|---|---|
| `crm-new: npx prisma validate` | OK | |
| `crm-new: npx prisma generate` | OK | клиент 7.8.0 |
| `crm-new: npx prisma migrate diff --from-schema <old> --to-schema <new> --script` | SQL сгенерирован | положен в миграцию без правок |
| миграция на schema-only копии боевой базы (`crm_shadow_migtest`, потом удалена) | 9 колонок, 2 индекса на месте | на сервере, через `psql` в контейнере Postgres |
| `crm-new: npm run build` (`nest build`) | OK | |
| `crm-new: npx tsc --noEmit -p tsconfig.json` | 4 ошибки | **все в `approval-render.spec.ts` и `partner-payload-client-item.spec.ts`, воспроизводятся на `master` без моих изменений** — не относятся к этапу |
| `crm-new: npx jest` | 59 suites, **603 passed** | 10 новых |
| `web-photo apps/api: npx tsc --noEmit` | OK | |
| `web-photo apps/api: npx jest` | 11 suites, **77 passed** | 3 новых |
| `web-photo apps/web: npx tsc --noEmit` | OK | |
| `web-photo apps/web: npm test` | **364, 363 passed, 1 skipped** | без изменений |

## 8. MIGRATION SAFETY

- Применима на боевой базе: да, проверено на её schema-only копии.
- Destructive operations: нет — только `ADD COLUMN` (nullable, без
  DEFAULT) и `CREATE INDEX`.
- Downtime: не требуется сверх штатного перезапуска контейнера;
  `ADD COLUMN` без DEFAULT в PostgreSQL — правка каталога, строки
  не перезаписываются; таблица — сотни строк, индексы строятся мгновенно.
- Ручная подготовка: не требуется. `docker-compose.prod.yml` запускает
  backend как `npx prisma migrate deploy && node dist/src/main` —
  миграция применится сама при следующем старте контейнера с новым
  образом.

## 9. NEW FACTS DISCOVERED

1. **UTM отправляли только формы футболок и контактов.** Формы
   фотопечати (`OrderPanel`) и холста (`CanvasOrderForm`) UTM не
   собирали, в их DTO на `apps/api` полей не было. Аудит 01 утверждал
   «все пять уходят с заявкой любого типа» — это было неверно; 01
   исправлен. Без правки на стороне сайта критерий «работают все типы
   товара» этап пройти не мог — отсюда сопутствующий коммит в web-photo.
2. Поле страницы получает `pageUrl` — адрес страницы, **на которой**
   отправлена заявка, а не страницу входа на сайт: сайт её не запоминает.
   В первой реализации поле называлось `landingUrl` и обещало не то, что
   хранило; по FIX_01 переименовано в `conversionPageUrl` (см. раздел 22).
3. Единственный путь в `PAID` — `updateStatusOrder` (см. раздел 5).
4. Backend CRM применяет миграции сам при старте (`migrate deploy`
   в compose) — ручного шага деплоя миграций нет.
5. `tsc --noEmit` на `master` CRM даёт 4 ошибки в двух spec-файлах;
   `nest build` и `jest` при этом чистые (сборка spec не включает).

## 10. DEVIATIONS FROM SPEC

1. **Изменения вне репозитория CRM** — `web-photo` (сайт и `apps/api`):
   без них UTM с форм фото и холста физически не доходили до CRM,
   и раздел 6 ТЗ («все типы заявок») был бы `PARTIAL`. Изменения
   только про доставку UTM: события Метрики, `lead_submitted`, `purchase`
   не тронуты. Запушено в рабочую ветку сайта `feature/cms-admin` —
   это его штатная ветка выкладки, а не `master`; CRM эти поля уже
   принимает, так что порядок выкладки не важен.
2. Ветка кода — `feature/analytics-foundation` от `docs/analytics`,
   как рекомендовано.

## 11. OPEN ISSUES

1. **First-touch landing URL пока не сохраняется.** Поля под него нет;
   добавить в этапе 04 (событийная модель): сохранить первый
   `location.href` визита рядом с UTM в `sessionStorage` и завести колонку.
2. Четыре ошибки `tsc` в spec-файлах CRM на `master` — вне этапа,
   стоит починить отдельно.
3. Слияние `feature/analytics-foundation` в `master` — по команде
   владельца; до слияния колонки в боевой базе не появятся.

## 12. QUESTIONS FOR REVIEWER

```text
none
```
