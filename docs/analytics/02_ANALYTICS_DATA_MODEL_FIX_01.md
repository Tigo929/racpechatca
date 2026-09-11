# 02_ANALYTICS_DATA_MODEL_FIX_01.md

# Этап 02 — Доработка 01: семантика URL атрибуции

## Статус

```text
REVIEW
```

## Причина доработки

Этап 02 в целом реализован корректно, но в отчёте обнаружен один архитектурно важный факт:

```text
OrderPhoto.landingUrl
```

сейчас получает:

```text
window.location.href
```

в момент отправки заявки.

Это не обязательно landing page / страница входа пользователя.

Следовательно поле с именем `landingUrl` хранит другое понятие и в будущем может дать ложную аналитику:

```text
"с какой страницы начался визит"
```

будет подменено на:

```text
"на какой странице пользователь отправил заявку"
```

Такую семантическую ошибку нужно исправить до слияния миграции в `master`.

---

# 1. Решение

Разделить два разных понятия.

## 1.1. Текущая страница конверсии

Данные, которые уже сейчас приходят как:

```text
pageUrl = window.location.href
```

должны храниться в поле с корректным названием:

```text
conversionPageUrl
```

Предпочтительное имя:

```text
conversionPageUrl
```

Допустимо:

```text
leadPageUrl
```

если это лучше соответствует существующему naming convention.

Исполнитель должен выбрать одно имя и использовать его последовательно.

---

## 1.2. Настоящий landingUrl

Поле:

```text
landingUrl
```

в этом этапе НЕ заполнять текущим `window.location.href`, если нет подтверждения, что это действительно первая страница визита.

Настоящий landing URL будет реализован отдельно на этапе событий/атрибуции после определения механизма сохранения первого URL визита.

Если поле `landingUrl` уже добавлено миграцией, необходимо выбрать безопасный вариант:

### Вариант A — миграция ещё нигде не применялась на постоянной/shared БД

Разрешается исправить исходную migration до merge:

```text
landingUrl
→ conversionPageUrl
```

### Вариант B — migration уже применялась на постоянной/shared БД

Не переписывать применённую migration.

Создать follow-up migration с безопасным rename/add/drop по правилам Prisma/PostgreSQL и объяснить стратегию.

---

# 2. Что НЕ делать

Не расширять задачу.

НЕ нужно сейчас:

- реализовывать настоящий first-touch landing page;
- вводить sessionStorage/cookie для landing URL;
- менять UTM attribution model;
- менять события Метрики;
- отключать `purchase`;
- делать backfill;
- подключать API Метрики;
- менять clientPaidAt;
- менять остальные поля этапа 02.

---

# 3. Проверка существующей реализации этапа 02

Повторно подтвердить, что после исправления остаются рабочими:

```text
yandexClientId
yclid
utmSource
utmMedium
utmCampaign
utmContent
utmTerm
conversionPageUrl
clientPaidAt
```

И что новые заявки:

```text
Фото
Холст
Футболка
Контакты
```

не потеряли передачу UTM.

---

# 4. Тесты

Добавить/обновить тест, подтверждающий:

```text
pageUrl из заявки
→ OrderPhoto.conversionPageUrl
```

Не называть это landing page в тестах, DTO-комментариях или документации.

Повторно выполнить:

```text
prisma validate
prisma generate
nest build
релевантные jest tests
apps/api typecheck/tests
apps/web typecheck/tests
```

Если полный набор тестов дорогой, минимум — все тесты, затронутые этапом 02, плюс build/typecheck соответствующих приложений.

---

# 5. Обновление документации

Исправить во всех документах этапа 02 утверждения:

```text
landingUrl = страница входа
```

на:

```text
conversionPageUrl = страница, на которой отправлена заявка
```

Отдельно зафиксировать открытый факт:

```text
настоящая first-touch landing page пока не сохраняется
```

и передать его в будущий этап `04_EVENT_MODEL` / атрибуции.

---

# 6. Формат ответа

## EXECUTOR_REPORT_FIX_01

### 1. RESULT

```text
READY_FOR_REVIEW
PARTIAL
BLOCKED
```

### 2. FIELD DECISION

```text
old field:
new field:
why:
```

### 3. MIGRATION STRATEGY

Указать:

- применялась ли исходная migration на persistent/shared БД;
- изменена исходная migration или создана новая;
- почему выбран этот путь;
- destructive operations: yes/no.

### 4. DATA FLOW

```text
window.location.href / pageUrl
→ ...
→ OrderPhoto.<newField>
```

### 5. FILES_CHANGED

```text
Файл | Изменение | Причина
```

### 6. TESTS

```text
Команда | Результат
```

### 7. DOCS UPDATED

Какие MD обновлены и что исправлено.

### 8. NEW FACTS

Если нет:

```text
none
```

### 9. OPEN ISSUES

Должно остаться явно:

```text
first-touch landing URL пока не сохраняется
```

### 10. GIT

```text
repo:
branch:
commit:
push:
git status:
```

---

# 7. Decision Gate

Этап 02 можно перевести в `DONE`, если:

- поле страницы заявки больше не называется `landingUrl`;
- его семантика однозначна;
- migration безопасна;
- документация исправлена;
- существующая structured attribution не сломана;
- clientPaidAt продолжает работать;
- тесты проходят.

После этого:

```text
02_ANALYTICS_DATA_MODEL = DONE
```

и создаётся:

```text
03_HISTORICAL_BACKFILL.md
```

---

# 8. EXECUTOR_REPORT_FIX_01 — 11.09.2026

## 1. RESULT

```text
READY_FOR_REVIEW
```

## 2. FIELD DECISION

```text
old field: landingUrl
new field: conversionPageUrl
why:       поле получает window.location.href в момент отправки заявки —
           адрес страницы конверсии, а не страницы входа на сайт.
           Имя из ТЗ (предпочтительное); в схеме CRM нет соглашения,
           которое делало бы leadPageUrl уместнее. Используется
           последовательно: схема, миграция, lead-attribution.ts, тест,
           документы.
```

## 3. MIGRATION STRATEGY

- Исходная миграция на постоянной/shared БД **не применялась**: только на
  schema-only копию боевой базы для проверки (`crm_shadow_migtest`),
  которая сразу удалялась; ветка в `master` не слита. Проверено запросом
  к боевой базе: `information_schema.columns` не содержит ни
  `landingUrl`, ни `conversionPageUrl` (0 строк).
- Поэтому **вариант A**: исходная миграция
  `20260911180000_order_attribution_fields` переписана, follow-up
  миграции нет. SQL снова сгенерирован `prisma migrate diff` от схемы
  `master` к текущей и положен без ручных правок.
- Почему так: вторая миграция с `RENAME COLUMN` оставила бы в истории
  колонку, которой никогда не было ни в одной живой базе, — шум без
  пользы. Переписывать применённую миграцию было бы нельзя; эта не
  применялась.
- Destructive operations: **no** — `ADD COLUMN` × 8 (nullable, без
  DEFAULT) и `CREATE INDEX` × 2.
- Повторная проверка: миграция применена на свежую schema-only копию
  боевой базы — восемь колонок (`conversionPageUrl, utmCampaign,
  utmContent, utmMedium, utmSource, utmTerm, yandexClientId, yclid`) и
  оба индекса на месте; копия удалена.

## 4. DATA FLOW

```text
window.location.href                    браузер, момент отправки заявки
→ pageUrl                               тело запроса сайта (JSON / FormData)
→ pageUrl                               apps/api DTO (фото, холст, футболки, контакты)
→ lead.pageUrl                          EnrichedLead → CrmLeadChannel
→ pageUrl                               POST /order-photo/lead, DtoCreateLead
→ attributionFromLead(dto)              clean(dto.pageUrl)
→ OrderPhoto.conversionPageUrl
```

Имя на проводе (`pageUrl`) не менялось — сайт и `apps/api` правок
не потребовали.

## 5. FILES_CHANGED

```text
crm-new/prisma/schema.prisma                                   | landingUrl → conversionPageUrl, комментарий переписан | семантика
crm-new/prisma/migrations/20260911180000_.../migration.sql     | перегенерирован, колонка conversionPageUrl, шапка   | вариант A
crm-new/src/order-photo/lead-attribution.ts                    | поле интерфейса и результата, комментарий           | семантика
crm-new/src/order-photo/lead-attribution.spec.ts               | ожидания на conversionPageUrl, комментарий к сценарию A | п. 4 FIX
docs/analytics/00_MASTER_PLAN.md                               | три явные пометки FIX_01 после блоков с landingUrl    | п. 16.4 плана — не менять исходный текст молча
docs/analytics/02_ANALYTICS_DATA_MODEL.md                      | пометка под статусом; в отчёте: таблица полей, data flow, факт 2, open issue 1 | п. 5 FIX
docs/analytics/02_ANALYTICS_DATA_MODEL_FIX_01.md               | добавлен текст доработки + этот отчёт; статус REVIEW  |
```

## 6. TESTS

```text
crm-new: npx prisma validate                       | OK
crm-new: npx prisma generate                       | OK
crm-new: npx prisma migrate diff --script          | SQL сгенерирован, положен без правок
миграция на schema-only копии боевой базы          | 8 колонок + 2 индекса, копия удалена
crm-new: npm run build (nest build)                | OK
crm-new: npx jest src/order-photo                  | 19 suites, 181 passed
crm-new: npx jest                                  | 59 suites, 603 passed
web-photo apps/api: npx tsc --noEmit               | OK (код не менялся)
web-photo apps/api: npx jest                       | 77 passed
web-photo apps/web: npx tsc --noEmit               | OK (код не менялся)
web-photo apps/web: npm test                       | 364, 363 passed, 1 skipped
```

Ранее известные 4 ошибки `tsc --noEmit` в двух spec-файлах CRM —
на `master`, к этапу не относятся, не изменились.

## 7. DOCS UPDATED

- `00_MASTER_PLAN.md` — после каждого из трёх блоков, где перечислено
  `landingUrl` (разделы 13.1, 16/02, 16/03), добавлена явно помеченная
  поправка: поле — `conversionPageUrl`, first-touch landing не
  сохраняется, задача этапа 04. Исходный текст плана не правился.
- `02_ANALYTICS_DATA_MODEL.md` — та же пометка под статусом; в отчёте
  исполнителя исправлены таблица полей, строка data flow, факт 2 и
  открытый вопрос 1. Текст исходного ТЗ (упоминания `landingUrl`)
  оставлен как история.
- `02_ANALYTICS_DATA_MODEL_FIX_01.md` — добавлен в репозиторий, статус
  `REVIEW`, этот отчёт в конце.
- `01_CURRENT_STATE.md` — правок не потребовал: там поле не упоминалось.

## 8. NEW FACTS

```text
none
```

## 9. OPEN ISSUES

```text
first-touch landing URL пока не сохраняется — сайт не запоминает первый
адрес визита, поля под него в OrderPhoto нет. Передано в 04_EVENT_MODEL.
```

Прочее без изменений: 4 ошибки `tsc` в spec на `master`; слияние
`feature/analytics-foundation` — по команде владельца.

## 10. GIT

```text
repo:       racpechatca
branch:     feature/analytics-foundation
commit:     5882956 (код и документы), далее — этот отчёт
push:       origin/feature/analytics-foundation
git status: чисто
master:     не тронут
web-photo:  без изменений в этой доработке
```
