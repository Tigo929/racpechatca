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
