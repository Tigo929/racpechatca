# Analytics integrity and Direct costs

Direct costs are synchronized read-only through the existing Metrika OAuth
client. Set `YANDEX_DIRECT_ANALYTICS_LOGIN` to the chief login returned by
`GET /management/v1/clients?counters=...` and
`YANDEX_DIRECT_ANALYTICS_CAMPAIGNS` to an explicit comma-separated allowlist.
The existing enabled analytics scheduler refreshes a 35-day window hourly.
Backfill: `npm run ads:sync -- 2026-08-25 2026-09-24`.

The API metric `ym:ad:RUBConvertedAdCost` is RUB **excluding VAT**, by click
date, stored to four decimal places. Impressions are unavailable in this query
and remain null. Complete unsampled responses replace only configured campaigns
within a database transaction under an advisory lock. API failures leave the
previous data intact. Manual imports share the same lock; invalid rows prevent
any write. Imported VAT basis defaults to UNKNOWN.

AdSpend is analytical data, not an additional P&L expense. Never subtract it
again from a financial report that may already contain marketing expenses.
Website origin and ClientID coverage do not prove advertising attribution.
Until results are linked to campaigns under a defined attribution window,
CPL/CPA/CPO/ROAS/ROMI are unavailable, even with 100% identity coverage.

CRM funnel steps use the same LEAD cohort. Period event totals remain in SALES.
Metrika goals count achievements, not unique orders or one cohort; the report
does not calculate drop-off between them. Custom report jobs refresh exact
period snapshots before collecting unique visitors.

## Counter configuration

The canonical `lead_submitted` action goal must use **exact** matching.
`contain` also matches `lead_submitted_photo`, `_canvas`, and `_tshirt`.
The site deliberately emits both general and product events. Existing data is
not retroactively corrected by changing the goal. Do not divide historical
counts by two: Metrika has a one-second duplicate-achievement limit and actual
delivery timing differs. Preserve the goal ID and history; edit its condition.

References:
- https://yandex.ru/dev/metrika/ru/stat/direct-clicks
- https://yandex.ru/support/metrica/ru/sources/direct-clicks
- https://yandex.ru/support/metrica/ru/general/goal-js-event
