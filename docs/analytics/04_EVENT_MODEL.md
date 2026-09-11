# 04_EVENT_MODEL.md

# Этап 04 — Единая модель событий, first-touch и корректная семантика конверсий

## Статус

```text
REVIEW
```

> Исполнитель не имеет права самостоятельно ставить этапу `DONE`.
> После выполнения этап переводится в `REVIEW`.
> Решение `DONE / NEEDS_FIX / BLOCKED` принимает ChatGPT после проверки отчёта.

---

# 1. Входной контекст

Этапы приняты:

```text
00_MASTER_PLAN            = DONE
01_CURRENT_STATE          = DONE
02_ANALYTICS_DATA_MODEL   = DONE
03_HISTORICAL_BACKFILL    = DONE
```

Подтверждено:

- CRM: NestJS + PostgreSQL + Prisma.
- Основная сущность: `OrderPhoto`.
- Структурированная атрибуция новых заявок уже реализована:
  - `yandexClientId`
  - `yclid`
  - `utmSource`
  - `utmMedium`
  - `utmCampaign`
  - `utmContent`
  - `utmTerm`
  - `conversionPageUrl`
- `conversionPageUrl` означает страницу, на которой пользователь отправил заявку.
- Настоящий first-touch URL пока не сохраняется.
- `clientPaidAt` фиксирует первый переход в `PAID`.
- Исторический backfill реализован и проверен на копии БД:
  - 323 заказа просмотрено;
  - 11 ClientID восстановимы;
  - 10 yclid;
  - 16 conversionPageUrl;
  - 204 clientPaidAt;
  - исторических UTM фактически нет.
- 16 оплаченных заказов без `StatusHistory` остаются без надёжного `clientPaidAt`.
- На сайте уже существует 30+ событий Метрики.
- Сейчас после успешной заявки дополнительно отправляется ложный Ecommerce `purchase`.
- `lead_submitted` уже существует.
- Четыре события, которые ожидались как цели, не созданы в интерфейсе Метрики.
- UTM / yclid уже имеют собственный механизм сохранения на стороне сайта.
- В проекте нужно учитывать consent/cookie-поведение, но не придумывать юридические требования.

---

# 2. Цель этапа

Создать **единый контракт событий проекта**, чтобы сайт, CRM и будущая аналитика одинаково понимали каждое действие.

После этапа должно быть однозначно:

```text
какое событие существует
когда оно происходит
что оно означает
какие параметры содержит
к какому товару относится
является ли оно целью Метрики
является ли оно Ecommerce-событием
является ли оно бизнес-событием CRM
```

Главное исправление:

```text
lead_submitted != purchase
```

Заявка не должна считаться покупкой.

---

# 3. Основной принцип

Разделить события на три слоя.

## 3.1. Поведение на сайте

Примеры:

```text
product_view
configurator_started
configurator_step
form_started
form_error
messenger_click
```

Они описывают действия пользователя.

---

## 3.2. Конверсия сайта

```text
lead_submitted
```

Означает:

> сервер успешно принял заявку.

Это не означает:

- заказ принят менеджером;
- клиент оплатил;
- бизнес получил выручку.

---

## 3.3. Бизнес-события

Источник истины — CRM.

```text
LEAD
NEW
PAID
CANCELLED
COMPLETED
```

Реальная покупка/оплата определяется CRM, а не браузером.

---

# 4. Фаза A — полный аудит событий

Перед изменением кода исполнитель должен собрать полный фактический реестр всех событий.

Найти:

- все вызовы `ym(...)`;
- `reachGoal`;
- Ecommerce `dataLayer`;
- wrapper-функции Метрики;
- `track*`;
- события форм;
- события продуктов;
- события конфигураторов;
- messenger events;
- ошибки;
- технические дубликаты.

Проверить:

```text
apps/web
apps/api
```

и другие места, если событие отправляется оттуда.

---

# 5. EVENT_CATALOG

Создать в документации таблицу всех событий.

Для каждого события:

```text
Event name
Category
Trigger
Meaning
Product scope
Parameters
Source file/function
Metrika goal required?
Ecommerce?
Keep / Rename / Deprecate
Notes
```

Категории использовать:

```text
Acquisition
Product
Configurator
Form
Lead
Communication
Error
Order
Payment
Completion
```

Если фактический event не укладывается — разрешается добавить категорию с объяснением.

---

# 6. Стабильность исторических event names

Нельзя массово переименовывать уже работающие event names ради красоты.

Приоритет:

```text
историческая сопоставимость
>
идеальное naming convention
```

Если событие имеет неудобное, но однозначное имя:

```text
KEEP
```

Если имя семантически неверное:

```text
DEPRECATE
```

и вводить корректное новое событие только с описанной стратегией перехода.

В отчёте отдельно показать все изменения имён.

---

# 7. Центральный registry событий

После аудита убрать возможность бесконтрольного появления строковых event names в разных компонентах.

Предпочтительно создать единый registry/typed constants.

Пример концепции:

```ts
METRIKA_EVENTS = {
  LEAD_SUBMITTED: 'lead_submitted',
  FORM_STARTED: 'form_started',
  FORM_ERROR: 'form_error',
  ...
}
```

Точная реализация должна соответствовать архитектуре проекта.

Требования:

- TypeScript-friendly;
- одно место для canonical names;
- без тяжёлой абстракции;
- существующие wrapper'ы переиспользовать;
- не переписывать весь analytics-код без необходимости.

---

# 8. Контракт параметров

Для каждого события определить допустимые параметры.

Общие параметры, если они уже доступны и не нарушают текущую архитектуру:

```text
productType
productId / productSlug
step
formType
errorType
value
currency
```

Не отправлять:

- имя клиента;
- телефон;
- email;
- содержимое пользовательских комментариев;
- другие персональные данные в event params.

---

# 9. lead_submitted

Определить единый контракт.

Событие должно происходить только после подтверждённого успешного ответа backend/API на создание заявки.

Не отправлять:

- при клике на кнопку;
- до ответа сервера;
- при validation error;
- при network error;
- при неуспешном ответе CRM.

Минимальная семантика:

```text
lead_submitted
= заявка успешно принята системой
```

Если событие сейчас вызывается разными формами по-разному — унифицировать.

---

# 10. Удаление ложного purchase

Сейчас существует:

```text
trackLeadPurchase
```

и Ecommerce `purchase` отправляется после заявки.

Это семантически неверно.

В целевой модели:

```text
Browser lead
→ lead_submitted

CRM PAID
→ реальная оплаченная конверсия
```

Реальная передача `PAID` в Метрику будет реализована в:

```text
06_CRM_TO_METRIKA
```

---

# 11. Безопасная стратегия отключения purchase

Исполнитель должен сначала определить deployment-поведение репозитория `web-photo`.

Нельзя случайно отключить production purchase в тот момент, когда CRM→Метрика ещё не существует, если это создаст необсуждённый провал текущей отчётности.

Допустимые стратегии:

## Вариант A — изменения можно держать в непроизводственной ветке

Удалить/отключить ложный `purchase` в рабочей analytics-ветке и не выкладывать до согласованного rollout.

## Вариант B — текущая ветка сайта автоматически production

Не пушить отключение напрямую в deploy-ветку.

Подготовить отдельную безопасную ветку/commit, который будет включён одновременно с этапом 06.

## Вариант C — минимальный временный feature flag

Использовать только если архитектура деплоя не позволяет A/B.

Feature flag не должен превращаться в долгосрочный технический долг.

---

# 12. Критическое правило

После этапа 04 в целевом коде должно быть подготовлено состояние:

```text
заявка != purchase
```

Но фактическое production-отключение ложного `purchase` должно быть скоординировано так, чтобы владелец понимал момент переключения.

В отчёте обязательно написать:

```text
purchase code status:
production behavior now:
when false purchase will stop:
```

---

# 13. First-touch / страница входа

Сейчас известно:

```text
conversionPageUrl
```

= страница отправки заявки.

Нужно исследовать существующий механизм:

```text
UTM storage
yclid storage
browser/session storage
cookie/localStorage/sessionStorage
```

и понять, как проект определяет «визит» / срок атрибуции.

---

# 14. Нельзя выдумывать семантику landing

Нельзя назвать `landingUrl` значением, если оно фактически означает:

- текущую страницу;
- первую страницу за всё время;
- страницу первого UTM;
- страницу текущей вкладки;

без явного определения.

Исполнитель должен описать существующий attribution lifetime.

---

# 15. Целевая first-touch семантика

Нам нужны два разных понятия:

```text
conversionPageUrl
```

> страница, где была отправлена заявка.

И отдельное значение:

```text
firstTouchUrl
```

или другое точное имя,

> первая зафиксированная страница в рамках выбранного и явно документированного attribution window.

Имя `landingUrl` использовать только если семантика действительно соответствует landing page выбранного окна атрибуции.

---

# 16. Реализация first-touch

Если после аудита существующий механизм UTM/yclid уже имеет чёткое attribution window, разрешается в этом этапе добавить first-touch URL по тому же lifecycle.

Требования:

- первое значение в окне не перезаписывается;
- новое окно может начать новое first-touch значение по тем же правилам, что и текущая атрибуция;
- текущая `conversionPageUrl` остаётся отдельной;
- значение передаётся в lead/API/CRM структурированно;
- нужна Prisma migration, если добавляется новое поле.

Если lifecycle неоднозначен или требует архитектурного решения владельца:

```text
НЕ ИМПРОВИЗИРОВАТЬ
```

Вернуть:

```text
PARTIAL
```

с точным описанием вариантов.

---

# 17. Referrer

Проверить, сохраняется ли сейчас:

```text
document.referrer
```

Если нет, НЕ добавлять автоматически.

В отчёте только указать:

```text
referrer captured: yes/no
```

Решение о сохранении referrer принять отдельно, если оно действительно необходимо и не дублирует Метрику.

---

# 18. Модель атрибуции

Не вводить полноценную multi-touch attribution в этом этапе.

Нужно только документировать текущую фактическую модель:

```text
first-touch?
last non-empty UTM?
last-touch?
session scoped?
persistent?
```

Если текущие UTM перезаписываются, показать когда.

Если не перезаписываются, показать срок жизни.

Это станет входом для:

```text
07_METRIKA_TO_ANALYTICS
08_ANALYTICS_METRICS
```

---

# 19. Цели Яндекс Метрики

По предыдущему аудиту четыре ожидаемые цели не созданы.

На этом этапе:

1. получить фактический список событий, которые должны быть целями;
2. сопоставить его с известной конфигурацией проекта;
3. сформировать точный `GOALS_MANIFEST`.

Для каждой цели:

```text
Event
Human title
Purpose
Required for funnel?
Required for optimization?
Already configured? yes/no/unknown
```

---

# 20. Не создавать remote goals без доступа

На этапе 04 не подключать OAuth write scope.

Если исполнитель не имеет API-доступа к настройкам счётчика:

- не придумывать состояние;
- не создавать цель;
- отметить `unknown` или использовать подтверждённые данные аудита.

Результатом должен стать точный список того, что владельцу/следующему этапу нужно создать или проверить.

---

# 21. Consent / cookie audit

Не требуется юридическая переработка cookie banner.

Нужно только технически проверить:

- когда загружается счётчик Метрики;
- блокируется ли он до consent;
- блокируются ли `ym/reachGoal` вызовы;
- что происходит, если `window.ym` недоступен;
- может ли отсутствие consent/счётчика сломать форму заказа.

Критическое правило:

> Аналитика никогда не должна ломать оформление заказа.

Если analytics unavailable:

```text
business flow continues
```

---

# 22. Error isolation

Все analytics-вызовы должны быть fail-safe.

Ошибка:

```text
ym undefined
dataLayer unavailable
analytics exception
```

не должна:

- отменить заявку;
- показать ложную ошибку пользователю;
- сломать redirect/success state;
- повторно отправить заказ.

---

# 23. Тесты

Минимально покрыть:

## lead_submitted

- успешная заявка → событие один раз;
- failed API → события нет;
- validation error → события нет;
- analytics unavailable → заявка всё равно успешна.

## purchase

Подтвердить целевую семантику:

```text
успешная заявка
≠ Ecommerce purchase
```

С учётом rollout-стратегии из раздела 11.

## registry

Проверить хотя бы критичные canonical event names.

## first-touch, если реализован

- первое значение сохраняется;
- переход между страницами его не меняет;
- conversionPageUrl остаётся текущей страницей;
- lifecycle соответствует существующему attribution window;
- отсутствие storage не ломает форму.

---

# 24. Что НЕ делать сейчас

Не делать:

- CRM → Metrika paid sync;
- offline conversion upload;
- Reports API;
- OAuth;
- dashboard;
- automated insights;
- multi-touch attribution;
- изменение P&L;
- изменение правил `DONE/SENT`;
- production backfill;
- создание сущности Customer;
- отправку персональных данных в Метрику.

---

# 25. Git / deployment safety

CRM продолжать в:

```text
feature/analytics-foundation
```

`master` не трогать без команды владельца.

Для `web-photo` перед изменением определить:

```text
какая ветка является production/deploy
```

Если:

```text
feature/cms-admin
```

автоматически выкладывается,

не пушить рискованные изменения `purchase` напрямую туда.

Создать отдельную ветку:

```text
feature/analytics-event-model
```

или эквивалент.

В отчёте обязательно описать реальное deployment behavior.

---

# 26. Документы

Создать/обновить:

```text
docs/analytics/04_EVENT_MODEL.md
```

Допустимо создать отдельные справочные документы:

```text
docs/analytics/EVENT_CATALOG.md
docs/analytics/GOALS_MANIFEST.md
```

если каталог слишком большой для основного файла.

В `00_MASTER_PLAN.md`:

```text
03_HISTORICAL_BACKFILL = DONE
04_EVENT_MODEL = REVIEW
```

Не ставить `04 = DONE`.

---

# 27. Формат отчёта

## EXECUTOR_REPORT

### 1. RESULT

```text
READY_FOR_REVIEW
PARTIAL
BLOCKED
```

### 2. GIT

Для каждого репозитория:

```text
repo:
branch:
base:
commit:
push:
git status:
production/deploy behavior:
```

### 3. EVENT INVENTORY

```text
total unique events:
duplicates found:
deprecated:
new:
renamed:
```

Приложить/указать путь к полному EVENT_CATALOG.

### 4. CRITICAL EVENT SEMANTICS

Таблица:

```text
Event | Trigger | Meaning | Goal? | Ecommerce?
```

Минимум:

```text
lead_submitted
form_started
form_error
messenger_click
все ключевые configurator events
purchase
```

### 5. PURCHASE DECISION

```text
current behavior:
target behavior:
code changed:
production changed:
rollout plan:
```

### 6. LEAD_SUBMITTED

```text
all forms covered:
success-only:
duplicate protection:
failure behavior:
```

### 7. ATTRIBUTION LIFETIME

Подробно:

```text
storage mechanism:
UTM lifetime:
yclid lifetime:
overwrite rules:
session/visit definition:
```

### 8. FIRST-TOUCH DECISION

```text
implemented: yes/no
field name:
exact semantics:
storage lifecycle:
CRM path:
migration:
```

Если не реализован:

```text
why:
what decision is required:
```

### 9. CONVERSION PAGE

Подтвердить:

```text
conversionPageUrl semantics:
```

### 10. REFERRER

```text
captured now:
recommendation:
```

### 11. GOALS MANIFEST

```text
goals required:
known configured:
known missing:
unknown:
```

Приложить точную таблицу.

### 12. CONSENT / FAILURE AUDIT

```text
metrika load:
consent gating:
ym unavailable behavior:
can analytics break order flow:
changes made:
```

### 13. TESTS

```text
Команда | Результат
```

### 14. FILES_CHANGED

```text
Файл | Изменение | Причина
```

### 15. NEW FACTS DISCOVERED

Все новые факты, влияющие на следующие этапы.

### 16. DEVIATIONS FROM SPEC

Если нет:

```text
none
```

### 17. OPEN ISSUES

Если нет:

```text
none
```

### 18. QUESTIONS FOR REVIEWER

Только реальные архитектурные вопросы.

---

# 28. Decision Gate для ChatGPT

## DONE

Этап можно принять, если:

- полный event catalog создан;
- значение каждого критичного события однозначно;
- canonical registry существует или обоснованно не нужен;
- `lead_submitted` означает только успешную заявку;
- ложный `purchase` больше не является целевой моделью;
- rollout отключения `purchase` безопасен;
- attribution lifetime документирован;
- `conversionPageUrl` не смешан с first-touch;
- first-touch либо корректно реализован, либо явно вынесен как обоснованный blocked subtask;
- GOALS_MANIFEST создан;
- analytics failure не ломает заказ;
- тесты проходят.

После принятия:

```text
04_EVENT_MODEL = DONE
```

Следующий файл:

```text
05_YANDEX_METRIKA_API.md
```

---

## NEEDS_FIX

Если есть исправимые проблемы:

```text
04_EVENT_MODEL = IN_PROGRESS
```

Создать:

```text
04_EVENT_MODEL_FIX_01.md
```

---

## BLOCKED

Если нужна бизнес-/архитектурная развилка владельца:

```text
04_EVENT_MODEL = BLOCKED
```

Следующий основной этап не начинать до решения.

---

# 29. Вход для следующего этапа

`05_YANDEX_METRIKA_API` должен получить из этого этапа:

- canonical event catalog;
- goals manifest;
- точный counter ID;
- список нужных read-метрик;
- понимание текущей attribution model;
- решение по first-touch;
- безопасный момент отключения false purchase.

---

# 30. Команда исполнителю

Выполни `04_EVENT_MODEL.md`.

Сначала проведи полный аудит всех фактических событий и текущего механизма хранения UTM/yclid.

Не переименовывай массово исторические события.

Сделай `lead_submitted` однозначным событием успешной заявки.

Подготовь код к устранению ложного Ecommerce `purchase`, но не создавай необсуждённый production gap между заявкой и будущей CRM-paid конверсией.

Не выдумывай first-touch semantics: либо реализуй её строго по существующему attribution lifecycle, либо верни точный архитектурный вопрос.

После выполнения верни отчёт строго в формате раздела 27.

---

# 31. EXECUTOR_REPORT — 11.09.2026

## 1. RESULT

```text
READY_FOR_REVIEW
```

## 2. GIT

```text
repo:       web-photo
branch:     feature/analytics-event-model
base:       feature/cms-admin (4f0bdca)
commit:     d9a6488
push:       origin/feature/analytics-event-model
git status: чисто
production/deploy behavior: CI (.github/workflows/build-images.yml) собирает
  образы и выкладывает только ветки main, feature/yandex-yml-feed,
  feature/canvas-section, feature/cms-admin. feature/cms-admin — фактическая
  ветка выкладки сайта: любой push в неё через ~10 минут оказывается
  в production. feature/analytics-event-model в список не входит —
  НЕ выкладывается. Все изменения этапа 04 на сайте лежат там.

repo:       racpechatca
branch:     feature/analytics-foundation
base:       docs/analytics → master 20cce7b
commit:     42aa665 (код), далее — документы этого этапа
push:       origin/feature/analytics-foundation
git status: чисто
production/deploy behavior: любой push в master пересобирает и
  перезапускает CRM; master не тронут.
```

## 3. EVENT INVENTORY

```text
total unique events: 34 в реестре, 25 отправляются кодом
duplicates found:    3 смысловых (add_tshirt_lead ≈ form_started;
                     submit_tshirt_order ≈ lead_submit_attempt;
                     submit_tshirt_order_success ≈ lead_submitted_tshirt) — сохранены
deprecated:          9 (объявлены, ничем не отправляются)
new:                 0
renamed:             0
removed from code:   purchase (e-commerce) при заявке
```

Полный каталог: `docs/analytics/EVENT_CATALOG.md`. Строковых имён вне
реестра нет; прямых `ym(` вне `lib/metrika.ts` и `Analytics.tsx` нет;
`apps/api` событий не отправляет.

## 4. CRITICAL EVENT SEMANTICS

| Event | Trigger | Meaning | Goal? | Ecommerce? |
|---|---|---|---|---|
| `lead_submitted` | сервер ответил 2xx на создание заявки | заявка принята системой | да (есть) | нет |
| `lead_submitted_photo` / `_canvas` / `_tshirt` | вместе с `lead_submitted`, по направлению; мерч → `_tshirt` | заявка по направлению | да (нет в Метрике) | нет |
| `form_started` | первое взаимодействие с формой | начал заполнять | да (unknown) | нет |
| `form_error` | клиентская проверка отбила | споткнулся на поле `field` | да (нет в Метрике) | нет |
| `messenger_click` | клик Telegram / MAX | ушёл в переписку | да (unknown) | нет |
| `phone_click` | клик по телефону | ушёл в звонок | да (unknown) | нет |
| `canvas_format_select`, `canvas_size_select`, `canvas_upload_click` | шаги карточки холста | воронка холста | желательно | нет |
| `choose_shirt_type`, `choose_color`, `choose_size`, `add_tshirt_lead` | шаги конфигуратора футболки | воронка футболок | желательно | нет |
| `detail` (dataLayer) | открыта карточка формата фото | просмотр товара | — | да, остаётся |
| `purchase` (dataLayer) | **было:** заявка принята | **было:** покупка на сумму заявки | — | **удалено** в ветке; в production пока отправляется |

## 5. PURCHASE DECISION

```text
current behavior (production, feature/cms-admin):
  после успешной заявки фото, холста и футболки в dataLayer уходит
  ecommerce.purchase на сумму заявки; отчёт «Покупки» = сумма заявок.
target behavior:
  заявка → lead_submitted (+ цель по направлению); покупка → переход
  заказа в PAID в CRM → импорт «Заказы из CRM» (этап 06).
code changed:
  да, в feature/analytics-event-model: trackPurchase, trackLeadPurchase,
  newOrderId и все три вызова удалены; detail оставлен. Тест подтверждает,
  что reportLeadSubmitted ничего не пишет в dataLayer и экспортов
  trackPurchase/trackLeadPurchase больше нет.
production changed:
  нет.
rollout plan (вариант B из раздела 11):
  ветка сливается в feature/cms-admin в один день с запуском этапа 06,
  после того как первый заказ из CRM дошёл до Метрики. Тогда покупки
  в отчёте сменят источник без провала. До этого ветка живёт отдельно;
  при слиянии возможны конфликты с текущими UX-правками — разрешимо.

purchase code status:          удалён в feature/analytics-event-model
production behavior now:       purchase при заявке отправляется
when false purchase will stop: при слиянии ветки — одновременно с этапом 06
```

## 6. LEAD_SUBMITTED

```text
all forms covered:    да — фото (OrderPanel), холст (CanvasOrderForm),
                      футболка (TshirtLeadForm), мерч (MerchForm),
                      контакты (ContactForm) вызывают reportLeadSubmitted.
                      До этапа: футболка и мерч общую цель НЕ отправляли.
success-only:         да — вызов только в ветке res.ok / response.ok,
                      после throw при !ok до него не доходит; при ошибке
                      проверки формы return раньше запроса.
duplicate protection: одна точка вызова на форму, внутри — по одному
                      reachGoal на цель; повторное нажатие блокирует
                      состояние формы (sending/ok), как и раньше.
failure behavior:     validation error → form_error, без lead_submitted;
                      network/server error → без lead_submitted
                      (футболки/мерч дополнительно submit_tshirt_order_error);
                      ym недоступен или бросает → reachGoal глотает,
                      форма завершает успех и переход на /thanks.
```

## 7. ATTRIBUTION LIFETIME

```text
storage mechanism:
  UTM   — sessionStorage['utm'], JSON из пяти utm_*  (lib/utm.ts)
  yclid — localStorage['yclid']                        (lib/yclid.ts)
  first-touch — sessionStorage['first_touch_url']     (lib/first-touch.ts, новое)
UTM lifetime:
  вкладка браузера: от открытия до закрытия. Новая вкладка — пусто
  (кроме открытой из страницы сайта — браузер копирует sessionStorage).
yclid lifetime:
  БЕССРОЧНО. localStorage не истекает: клик по Директу месяцы назад
  припишется сегодняшнему заказу из органики, если новый yclid не пришёл.
overwrite rules:
  UTM   — каждая страница с любым utm_* в адресе перезаписывает
          сохранённый набор целиком (последняя кампания в визите побеждает);
          при отправке заявки берётся utm из адреса текущей страницы,
          иначе сохранённый.
  yclid — новый yclid в адресе перезаписывает старый; иначе берётся
          последний сохранённый когда угодно.
  first-touch — ставится один раз, внутри вкладки не меняется.
session/visit definition:
  для UTM и first-touch — жизнь вкладки (sessionStorage). Для yclid
  определения визита нет вовсе. Модель фактически: UTM — last-touch
  внутри визита-вкладки; yclid — last Директ-клик за всё время;
  first-touch — первая страница визита-вкладки.
```

## 8. FIRST-TOUCH DECISION

```text
implemented: yes
field name:  firstTouchUrl
exact semantics:
  адрес первой страницы, открытой в той вкладке браузера, из которой
  отправлена заявка (полный href с параметрами, ≤ 600 символов).
  Не «первая страница за всё время», не страница текущей заявки.
storage lifecycle:
  sessionStorage — то же окно, что у UTM; rememberFirstTouch() при первой
  отрисовке каждой страницы (Analytics.tsx рядом с rememberUtm), пишет
  только если ключа ещё нет; новая вкладка — новое значение; хранилище
  недоступно — значения нет, форма работает.
CRM path:
  формы (JSON/FormData) → firstTouchUrl → apps/api DTO ×4 (@IsString,
  MaxLength как у pageUrl) → EnrichedLead (LeadInput в @photo/shared)
  → CrmLeadChannel → DtoCreateLead (@IsUrl, ≤ 600)
  → attributionFromLead → OrderPhoto.firstTouchUrl; в note строка
  «Первая страница визита: …».
migration:
  20260911200000_order_first_touch_url — один nullable ADD COLUMN,
  сгенерирован prisma migrate diff, применён вместе с миграцией
  этапа 02 на schema-only копию боевой базы (копия удалена).
```

Отличие от правил UTM намеренное и записано в коде: UTM внутри вкладки
перезаписываются (last-touch), first-touch — нет. Какой из них считать
«источником визита» — вопрос модели атрибуции для этапа 08.

## 9. CONVERSION PAGE

```text
conversionPageUrl semantics:
  адрес страницы, на которой отправлена заявка (window.location.href
  в момент отправки, поле pageUrl на проводе). Не смешан с first-touch:
  разные ключи, разные колонки, разные строки в note.
```

## 10. REFERRER

```text
captured now:   no — document.referrer нигде не читается и не отправляется
recommendation: не добавлять. Источник перехода уже есть в Метрике
                (lastTrafficSource, referer визита) и доступен через
                Reports API по ClientID; дублировать его в CRM — лишняя
                колонка ради данных, которые Метрика хранит точнее.
```

## 11. GOALS MANIFEST

```text
goals required:   8 обязательных + 8 желательных (воронки)
known configured: lead_submitted, автоцель «Отправка формы»
known missing:    lead_submitted_photo, lead_submitted_canvas,
                  lead_submitted_tshirt, form_error
unknown:          form_started, messenger_click, phone_click,
                  8 событий воронок конфигураторов
```

Полная таблица с названиями и инструкцией — `docs/analytics/GOALS_MANIFEST.md`.

## 12. CONSENT / FAILURE AUDIT

```text
metrika load:
  Analytics.tsx рендерит <Script> счётчика только когда consent ===
  'accepted' (localStorage['cookie-consent']) или страница открыта
  во фрейме Метрики (metrika-frame.ts). До согласия window.ym не существует.
consent gating:
  да — всё: hit, reachGoal, getClientID, dataLayer-события до согласия
  не имеют получателя; ретроспективно не досылаются.
ym unavailable behavior:
  reachGoal/hit/pushEcommerce — no-op, теперь ещё и в try/catch
  (исключение внутри ym не выходит наружу);
  getYandexClientId — сразу undefined без ym, при живом ym — таймаут
  800 мс, форма не ждёт дольше.
can analytics break order flow:
  нет. Проверено тестами: без window, без ym, с бросающим ym —
  reachGoal/hit/reportLeadSubmitted не бросают. Заявка не зависит
  от аналитики ни в одной форме.
changes made:
  try/catch в reachGoal, hit, pushEcommerce; типизация имени цели;
  вырезание персональных ключей из параметров (name, phone, email,
  contactValue, comment, note, address).
```

Хранилище атрибуции (UTM, yclid, first-touch) пишется независимо от
согласия — так было до этапа для UTM/yclid; first-touch следует тому же
правилу. Юридическую оценку этого этап не делает (раздел 21 ТЗ).

## 13. TESTS

| Команда | Результат |
|---|---|
| `web-photo apps/web: npx tsc --noEmit` | OK |
| `web-photo apps/web: npm test` | **381 тестов, 380 passed, 1 skipped**; новых 17: `metrika-events.test.ts` (реестр, fail-safe, контракт lead_submitted, отсутствие purchase), `first-touch.test.ts` |
| `web-photo apps/api: npx tsc --noEmit` | OK |
| `web-photo apps/api: npx jest` | 77 passed |
| `web-photo packages/shared: npm test` | 38 passed |
| `racpechatca crm-new: npx prisma validate / generate` | OK |
| `racpechatca crm-new: npm run build` | OK |
| `racpechatca crm-new: npx jest` | **629 passed** (lead-attribution.spec — девять полей) |
| миграции 02 + 04 на schema-only копии боевой базы | обе применились, колонки на месте, копия удалена |

## 14. FILES_CHANGED

| Файл | Изменение | Причина |
|---|---|---|
| **web-photo** `apps/web/src/lib/metrika.ts` | тип `MetrikaGoal`, `sanitizeGoalParams`, try/catch в `reachGoal`/`hit`/`pushEcommerce`; удалены `trackPurchase`, `trackLeadPurchase`, `newOrderId`, `PurchaseItem` | реестр, fail-safe, заявка ≠ покупка |
| `apps/web/src/lib/lead-events.ts` | новый: `reportLeadSubmitted`, `leadSubmittedGoals` | единый контракт |
| `apps/web/src/lib/first-touch.ts` | новый: `rememberFirstTouch`, `getFirstTouchUrl` | first-touch |
| `apps/web/src/lib/metrika-events.test.ts`, `first-touch.test.ts` | новые тесты | п. 23 |
| `apps/web/src/components/Analytics.tsx` | `rememberFirstTouch()` рядом с UTM/yclid | first-touch |
| `OrderPanel.tsx`, `CanvasOrderForm.tsx`, `TshirtLeadForm.tsx`, `MerchForm.tsx`, `ContactForm.tsx` | `reportLeadSubmitted` вместо разрозненных целей и purchase; `firstTouchUrl` в payload | контракт, first-touch |
| `apps/api/src/leads/dto/*.dto.ts` (4) | `firstTouchUrl` | first-touch |
| `apps/api/src/leads/{canvas,contact,tshirt}-lead.service.ts`, `channels/crm.channel.ts` | проброс `firstTouchUrl` | first-touch |
| `packages/shared/src/types.ts` | `LeadInput.firstTouchUrl`, уточнение `pageUrl` | тип |
| **racpechatca** `crm-new/prisma/schema.prisma` | `OrderPhoto.firstTouchUrl` | first-touch |
| `crm-new/prisma/migrations/20260911200000_order_first_touch_url/` | миграция | |
| `crm-new/src/order-photo/dto/create-lead.dto.ts` | `firstTouchUrl` (`@IsUrl`, ≤ 600) | |
| `crm-new/src/order-photo/lead-attribution.ts` (+ spec) | девятое поле | |
| `crm-new/src/order-photo/order-photo.service.ts` | строка в `note` | для людей |
| `docs/analytics/EVENT_CATALOG.md`, `GOALS_MANIFEST.md` | новые | п. 5, 19, 26 |
| `docs/analytics/04_EVENT_MODEL.md` | текст этапа + отчёт | п. 26 |
| `docs/analytics/00_MASTER_PLAN.md`, `01_CURRENT_STATE.md` | 03 DONE, 04 REVIEW; новые факты | п. 26 |

## 15. NEW FACTS DISCOVERED

1. **`yclid` хранится в `localStorage` бессрочно** — единственный элемент
   атрибуции без окна. Клик по Директу любой давности приписывается
   следующему заказу. UTM и first-touch — sessionStorage. Требует решения
   (этап 07/08): перевести на sessionStorage или срок (например, 21 день,
   как окно привязки Метрики).
2. **Формы футболок и мерча не отправляли `lead_submitted`** — общая цель
   «Заявка отправлена» недосчитывала футболки целиком. Отчёты по этой цели
   за прошлые месяцы занижены на футболки.
3. 9 имён реестра ничем не отправляются (7 — шаги, убранные из интерфейса
   в сентябре 2026).
4. У формы мерча нет `form_error`.
5. Три смысловых дубля событий у футболок (историческая параллельная схема
   `submit_tshirt_order*`).
6. `document.referrer` не читается.
7. Хранилище атрибуции пишется до согласия на cookie (UTM/yclid — так было).
8. `getYandexClientId` ждёт ClientID не дольше 800 мс — форма не зависает.

## 16. DEVIATIONS FROM SPEC

1. First-touch реализован **не в точности** «по тому же lifecycle, что
   UTM»: окно то же (вкладка), но правило перезаписи другое — UTM
   заменяются новым набором внутри визита, first-touch не меняется.
   Иначе это была бы не первая страница, а последняя посадочная.
   Разница зафиксирована в коде и в разделе 7; вопрос модели — п. 18.
2. Константы 9 DEPRECATED-событий не удалены из реестра — историческая
   сопоставимость важнее чистоты, 7 из них могут вернуться со шагами
   конфигураторов. Решение — на этапе 07.
3. Ветка CRM не отдельная (`feature/analytics-foundation`, как велено
   в разделе 25); ветка сайта отдельная (`feature/analytics-event-model`).

## 17. OPEN ISSUES

1. Слияние `feature/analytics-event-model` в `feature/cms-admin` — только
   вместе с этапом 06; до этого ветка отстаёт от UX-правок сайта.
2. Бессрочный `yclid` (факт 1).
3. Четыре цели по-прежнему не созданы в Метрике; 11 — в состоянии unknown.
4. `form_error` у мерча отсутствует.
5. Отчёты по `lead_submitted` до слияния ветки занижены на футболки.

## 18. QUESTIONS FOR REVIEWER

1. Окно жизни `yclid`: оставить бессрочным (как сейчас), перевести на
   sessionStorage (как UTM) или срок в 21 день? Это меняет, кому
   приписываются заказы из органики после рекламы, — решение модели
   атрибуции, не техники.
2. Модель атрибуции для отчётов (этап 08): источник визита — по
   first-touch (первая страница) или по last-touch UTM (последняя
   кампания внутри визита)? Сейчас сохраняется и то и другое; отчёт
   должен выбрать одно правило.
