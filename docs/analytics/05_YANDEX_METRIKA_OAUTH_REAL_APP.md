# 05_YANDEX_METRIKA_OAUTH_REAL_APP.md

# Этап 05 — Реальные данные OAuth-приложения и завершение live smoke

## Статус

```text
REVIEW
```

ClientID, Redirect URI и Counter ID приняты как реальные; live smoke с
настоящим токеном пройден 11.09.2026 (`05_YANDEX_METRIKA_API.md`, § 34).
Client Secret не использовался. Токен, показанный в переписке, подлежит
отзыву и перевыпуску владельцем; новый — только в `/opt/raspechatka/.env`.

> Это дополнение к `05_YANDEX_METRIKA_API.md` и `05_YANDEX_METRIKA_API_LIVE_SMOKE.md`.
> Данные OAuth-приложения ниже считать РЕАЛЬНЫМИ текущими данными проекта, а не примерами/placeholder.
> Client Secret является временным и будет перевыпущен владельцем позже. Не блокировать работу из-за этого и не переносить secret в код/документацию.

---

# 1. Реальные данные OAuth-приложения

Использовать как фактические:

```text
OAuth provider: Yandex OAuth
Application purpose: доступ к API / отладка
ClientID: 6e727d1db7d243d29b176d6ef8ad1f83
Redirect URI: https://oauth.yandex.ru/verification_code
Counter ID: 111569944
```

Запрашиваемые права должны включать:

```text
metrika:read
metrika:offline_data
```

Не использовать без отдельного решения:

```text
metrika:write
```

---

# 2. Client Secret

У приложения существует реальный Client Secret, показанный владельцем отдельно.

Правила:

- считать его временно действующим;
- НЕ копировать его в этот MD;
- НЕ коммитить;
- НЕ hardcode;
- НЕ писать в логи;
- НЕ добавлять в frontend;
- НЕ включать в отчёт;
- НЕ использовать как runtime-secret CRM, если это не требуется выбранным OAuth flow.

Для текущего implicit/token flow:

```text
response_type=token
```

Client Secret НЕ нужен.

Если текущая реализация этапа 05 требует только готовый OAuth access token:

```text
Client Secret не использовать вообще.
```

Владелец позже перевыпустит Client Secret отдельно.

---

# 3. Реальный URL авторизации

Использовать этот ClientID как настоящий:

```text
https://oauth.yandex.ru/authorize?response_type=token&client_id=6e727d1db7d243d29b176d6ef8ad1f83
```

Это НЕ placeholder.

Авторизация должна выполняться под Яндекс-аккаунтом, имеющим доступ к счётчику:

```text
111569944
```

---

# 4. Что считать уже решённым

Не задавать повторно вопросы:

```text
"Какой ClientID?"
"Какой Redirect URI?"
"Это тестовое приложение?"
"Можно ли считать данные реальными?"
```

Ответы:

```text
ClientID известен и реальный.
Redirect URI известен и реальный.
OAuth-приложение реальное.
Counter ID реальный.
```

Единственный runtime-secret, необходимый для live smoke:

```text
YANDEX_METRIKA_OAUTH_TOKEN
```

---

# 5. Что НЕ делать с Client Secret

Не строить новую server-side OAuth authorization flow только потому, что Client Secret известен.

Текущая архитектура уже принята:

```text
владелец получает OAuth token
↓
token хранится в backend env
↓
YandexMetrikaClient использует token
```

Не добавлять:

```text
refresh-token service
OAuth callback endpoint
Client Secret в CRM env
JWT signing logic
новый auth controller
```

без отдельного ТЗ.

---

# 6. Environment CRM

Целевые runtime-переменные остаются:

```env
YANDEX_METRIKA_COUNTER_ID=111569944
YANDEX_METRIKA_OAUTH_TOKEN=<real access token>
```

Не добавлять Client Secret в runtime env, если код его не использует.

ClientID приложения также не обязан находиться в runtime env для API-запросов.

---

# 7. Если OAuth token ещё не находится на сервере

Не считать отсутствие token проблемой OAuth-приложения.

Вернуть только:

```text
LIVE_OAUTH_TOKEN_REQUIRED
```

При этом подтвердить:

```text
real ClientID accepted
real Redirect URI accepted
counter ID accepted
no additional OAuth app metadata required
```

Не имитировать token.

---

# 8. Если token уже добавлен владельцем

Как только:

```text
/opt/raspechatka/.env
```

содержит:

```env
YANDEX_METRIKA_COUNTER_ID=111569944
YANDEX_METRIKA_OAUTH_TOKEN=<secret>
```

выполнить `05_YANDEX_METRIKA_API_LIVE_SMOKE.md`.

Только read-only:

1. прочитать counter `111569944`;
2. получить goals;
3. получить Reports API за последние 7 дней;
4. сверить `GOALS_MANIFEST.md`.

---

# 9. Важное правило по секретам

Не печатать в ответе:

```text
OAuth access token
Client Secret
Authorization header
```

Даже если эти значения доступны исполнителю.

Разрешено печатать:

```text
ClientID
Counter ID
Redirect URI
HTTP status
aggregate metrics
goal ids/titles
```

---

# 10. Live smoke criteria

Успешный этап должен доказать:

```text
ClientID приложения реальный
↓
OAuth token реальный
↓
аккаунт имеет доступ к counter 111569944
↓
Counter API = 200
↓
Goals API/data = получены
↓
Reports API = получены visits/users/pageviews
```

---

# 11. Формат отчёта

## EXECUTOR_REPORT_REAL_OAUTH

### 1. RESULT

```text
READY_FOR_REVIEW
BLOCKED
```

### 2. REAL APP METADATA

```text
client id: 6e727d1db7d243d29b176d6ef8ad1f83
redirect uri: https://oauth.yandex.ru/verification_code
counter id: 111569944
treated as real: yes
client secret required for runtime: no
```

### 3. TOKEN STATUS

```text
token present in secure env: yes/no
token printed: no
```

### 4. LIVE COUNTER

Если token есть:

```text
HTTP:
counter id:
access:
status:
goals count:
duration:
```

### 5. LIVE REPORTS

Если token есть:

```text
period:
visits:
users:
pageviews:
sampled:
sample share:
duration:
```

### 6. GOALS RECONCILIATION

```text
configured:
missing:
extra/stale:
unknown:
```

### 7. SECURITY

```text
client secret committed: no
oauth token committed: no
oauth token logged: no
frontend exposure: no
write requests: no
```

### 8. OPEN ISSUES

Если token отсутствует:

```text
LIVE_OAUTH_TOKEN_REQUIRED
```

Если live smoke успешен:

```text
none
```

---

# 12. Decision Gate

Если token отсутствует:

```text
05_YANDEX_METRIKA_API = BLOCKED
```

Но НЕ возвращаться к обсуждению ClientID/Redirect URI — они уже подтверждены как реальные.

Если token присутствует и оба read-only smoke теста успешны:

```text
05_YANDEX_METRIKA_API = DONE
```

Следующий этап:

```text
06_CRM_TO_METRIKA.md
```

---

# 13. Команда исполнителю

Считать ClientID, Redirect URI и Counter ID из этого документа реальными данными проекта.

Не считать их placeholder.

Не использовать и не запрашивать Client Secret для runtime CRM: текущему token-based API client он не нужен.

Если access token уже находится в secure environment — выполнить live smoke из `05_YANDEX_METRIKA_API_LIVE_SMOKE.md`.

Если token ещё отсутствует — вернуть только `LIVE_OAUTH_TOKEN_REQUIRED`, не задавая повторных вопросов о ClientID/Redirect URI и не меняя архитектуру.

---

# 14. EXECUTOR_REPORT_REAL_OAUTH — 11.09.2026

```text
RESULT: BLOCKED — LIVE_OAUTH_TOKEN_REQUIRED
```

Приняты как реальные: ClientID 6e727d1db7d243d29b176d6ef8ad1f83, Redirect URI
https://oauth.yandex.ru/verification_code, счётчик 111569944. Client Secret для
runtime не требуется и не используется. Проверка `/opt/raspechatka/.env` по именам
переменных: `YANDEX_METRIKA_COUNTER_ID` и `YANDEX_METRIKA_OAUTH_TOKEN` отсутствуют.
Живой smoke не запускался. Ожидание: «токен на месте».
