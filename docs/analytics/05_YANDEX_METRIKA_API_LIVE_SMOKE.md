# 05_YANDEX_METRIKA_API_LIVE_SMOKE.md

# Этап 05 — Live smoke test OAuth и фактическая сверка целей

## Статус

```text
BLOCKED
```

Причина:

```text
LIVE_OAUTH_TOKEN_REQUIRED
```

> Код этапа 05 принят как технически готовый к live-проверке.
> Новый код и новая архитектура сейчас не требуются.
> Этап 05 нельзя переводить в DONE, пока реальный OAuth-токен не подтвердит доступ к счётчику `111569944` и Reports API.

---

# 1. Что уже принято

Из отчёта этапа 05 принимаются:

- централизованный `YandexMetrikaClient`;
- `MetrikaModule`;
- backend-only конфигурация;
- `YANDEX_METRIKA_COUNTER_ID`;
- `YANDEX_METRIKA_OAUTH_TOKEN`;
- отсутствие обязательного token при boot CRM;
- timeout 10 секунд;
- retry только для временных GET-ошибок;
- нормализация 401/403/429/5xx/network/timeout;
- безопасная redaction токена;
- CLI `metrika:smoke`;
- unit tests;
- CRM build;
- отсутствие изменений в production;
- отсутствие write/import операций.

Единственный блокер:

```text
нет реального OAuth token
```

---

# 2. Действие владельца перед запуском

## 2.1. Перевыпустить Client Secret OAuth-приложения

Если Client Secret ранее был показан в переписке/скриншоте третьей стороне или попал в небезопасный контекст:

```text
перевыпустить secret
```

Хотя runtime CRM сейчас не использует Client Secret, скомпрометированный secret не следует оставлять действующим.

Новый secret:

- не присылать в ChatGPT;
- не добавлять в MD;
- не коммитить;
- не нужен для текущего runtime smoke test.

---

## 2.2. Выпустить OAuth token

Токен должен быть получен под Яндекс-аккаунтом, который имеет доступ к:

```text
counter 111569944
```

Разрешения OAuth-приложения:

```text
metrika:read
metrika:offline_data
```

Не добавлять:

```text
metrika:write
```

---

# 3. Куда положить token

Предпочтительный production secret location проекта:

```text
/opt/raspechatka/.env
```

Добавить:

```env
YANDEX_METRIKA_COUNTER_ID=111569944
YANDEX_METRIKA_OAUTH_TOKEN=<secret>
```

ВАЖНО:

- token не вставлять в чат;
- token не вставлять в executor report;
- token не вставлять в команды, которые попадут в публичные логи;
- token не коммитить.

---

# 4. Не менять production ради smoke test без необходимости

Код этапа 05 находится в:

```text
feature/analytics-foundation
```

а production CRM работает из `master`.

Поэтому исполнитель сначала должен выбрать безопасный способ live test, НЕ сливая этап 05 в `master`.

Допустимые варианты:

### Вариант A — выполнить CLI из рабочего checkout ветки

Если на сервере/рабочей машине доступен checkout:

```text
feature/analytics-foundation
```

загрузить environment безопасно и выполнить:

```text
npm run build
npm run metrika:smoke
```

### Вариант B — локальный/CI-safe runner

Запустить smoke из этой же ветки в окружении, куда token передан как secret env.

### Вариант C — временный container/image из feature branch

Допустимо только если он не заменяет production backend и не принимает production traffic.

---

# 5. Запрещено

Для smoke test НЕ нужно:

- merge в `master`;
- restart production CRM;
- deploy сайта;
- отключать `purchase`;
- запускать backfill;
- выполнять POST/PUT/DELETE в API Метрики;
- импортировать CRM orders;
- менять goals;
- показывать token.

---

# 6. Live smoke №1 — Counter

Выполнить фактический read-only вызов:

```text
GET /management/v1/counter/111569944
```

с goals.

Ожидается:

```text
HTTP 200
counter.id = 111569944
```

Зафиксировать:

```text
counter access
counter status
permission/access level
goals count
request duration
```

Не публиковать owner login/email.

---

# 7. Live smoke №2 — Reports API

Выполнить read-only запрос за последние 7 календарных дней:

```text
metrics:
ym:s:visits
ym:s:users
ym:s:pageviews
```

Зафиксировать:

```text
period
visits
users
pageviews
sampling/sampled
sample_share, если API возвращает
duration
```

Числа можно включить в отчёт.

---

# 8. Фактическая сверка целей

После получения goals из counter API сопоставить:

```text
EVENT_CATALOG.md
GOALS_MANIFEST.md
реальный counter 111569944
```

Нужны три группы:

## A. CONFIGURED

Событие используется кодом и цель реально существует.

## B. MISSING

Событие используется/требуется, но цели нет.

## C. EXTRA / STALE

Цель существует в Метрике, но текущий код её не использует либо она относится к старой логике.

После live API:

```text
UNKNOWN
```

должен исчезнуть для всех целей, которые можно однозначно сопоставить по event identifier.

---

# 9. Важная проверка scopes

API не обязательно предоставляет удобный endpoint со списком scopes token.

Поэтому фактическое подтверждение:

```text
metrika:read
```

считается успешным, если:

- counter успешно прочитан;
- goals прочитаны;
- Reports API успешно возвращает данные.

`metrika:offline_data` пока не проверять write-вызовом.

Его наличие будет практически подтверждаться на этапе 06 первой безопасной операцией импорта.

Не выполнять write только ради проверки scope.

---

# 10. Если Counter API вернул 403

Не считать автоматически:

```text
"токен неправильный"
```

Проверить:

1. token выпущен под нужным аккаунтом;
2. этот аккаунт действительно имеет доступ к `111569944`;
3. OAuth application имеет `metrika:read`;
4. token был получен после добавления нужных scopes;
5. token не был отозван/перевыпущен.

Поскольку API может отвечать 403 и на проблемы token, и на отсутствие прав, причина устанавливается по конфигурации аккаунта/scopes.

---

# 11. Если Reports API работает, а цели расходятся

Не менять цели в этом этапе.

Только обновить:

```text
GOALS_MANIFEST.md
```

фактическими статусами.

Создание missing goals будет отдельным контролируемым действием после review.

---

# 12. Формат дополнения к отчёту

## EXECUTOR_REPORT_LIVE_SMOKE

### 1. RESULT

```text
READY_FOR_REVIEW
BLOCKED
```

### 2. LIVE ENVIRONMENT

```text
runner type:
feature branch:
production modified: yes/no
production restarted: yes/no
token source: secret env / server env
token printed: no
```

Не указывать token.

### 3. COUNTER RESULT

```text
HTTP:
counter id:
access:
status:
goals count:
duration:
```

### 4. REPORTS RESULT

```text
period:
visits:
users:
pageviews:
sampled:
sample_share:
duration:
```

### 5. GOALS RECONCILIATION

Таблица:

```text
event id | title | expected | actual | final status
```

И итоги:

```text
configured:
missing:
extra/stale:
unknown:
```

### 6. SECURITY

```text
token committed: no
token logged: no
token shown in report: no
write requests executed: no
```

### 7. DOCS UPDATED

Указать:

```text
GOALS_MANIFEST.md
05_YANDEX_METRIKA_API.md
00_MASTER_PLAN.md
```

и что именно обновлено.

### 8. NEW FACTS

Все новые факты, которые влияют на этап 06.

### 9. OPEN ISSUES

Если нет:

```text
none
```

### 10. GIT

```text
repo:
branch:
commit:
push:
status:
```

Если live smoke не потребовал code changes — так и написать.

---

# 13. Decision Gate

## DONE

Этап 05 закрывается, если:

- реальный token успешно прочитал counter `111569944`;
- Reports API вернул visits/users/pageviews;
- фактический goals list получен;
- GOALS_MANIFEST сверён;
- token не попал в код/логи/отчёт;
- write operations не выполнялись;
- production не был изменён только ради smoke test.

Тогда:

```text
05_YANDEX_METRIKA_API = DONE
```

Следующий этап:

```text
06_CRM_TO_METRIKA.md
```

---

## BLOCKED

Если live test не проходит:

```text
05_YANDEX_METRIKA_API = BLOCKED
```

В отчёте вернуть точную нормализованную ошибку и проверенные причины.

Не начинать этап 06, пока read-access к реальному counter не подтверждён.

---

# 14. Команда исполнителю

Не меняй архитектуру этапа 05.

После того как владелец сообщит:

```text
токен на месте
```

выполни только безопасный live read-only smoke test из feature branch.

Проверь:

1. counter `111569944`;
2. goals;
3. Reports API за 7 дней;
4. сверку `GOALS_MANIFEST`.

Не выполняй никаких write/import операций и не трогай production deployment.

---

# 15. Состояние на 11.09.2026 (исполнитель)

Проверено по именам переменных в `/opt/raspechatka/.env`: `YANDEX_METRIKA_COUNTER_ID`
и `YANDEX_METRIKA_OAUTH_TOKEN` **отсутствуют**. Live smoke не запускался.

Выбранный способ запуска, когда токен появится — вариант A/B: рабочий checkout
`feature/analytics-foundation` на машине исполнителя, `npm run build`,
переменные окружения читаются с сервера по SSH прямо в окружение процесса
(тот же приём, что для копии базы на этапе 03), ничего не печатается, затем
`npm run metrika:smoke`. Production не трогается: ни merge, ни рестарт.

Ожидание команды владельца: «токен на месте».
