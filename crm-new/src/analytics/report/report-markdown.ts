import type { AnalyticsPeriod } from '../metrics/analytics-period';
import type { FunnelStep, MetricRow, ReportModel } from './report-contract';

/**
 * Печать отчёта (этап 15). Всё, что нужно внешнему аналитику, обязано лежать
 * внутри файла: определения метрик, границы периодов, пробелы в данных и
 * инструкция. Читатель не должен ничего спрашивать у системы — у него её нет.
 *
 * Персональные данные сюда не попадают по построению: рендер получает только
 * агрегаты и обезличенные строки, имён, телефонов, ClientID и yclid в модели
 * нет вовсе.
 */

const DASH = '—';

function money(v: number | null): string {
  if (v === null) return DASH;
  return `${Math.round(v).toLocaleString('ru-RU')} ₽`;
}

function num(v: number | null): string {
  return v === null ? DASH : v.toLocaleString('ru-RU');
}

/** Дробные значения печатаем с одним знаком: сырой float читать невозможно. */
function rounded(v: number | null): string {
  if (v === null) return DASH;
  return Number.isInteger(v) ? num(v) : v.toFixed(1);
}

function pct(v: number | null, digits = 1): string {
  return v === null ? DASH : `${v.toFixed(digits)} %`;
}

function value(row: MetricRow, v: number | null): string {
  if (v === null) return DASH;
  if (row.unit === 'rub') return money(v);
  if (row.unit === 'percent') return pct(v);
  return num(v);
}

function signed(row: MetricRow): string {
  if (row.delta === null) return DASH;
  const sign = row.delta > 0 ? '+' : '';
  if (row.unit === 'rub')
    return `${sign}${Math.round(row.delta).toLocaleString('ru-RU')} ₽`;
  if (row.unit === 'percent') return `${sign}${row.delta.toFixed(1)} п.п.`;
  return `${sign}${row.delta.toLocaleString('ru-RU')}`;
}

function signedPct(row: MetricRow): string {
  if (row.deltaPct === null) return DASH;
  return `${row.deltaPct > 0 ? '+' : ''}${row.deltaPct.toFixed(1)} %`;
}

function period(p: AnalyticsPeriod): string {
  const d = (iso: string) => iso.split('-').reverse().join('.');
  return `${d(p.from)}–${d(p.to)}`;
}

function iso(date: Date | null): string {
  return date ? date.toISOString() : DASH;
}

function table(header: string[], rows: string[][]): string {
  const sep = header.map(() => '---');
  return [header, sep, ...rows].map((r) => `| ${r.join(' | ')} |`).join('\n');
}

function funnelTable(steps: FunnelStep[]): string {
  return table(
    [
      'Шаг',
      'Текущий период',
      'Конверсия с прошлого шага',
      'Отвал',
      'Предыдущий период',
    ],
    steps.map((s) => [
      s.name,
      num(s.count),
      s.conversionFromPrevious === null ? DASH : pct(s.conversionFromPrevious),
      num(s.dropOff),
      num(s.previousCount),
    ]),
  );
}

export function renderMarkdown(model: ReportModel): string {
  const i = model.input;
  const cur = i.current.overview;
  const curRealized = cur.financials.realized;
  const out: string[] = [];
  const add = (...lines: string[]) => out.push(...lines, '');

  // ── шапка и технический контекст ─────────────────────────────────────────
  add(
    `# Аналитический отчёт «Распечатка» — ${period(i.current.period)}`,
    '',
    'Отчёт самодостаточен: все определения, границы периодов и известные пробелы в данных описаны внутри. Инструкция для ИИ-аналитика — в конце файла.',
  );

  add(
    '## TECHNICAL CONTEXT',
    '',
    '```text',
    `Отчёт сформирован:     ${i.generatedAt.toISOString()} (UTC)`,
    `Production build:      ${i.build ?? DASH}`,
    'Часовой пояс отчёта:   Europe/Moscow (+03:00, фиксированное смещение)',
    'Валюта:                RUB',
    `Текущий период:        ${period(i.current.period)}`,
    `Предыдущий период:     ${period(i.previous.period)}`,
    `Средний период (30 д): ${period(i.average30.period)}`,
    i.month
      ? `Календарный месяц:     ${period(i.month.period)}`
      : 'Календарный месяц:     нет данных',
    i.previousMonth
      ? `Предыдущий месяц:      ${period(i.previousMonth.period)}`
      : 'Предыдущий месяц:      нет данных',
    `Свежесть данных Метрики: ${iso(i.current.dataQuality.freshness.lastMetrikaSyncAt)} (${i.current.dataQuality.freshness.status})`,
    '',
    'Источники данных:',
    '  - PostgreSQL CRM: заказы, статусы, позиции, зарплаты, расходы',
    '  - Яндекс.Метрика: визиты, посетители, просмотры, источники, цели (синхронизация этапа 07)',
    '  - Снимки периодов Метрики (уникальные посетители за период)',
    '  - Отчёт P&L владельца (ReportsService): выручка, себестоимость, прибыль',
    '  - Журнал выгрузки CRM → Метрика (очередь заказов)',
    '  - Оценки изменений (этап 11) и карточки сигналов (этап 12)',
    'Текущий неполный день в периоды не включается.',
    '```',
  );

  // ── executive summary ────────────────────────────────────────────────────
  add(
    '# EXECUTIVE SUMMARY',
    '',
    `Текущий период — ${period(i.current.period)}, сравнение с ${period(i.previous.period)}.`,
    '',
    table(
      ['Показатель', 'Текущий', 'Предыдущий', 'Изменение', 'Изменение %'],
      model.summary.map((r) => [
        r.label,
        value(r, r.current),
        value(r, r.previous),
        signed(r),
        signedPct(r),
      ]),
    ),
  );

  // ── business health ──────────────────────────────────────────────────────
  const byKind = (kind: string) =>
    model.signals.filter((s) => s.kind === kind).map((s) => `- ${s.statement}`);
  add(
    '# BUSINESS HEALTH',
    '',
    'Ниже — факты изменения показателей. Причины изменений отчёт не устанавливает: это работа аналитика.',
    '',
    '## Positive signals',
    ...(byKind('positive').length ? byKind('positive') : ['- нет']),
    '',
    '## Negative signals',
    ...(byKind('negative').length ? byKind('negative') : ['- нет']),
    '',
    '## Stable signals',
    ...(byKind('stable').length ? byKind('stable') : ['- нет']),
    '',
    '## Insufficient evidence',
    ...(byKind('insufficient').length ? byKind('insufficient') : ['- нет']),
  );

  // ── traffic ──────────────────────────────────────────────────────────────
  const t = cur.traffic;
  add(
    '# TRAFFIC',
    '',
    '```text',
    `Визиты:              ${num(t.visits)}`,
    `Посетители (период): ${num(t.periodUsers)}   (отдельный запрос к Метрике за период, не сумма дней)`,
    `Сумма дневных users: ${num(t.sumDailyUsers)}  (один человек в разные дни считается дважды)`,
    `Просмотры:           ${num(t.pageviews)}`,
    `Дней с данными:      ${num(t.daysWithTraffic)}`,
    `Полнота:             ${t.quality.completeness}${t.quality.notes.length ? ` (${t.quality.notes.join(', ')})` : ''}`,
    '```',
    '',
    '## Источники визитов',
    '',
    i.sources.rows.length
      ? table(
          [
            'Источник',
            'Канал',
            'Визиты',
            'Просмотры',
            'Заявки',
            'Принято (сопост.)',
            'Оплачено (сопост.)',
            'Визит → заявка',
          ],
          i.sources.rows.map((r) => [
            r.trafficSourceName || r.trafficSource,
            r.sourceEngineName || r.sourceEngine || DASH,
            num(r.visits),
            num(r.pageviews),
            num(r.siteLeads),
            num(r.matchedAccepted),
            num(r.matchedPaid),
            pct(r.visitToLead),
          ]),
        )
      : '_Нет данных по источникам за период._',
    '',
    '## UTM-метки',
    '',
    i.utm.rows.length
      ? table(
          ['utm_source / utm_medium', 'Кампания', 'Визиты', 'Заявки'],
          i.utm.rows.map((r) => [
            r.isNoUtm
              ? 'NO_UTM (метки отсутствуют)'
              : `${r.utmSource} / ${r.utmMedium}`,
            r.isNoUtm ? DASH : r.utmCampaign,
            num(r.visits),
            num(r.siteLeads),
          ]),
        )
      : '_UTM-меток в периоде нет._',
    '',
    '## Деньги по источникам',
    '',
    '```text',
    'NOT ATTRIBUTABLE — выручку и прибыль нельзя разложить по источникам трафика.',
    'Причина: связь «визит → заказ» держится на ClientID, а его покрытие у принятых заказов',
    `составляет ${pct(i.current.dataQuality.clientIdCoverageAccepted)}. Рекламные расходы в систему не заводятся,`,
    'поэтому CPL, CPA, CPO, ROAS и ROMI не считаются (в контракте метрик они помечены',
    'как UNAVAILABLE_NO_SPEND_DATA). Достоверно доступны только цели Метрики по источникам',
    'и общие финансовые итоги периода.',
    '```',
    '',
    '## Страницы входа и заявок',
    '',
    i.landings.rows.length
      ? table(
          ['Страница входа', 'Визиты', 'Заявки', 'Визит → заявка'],
          i.landings.rows
            .slice(0, 10)
            .map((r) => [
              r.normalizedPath.replace(/[?#].*$/, ''),
              num(r.visits),
              num(r.siteLeads),
              pct(r.visitToLead),
            ]),
        )
      : '_Нет данных по страницам._',
  );

  // ── funnel ───────────────────────────────────────────────────────────────
  add(
    '# FUNNEL',
    '',
    'Путь посетителя сайта. Шаги «принято» и «оплачено» считаются только по заказам, которые удалось сопоставить с визитом по ClientID, — это меньшинство заказов CRM (см. DATA QUALITY).',
    '',
    funnelTable(model.siteFunnel),
    '',
    model.biggestDropOff
      ? `**Самый большой отвал:** ${model.biggestDropOff.name} — потеряно ${num(model.biggestDropOff.dropOff)} (конверсия шага ${pct(model.biggestDropOff.conversionFromPrevious)}). Причина отвала отчётом не устанавливается.`
      : '_Отвал посчитать не на чем: в периоде нет данных по шагам воронки._',
  );

  // ── crm funnel ───────────────────────────────────────────────────────────
  const cohorts = cur.crmFunnel.cohorts;
  add(
    '# CRM FUNNEL',
    '',
    'Путь заказа внутри CRM. Считается по событиям периода: заявка (LEAD), принятие в работу, оплата, признание выручки, отмена.',
    '',
    funnelTable(model.crmFunnel),
    '',
    '## Когорты (заказы, вошедшие в период, прослеженные до конца)',
    '',
    '```text',
    `Заявок в когорте:            ${num(cohorts.leadCohortSize)}  → принято ${num(cohorts.leadCohortAccepted)} → оплачено ${num(cohorts.leadCohortPaid)}`,
    `Принятых в когорте:          ${num(cohorts.acceptedCohortSize)} → оплачено ${num(cohorts.acceptedCohortPaid)} → отменено ${num(cohorts.acceptedCohortCancelled)}`,
    `Конверсия заявка → принят:   ${pct(cohorts.crmLeadToAccepted)}`,
    `Конверсия принят → оплачен:  ${pct(cohorts.crmAcceptedToPaid)}`,
    `Конверсия заявка → оплата:   ${pct(cohorts.crmLeadToPaid)}`,
    `Доля отмен:                  ${pct(cohorts.crmCancellationRate)}`,
    '```',
  );

  // ── sales ────────────────────────────────────────────────────────────────
  const o = cur.orders;
  const po = i.previous.overview.orders;
  add(
    '# SALES',
    '',
    table(
      ['Показатель', 'Текущий', 'Предыдущий'],
      [
        ['Принятые заказы', num(o.acceptedOrders), num(po.acceptedOrders)],
        ['Оплаченные заказы', num(o.paidOrders), num(po.paidOrders)],
        ['Отменённые заказы', num(o.cancelledOrders), num(po.cancelledOrders)],
        ['Реализовано заказов', num(o.realizedOrders), num(po.realizedOrders)],
        ['Средний чек принятого', money(o.acceptedAov), money(po.acceptedAov)],
        ['Средний чек оплаченного', money(o.paidAov), money(po.paidAov)],
        [
          'Оплачено без даты оплаты',
          num(o.paidWithoutDate),
          num(po.paidWithoutDate),
        ],
      ],
    ),
    '',
    '_Медиана чека в контракте метрик не считается — в отчёт не выносится, чтобы не расходиться с дашбордом._',
  );

  // ── products ─────────────────────────────────────────────────────────────
  const totalContract = i.products.rows.reduce(
    (s, r) => s + r.contractValue,
    0,
  );
  add(
    '# PRODUCTS',
    '',
    i.products.rows.length
      ? table(
          [
            'Направление',
            'Принято',
            'Оплачено',
            'Отменено',
            'Сумма принятых',
            'Сумма оплаченных',
            'Доля суммы принятых',
          ],
          i.products.rows.map((r) => [
            r.productCategory,
            num(r.acceptedOrders),
            num(r.paidOrders),
            num(r.cancelledOrders),
            money(r.contractValue),
            money(r.paidOrderValue),
            totalContract > 0
              ? pct((r.contractValue / totalContract) * 100)
              : DASH,
          ]),
        )
      : '_Нет заказов за период._',
    '',
    '## Прибыль по направлениям (за период признания выручки)',
    '',
    curRealized
      ? table(
          ['Направление', 'Заказы', 'Выручка', 'Прибыль'],
          [
            [
              'PHOTO',
              num(curRealized.byCategory.photo.orders),
              money(curRealized.byCategory.photo.revenue),
              money(curRealized.byCategory.photo.profit),
            ],
            [
              'TSHIRT',
              num(curRealized.byCategory.tshirt.orders),
              money(curRealized.byCategory.tshirt.revenue),
              money(curRealized.byCategory.tshirt.profit),
            ],
            [
              'CANVAS',
              num(curRealized.byCategory.canvas.orders),
              money(curRealized.byCategory.canvas.revenue),
              money(curRealized.byCategory.canvas.profit),
            ],
          ],
        )
      : '_P&L за период недоступен._',
    '',
    '_Раскладка заказов и денег по каналам — в разделе ORDER ORIGIN: там же полнота классификации и правила, по которым канал нельзя путать с источником рекламы._',
  );

  // ── происхождение заказов (этап 17) ──────────────────────────────────────
  const origin = model.orderOrigin;
  const originRow = (r: (typeof origin.rows)[number]) => [
    r.label,
    num(r.crmLeads),
    num(r.acceptedOrders),
    num(r.paidOrders),
    money(r.revenue),
    money(r.cogs),
    money(r.profit),
    pct(r.marginPct),
    money(r.averageCheck),
  ];
  add(
    '# ORDER ORIGIN',
    '',
    'Происхождение заказа — откуда заказ ВЗЯЛСЯ: заявку создал сайт или сотрудник завёл её руками в CRM. Это не источник рекламы: откуда человек пришёл на сайт, показано отдельно в разделах TRAFFIC и ATTRIBUTION.',
    '',
    origin.rows.length
      ? table(
          [
            'Канал',
            'Заявки',
            'Принято',
            'Оплачено',
            'Выручка',
            'COGS',
            'Прибыль',
            'Маржа',
            'Средний чек',
          ],
          [
            ...origin.rows.map(originRow),
            ...(origin.all ? [originRow(origin.all)] : []),
          ],
        )
      : '_Нет заказов за период._',
    '',
    '_Прибыль канала — валовая: товарная выручка минус себестоимость заказов. Зарплата, реклама и прочие расходы бизнеса по каналам не делятся, поэтому чистая прибыль остаётся одна на весь бизнес (раздел FINANCIALS)._',
    '',
    '## Полнота классификации',
    '',
    table(
      ['Показатель', 'Значение'],
      [
        ['Заказов создано за период', num(origin.coverage.totalOrders)],
        ['orderOriginCoveragePct', pct(origin.coverage.orderOriginCoveragePct)],
        ['websiteOrders', num(origin.coverage.websiteOrders)],
        ['avitoOrders', num(origin.coverage.avitoOrders)],
        ['unknownOriginOrders', num(origin.coverage.unknownOriginOrders)],
      ],
    ),
    '',
    origin.coverage.unknownOriginOrders > 0
      ? `_ОГРАНИЧЕНИЕ ДАННЫХ: у ${num(origin.coverage.unknownOriginOrders)} заказов периода происхождение по истории не доказано. Они показаны строкой «Не определён» и не приписаны ни одному каналу._`
      : '_Все заказы периода классифицированы: строк с недоказанным происхождением нет._',
    '',
    '## Методика (правила, которые нельзя нарушать при анализе)',
    '',
    '```text',
    'WEBSITE  = заявку создал сайт (серверный признак заявки), даже если рекламных меток нет.',
    'AVITO    = ручной заказ CRM: выбранный сотрудником Avito либо текущий канал по умолчанию.',
    'UNKNOWN  = историческое происхождение не доказано; такие заказы не приписываются ни сайту, ни Avito.',
    'Конверсия сайта считается ТОЛЬКО по населённости WEBSITE.',
    'Делить все заказы CRM на визиты сайта нельзя: ручные заказы сайт не создавал.',
    'Рост AVITO не является конверсией сайта и не доказывает работу сайта.',
    'Происхождение заказа и маркетинговая атрибуция — разные измерения; смешивать их нельзя.',
    '```',
  );

  // ── financials ───────────────────────────────────────────────────────────
  add(
    '# FINANCIALS',
    '',
    curRealized
      ? table(
          ['Показатель', 'Значение'],
          [
            ['Реализованная выручка', money(curRealized.realizedRevenue)],
            [
              'Выручка за товар (без доставки)',
              money(curRealized.realizedGoodsRevenue),
            ],
            ['Себестоимость (COGS)', money(curRealized.cogs)],
            ['Валовая маржа', money(curRealized.grossContribution)],
            ['Начисленная зарплата', money(curRealized.salaryAccrued)],
            ['Операционные расходы', money(curRealized.operatingExpenses)],
            ['Прибыль доставки', money(curRealized.deliveryProfit)],
            [
              'Прибыль (методика отчёта владельца)',
              money(curRealized.netProfit),
            ],
            ['Маржа', pct(curRealized.marginPct)],
            ['Заказов в расчёте', num(curRealized.orders)],
          ],
        )
      : '_P&L за период недоступен._',
    '',
    '```text',
    'Что входит в себестоимость: заготовки и расходники позиции, печать, термоперенос,',
    'упаковка, прочие прямые расходы позиции и стоимость доставки перевозчику.',
    'Что НЕ входит в себестоимость: начисленная зарплата и операционные расходы —',
    'они вычитаются отдельно, после валовой маржи.',
    '',
    'ВАЖНО о названии: «прибыль» здесь — показатель netProfit по методике отчёта владельца',
    '(валовая маржа − зарплата − операционные расходы + прибыль доставки). Это не',
    'бухгалтерская чистая прибыль: в ней нет налогов, аренды, амортизации и прочих',
    'расходов, которые в CRM не заводятся.',
    '```',
  );

  // ── attribution ──────────────────────────────────────────────────────────
  const a = i.attribution;
  const share = (part: number) =>
    a.totalOrders > 0 ? pct((part / a.totalOrders) * 100) : DASH;
  add(
    '# ATTRIBUTION',
    '',
    `Заказы, созданные в текущем периоде: ${num(a.totalOrders)}.`,
    '',
    table(
      ['Признак', 'Заказов', 'Доля'],
      [
        ['ClientID Метрики', num(a.withClientId), share(a.withClientId)],
        ['yclid (клик Яндекс.Директа)', num(a.withYclid), share(a.withYclid)],
        ['UTM-метки', num(a.withUtm), share(a.withUtm)],
        [
          'Страница заявки',
          num(a.withConversionPage),
          share(a.withConversionPage),
        ],
        [
          'Первая страница визита',
          num(a.withFirstTouch),
          share(a.withFirstTouch),
        ],
      ],
    ),
    '',
    '## По источнику заказа',
    '',
    a.bySource.length
      ? table(
          ['Источник заказа', 'Заказов', 'С атрибуцией', 'Доля с атрибуцией'],
          a.bySource.map((s) => [
            s.source,
            num(s.orders),
            num(s.withAnyAttribution),
            s.orders > 0 ? pct((s.withAnyAttribution / s.orders) * 100) : DASH,
          ]),
        )
      : '_Нет заказов за период._',
    '',
    '_Заказы, заводимые вручную (Авито, маркетплейсы), не имеют признаков атрибуции по своей природе: человек оформляет их в CRM, минуя сайт._',
  );

  // ── data quality ─────────────────────────────────────────────────────────
  add(
    '# DATA QUALITY',
    '',
    ...model.quality.flatMap((q) => [
      `### ${q.metric}`,
      '',
      '```text',
      `VALUE:     ${q.value}`,
      `EXPECTED:  ${q.threshold}`,
      `IMPACT:    ${q.impact}`,
      '```',
      '',
    ]),
  );

  // ── metrika sync ─────────────────────────────────────────────────────────
  const s = i.sync;
  add(
    '# METRIKA / CRM SYNC',
    '',
    table(
      ['Состояние очереди', 'Строк'],
      [
        ['delivered (доставлено)', num(s.delivered)],
        ['skipped (пропущено)', num(s.skipped)],
        ['pending (ожидает)', num(s.pending)],
        ['processing (в работе)', num(s.processing)],
        ['failed (ошибка)', num(s.failed)],
      ],
    ),
    '',
    '```text',
    `Доставлено с идентификатором загрузки: ${s.deliveredWithUploadingId} из ${s.delivered}`,
    `Прошло валидацию на стороне Метрики:    ${s.validationPassed}`,
    `Дубли ключа дедупликации:               ${s.duplicateDedupeKeys} (норма 0)`,
    `Повторные покупки по одному заказу:     ${s.duplicatePurchasesPerOrder} (норма 0)`,
    `Последняя доставка:                     ${iso(s.lastDeliveredAt)}`,
    '```',
    '',
    s.skipReasons.length
      ? table(
          ['Причина пропуска', 'Строк'],
          s.skipReasons.map((r) => [r.reason, num(r.rows)]),
        )
      : '_Пропусков нет._',
    '',
    '## Сверки (отчёт против принятых источников)',
    '',
    '```text',
    `Сумма выручки по дням = итог периода: ${num(i.reconciliation.trendSumRealizedRevenue)} против ${num(i.reconciliation.overviewRealizedRevenue)} → ${
      i.reconciliation.trendSumRealizedRevenue ===
      i.reconciliation.overviewRealizedRevenue
        ? 'СОВПАДАЕТ'
        : 'РАСХОЖДЕНИЕ'
    }`,
    i.reconciliation.monthlyPnl
      ? `P&L месяца ${i.reconciliation.monthlyPnl.month}: выручка ${num(i.reconciliation.monthlyPnl.serviceRevenue)} против отчёта владельца ${num(i.reconciliation.monthlyPnl.reportRevenue)} → ${
          i.reconciliation.monthlyPnl.serviceRevenue ===
          i.reconciliation.monthlyPnl.reportRevenue
            ? 'СОВПАДАЕТ'
            : 'РАСХОЖДЕНИЕ'
        }`
      : 'P&L месяца: нет данных',
    i.reconciliation.monthlyPnl
      ? `   прибыль ${num(i.reconciliation.monthlyPnl.serviceNetProfit)} против ${num(i.reconciliation.monthlyPnl.reportNetProfit)}, себестоимость ${num(i.reconciliation.monthlyPnl.serviceCogs)} против ${num(i.reconciliation.monthlyPnl.reportCogs)}`
      : '',
    '```',
  );

  // ── comparison ───────────────────────────────────────────────────────────
  add(
    '# PERIOD COMPARISON',
    '',
    `${period(i.current.period)} → ${period(i.previous.period)}`,
    '',
    table(
      ['Показатель', 'Текущий', 'Предыдущий', 'Δ', 'Δ %'],
      model.comparison.map((r) => [
        r.label,
        value(r, r.current),
        value(r, r.previous),
        signed(r),
        signedPct(r),
      ]),
    ),
    '',
    `Для справки, средние значения за 30 дней (${period(i.average30.period)}): визиты ${num(i.average30.overview.traffic.visits)}, заявки CRM ${num(i.average30.overview.crmFunnel.events.crmLeads)}, оплачено ${num(i.average30.overview.orders.paidOrders)}, выручка ${money(i.average30.overview.financials.realized?.realizedRevenue ?? null)}, прибыль ${money(i.average30.overview.financials.realized?.netProfit ?? null)}.`,
  );

  // ── trends ───────────────────────────────────────────────────────────────
  add(
    '# TRENDS',
    '',
    `Дневной ряд за ${i.daily.length} дней (календарь Europe/Moscow).`,
    '',
    i.daily.length
      ? table(
          [
            'День',
            'Визиты',
            'Заявки CRM',
            'Принято',
            'Оплачено',
            'Выручка',
            'Прибыль',
          ],
          i.daily.map((p) => [
            p.date,
            num(p.visits),
            num(p.crmLeads),
            num(p.acceptedOrders),
            num(p.paidOrders),
            money(p.realizedRevenue),
            money(p.netProfit),
          ]),
        )
      : '_Нет дневных данных._',
  );

  // ── anomalies ────────────────────────────────────────────────────────────
  add(
    '# ANOMALIES',
    '',
    'Перечислены только факты отклонений с доказательством. Причины не предполагаются.',
    '',
    model.anomalies.length
      ? model.anomalies
          .map((an) =>
            [
              '```text',
              `metric:   ${an.metric}`,
              `current:  ${rounded(an.current)}`,
              `baseline: ${rounded(an.baseline)}`,
              `delta:    ${rounded(an.delta)}`,
              `severity: ${an.severity}`,
              `evidence: ${an.evidence}`,
              '```',
            ].join('\n'),
          )
          .join('\n\n')
      : '_Отклонений выше порогов не обнаружено._',
  );

  // ── growth ───────────────────────────────────────────────────────────────
  add(
    '# GROWTH',
    '',
    i.growth.changes.length
      ? i.growth.changes
          .map((c) =>
            [
              `### ${c.name}`,
              '',
              '```text',
              `статус:    ${c.status}`,
              `начало:    ${iso(c.startedAt)}`,
              c.latest
                ? [
                    `оценка:    версия ${c.latest.version}, ${c.latest.evaluatedAt.toISOString()} (trigger ${c.latest.trigger})`,
                    `вердикт:   ${c.latest.verdict}`,
                    `зрелость:  ${c.latest.maturity}`,
                    `метрика:   ${c.latest.primaryMetric}`,
                    `причинность: ${c.latest.causality}`,
                    `факт:      ${c.latest.fact}`,
                  ].join('\n')
                : 'оценок пока нет',
              '```',
            ].join('\n'),
          )
          .join('\n\n')
      : '_Зарегистрированных изменений нет._',
    '',
    '_Вердикт INCOMPARABLE означает, что периоды «до» и «после» несопоставимы, а `causality: NOT_ESTABLISHED` — что причинная связь не доказана. Эти пометки нельзя игнорировать при интерпретации._',
    '',
    '## Автоматические карточки сигналов (этап 12)',
    '',
    i.insights.length
      ? table(
          ['Детектор', 'Статус', 'Версия', 'Заголовок'],
          i.insights.map((c) => [
            c.detectorId,
            c.status,
            `v${c.version}`,
            c.title,
          ]),
        )
      : '_Карточек нет._',
  );

  // ── forecast input ───────────────────────────────────────────────────────
  add(
    '# FORECAST INPUT',
    '',
    model.weekly.length
      ? table(
          [
            'Неделя (с понедельника)',
            'Визиты',
            'Заявки',
            'Принято',
            'Оплачено',
            'Выручка',
            'Прибыль',
            'Маржа',
          ],
          model.weekly.map((w) => [
            w.week,
            num(w.visits),
            num(w.leads),
            num(w.accepted),
            num(w.paid),
            money(w.revenue),
            money(w.profit),
            pct(w.marginPct),
          ]),
        )
      : '_Недельных агрегатов нет._',
  );

  // ── system forecast ──────────────────────────────────────────────────────
  add(
    '# SYSTEM-GENERATED FORECAST',
    '',
    model.forecast.available
      ? [
          table(
            ['Горизонт', 'Показатель', 'Оценка'],
            model.forecast.horizons.map((h) => [
              h.horizon,
              h.metric,
              h.metric === 'Выручка' || h.metric === 'Прибыль'
                ? money(h.value)
                : num(h.value),
            ]),
          ),
          '',
          '```text',
          `Метод:       ${model.forecast.method}`,
          `Уверенность: ${model.forecast.confidence}`,
          'Ограничения:',
          ...model.forecast.limitations.map((l) => `  - ${l}`),
          '```',
          '',
          '_Это оценка по недавней динамике, а не обязательство и не факт._',
        ].join('\n')
      : `\`\`\`text\n${model.forecast.reason ?? 'INSUFFICIENT HISTORY FOR RELIABLE FORECAST'}\n\`\`\``,
  );

  // ── decision context ─────────────────────────────────────────────────────
  add(
    '# DECISION CONTEXT',
    '',
    '## Current strengths',
    ...(model.strengths.length
      ? model.strengths.map((s) => `- ${s}`)
      : ['- нет фактических улучшений в периоде']),
    '',
    '## Current weaknesses',
    ...(model.weaknesses.length
      ? model.weaknesses.map((s) => `- ${s}`)
      : ['- нет фактических ухудшений в периоде']),
    '',
    '## Constraints',
    ...model.constraints.map((s) => `- ${s}`),
    '',
    '## Open questions',
    ...model.openQuestions.map((s) => `- ${s}`),
  );

  // ── определения ──────────────────────────────────────────────────────────
  add(
    '# METRIC DEFINITIONS',
    '',
    '```text',
    'Визит (visit): сессия на сайте по данным Яндекс.Метрики.',
    'Посетители за период (periodUsers): уникальные посетители за весь период —',
    '  отдельный запрос к Метрике, а не сумма дневных значений.',
    'Просмотры (pageviews): просмотры страниц по данным сессий.',
    'Заявка с сайта (siteLead): достижение цели «заявка» на сайте.',
    'Заявка CRM (crmLead): заказ, заведённый в статусе LEAD (обращение без подтверждения).',
    'Принят в работу (accepted): заказ перешёл в рабочий статус (NEW и далее по потоку).',
    'Оплачен (paid): заказ переведён в статус «Оплачен» — деньги от клиента получены.',
    'Дата оплаты (clientPaidAt): фактическая дата получения денег. Ставится при ручном',
    '  переводе в «Оплачен» или указывается администратором отдельно. Перевод заказа в',
    '  «Оплачен» при выплате зарплаты исполнителю дату НЕ проставляет — расчёт с',
    '  сотрудником не является оплатой клиента.',
    'paidWithoutDate: оплаченные заказы без даты оплаты. Выручка таких заказов признаётся',
    '  по дате отгрузки (правило признания ниже). Суммы верны, смещаются только когорты.',
    'Реализованная выручка (realizedRevenue): выручка заказов, признанных в периоде.',
    '  Дата признания = дата оплаты, иначе дата завершения, иначе смена статуса, иначе',
    '  отгрузка, иначе создание заказа.',
    'Себестоимость (COGS): прямые расходы заказа — заготовки, печать, термоперенос,',
    '  упаковка, прочие прямые расходы, доставка перевозчику.',
    'Валовая маржа (grossContribution): выручка − себестоимость.',
    'Прибыль (netProfit): валовая маржа − начисленная зарплата − операционные расходы',
    '  + прибыль доставки. Методика отчёта владельца, не бухгалтерская чистая прибыль.',
    'Маржа (marginPct): прибыль / выручка × 100.',
    'Средний чек (AOV): сумма заказов / количество заказов; отдельно для принятых и',
    '  для оплаченных.',
    'ClientID: идентификатор браузера в Метрике. Единственный ключ связи «визит → заказ».',
    'Покрытие ClientID: доля принятых заказов, у которых ClientID известен.',
    'yclid: метка клика Яндекс.Директа, сохраняется у заявки с сайта.',
    'Сопоставленные метрики (matchedAccepted / matchedPaid): считаются только по заказам',
    '  с известным ClientID — это подмножество заказов CRM.',
    'Происхождение заказа (order origin): откуда заказ взялся — WEBSITE (заявку создал',
    '  сайт), AVITO / OZON / WB / LOCAL (заказ заведён в CRM вручную), UNKNOWN (по истории',
    '  не доказано). Это не источник рекламы: маркетинговая атрибуция (визиты, UTM, yclid,',
    '  ClientID) — отдельное измерение, и смешивать их нельзя.',
    'orderOriginCoveragePct: доля заказов периода, чьё происхождение известно (не UNKNOWN).',
    'Отвал (drop-off): разница между соседними шагами воронки.',
    'INCOMPARABLE: вердикт оценки изменения — периоды «до» и «после» несопоставимы.',
    'NOT_ESTABLISHED: причинная связь не доказана (наблюдательное сравнение).',
    '```',
  );

  // ── инструкция для ИИ ────────────────────────────────────────────────────
  add(
    '# INSTRUCTIONS FOR AI ANALYST',
    '',
    '```text',
    'Проанализируй данные этого отчёта как бизнес-аналитик.',
    '',
    'Не придумывай отсутствующие данные и не делай причинных выводов без доказательств.',
    '',
    'Обязательные правила при разборе каналов (раздел ORDER ORIGIN):',
    '- конверсию сайта считай только по заказам WEBSITE;',
    '- все заказы CRM на визиты сайта не дели: ручные заказы сайт не создавал;',
    '- рост Avito не считай ростом эффективности сайта;',
    '- заказы UNKNOWN не приписывай ни сайту, ни Avito;',
    '- происхождение заказа и источник рекламы — разные измерения.',
    '',
    'Дай:',
    '',
    '1. Краткое состояние бизнеса.',
    '2. Что улучшилось.',
    '3. Что ухудшилось.',
    '4. Самые серьёзные проблемы.',
    '5. Возможные причины, разделив:',
    '   - доказанные;',
    '   - вероятные гипотезы.',
    '6. Точки роста.',
    '7. Что стоит сделать в первую очередь.',
    '8. Что не стоит менять.',
    '9. Какие дополнительные данные нужно начать собирать.',
    '10. Прогноз на:',
    '    - 7 дней;',
    '    - 30 дней;',
    '   если данных для прогноза достаточно.',
    '11. Для каждого прогноза укажи уровень уверенности.',
    '12. Составь TOP-5 действий по потенциальному влиянию на бизнес.',
    '',
    'Для каждой рекомендации укажи:',
    '- на какие данные она опирается;',
    '- ожидаемый эффект;',
    '- что измерить после внедрения;',
    '- через какой срок оценивать результат.',
    '',
    'Отдельно укажи:',
    '- где вывод основан на факте;',
    '- где это гипотеза;',
    '- где данных недостаточно.',
    '```',
  );

  return (
    out
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trimEnd() + '\n'
  );
}
