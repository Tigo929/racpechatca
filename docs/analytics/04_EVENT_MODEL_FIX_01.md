# 04_EVENT_MODEL_FIX_01.md

# Этап 04 — Доработка 01: окно yclid и правило атрибуции

## Статус

```text
REVIEW
```

> Основная реализация этапа 04 принята по архитектуре.
> Этап не переводится в DONE до закрытия двух решений:
> 1. бессрочный `yclid`;
> 2. смешение понятий first-touch URL и маркетинговой атрибуции.

# 1. Решение Reviewer

## 1.1. `yclid` — не хранить бессрочно

Принятое решение:

```text
yclid TTL = 21 день
```

Причина: Яндекс Метрика связывает офлайн-конверсии и CRM-данные с визитами в пределах 21-дневного периода учета. Поэтому бессрочный `localStorage['yclid']` может приписывать новый заказ рекламному клику давней давности, хотя такой идентификатор уже не соответствует рабочему окну сопоставления офлайн-конверсий.

Целевая семантика:

```text
новый yclid из URL
↓
сохраняем yclid + capturedAt
↓
действителен 21 день
↓
после истечения не передаём в новую заявку
```

Новый `yclid` всегда заменяет старый и начинает новое 21-дневное окно.

# 2. Реализация TTL

Текущий механизм:

```text
localStorage['yclid']
```

нужно заменить/расширить так, чтобы вместе со значением сохранялось время получения.

Предпочтительно одна versioned JSON-запись, например концептуально:

```json
{
  "value": "...",
  "capturedAt": 1234567890
}
```

Точное имя storage key и структура выбираются по conventions проекта.

Требования:

- TTL = ровно 21 день;
- при чтении просроченный yclid не возвращается;
- просроченная запись по возможности удаляется;
- новый yclid перезаписывает старый;
- storage exception не ломает пользовательский flow;
- старый legacy string-format `yclid`, если уже существует у пользователей, обработать безопасно.

# 3. Legacy `yclid` в localStorage

На момент rollout у пользователей могут существовать старые записи:

```text
localStorage['yclid'] = "<value>"
```

без даты получения.

У такой записи невозможно доказать возраст.

Принятое правило:

```text
legacy yclid без capturedAt
→ НЕ считать валидным для новой заявки
→ удалить / проигнорировать
```

Не присваивать ему искусственно новые 21 день с момента обновления сайта.

# 4. ClientID остаётся основным идентификатором

TTL `yclid` не означает, что через 21 день заказ становится невозможно связать с пользователем.

Для CRM и будущего импорта приоритет:

```text
1. yandexClientId
2. валидный yclid как дополнительный рекламный идентификатор
```

Не удалять и не ограничивать `yandexClientId` этим TTL.

# 5. Решение по модели атрибуции

Вопрос из отчёта:

> использовать first-touch или last-touch UTM для отчётов?

Ответ:

> Не смешивать эти понятия. Они отвечают на разные вопросы.

## 5.1. `firstTouchUrl`

Использовать как dimension поведения:

```text
С какой страницы пользователь начал текущий tab/session journey?
```

Это нужно для анализа landing/entry pages и UX.

`firstTouchUrl` НЕ определяет рекламный источник заказа.

## 5.2. UTM

Для campaign attribution в CRM принять текущую фактическую модель:

```text
last-touch UTM within the current sessionStorage lifecycle
```

То есть новый набор UTM в рамках текущей вкладки заменяет предыдущий, и именно актуальный набор передаётся с заявкой.

# 6. Что будет источником маркетинговой атрибуции в итоговых отчётах

Целевая архитектура:

```text
Маркетинговый источник / канал
→ данные визита Яндекс Метрики как основной аналитический источник

Campaign detail / CRM attribution
→ UTM, сохранённые вместе с заявкой

Yandex Direct click evidence
→ валидный yclid

Entry-page analysis
→ firstTouchUrl

Conversion-page analysis
→ conversionPageUrl
```

То есть `firstTouchUrl` и `last-touch UTM` не конкурируют между собой: это разные измерения.

# 7. Важная пометка для этапа 08

В `08_ANALYTICS_METRICS.md` зафиксировать:

- для канала/источника по возможности использовать источник визита Яндекс Метрики;
- сохранённые UTM заявки трактовать как `last-touch UTM in current session`;
- `firstTouchUrl` использовать как entry-page dimension;
- не называть `firstTouchUrl` first-touch marketing attribution.

# 8. Тесты yclid TTL

Обязательные сценарии:

A. Новый yclid сохраняется вместе с `capturedAt`.

B. В пределах 21 дней `getYclid()` возвращает значение.

C. После 21 дней `getYclid()` не возвращает значение, просроченная запись не уходит в lead.

D. Новый yclid заменяет старый и обновляет `capturedAt`.

E. Legacy string без timestamp не считается валидным и не получает новый 21-дневный срок.

F. Недоступный/бросающий `localStorage` не ломает форму и заказ.

# 9. Не менять

В этой доработке НЕ нужно:

- менять firstTouchUrl lifecycle;
- менять UTM sessionStorage lifecycle;
- подключать API Метрики;
- создавать цели удалённо;
- менять `lead_submitted`;
- менять event registry;
- менять уже подготовленную стратегию `purchase`;
- выкладывать ветку сайта в production;
- трогать CRM-paid sync.

# 10. Документация

Обновить:

```text
04_EVENT_MODEL.md
00_MASTER_PLAN.md
```

и при необходимости `EVENT_CATALOG.md` / `GOALS_MANIFEST.md`.

В `04_EVENT_MODEL.md` добавить architecture decision:

```text
yclid TTL = 21 days
campaign UTM = last-touch within current session
firstTouchUrl = entry-page dimension, not marketing attribution
conversionPageUrl = conversion-page dimension
```

Этап оставить:

```text
04_EVENT_MODEL = REVIEW
```

до решения ChatGPT.

# 11. Формат ответа

## EXECUTOR_REPORT_FIX_01

### 1. RESULT

```text
READY_FOR_REVIEW
PARTIAL
BLOCKED
```

### 2. YCLID STORAGE

```text
old format:
new format:
TTL:
legacy handling:
new-click overwrite:
```

### 3. DATA FLOW

```text
URL yclid
→ storage
→ getYclid
→ lead
→ API
→ CRM
```

### 4. ATTRIBUTION DECISION RECORDED

Подтвердить:

```text
firstTouchUrl:
UTM:
yclid:
conversionPageUrl:
future Metrika source:
```

### 5. TESTS

```text
Команда | Результат
```

Отдельно перечислить сценарии A–F.

### 6. FILES_CHANGED

```text
Файл | Изменение | Причина
```

### 7. PRODUCTION STATUS

```text
feature branch:
production changed: yes/no
false purchase production behavior:
```

### 8. NEW FACTS

Если нет:

```text
none
```

### 9. OPEN ISSUES

Не повторять уже решённые вопросы про TTL или first-touch-vs-UTM.

### 10. GIT

Для затронутых репозиториев:

```text
repo:
branch:
commit:
push:
status:
```

# 12. Decision Gate

Этап 04 переводится в DONE, если:

- `yclid` больше не бессрочный;
- TTL = 21 день;
- legacy yclid без даты не получает искусственно новое окно;
- analytics/storage failure не ломает заказ;
- attribution semantics отражены в документации;
- firstTouchUrl не используется как marketing source;
- UTM semantics определены как last-touch в текущем session lifecycle;
- тесты проходят;
- production purchase остаётся неизменённым до этапа 06.

После этого:

```text
04_EVENT_MODEL = DONE
```

и следующий этап:

```text
05_YANDEX_METRIKA_API.md
```

---

# 13. EXECUTOR_REPORT_FIX_01 — 11.09.2026

## 1. RESULT

```text
READY_FOR_REVIEW
```

## 2. YCLID STORAGE

```text
old format:         localStorage['yclid'] = "<строка>", без даты, без срока
new format:         localStorage['yclid'] = {"version":1,"value":"<строка>","capturedAt":<мс>}
                    (ключ тот же — прежняя запись под ним распознаётся как legacy и удаляется)
TTL:                21 день ровно: YCLID_TTL_MS = 21 × 24 × 60 × 60 × 1000;
                    граница включительно (ровно 21 день — ещё действует, +1 мс — нет)
legacy handling:    строка без даты / битый JSON / объект без capturedAt →
                    недействительно, при чтении удаляется, новых 21 дня не получает
new-click overwrite: новый yclid в адресе перезаписывает запись целиком
                    и ставит новый capturedAt — отсчёт начинается заново
ClientID:           не затронут — по-прежнему главный ключ связи с посетителем
```

## 3. DATA FLOW

```text
URL ?yclid=…
→ rememberYclid(now) при первой отрисовке страницы (Analytics.tsx, без изменений)
→ localStorage['yclid'] = {version, value, capturedAt}
→ getYclid(now) при отправке заявки: yclid из адреса текущей страницы,
  иначе из хранилища, если now − capturedAt ≤ 21 дня; просроченное удаляется
→ lead.yclid (пять форм, вызовы не менялись)
→ apps/api DTO ×4 → EnrichedLead.yclid → CrmLeadChannel
→ CRM DtoCreateLead.yclid → attributionFromLead → OrderPhoto.yclid
```

Ни один участник цепочки после getYclid не менялся: сигнатура та же,
параметр `now` — только для тестов.

## 4. ATTRIBUTION DECISION RECORDED

```text
firstTouchUrl:         измерение поведения — с какой страницы началась
                       текущая вкладка/визит; для анализа входных страниц и UX.
                       НЕ определяет рекламный источник заказа.
UTM:                   маркетинговая атрибуция заявки в CRM — last-touch
                       внутри текущего sessionStorage-визита: новый набор utm_*
                       в адресе заменяет предыдущий, с заявкой уходит актуальный.
yclid:                 свидетельство клика по Директу, действует 21 день,
                       дополнение к ClientID, не замена.
conversionPageUrl:     измерение — страница, на которой отправлена заявка.
future Metrika source: канал/источник визита в итоговых отчётах — из данных
                       визита Яндекс Метрики (Reports API, этап 07), UTM заявки —
                       детализация кампании, firstTouchUrl — входная страница.
```

Записано как архитектурное решение в разделе 32 этого документа
и пометкой для этапа 08.

## 5. TESTS

| Команда | Результат |
|---|---|
| `web-photo apps/web: node --test src/lib/yclid.test.ts` | 9 passed |
| `web-photo apps/web: npx tsc --noEmit` | OK |
| `web-photo apps/web: npm test` | **390 тестов, 389 passed, 1 skipped** |

Сценарии доработки:

| Сценарий | Тест | Итог |
|---|---|---|
| A — новый yclid сохраняется с `capturedAt` | «A: новый yclid сохраняется вместе с временем получения» | ✔ |
| B — в пределах 21 дня возвращается | «B: …», включая ровно 21 день | ✔ |
| C — после 21 дня не возвращается, запись удалена, в заявку не уходит | «C: …» | ✔ |
| D — новый заменяет старый и обновляет `capturedAt` | «D: …» (второй клик через 15 дней жив через 30 от первого) | ✔ |
| E — legacy-строка без даты недействительна и не получает новый срок | «E: …», «E2: битый JSON и запись без capturedAt» | ✔ |
| F — недоступный/бросающий localStorage не ломает форму | «F: …», «F2: без window» | ✔ |

## 6. FILES_CHANGED

| Файл | Изменение | Причина |
|---|---|---|
| `web-photo/apps/web/src/lib/yclid.ts` | JSON-запись с `capturedAt`, TTL 21 день, обработка legacy, удаление просроченного, `YCLID_TTL_MS` | п. 1–3 FIX |
| `web-photo/apps/web/src/lib/yclid.test.ts` | новый, 9 тестов (A–F + граница + URL) | п. 8 FIX |
| `racpechatca/docs/analytics/04_EVENT_MODEL.md` | раздел 32 «Архитектурное решение», этот отчёт | п. 10 FIX |
| `racpechatca/docs/analytics/04_EVENT_MODEL_FIX_01.md` | текст доработки + отчёт | |
| `racpechatca/docs/analytics/EVENT_CATALOG.md` | пометка о сроке yclid и о смысле firstTouchUrl | п. 10 FIX |
| `racpechatca/docs/analytics/01_CURRENT_STATE.md` | строка про yclid обновлена | факт изменился |
| `racpechatca/docs/analytics/00_MASTER_PLAN.md` | статус 04 остаётся REVIEW; раздел 22 — упоминание FIX_01 | п. 10 FIX |

## 7. PRODUCTION STATUS

```text
feature branch:                    web-photo feature/analytics-event-model (cb2dd96)
production changed:                no — ветка не в списке сборки CI
false purchase production behavior: без изменений — production (feature/cms-admin)
                                   по-прежнему отправляет purchase при заявке;
                                   отключится при слиянии ветки вместе с этапом 06
```

## 8. NEW FACTS

```text
none
```

## 9. OPEN ISSUES

1. Слияние `feature/analytics-event-model` в `feature/cms-admin` — вместе с этапом 06.
2. Четыре цели не созданы в Метрике; 11 — unknown (GOALS_MANIFEST).
3. У формы мерча нет `form_error`.
4. До слияния ветки production-отчёты по `lead_submitted` занижены на футболки.

## 10. GIT

```text
repo:    web-photo
branch:  feature/analytics-event-model
commit:  cb2dd96
push:    origin/feature/analytics-event-model
status:  чисто

repo:    racpechatca
branch:  feature/analytics-foundation
commit:  см. git log (документы FIX_01)
push:    origin/feature/analytics-foundation
status:  чисто; master не тронут
```
