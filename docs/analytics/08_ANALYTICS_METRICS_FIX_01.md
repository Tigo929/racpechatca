# 08_ANALYTICS_METRICS_FIX_01.md

# Stage 08 — FIX 01: cancellation semantics

## Статус

```text
REVIEW — исправлено 12.09.2026 (feature/analytics-foundation); production не тронут
```

Отчёт исполнителя — раздел 13.

Основная реализация Stage 08 принята по архитектуре:

- `AnalyticsMetricsService` готов;
- period unique users реализованы безопасно;
- site funnel / CRM funnel / P&L разделены;
- traffic/CRM/P&L reconciliation = 0;
- existing P&L logic переиспользуется;
- production не затронут.

Но перед production rollout нужно исправить одну семантическую ошибку в cancellation metrics.

---

# 1. Проблема

Текущая реализация из отчёта:

```text
cancelledAt:
последний переход в CANCELLED, если заказ отменён сейчас;
если заказ возвращён в работу → null
```

То есть:

```text
LEAD → NEW → CANCELLED → NEW
```

после reopen становится:

```text
cancelledAt = null
wasEverCancelled = true
```

Это корректно для поля `currentlyCancelled`, но некорректно для исторической/event-аналитики.

Stage 08 требует сохранять факт отмены даже после reopen.

---

# 2. Почему это важно

Иначе после reopen система потеряет историческое событие:

```text
ordersCancelledInPeriod
```

и cohort cancellation rate будет занижен.

Пример:

```text
01.09 LEAD
02.09 NEW
05.09 CANCELLED
07.09 NEW
```

Нельзя получить:

```text
cancelledOrders 01–06.09 = 0
```

только потому, что 07.09 заказ был восстановлен.

---

# 3. Исправить lifecycle contract

`deriveOrderLifecycle()` должен различать минимум:

```text
firstCancelledAt
lastCancelledAt
currentlyCancelled
wasEverCancelled
```

Семантика:

```text
firstCancelledAt
= самый ранний достоверный вход в CANCELLED

lastCancelledAt
= самый поздний достоверный вход в CANCELLED

currentlyCancelled
= текущий status == CANCELLED

wasEverCancelled
= существовал хотя бы один CANCELLED transition
```

После:

```text
CANCELLED → NEW
```

ожидается:

```text
firstCancelledAt != null
lastCancelledAt != null
currentlyCancelled = false
wasEverCancelled = true
```

---

# 4. cancelledOrders

Канонический order-level event metric V1:

```text
cancelledOrders
= COUNT orders where firstCancelledAt is inside period
```

Это даёт стабильную order-level метрику без повторного учёта одного заказа при нескольких reopen/re-cancel cycles.

Если нужен operational transition count, можно дополнительно ввести:

```text
cancellationEvents
= COUNT transitions into CANCELLED inside period
```

но это отдельная метрика и не заменяет `cancelledOrders`.

---

# 5. crmCancellationRate

Для cohort accepted orders:

```text
crmCancellationRate
=
accepted cohort orders that wereEverCancelled
/
accepted cohort orders
```

То есть reopen не должен стирать факт того, что accepted order когда-либо был отменён.

Denominator = accepted cohort.

Если denominator = 0:

```text
null
```

---

# 6. Current-state cancellation

Если dashboard позже понадобится показатель:

```text
сколько заказов сейчас отменено
```

он должен называться отдельно, например:

```text
currentlyCancelledOrders
```

и рассчитываться по:

```text
currentlyCancelled = true
```

Не использовать его вместо historical `cancelledOrders`.

---

# 7. Tests

Добавить/исправить обязательные тесты.

### A

```text
LEAD → NEW → CANCELLED
```

Ожидается:

```text
firstCancelledAt = cancellation time
lastCancelledAt = cancellation time
currentlyCancelled = true
wasEverCancelled = true
```

### B

```text
LEAD → NEW → CANCELLED → NEW
```

Ожидается:

```text
firstCancelledAt retained
lastCancelledAt retained
currentlyCancelled = false
wasEverCancelled = true
cancelledOrders period containing first cancellation = 1
```

### C

```text
NEW → CANCELLED → NEW → CANCELLED
```

Ожидается:

```text
firstCancelledAt = first cancellation
lastCancelledAt = second cancellation
currentlyCancelled = true
wasEverCancelled = true
cancelledOrders based on firstCancelledAt = 1
cancellationEvents = 2   # только если метрика реализована
```

### D

Accepted cohort:

```text
accepted order later cancelled then reopened
```

должен оставаться в numerator `crmCancellationRate`.

### E

```text
LEAD → CANCELLED
```

не является accepted order и не входит в denominator accepted cohort.

---

# 8. Reconciliation

После FIX на текущей production-copy базе ожидаемо:

```text
cancelledOrders = 0
crmCancellationRate = 0/null согласно denominator
```

потому что по текущему отчёту CANCELLED transitions в базе отсутствуют.

Но нужно доказать correctness на fixtures/tests, чтобы будущая первая отмена не дала неверную историю.

Остальные reconciliation:

```text
traffic
CRM counts
P&L
```

не должны измениться.

---

# 9. Не менять

FIX не должен менять:

```text
period unique users
pageviews semantics
acceptedAt
paidAt
realizedAt
P&L formulas
source/UTM
product metrics
Stage 07 scheduler
Stage 06 order sync
```

---

# 10. Production

Production не трогать.

После FIX:

```text
commit → feature/analytics-foundation
push feature branch
```

Master/production только после отдельного review и rollout-команды.

---

# 11. EXECUTOR_REPORT_FIX_01

## RESULT

```text
READY_FOR_REVIEW
```

## LIFECYCLE

```text
firstCancelledAt:
lastCancelledAt:
currentlyCancelled:
wasEverCancelled:
```

## METRICS

```text
cancelledOrders:
cancellationEvents: implemented/not implemented
crmCancellationRate:
currentlyCancelledOrders: implemented/not implemented
```

## TESTS

```text
A:
B:
C:
D:
E:
full metrics tests:
full CRM tests:
build:
```

## RECONCILIATION

```text
traffic diff:
CRM diff:
P&L diff:
```

## GIT

```text
branch:
commit:
push:
master touched:
production touched:
```

## OPEN ISSUES

```text
none
```

---

# 12. Decision Gate

FIX принимается, если:

- reopen не стирает historical cancellation;
- `cancelledOrders` имеет стабильную order-level event semantics;
- cohort cancellation rate использует `wasEverCancelled`;
- current-state cancellation отделена от historical cancellation;
- tests A–E проходят;
- остальные Stage 08 metrics/reconciliation не изменены.

После этого Stage 08 станет:

```text
READY_FOR_PRODUCTION_ROLLOUT
```

---

# 13. EXECUTOR_REPORT_FIX_01 — 12.09.2026

## RESULT

```text
READY_FOR_REVIEW
```

## LIFECYCLE

```text
firstCancelledAt:   самый ранний вход в CANCELLED по StatusHistory; заказ отменён сейчас без единого
                    перехода (создан отменённым) → statusChangedAt ?? createdAt; не отменялся → null.
                    Возврат в работу значение не трогает.
lastCancelledAt:    самый поздний вход в CANCELLED; иначе как выше
currentlyCancelled: order.status === 'CANCELLED'
wasEverCancelled:   cancellationTimes.length > 0 (хотя бы один вход в CANCELLED)
дополнительно:      cancellationTimes: Date[] — все входы, для счётчика событий; поле cancelledAt удалено
```

## METRICS

```text
cancelledOrders:          COUNT заказов с firstCancelledAt в периоде (order-level; повторные отмены не задваивают)
cancellationEvents:       implemented — COUNT переходов в CANCELLED внутри периода (CrmFunnelEvents.cancellationEvents)
crmCancellationRate:      acceptedCohort с wasEverCancelled / acceptedCohort × 100; знаменатель 0 → null
currentlyCancelledOrders: implemented — заказы с firstCancelledAt в периоде и currentlyCancelled = true
                          (CrmFunnelEvents.currentlyCancelledOrders, OrdersMetrics.currentlyCancelledOrders);
                          отдельное имя, historical cancelledOrders не подменяет
не менялись:              periodUsers, pageviews, acceptedAt, paidAt, realizedAt, P&L, source/UTM, товары,
                          расписание этапа 07, очередь этапа 06
```

## TESTS

```text
A: LEAD → NEW → CANCELLED — first = last = момент отмены, currentlyCancelled = true, wasEverCancelled = true;
   в обзоре cancelledOrders 1, cancellationEvents 1, currentlyCancelledOrders 1, rate 50 % из двух принятых — PASS
B: LEAD → NEW → CANCELLED(05.09) → NEW(07.09) — first/last сохранены, currentlyCancelled = false,
   wasEverCancelled = true; период 01–06.09: cancelledOrders 1, currentlyCancelledOrders 0;
   период 07–13.09: cancelledOrders 0, cancellationEvents 0 — PASS
C: NEW → CANCELLED → NEW → CANCELLED — first = первая, last = вторая, cancellationTimes 2, currentlyCancelled = true;
   cancelledOrders 1 (по первой отмене), cancellationEvents 2; период только со второй отменой: cancelledOrders 0,
   cancellationEvents 1 — PASS
D: принятый, отменённый и возвращённый в работу остаётся в numerator crmCancellationRate (100 % при когорте 1) — PASS
E: LEAD → CANCELLED — не принят, в когорту принятых не входит (acceptedCohortSize 0, rate null),
   cancelledOrders 1 — PASS
full metrics tests: npx jest src/analytics/metrics — 4 suites / 62 passed (+4 к этапу 08)
full CRM tests:     npx jest — 82 suites / 897 passed
build:              npm run build OK; tsc 0; eslint новых файлов чисто
```

## RECONCILIATION (копия боевой базы crm_stage08_test, после FIX)

```text
traffic diff: 0 (last_7_days: visits 185, pageviews 1042 / 1163, lead 2, created 1, paid 0)
CRM diff:     0 — last_30_days и 01.06–12.09: crmLeads, acceptedOrders, paidOrders, paidWithoutDate, paidOrderValue
              без изменений; cancelledOrders 0 = 0, cancellationEvents 0 = 0, currentlyCancelled 0 = 0
              (SQL сверки переписан на первый вход в CANCELLED; переходов в CANCELLED в базе нет)
P&L diff:     0 (август 2026, 12 строк против /reports/monthly и /reports/weekly)
```

## GIT

```text
branch:              feature/analytics-foundation
commit:              см. коммит «fix(аналитика, этап 08 / FIX_01)»
push:                yes
master touched:      no
production touched:  no (копия crm_stage08_test удалена после сверок)
```

## OPEN ISSUES

```text
none
```
