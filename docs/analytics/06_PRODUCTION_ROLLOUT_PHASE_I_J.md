# 06_PRODUCTION_ROLLOUT_PHASE_I_J.md

# Этап 06 — PHASE I–J: цели Метрики и web cutover

## Статус

```text
REVIEW — PHASE I и J выполнены 12.09.2026; FALSE_BROWSER_PURCHASE_STOPPED_AT = 2026-09-12 13:19:22 MSK; K/L — наблюдение естественных событий
```

PHASE B–H приняты.

Подтверждено в production:

```text
CRM deploy healthy
migrate deploy OK
migrate status up to date
атрибуционные поля созданы
MetrikaOrderOutbox создан
backfill 219 → apply → повторный dry-run 0
исходные note/designNote/StatusHistory сохранены
Metrika API из production работает
worker включён
очередь после включения пустая, массового historical enqueue нет
```

PHASE J пока запрещён до завершения PHASE I и отдельного разрешения Reviewer.

---

# 1. PHASE I — действие владельца

В интерфейсе Яндекс Метрики для счётчика:

```text
111569944
```

создать четыре цели типа:

```text
JavaScript-событие
```

Идентификаторы должны совпадать ПОСИМВОЛЬНО:

```text
lead_submitted_photo
lead_submitted_canvas
lead_submitted_tshirt
form_error
```

Рекомендуемые названия целей:

```text
Заявка — фото
Заявка — холст
Заявка — футболка
Ошибка формы
```

Человеческое название может отличаться; критичен именно идентификатор события.

---

# 2. Не трогать существующие цели

Не удалять и не переименовывать:

```text
lead_submitted
```

Не удалять legacy URL goal:

```text
Заявка отправлена → /thanks
```

Она остаётся исторической/вторичной целью.

Не удалять системные CRM-цели:

```text
CRM: Заказ создан
CRM: Заказ оплачен
CRM: Заказ отменен
CRM: Спам заказ
```

Они появились автоматически после CDP upload и нужны для следующих этапов.

---

# 3. После ручного создания целей

Владелец пишет исполнителю:

```text
4 цели созданы. Выполни read-only reconciliation по API.
PHASE J пока не начинай.
```

Исполнитель делает только GET/read-only.

Проверить фактическое наличие exact identifiers:

```text
lead_submitted_photo
lead_submitted_canvas
lead_submitted_tshirt
form_error
```

И обновить:

```text
GOALS_MANIFEST.md
06_PRODUCTION_ROLLOUT.md
```

---

# 4. Формат PHASE I отчёта

## EXECUTOR_REPORT_PHASE_I

### 1. RESULT

```text
READY_FOR_WEB_CUTOVER
NEEDS_FIX
```

### 2. GOALS

```text
lead_submitted_photo: CONFIGURED/MISSING
lead_submitted_canvas: CONFIGURED/MISSING
lead_submitted_tshirt: CONFIGURED/MISSING
form_error: CONFIGURED/MISSING
```

### 3. COUNTER SUMMARY

```text
total goals:
canonical lead goal:
legacy URL goal present:
CRM system goals present:
unknown:
```

Не считать общее количество целей главным критерием: важны exact identifiers.

### 4. WRITE OPERATIONS

```text
API write calls executed: no
```

### 5. OPEN ISSUES

Если нет:

```text
none
```

---

# 5. Gate перед PHASE J

PHASE J разрешается только если все четыре цели:

```text
CONFIGURED
```

После review владелец/Reviewer даёт отдельную команду:

```text
РАЗРЕШАЮ PHASE J
```

Без неё web production не выкладывать.

---

# 6. PHASE J — web merge

После разрешения:

```text
web-photo
feature/analytics-event-model
→ feature/cms-admin
```

Учитывать:

```text
push feature/cms-admin = production website deploy
```

Перед merge:

1. `fetch`;
2. проверить, что analytics branch не отстаёт от `feature/cms-admin`;
3. если появились новые UX/content commits — сначала аккуратно интегрировать их;
4. повторить web/api/shared tests и builds;
5. merge/push только при зелёных проверках.

---

# 7. Что должно измениться после web deploy

Ожидается:

```text
lead_submitted работает на всех 5 формах
lead_submitted_photo/canvas/tshirt отправляются
form_error отправляется там, где реализован
firstTouchUrl собирается
conversionPageUrl сохраняется
yclid TTL = 21 days
PII не отправляется в Metrika params
analytics exception не ломает заявку
```

Главное изменение:

```text
ecommerce.purchase при успешной заявке
→ больше НЕ отправляется
```

Реальные order/payment события теперь идут:

```text
CRM
→ MetrikaOrderOutbox
→ simple_orders
```

---

# 8. Зафиксировать cutover time

После успешного production web deploy записать точное время:

```text
FALSE_BROWSER_PURCHASE_STOPPED_AT=<timestamp Europe/Moscow>
```

Это обязательная граница данных.

До неё:

```text
browser purchase = ложная семантика заявки
```

После неё:

```text
lead = lead_submitted
order/payment = CRM CDP
```

---

# 9. Post-deploy smoke

Не создавать фиктивный заказ.

Проверить:

```text
главные страницы открываются
формы открываются
consent/Metrika не ломают сайт
Metrika после consent инициализируется
browser console без новых blocking errors
```

При следующей естественной заявке проверить:

```text
lead_submitted
directional goal
CRM LEAD
yandexClientId
firstTouchUrl
conversionPageUrl
UTM/yclid при наличии
```

---

# 10. PHASE K/L — естественные события

Не менять статусы заказов искусственно.

На первом естественном:

```text
LEAD → NEW
```

проверить:

```text
outbox IN_PROGRESS
→ delivered
→ PASSED
```

На первом естественном:

```text
→ PAID
```

проверить:

```text
outbox PAID
→ delivered
→ PASSED
```

На CANCELLED — аналогично, когда он реально возникнет.

Отсутствие естественного PAID/CANCELLED сразу после deploy не блокирует web rollout.

---

# 11. EXECUTOR_REPORT_PHASE_J

### 1. RESULT

```text
READY_FOR_REVIEW
PARTIAL
BLOCKED
```

### 2. GIT / DEPLOY

```text
web merge commit:
feature/cms-admin pushed:
production deploy:
deployed commit:
```

### 3. TESTS

```text
web tests:
api tests:
shared tests:
tsc:
next build:
```

### 4. WEB CUTOVER

```text
FALSE_BROWSER_PURCHASE_STOPPED_AT:
lead_submitted active:
purchase-on-lead active: no
```

### 5. POST-DEPLOY SMOKE

```text
pages:
forms:
Metrika:
console:
business flow:
```

### 6. GOALS

```text
lead_submitted_photo:
lead_submitted_canvas:
lead_submitted_tshirt:
form_error:
```

### 7. NATURAL EVENTS

```text
new LEAD observed:
NEW/IN_PROGRESS observed:
PAID observed:
CANCELLED observed:
```

Use:

```text
not observed yet
```

where applicable.

### 8. OPEN ISSUES

Only actual blockers.

---

# 12. Decision Gate

Rollout этапа 06 можно закрыть, если:

- четыре обязательные JS goals существуют;
- web analytics branch выложена;
- false browser purchase прекращён;
- `lead_submitted` продолжает работать;
- сайт и формы здоровы;
- CRM worker остаётся включён и healthy;
- новые естественные transitions готовы идти через outbox;
- нет технического блокера для IN_PROGRESS/PAID/CANCELLED.

После этого:

```text
06_PRODUCTION_ROLLOUT = DONE
```

и можно начинать:

```text
07_METRIKA_TO_ANALYTICS.md
```

---

# 13. Предварительная сверка PHASE I — 12.09.2026 12:29 MSK (read-only GET)

Документ получен; владелец о создании целей ещё не сообщал. Проверка по API
из боевого контейнера (`metrika:smoke`, только чтение):

```text
lead_submitted_photo:   MISSING
lead_submitted_canvas:  MISSING
lead_submitted_tshirt:  MISSING
form_error:             MISSING

total goals:             17
canonical lead goal:     611379890 lead_submitted — есть
legacy URL goal present: yes — 602316919 «Заявка отправлена» → /thanks (не трогаем)
CRM system goals present: yes — 596990603/604/605/606 (заказ создан / оплачен / спам / отменён)
unknown:                 0
API write calls executed: no
```

Очередь на бою пуста, воркер healthy, естественных переходов с 12:10 нет.
PHASE J не начинается до четырёх CONFIGURED и команды «РАЗРЕШАЮ PHASE J».

---

# 14. EXECUTOR_REPORT_PHASE_I — 12.09.2026 12:58 MSK

## 1. RESULT

```text
READY_FOR_WEB_CUTOVER
```

## 2. GOALS (read-only GET /management/v1/counter/111569944/goals, из боевого контейнера)

```text
lead_submitted_photo:   CONFIGURED — 612290270 «Заявка — фото»,     type=action, url=lead_submitted_photo
lead_submitted_canvas:  CONFIGURED — 612290370 «Заявка — холст»,    type=action, url=lead_submitted_canvas
lead_submitted_tshirt:  CONFIGURED — 612290451 «Заявка — футболка», type=action, url=lead_submitted_tshirt
form_error:             CONFIGURED — 612290566 «Ошибка формы»,      type=action, url=form_error
```

Первая попытка владельца (12:45) в счётчик не записалась (17 целей в 12:45 и
12:48, счётчик у аккаунта один); повторное создание — 21 цель в 12:58.

## 3. COUNTER SUMMARY

```text
total goals:              21
canonical lead goal:      lead_submitted (611379890) — на месте, не менялась
legacy URL goal present:  yes — 602316919 «Заявка отправлена» → /thanks (не тронута)
CRM system goals present: yes — 596990603/604/605/606
unknown:                  0
```

## 4. WRITE OPERATIONS

```text
API write calls executed: no
```

## 5. OPEN ISSUES

```text
none
```

Бой: backend healthy, воркер работает, очередь пуста, естественных переходов
с 12:10 нет. PHASE J — только по команде «РАЗРЕШАЮ PHASE J».

---

# 15. EXECUTOR_REPORT_PHASE_J — 12.09.2026

## 1. RESULT

```text
READY_FOR_REVIEW
```

## 2. GIT / DEPLOY

```text
web merge commit:          cb2dd96 — fast-forward feature/analytics-event-model → feature/cms-admin
                           (cms-admin новых UX/content-коммитов после ответвления не имел: 0 позади,
                           затирать нечего)
feature/cms-admin pushed:  12.09.2026 13:10:16 MSK (4f0bdca..cb2dd96)
production deploy:         auto-update.sh: api 13:12:09 → 13:12:26 «обновлён и здоров» (образ
                           42c22b52… → 7da55c3a…), nginx перечитан 13:12:34, холст прогрет 13:18:37;
                           web 13:19:14 → 13:19:16 «обновлён и здоров» (образ 7bb8c13b… → a7e9d49f…),
                           nginx перечитан 13:19:22
deployed commit:           cb2dd96 — единственный push в feature/cms-admin после 4f0bdca; образы
                           web-photo-web@sha256:a7e9d49f…, api 7da55c3a… собраны CI по нему
                           (репозиторий приватный, run снаружи не виден); содержимое бандла
                           соответствует ветке (см. § 4). BUILD_ID BHZsFiNk… → K7wld8nz…
```

## 3. TESTS (повторены перед merge)

```text
web tests:    389 passed, 1 skipped, 0 failed (node --test, 87 suites)
api tests:    77 passed
shared tests: 38 passed
tsc:          apps/web 0 ошибок, apps/api 0 ошибок
next build:   OK — 107 статических страниц (локально без CMS-базы — штатный откат на код)
```

## 4. WEB CUTOVER

```text
FALSE_BROWSER_PURCHASE_STOPPED_AT: 2026-09-12 13:19:22 Europe/Moscow
                                   (новый web-контейнер здоров 13:19:16; nginx переключил трафик
                                   на него 13:19:22). Оговорка: вкладки, открытые до отсечки,
                                   несут старый JS и до перезагрузки могут прислать purchase —
                                   хвост в несколько минут.
lead_submitted active:             yes — цель 611379890; в бандле имя события есть (13 файлов)
purchase-on-lead active:           no — в новом бандле строки «purchase» нет ни в одном .js
                                   (было 12 файлов), «actionField» нет (было); «ecommerce» осталась
                                   только для detail (просмотр карточки)
directional goals in bundle:       lead_submitted_photo / _canvas / _tshirt, form_error — есть
first-touch in bundle:             first_touch_url — есть (2 файла; до деплоя 0)
```

## 5. POST-DEPLOY SMOKE (без фиктивных заявок; браузер + curl с сервера)

```text
pages:      / , /formaty, /catalog/foto-10x15-s-polyami, /interer/holst, /interer/holst/30x40,
            /interer/holst/30x40/zakaz, /futbolki, /futbolki/svoy-print, /merch, /contacts — 200,
            заголовки и контент на месте; холст с ценами («Цены временно недоступны» нет)
forms:      фото (OrderPanel): форма, способы связи telegram/max, кнопка «Оставить заявку · 370 ₽»;
            холст /zakaz: имя, телефон, способ связи, доставка, согласие, «Оставить заявку»;
            футболка svoy-print: конструктор из 4 шагов (без шага «расположение»), способы связи,
            доставка; мерч: форма «Получить расчёт», способы связи; контакты: форма «Отправить».
            Заявки не отправлялись.
Metrika:    до согласия — ym не определён, скриптов Метрики нет (как задумано);
            после «Принять и продолжить» — ym: function, загружены mc.yandex.ru/metrika/tag.js и
            tag_phono.js, cookie-consent=accepted; sessionStorage: first_touch_url =
            https://raspechatkaa.ru/ (новый код работает); dataLayer без purchase
console:    ошибок нет ни на одной проверенной странице (единственный 404 — мой неверный адрес
            /futbolki/svoy-dizayn при подборе маршрута, не ресурс сайта)
business flow: формы открываются и валидируются; аналитика без согласия сайт не ломает
```

## 6. GOALS (read-only, 12:58 и подтверждено на 13:2x)

```text
lead_submitted_photo:   CONFIGURED 612290270
lead_submitted_canvas:  CONFIGURED 612290370
lead_submitted_tshirt:  CONFIGURED 612290451
form_error:             CONFIGURED 612290566
```

## 7. NATURAL EVENTS

```text
new LEAD observed:            not observed yet (заявок после 13:19 нет — 0 новых OrderPhoto)
NEW/IN_PROGRESS observed:     not observed yet (переходов StatusHistory после 12:10 — 0)
PAID observed:                not observed yet
CANCELLED observed:           not observed yet
CRM worker:                   raspechatka-backend-1 running:healthy (с 12:19:54), очередь
                              pending 0 / delivered 0 / failed 0 / skipped 0
```

## 8. OPEN ISSUES

```text
none (блокеров нет)
```

Незакрытое, не блокирующее: естественные события (PHASE K/L) — наблюдение;
security debt ROTATE_YANDEX_OAUTH_TOKEN / ROTATE_YANDEX_CLIENT_SECRET;
production CRM/master не менялись в этой фазе.
