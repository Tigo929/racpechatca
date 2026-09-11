# 05_YANDEX_METRIKA_API.md

# Этап 05 — Подключение CRM к API Яндекс Метрики: OAuth, read-only client и live smoke test

## Статус

```text
REVIEW
```

> Исполнитель не имеет права самостоятельно ставить этапу `DONE`.
> После выполнения этап переводится в `REVIEW`.
> Решение `DONE / NEEDS_FIX / BLOCKED` принимает ChatGPT после проверки отчёта.

---

# 1. Входной контекст

Приняты этапы:

```text
00_MASTER_PLAN            = DONE
01_CURRENT_STATE          = DONE
02_ANALYTICS_DATA_MODEL   = DONE
03_HISTORICAL_BACKFILL    = DONE
04_EVENT_MODEL            = DONE
```

Подтверждено:

- Яндекс Метрика counter ID:

```text
111569944
```

- event catalog создан;
- goals manifest создан;
- `lead_submitted` имеет корректную семантику успешной заявки;
- ложный browser Ecommerce `purchase` удалён только в непроизводственной ветке и пока продолжает работать в production;
- его production-отключение запланировано одновременно с этапом 06;
- `yandexClientId` сохраняется структурированно в CRM;
- `yclid` имеет TTL 21 день;
- `firstTouchUrl` — entry-page dimension текущей вкладки;
- UTM — last-touch внутри текущего `sessionStorage` lifecycle;
- `conversionPageUrl` — страница отправки заявки;
- основной источник/канал будущей аналитики должен приходить из данных визита Метрики;
- четыре цели по последнему аудиту известны как отсутствующие, часть целей имеет статус unknown;
- на этом этапе нужно получить фактическую конфигурацию целей через read-only API.

---

# 2. Цель этапа

Создать безопасный backend-клиент Яндекс Метрики внутри CRM и доказать реальным read-only запросом, что:

```text
CRM NestJS
↓
OAuth token
↓
Yandex Metrika API
↓
counter 111569944
↓
данные успешно получены
```

На этом этапе НЕ строится аналитическое хранилище и НЕ импортируются заказы.

Результат этапа — фундамент API-интеграции, которым будут пользоваться этапы:

```text
06_CRM_TO_METRIKA
07_METRIKA_TO_ANALYTICS
```

---

# 3. Официальная модель авторизации

Яндекс Метрика использует OAuth 2.0.

Для API-запросов токен передаётся:

```http
Authorization: OAuth <token>
```

Для нашего приложения нужны разрешения:

```text
metrika:read
metrika:offline_data
```

Назначение:

```text
metrika:read
→ чтение статистики
→ чтение параметров доступных счётчиков
→ получение списка счётчиков

metrika:offline_data
→ будущая загрузка CRM/offline data на этапе 06
```

На этапе 05 фактически используется только read-доступ.

НЕ добавлять:

```text
metrika:write
```

если нет отдельной необходимости.

---

# 4. Действие владельца проекта

Для live smoke test требуется OAuth token.

Владелец должен создать/использовать Yandex OAuth application:

```text
Для доступа к API или отладки
```

с разрешениями:

```text
metrika:read
metrika:offline_data
```

Токен должен быть выпущен под Яндекс-аккаунтом, который имеет доступ к счётчику:

```text
111569944
```

ВАЖНО:

> Владельцем токена является аккаунт, под которым пользователь авторизовался при выдаче токена, а не просто владелец OAuth-приложения.

---

# 5. Секреты

Runtime CRM должен использовать:

```env
YANDEX_METRIKA_COUNTER_ID=111569944
YANDEX_METRIKA_OAUTH_TOKEN=<secret>
```

Допустимо хранить:

```env
YANDEX_METRIKA_CLIENT_ID=<oauth app client id>
```

только если он реально нужен для операционной документации/диагностики.

Для API-вызовов ClientID приложения не требуется.

НЕ требуется хранить в CRM:

```text
Client Secret
```

если используется вручную полученный OAuth token и нет реализованного server-side refresh flow.

---

# 6. Правила хранения OAuth token

Запрещено:

- коммитить токен;
- помещать токен в frontend;
- отправлять токен в браузер;
- писать токен в application logs;
- писать токен в error objects, которые могут логироваться;
- включать токен в executor report;
- включать токен в скриншоты/документацию;
- хранить токен в database без отдельной причины.

Использовать существующий механизм environment/secrets проекта.

Проверить:

```text
.env*
docker compose
CI/CD variables
production secret injection
```

и описать реальную схему в отчёте.

---

# 7. Поведение при отсутствии конфигурации

Отсутствующий токен Метрики НЕ должен ломать CRM.

Целевое поведение:

```text
CRM запускается
↓
Metrika integration = disabled/not configured
↓
основной бизнес-flow работает
```

Нельзя делать OAuth token обязательным для boot всего backend до момента, когда интеграция станет обязательной инфраструктурой.

Попытка явно вызвать Metrika client без конфигурации должна возвращать контролируемую ошибку:

```text
METRIKA_NOT_CONFIGURED
```

или эквивалент.

---

# 8. Создать Metrika API client/service

Создать один централизованный backend client/service.

Предпочтительная концепция:

```text
YandexMetrikaClient
```

или:

```text
MetrikaApiService
```

Точное имя — по conventions CRM.

Он должен отвечать за:

- base URL;
- OAuth header;
- timeout;
- JSON parsing;
- нормализацию API errors;
- request metadata без секретов.

Нельзя размазывать raw `fetch/axios` вызовы Метрики по разным сервисам.

---

# 9. Base URL

Использовать официальный endpoint:

```text
https://api-metrika.yandex.net
```

Не делать пользовательский произвольный base URL в production-конфигурации без необходимости.

Для unit tests допускается dependency injection/mock transport.

---

# 10. HTTP timeout

Каждый внешний запрос должен иметь конечный timeout.

Выбрать разумное значение, например:

```text
5–10 секунд
```

и обосновать выбор.

Зависший API Метрики не должен зависить worker/CRM бесконечно.

---

# 11. Ошибки API

Нормализовать минимум:

```text
401
→ invalid/missing OAuth authentication

403
→ token/account/app has no required access to counter

429
→ rate limit

5xx
→ Yandex temporary/server error

network timeout
→ external timeout
```

Не выводить OAuth token в сообщениях.

В этапе 05 допустим простой ограниченный retry для idempotent GET на:

```text
429
5xx
network transient error
```

Но не строить полноценную очередь/retry infrastructure — это будет этап 13 и этап 06 для outbound business events.

---

# 12. Smoke test №1 — доступ к счётчику

Выполнить read-only запрос:

```http
GET https://api-metrika.yandex.net/management/v1/counter/111569944
Authorization: OAuth <token>
```

Допустимо использовать:

```text
?field=goals
```

чтобы одновременно получить текущие цели.

Проверить:

```text
HTTP 200
counter.id == 111569944
counter доступен владельцу token
status/activity status
site/name
permission
```

Не публиковать лишние account data в отчёте.

---

# 13. Smoke test №2 — Reports API

Выполнить:

```http
GET https://api-metrika.yandex.net/stat/v1/data
```

Параметры:

```text
ids=111569944
metrics=ym:s:visits,ym:s:users,ym:s:pageviews
```

Период:

```text
последние 7 календарных дней
```

Запрос должен доказать, что Reports API реально отдаёт статистику.

Проверить:

```text
visits
users
pageviews
```

В отчёте разрешено показать сами агрегированные числа.

---

# 14. Accuracy / sampling

На этом этапе не навязывать глобально:

```text
accuracy=full
```

для всех будущих запросов.

Smoke test может использовать стандартное поведение API.

Исполнитель должен сохранить из ответа API информацию о sampling, если она возвращается, и показать её в отчёте.

На этапе 07 будет принято отдельное решение о:

```text
accuracy
sampling
периодах
кэшировании
стоимости запросов
```

---

# 15. Фактический аудит целей через API

Используя read-only counter API, получить фактический список goals для:

```text
111569944
```

Сопоставить его с:

```text
docs/analytics/GOALS_MANIFEST.md
```

Для каждой цели manifest определить:

```text
CONFIGURED
MISSING
```

Статус:

```text
UNKNOWN
```

после успешного live API чтения больше не должен оставаться для целей, которые можно однозначно идентифицировать по event ID.

---

# 16. Не создавать цели в этом этапе

Даже если отсутствующие цели обнаружены:

```text
НЕ POST/PUT
НЕ использовать metrika:write
```

Только сформировать точный список:

```text
configured
missing
extra
```

Создание/изменение целей — отдельное осознанное действие после review.

---

# 17. Сверка EVENT_CATALOG ↔ GOALS

Проверить:

```text
EVENT_CATALOG
↓
GOALS_MANIFEST
↓
реальные goals counter 111569944
```

Выдать три группы:

```text
A. событие есть в коде + goal есть
B. событие есть в коде + goal отсутствует
C. goal есть в Метрике, но отсутствует/не используется текущим кодом
```

Это станет входом для дальнейшей чистки.

---

# 18. Smoke CLI

Предпочтительно создать безопасную CLI-команду.

Например:

```text
npm run metrika:smoke
```

Она должна:

1. проверить наличие конфигурации;
2. получить counter metadata;
3. получить goals;
4. получить базовые metrics за 7 дней;
5. вывести краткий результат;
6. никогда не выводить token.

Не создавать публичный HTTP endpoint только ради smoke test, если в проекте нет такой необходимости.

---

# 19. Пример безопасного CLI output

```text
Yandex Metrika connectivity: OK
Counter: 111569944
Counter access: OK
Goals loaded: 12
Reports API: OK
Period: 2026-09-05..2026-09-11
Visits: ...
Users: ...
Pageviews: ...
Sampling: ...
```

Никаких:

```text
OAuth token
Authorization header
```

---

# 20. Observability

В client/service логировать безопасно:

```text
operation
counterId
durationMs
status code
success/failure
```

Не логировать:

```text
Authorization
full request headers
token
```

На этом этапе не создавать сложную telemetry infrastructure.

---

# 21. Типизация

Не использовать бесконтрольные `any` для ключевых ответов.

Минимально типизировать:

```text
Counter response
Goal summary
Reports API base response
Metrika API error
```

Не требуется моделировать весь OpenAPI Яндекса вручную.

Типизировать только используемый surface.

---

# 22. Тесты API client

Обязательны unit tests.

## A. Authorization header

Mock transport получает:

```text
Authorization: OAuth ***
```

но тест не snapshot'ит реальный token.

---

## B. Counter request

Правильный URL:

```text
/management/v1/counter/111569944
```

---

## C. Reports request

Проверить:

```text
ids
metrics
date1/date2
```

---

## D. 401

Нормализуется в понятную authentication error.

---

## E. 403

Нормализуется в access error.

---

## F. 429

Обрабатывается согласно принятой retry policy.

---

## G. timeout/network failure

Не зависает и возвращает контролируемую ошибку.

---

## H. missing env

CRM/service не падает при boot.

Явный API call сообщает:

```text
not configured
```

---

## I. token redaction

Проверить, что error/log formatting не содержит token.

---

# 23. Live test и секреты

Если у исполнителя НЕТ реального OAuth token:

разрешено полностью реализовать client и unit tests, но результат этапа должен быть:

```text
PARTIAL
```

с причиной:

```text
LIVE_OAUTH_TOKEN_REQUIRED
```

Тогда ChatGPT не переводит этап в DONE до live smoke test.

Исполнитель не должен просить вставлять token в MD/чат/commit.

---

# 24. Никаких данных в БД на этом этапе

Не создавать пока:

```text
MetrikaDailyStats
MetrikaSyncRun
analytics aggregates
```

Это этап 07.

Этап 05 только подтверждает:

```text
authorization
connectivity
API contract
goals state
basic Reports API
```

---

# 25. Не делать сейчас

Запрещено в этапе 05:

- импортировать офлайн-конверсии;
- загружать CRM orders;
- отправлять PAID;
- использовать write endpoints;
- создавать/редактировать goals;
- отключать production false purchase;
- запускать production backfill;
- строить dashboard;
- создавать scheduled sync;
- Logs API;
- Direct API;
- создавать рекламные расходы;
- менять event model;
- менять attribution model.

---

# 26. Production behavior

Этап 05 не должен менять поведение production сайта.

На production:

```text
false purchase при заявке
```

пока продолжает существовать.

Его отключение всё ещё связано с:

```text
06_CRM_TO_METRIKA
```

---

# 27. Git

Основная реализация CRM:

```text
feature/analytics-foundation
```

Не сливать в:

```text
master
```

без команды владельца.

Если в этапе 05 изменение сайта не требуется:

```text
web-photo не трогать
```

---

# 28. Документация

Обновить:

```text
docs/analytics/05_YANDEX_METRIKA_API.md
docs/analytics/GOALS_MANIFEST.md
docs/analytics/00_MASTER_PLAN.md
docs/analytics/01_CURRENT_STATE.md
```

только если появились новые подтверждённые факты.

В Master после выполнения:

```text
04_EVENT_MODEL = DONE
05_YANDEX_METRIKA_API = REVIEW
```

Не ставить самостоятельно:

```text
05 = DONE
```

---

# 29. Формат ответа исполнителя

## EXECUTOR_REPORT

### 1. RESULT

```text
READY_FOR_REVIEW
PARTIAL
BLOCKED
```

### 2. GIT

```text
repo:
branch:
commit:
push:
git status:
master touched:
```

### 3. CONFIGURATION

```text
counter env:
token env:
client id env required: yes/no
client secret required: yes/no
missing config behavior:
```

Не показывать значения секретов.

### 4. OAUTH APP / SCOPES

Подтвердить:

```text
metrika:read:
metrika:offline_data:
metrika:write:
token account has counter access:
```

Если реальный scope нельзя программно доказать полностью — указать, что доказано фактическими API operations.

### 5. API CLIENT

```text
service/class:
HTTP transport:
timeout:
retry policy:
error model:
```

### 6. LIVE COUNTER SMOKE TEST

```text
executed:
HTTP:
counter id:
access:
counter status:
goals received:
duration:
```

Не выводить owner login/token.

### 7. LIVE REPORTS SMOKE TEST

```text
executed:
period:
visits:
users:
pageviews:
sampled:
sample_share:
duration:
```

Если API использует другие поля sampling — показать реальные.

### 8. GOALS RECONCILIATION

```text
configured:
missing:
extra:
```

Приложить таблицу:

```text
event/goal id | manifest status before | actual API status | title
```

### 9. CLI

```text
command:
example redacted output:
```

### 10. SECURITY

Подтвердить:

```text
token committed: no
token logged: no
frontend exposure: no
secret store/env:
redaction tested:
```

### 11. TESTS

Таблица:

```text
Команда | Результат
```

### 12. FILES_CHANGED

```text
Файл | Изменение | Причина
```

### 13. NEW FACTS DISCOVERED

Все новые факты, которые меняют следующие MD.

Если нет:

```text
none
```

### 14. DEVIATIONS FROM SPEC

Если нет:

```text
none
```

### 15. OPEN ISSUES

Если нет:

```text
none
```

### 16. QUESTIONS FOR REVIEWER

Только реальные blocking-вопросы.

---

# 30. Decision Gate для ChatGPT

## DONE

Этап принимается, если:

- централизованный API client реализован;
- token остаётся backend-only;
- отсутствие token не ломает CRM;
- реальный OAuth token успешно прочитал counter 111569944;
- Reports API реально вернул visits/users/pageviews;
- фактические goals получены;
- GOALS_MANIFEST сверён с реальным counter;
- token не попал в commit/log/report;
- unit tests проходят;
- CRM build проходит;
- production write operations не выполнялись.

Тогда:

```text
05_YANDEX_METRIKA_API = DONE
```

Следующий файл:

```text
06_CRM_TO_METRIKA.md
```

---

## NEEDS_FIX

При исправимой проблеме:

```text
05_YANDEX_METRIKA_API = IN_PROGRESS
```

Создать:

```text
05_YANDEX_METRIKA_API_FIX_01.md
```

---

## BLOCKED / PARTIAL

Если единственный блокер — отсутствие OAuth token:

```text
05_YANDEX_METRIKA_API = BLOCKED
```

Причина:

```text
LIVE_OAUTH_TOKEN_REQUIRED
```

После предоставления token через безопасный environment/secrets mechanism исполнитель выполняет только live smoke test и возвращает дополнение к отчёту.

---

# 31. Вход для этапа 06

После DONE этап 06 должен получить:

- работающий `YandexMetrikaClient`;
- безопасную OAuth-конфигурацию;
- подтверждённый доступ к counter 111569944;
- фактический goals list;
- точный список missing goals;
- доказанную работу API;
- event model из этапа 04.

На этапе 06 будет создан надёжный поток:

```text
CRM NEW/PAID/CANCELLED
↓
outbox
↓
Yandex Metrika CRM/offline import
↓
matching result
```

и только после доказанного production-ready paid sync будет координироваться отключение ложного browser `purchase`.

---

# 32. Команда исполнителю

Выполни `05_YANDEX_METRIKA_API.md`.

Не выполняй write/import operations.

Создай централизованный backend client Яндекс Метрики, безопасную конфигурацию и CLI smoke test.

С реальным OAuth token выполни только read-only:

1. чтение counter `111569944` + goals;
2. Reports API `visits/users/pageviews` за последние 7 дней.

Сверь фактические goals с `GOALS_MANIFEST.md`.

Никогда не выводи OAuth token в отчёт или git.

Если token отсутствует — закончи реализацию и тесты, верни `PARTIAL: LIVE_OAUTH_TOKEN_REQUIRED`; не имитируй успешный live test.

---

# 33. EXECUTOR_REPORT — 11.09.2026

## 1. RESULT

```text
PARTIAL — LIVE_OAUTH_TOKEN_REQUIRED
```

Клиент, конфигурация, CLI и тесты готовы. Живой smoke test с настоящим
токеном не выполнялся: токена нет ни в одном окружении проекта
(ключей `YANDEX_METRIKA_*` на сервере нет — проверено по именам
переменных). Успех не имитировался.

## 2. GIT

```text
repo:           racpechatca
branch:         feature/analytics-foundation
commit:         1e50a9a (код), далее — документы этапа
push:           origin/feature/analytics-foundation
git status:     чисто
master touched: no
web-photo:      не тронут — изменений сайта этап не требует
```

## 3. CONFIGURATION

```text
counter env:               YANDEX_METRIKA_COUNTER_ID
token env:                 YANDEX_METRIKA_OAUTH_TOKEN
client id env required:    no  (для запросов к API не нужен)
client secret required:    no  (токен выпускается вручную, серверного refresh нет)
missing config behavior:   CRM стартует; MetrikaModule собирает клиент из окружения,
                           isConfigured() = false; любой вызов getCounter/getGoals/getStats
                           бросает MetrikaApiError kind=not_configured, status 0,
                           с текстом, какие переменные нужны. Бизнес-поток не зависит.
```

Схема секретов (фактическая): `/opt/raspechatka/.env` на сервере →
`docker-compose.prod.yml`, сервис backend, `environment:` — добавлены
обе переменные с пустым значением по умолчанию (`${…:-}`), как у других
необязательных интеграций. В `.env.example` — описание и пустой токен.
CI-переменных для runtime-секретов в проекте нет — образ собирается без
них, секреты живут только на сервере. В базу токен не пишется, во фронтенд
не отдаётся, в логи и ошибки не попадает (тест I).

## 4. OAUTH APP / SCOPES

```text
metrika:read:                    требуется для всех операций этапа; доказать программно
                                 нельзя без токена — при живом smoke доказательством
                                 станут успешные getCounter/getGoals/getStats
metrika:offline_data:            понадобится на этапе 06; на этапе 05 не используется
metrika:write:                   не требуется, не запрашивать
token account has counter access: не подтверждено — токена нет.
```

Приложение OAuth создано владельцем 11.09.2026 (Client ID известен;
Client Secret был показан в переписке и подлежит перевыпуску). Токен
должен быть выпущен под аккаунтом, у которого есть доступ к счётчику
111569944, — это аккаунт-владелец счётчика, а не приложение.

## 5. API CLIENT

```text
service/class:  YandexMetrikaClient — crm-new/src/metrika/metrika-api.client.ts,
                MetrikaModule (фабрика из окружения), зарегистрирован в AppModule
HTTP transport: глобальный fetch (Node 22); в конструктор подменяется для тестов
timeout:        10 000 мс, AbortSignal.timeout на каждый запрос. Управляющие методы
                отвечают за доли секунды, отчёты — до нескольких; десять секунд —
                граница, за которой ждать бессмысленно, а держать воркер вредно
retry policy:   до 2 повторов (паузы 500 и 1500 мс), только GET и только на
                429 / 5xx / сеть / таймаут; 401, 403, 4xx и не-JSON — без повторов
error model:    MetrikaApiError { kind, status, humanMessage, details? }
                kind ∈ not_configured | unauthorized(401) | forbidden(403) |
                rate_limited(429) | server(5xx) | timeout | network | http
                humanMessage — по-русски, без токена; details — ≤ 500 символов тела
                ответа Метрики
типизация:      MetrikaCounter, MetrikaGoal, MetrikaStatsQuery/Response, MetrikaErrorBody —
                только используемая поверхность, остальное unknown
observability:  Nest Logger: «Метрика <операция> counter=<id> → <код> за <мс> (<kind>)»;
                заголовки и токен не логируются
```

## 6. LIVE COUNTER SMOKE TEST

```text
executed:       нет — LIVE_OAUTH_TOKEN_REQUIRED
HTTP:           —
counter id:     —
access:         —
counter status: —
goals received: —
duration:       —
```

Что выполнено вместо живого теста: `metrika:smoke` с **недействительным**
токеном против настоящего `api-metrika.yandex.net` — API ответил
`403`, клиент нормализовал в `forbidden` без повторов, токен в вывод
не попал; связность с эндпойнтом и разбор ошибок проверены на живом API.

## 7. LIVE REPORTS SMOKE TEST

```text
executed:     нет — LIVE_OAUTH_TOKEN_REQUIRED
period:       (будет: последние 7 календарных дней, date1 = сегодня − 6)
visits/users/pageviews/sampled/sample_share/duration: —
```

Поля семплирования, которые CLI печатает из ответа: `sampled`,
`sample_share`, `data_lag`.

## 8. GOALS RECONCILIATION

Без живого чтения сверить нельзя. Состояние манифеста не менялось:

```text
configured: lead_submitted, автоцель формы  (по скриншотам владельца)
missing:    lead_submitted_photo, lead_submitted_canvas, lead_submitted_tshirt, form_error
extra:      unknown
unknown:    form_started, messenger_click, phone_click, 8 воронок
```

Готов инструмент сверки: `metrika:smoke` печатает все цели счётчика
в виде `[id] название (тип: идентификатор события)` — после живого
запуска таблица «событие | было в манифесте | факт API | название»
заполняется по этому выводу.

## 9. CLI

```text
command: npm run metrika:smoke   (= node dist/src/analytics/metrika-smoke.js; нужен npm run build)
         в боевом контейнере: docker exec raspechatka-backend-1 node dist/src/analytics/metrika-smoke.js
exit:    0 — всё прочиталось; 2 — не настроено; 1 — ошибка API

example redacted output (без конфигурации, фактический):
  Yandex Metrika connectivity: NOT CONFIGURED
    counter id: нет, token: нет
    Нужны переменные YANDEX_METRIKA_COUNTER_ID и YANDEX_METRIKA_OAUTH_TOKEN.

example redacted output (недействительный токен, фактический):
  [Nest] WARN [YandexMetrikaClient] Метрика counter counter=111569944 → 403 за 165 мс (forbidden)
  Yandex Metrika connectivity: FAIL (forbidden, HTTP 403)
    У аккаунта токена нет прав на этот счётчик или у приложения нет нужного разрешения (metrika:read).

example output (ожидаемый при успехе):
  Yandex Metrika connectivity: OK
  Counter: 111569944
  Counter access: OK (permission: own, status: Active)
  Site: raspechatkaa.ru
  Goals loaded: N
    - [id] Заявка отправлена (action: lead_submitted)
    …
  Reports API: OK
  Period: 2026-09-05..2026-09-11
  Visits: … / Users: … / Pageviews: …
  Sampling: sampled=false sample_share=1 data_lag=…s
  Duration: … ms
```

## 10. SECURITY

```text
token committed:   no  (.env.example — пустое значение; compose — подстановка ${…:-})
token logged:      no  (лог — операция, счётчик, код, мс)
frontend exposure: no  (backend-only; HTTP-эндпойнта для smoke нет)
secret store/env:  /opt/raspechatka/.env → docker-compose.prod.yml → env контейнера backend
redaction tested:  да — тест I: сообщение, стек, details, humanMessage и собственные поля
                   ошибки не содержат ни токена, ни строки «OAuth »
```

## 11. TESTS

| Команда | Результат |
|---|---|
| `crm-new: npx jest src/metrika` | 14 passed — A заголовок, B адрес счётчика (с полями и без), цели, C параметры отчёта, D 401, E 403, F 429 с успехом со второй попытки и 5xx с исчерпанием, G таймаут и сеть, не-JSON, H отсутствие конфигурации, I отсутствие токена в ошибках |
| `crm-new: npx jest` | 64 suites, **643 passed** |
| `crm-new: npm run build` | OK |
| `npm run metrika:smoke` без переменных | NOT CONFIGURED, exit 2 |
| `npm run metrika:smoke` с недействительным токеном (живой API) | 403 → forbidden, exit 1, токен не напечатан |

## 12. FILES_CHANGED

| Файл | Изменение | Причина |
|---|---|---|
| `crm-new/src/metrika/metrika-api.client.ts` | клиент: OAuth-заголовок, таймаут, повторы, ошибки, лог | п. 8–11, 20 |
| `crm-new/src/metrika/metrika.config.ts` | чтение окружения, `isMetrikaConfigured` | п. 5, 7 |
| `crm-new/src/metrika/metrika.types.ts` | типы используемой поверхности | п. 21 |
| `crm-new/src/metrika/metrika.module.ts` | модуль с фабрикой из окружения | п. 8 |
| `crm-new/src/metrika/metrika-api.client.spec.ts` | 14 тестов | п. 22 |
| `crm-new/src/analytics/metrika-smoke.ts` | CLI проверки связи | п. 18 |
| `crm-new/src/app.module.ts` | `MetrikaModule` | регистрация |
| `crm-new/package.json` | `metrika:smoke` | п. 18 |
| `docker-compose.prod.yml` | две переменные для backend с пустым умолчанием | п. 5–6 |
| `.env.example` | описание и пустой токен | п. 5–6 |
| `docs/analytics/05_YANDEX_METRIKA_API.md` | текст этапа + отчёт | п. 28 |
| `docs/analytics/00_MASTER_PLAN.md` | 04 DONE, 05 REVIEW, раздел 22 | п. 28 |
| `docs/analytics/01_CURRENT_STATE.md` | схема секретов CRM, факт про 403 | п. 28 |

## 13. NEW FACTS DISCOVERED

1. **Недействительный токен Метрика отвечает `403`, а не `401`.** То есть
   «нет прав» и «плохой токен» снаружи неразличимы по коду; клиент
   нормализует оба без повторов, текст ошибки называет обе причины.
2. Runtime-секреты CRM живут только в `/opt/raspechatka/.env` и передаются
   в контейнер поимённо через `environment:` compose — новую переменную
   нужно добавлять в compose, иначе она в контейнер не попадёт (сделано).
3. Токена Метрики в окружении нет ни у CRM, ни у сайта.

## 14. DEVIATIONS FROM SPEC

1. Живые smoke tests №1 и №2 не выполнены — нет токена (раздел 23 ТЗ
   предусматривает этот исход). Вместо них — живой запрос с недействительным
   токеном как проверка связности и разбора ошибок.
2. Цели через API не получены → сверка манифеста не сделана; `unknown`
   остаются (раздел 15 требовал снять их после живого чтения — оно не
   состоялось).

## 15. OPEN ISSUES

1. **Нужен OAuth-токен.** Действия владельца: перевыпустить Client Secret
   приложения (был показан в переписке); выпустить токен под аккаунтом
   с доступом к счётчику (приложение с правами `metrika:read`,
   `metrika:offline_data`); положить его на сервер в `/opt/raspechatka/.env`
   как `YANDEX_METRIKA_OAUTH_TOKEN=…` и добавить
   `YANDEX_METRIKA_COUNTER_ID=111569944`. Токен не присылать в чат.
2. После этого исполнитель выполняет только живой smoke
   (`docker exec raspechatka-backend-1 node dist/src/analytics/metrika-smoke.js`
   после выкладки ветки, либо локально через окружение сервера) и дополняет
   отчёт разделами 6–8.
3. Ветка `feature/analytics-foundation` по-прежнему не слита в `master`.

## 16. QUESTIONS FOR REVIEWER

```text
none
```

---

# 34. EXECUTOR_REPORT_LIVE_SMOKE — 11.09.2026

Дополнение к отчёту раздела 33 по форматам
`05_YANDEX_METRIKA_API_LIVE_SMOKE.md` § 12 и
`05_YANDEX_METRIKA_OAUTH_REAL_APP.md` § 11.

## 1. RESULT

```text
READY_FOR_REVIEW
```

Оба read-only smoke test выполнены настоящим токеном против настоящего
счётчика `111569944`. Код этапа 05 не менялся. Production не тронут.

## 2. LIVE ENVIRONMENT

```text
runner type:          вариант B — локальный runner из checkout ветки
                      (npm run build → npm run metrika:smoke), токен передан
                      переменной окружения одному процессу и не сохранён
feature branch:       feature/analytics-foundation
production modified:  no
production restarted: no
token source:         secret env одного процесса. На сервере токена НЕТ:
                      /opt/raspechatka/.env не содержит ключей YANDEX_METRIKA_*,
                      в контейнере raspechatka-backend-1 их тоже нет
                      (проверено по именам ключей, значения не читались)
token printed:        no  (вывод CLI фильтровался, в отчёт не попал)
```

## 2a. REAL APP METADATA

```text
client id:                          6e727d1db7d243d29b176d6ef8ad1f83
redirect uri:                       https://oauth.yandex.ru/verification_code
counter id:                         111569944
treated as real:                    yes
client secret required for runtime: no  (не использовался и не нужен)
token present in secure env:        no  (см. § 2 — только разовый запуск)
```

## 3. COUNTER RESULT

```text
HTTP:         200
counter id:   111569944
access:       permission = own  (токен выпущен владельцем счётчика)
status:       code_status = CS_ERR_UNKNOWN  (см. NEW FACTS, п. 3)
site:         raspechatkaa.ru
goals count:  13
duration:     в составе общего прогона 1057 мс на три запроса
```

## 4. REPORTS RESULT

```text
period:        2026-09-05 .. 2026-09-11  (7 календарных дней)
visits:        218
users:         151
pageviews:     1189
sampled:       false
sample_share:  1
data_lag:      0 с
duration:      в составе общего прогона 1057 мс на три запроса
```

`metrika:read` подтверждён фактически: счётчик, цели и отчёт прочитаны.
`metrika:offline_data` write-вызовом не проверялся (§ 9 ТЗ) — подтвердится
первым импортом на этапе 06.

## 5. GOALS RECONCILIATION

Источник — `GET /management/v1/counter/111569944/goals`. Полная таблица и
решения — в `GOALS_MANIFEST.md`; здесь свод.

```text
event id                    | title (Метрика)                        | expected     | actual        | final status
----------------------------+----------------------------------------+--------------+---------------+-------------
lead_submitted              | Сколько заявок реально ушло на сервер   | configured   | 611379890 JS  | CONFIGURED
form_started                | Сколько людей вообще начали заполнять  | unknown      | 611379430 JS  | CONFIGURED
messenger_click             | Сколько предпочли написать…            | unknown      | 611380009 JS  | CONFIGURED
phone_click                 | Сколько предпочли позвонить            | unknown      | 611380045 JS  | CONFIGURED
choose_size                 | дошёл до выбора размера                | unknown      | 611382416 JS  | CONFIGURED
add_tshirt_lead             | дошёл до формы заявки                  | unknown      | 611384704 JS  | CONFIGURED
lead_submit_attempt         | Сколько дошли до нажатия «отправить»   | не создавать | 611379504 JS  | CONFIGURED (оставить)
submit_tshirt_order_success | Заявки на футболки…                    | не создавать | 611379979 JS  | CONFIGURED (оставить до lead_submitted_tshirt)
submit_tshirt_order_error   | неудачная отправка…                    | не создавать | 611386291 JS  | CONFIGURED (оставить)
view_custom_tshirt          | открыл конструктор футболки            | не создавать | 611381532 JS  | CONFIGURED (оставить)
lead_submitted_photo        | —                                      | missing      | нет           | MISSING (обязательная)
lead_submitted_canvas       | —                                      | missing      | нет           | MISSING (обязательная)
lead_submitted_tshirt       | —                                      | missing      | нет           | MISSING (обязательная)
form_error                  | —                                      | missing      | нет           | MISSING (обязательная)
canvas_format_select        | —                                      | unknown      | нет           | MISSING (желательная)
canvas_size_select          | —                                      | unknown      | нет           | MISSING (желательная)
canvas_upload_click         | —                                      | unknown      | нет           | MISSING (желательная)
choose_shirt_type           | —                                      | unknown      | нет           | MISSING (желательная)
choose_color                | —                                      | unknown      | нет           | MISSING (желательная)
view_product                | —                                      | unknown      | нет           | MISSING (желательная)
(url /thanks)               | Заявка отправлена                      | «JS-цель»    | 602316919 URL | EXTRA/STALE — оставить, конверсией не считать
(autogoal form)             | Автоцель: отправка формы               | configured   | 602325854     | EXTRA (автоцель) — оставить
(autogoal messenger)        | Автоцель: переход в мессенджер         | —            | 608401685     | EXTRA (автоцель) — оставить
```

```text
configured:   10
missing:      10  (4 обязательных + 6 желательных)
extra/stale:   3  (URL-цель /thanks, две автоцели)
unknown:       0
```

Цели через API не создавались и не менялись (§ 11 ТЗ).

## 6. SECURITY

```text
client secret committed:  no  (не использовался)
token committed:          no
token logged:             no
token shown in report:    no
frontend exposure:        no
write requests executed:  no  (три GET)
```

**Инцидент.** Токен был вставлен владельцем в переписку с исполнителем
открытым текстом. Исполнитель использовал его один раз для этого smoke
и не сохранил, но токен следует считать скомпрометированным: владельцу
нужно отозвать его (Яндекс ID → Безопасность → доступы приложений) или
перевыпустить через
`https://oauth.yandex.ru/authorize?response_type=token&client_id=6e727d1db7d243d29b176d6ef8ad1f83`
и новый токен положить **только** в `/opt/raspechatka/.env` на сервере,
не пересылая его в чат. Client Secret по-прежнему подлежит перевыпуску
(показан в скриншоте ранее).

## 7. DOCS UPDATED

```text
GOALS_MANIFEST.md                    — переписан по факту API: 13 целей с id, типами
                                       и идентификаторами; группы A/B/C; unknown = 0;
                                       URL-цель «Заявка отправлена» = /thanks
05_YANDEX_METRIKA_API.md             — этот раздел 34
05_YANDEX_METRIKA_API_LIVE_SMOKE.md  — статус BLOCKED → REVIEW
05_YANDEX_METRIKA_OAUTH_REAL_APP.md  — статус IN_PROGRESS → REVIEW
00_MASTER_PLAN.md                    — раздел 22: 05 REVIEW (live smoke пройден);
                                       блок 05: критерий users/visits выполнен
01_CURRENT_STATE.md                  — раздел 4 (цели по факту), 5c (live smoke),
                                       факт про URL-цель и CS_ERR_UNKNOWN
```

## 8. NEW FACTS

1. **«Заявка отправлена» (602316919) — не JS-цель, а URL-цель на `/thanks`.**
   На `/thanks` уходят только формы фото и холста; футболки, мерч и
   контакты страницу «спасибо» не открывают. Значит «конверсия 11,96 %»
   из отчётов 5–8.09 занижена на эти формы, и конверсией в отчётах
   этапов 07–09 нужно считать JS-цель `lead_submitted` (611379890), а не
   602316919. Раздел 4 `01_CURRENT_STATE` исправлен.
2. В счётчике **13 целей**, из них 10 JS-целей совпадают с именами
   событий кода. Семь целей, которые манифест этапа 04 считал
   «unknown»/«не создавать», реально существуют — оставлены.
   Не хватает четырёх обязательных (`lead_submitted_photo/canvas/tshirt`,
   `form_error`) и шести целей воронок холста/футболок.
3. `code_status = CS_ERR_UNKNOWN` — проверка кода счётчика Яндексом
   не находит счётчик на странице. Ожидаемо: счётчик на сайте
   загружается только после согласия на cookie (`Analytics.tsx`), а
   робот проверки согласия не даёт. На сбор данных не влияет (218 визитов
   за неделю подтверждают); это та же причина, по которой раньше не
   работали Вебвизор и карты во фрейме до исключения `isMetrikaFrame()`.
4. Отчёт за 7 дней без семплирования (`sampled=false`, `sample_share=1`,
   `data_lag=0`) — на текущих объёмах (~30 визитов/день) Reports API
   отдаёт точные числа; это упростит сверку CRM↔Метрика на этапах 06–08.
5. Токен на сервере отсутствует; для этапа 06 он должен появиться в
   `/opt/raspechatka/.env` (новый, после отзыва показанного).

## 9. OPEN ISSUES

1. Отзыв/перевыпуск показанного в чате OAuth-токена и перевыпуск Client
   Secret — действие владельца.
2. Новый токен → `/opt/raspechatka/.env` (`YANDEX_METRIKA_COUNTER_ID=111569944`,
   `YANDEX_METRIKA_OAUTH_TOKEN=…`), без пересылки в чат — действие владельца.
3. Создание четырёх обязательных целей из `GOALS_MANIFEST.md` § B — вручную
   владельцем (или программно на этапе 06/13 после решения о `metrika:write`).
4. Ветка `feature/analytics-foundation` не слита в `master`; backfill
   `--apply` не выполнялся — ждут команды владельца.

## 10. GIT

```text
repo:    racpechatca
branch:  feature/analytics-foundation
commit:  коммит «docs(аналитика, этап 05): live smoke …» поверх 3972558
push:    origin/feature/analytics-foundation
status:  live smoke не потребовал изменений кода — изменены только документы
master:  не тронут
```
