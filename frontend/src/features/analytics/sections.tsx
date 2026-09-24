import { useState, type ReactNode } from 'react';
import type {
  CrmSlice,
  DeviceRow,
  LandingRow,
  MatchedFunnelRates,
  Overview,
  ProductRow,
  SalesChannelRow,
  Slice,
  SourceRow,
  UtmRow,
} from '../../types/analytics';
import {
  attentionCards,
  CHANNEL_LABELS,
  coverageIsLow,
  COVERAGE_WARNING,
  DEVICE_LABELS,
  formatAgo,
  formatCount,
  formatMoney,
  formatPercent,
  FRESHNESS_LABELS,
  labelOf,
  MATCHING_INSUFFICIENT,
  matchingInsufficient,
  NO_UTM_LABEL,
  PRODUCT_LABELS,
} from './analytics-view';
import { Card, Hint, Notice, StateBlock, TableWrap, Td, Th } from './ui';

/**
 * Блоки дашборда (этап 09, разделы 10–13, 15–21, 27): две воронки, которые
 * нельзя рисовать одной линией, таблицы источников/UTM/страниц/устройств по
 * сопоставленной воронке Метрики, товары и каналы продаж по CRM, качество
 * данных и «Требует внимания».
 */

// ── Воронки ────────────────────────────────────────────────────────────────

function FunnelStep({ label, value, conversion, conversionLabel, muted }: { label: string; value: string; conversion?: string; conversionLabel?: string; muted?: boolean }) {
  return (
    <li className="flex items-center gap-3">
      <div className={`flex-1 rounded-lg px-3 py-2 ${muted ? 'bg-gray-50' : 'bg-indigo-50'}`}>
        <div className="text-xs text-gray-500">{label}</div>
        <div className={`text-lg font-bold tabular-nums ${muted ? 'text-gray-500' : 'text-gray-900'}`}>{value}</div>
      </div>
      {conversion !== undefined && (
        <div className="w-24 sm:w-28 text-right">
          <div className="text-[11px] text-gray-400 leading-tight">{conversionLabel}</div>
          <div className="text-sm font-semibold text-gray-700 tabular-nums">{conversion}</div>
        </div>
      )}
    </li>
  );
}

export function SiteFunnel({ o }: { o: Overview }) {
  const f = o.siteFunnel;
  const insufficient = matchingInsufficient(o);
  return (
    <Card title="Воронка сайта" subtitle="Сопоставлено через Метрику/ClientID — только заказы, которые Метрика связала с визитом">
      <ol className="space-y-2">
        <FunnelStep label="Визиты" value={formatCount(f.visits)} />
        <FunnelStep label="Заявки сайта" value={formatCount(f.siteLeads)} conversion={formatPercent(f.siteLeadConversion)} conversionLabel="визит → заявка" />
        {/* Счётчики — как есть (это реальные достижения целей в Метрике); прячем
            только конверсии: при пустой базе сопоставления они не «0 %», их нет. */}
        <FunnelStep
          label="Сопоставленные принятые заказы"
          value={formatCount(f.matchedAccepted)}
          conversion={insufficient ? '—' : formatPercent(f.siteLeadToAccepted)}
          conversionLabel="заявка → заказ"
          muted={insufficient}
        />
        <FunnelStep
          label="Сопоставленные оплаты"
          value={formatCount(f.matchedPaid)}
          conversion={insufficient ? '—' : formatPercent(f.siteAcceptedToPaid)}
          conversionLabel="заказ → оплата"
          muted={insufficient}
        />
      </ol>
      <div className="mt-3 space-y-2">
        {insufficient && <Notice warning={{ code: 'matching', text: MATCHING_INSUFFICIENT, tooltip: 'Заказов с ClientID, отправленных в Метрику, за период нет — сопоставленную конверсию посчитать не из чего. Это не 0 %.' }} tone="gray" />}
        {coverageIsLow(o) && <Notice warning={COVERAGE_WARNING} />}
      </div>
    </Card>
  );
}

export function CrmFunnel({ o }: { o: Overview }) {
  const e = o.crmFunnel.events;
  const c = o.crmFunnel.cohorts;
  return (
    <Card title="Воронка CRM" subtitle="Все заказы: сайт, Avito, созданные вручную — основной бизнес-показатель">
      <ol className="space-y-2">
        <FunnelStep label="CRM-заявки" value={formatCount(e.crmLeads)} />
        <FunnelStep label="Принятые заказы" value={formatCount(e.acceptedOrders)} conversion={formatPercent(c.crmLeadToAccepted)} conversionLabel="из заявок периода" />
        <FunnelStep label="Оплаченные заказы" value={formatCount(e.paidOrders)} conversion={formatPercent(c.crmAcceptedToPaid)} conversionLabel="из принятых периода" />
      </ol>
      <p className="mt-3 text-[11px] text-gray-400">
        Конверсии — по когорте: доля заявок (заказов) этого периода, которые когда-либо стали заказом (оплатой). Отменено за период: {formatCount(e.cancelledOrders)}
        {c.crmCancellationRate !== null && ` (${formatPercent(c.crmCancellationRate)} принятых)`}.
      </p>
    </Card>
  );
}

// ── Таблицы по сопоставленной воронке ──────────────────────────────────────

function RateCells({ r }: { r: MatchedFunnelRates }) {
  return (
    <>
      <Td right>{formatCount(r.visits)}</Td>
      <Td right>{formatCount(r.siteLeads)}</Td>
      <Td right dim={r.matchedAccepted === 0}>{formatCount(r.matchedAccepted)}</Td>
      <Td right dim={r.matchedPaid === 0}>{formatCount(r.matchedPaid)}</Td>
      <Td right>{formatPercent(r.visitToLead)}</Td>
      <Td right dim={r.visitToAccepted === null || r.visitToAccepted === 0}>{formatPercent(r.visitToAccepted)}</Td>
    </>
  );
}

function RateHead({ first }: { first: string }) {
  return (
    <thead className="bg-gray-50">
      <tr>
        <Th>{first}</Th>
        <Th right>Визиты</Th>
        <Th right>Заявки</Th>
        <Th right>Сопост. заказы</Th>
        <Th right>Сопост. оплаты</Th>
        <Th right>Конв. в заявку</Th>
        <Th right>Конв. в заказ</Th>
      </tr>
    </thead>
  );
}

function TotalsRow({ label, t }: { label: string; t: MatchedFunnelRates }) {
  return (
    <tr className="bg-gray-50 font-semibold border-t-2 border-gray-200">
      <Td>{label}</Td>
      <RateCells r={t} />
    </tr>
  );
}

function SliceCard<Row>({ title, subtitle, slice, first, rowKey, rowLabel, limit }: { title: string; subtitle?: ReactNode; slice: Slice<Row & MatchedFunnelRates> | undefined; first: string; rowKey: (r: Row) => string; rowLabel: (r: Row) => ReactNode; limit?: number }) {
  const [all, setAll] = useState(false);
  if (!slice) return <Card title={title}><StateBlock kind="loading" /></Card>;
  const rows = limit && !all ? slice.rows.slice(0, limit) : slice.rows;
  return (
    <Card title={title} subtitle={subtitle}>
      {slice.rows.length === 0 ? (
        <StateBlock kind="empty" />
      ) : (
        <>
          <TableWrap>
            <RateHead first={first} />
            <tbody>
              {rows.map((r) => (
                <tr key={rowKey(r)} className="border-b border-gray-100">
                  <Td>{rowLabel(r)}</Td>
                  <RateCells r={r} />
                </tr>
              ))}
              <TotalsRow label="Итого" t={slice.totals} />
            </tbody>
          </TableWrap>
          {limit && slice.rows.length > limit && (
            <button type="button" onClick={() => setAll((v) => !v)} className="mt-3 text-xs font-medium text-indigo-600 hover:underline">
              {all ? 'Свернуть' : `Показать все (${slice.rows.length})`}
            </button>
          )}
        </>
      )}
    </Card>
  );
}

export function SourcesTable({ slice }: { slice?: Slice<SourceRow> }) {
  return (
    <SliceCard
      title="Источники трафика"
      subtitle="Откуда пришли визиты по Метрике (последний значимый переход). Это не канал продаж CRM."
      slice={slice}
      first="Источник"
      rowKey={(r) => `${r.trafficSource}|${r.sourceEngine}`}
      rowLabel={(r) => (
        <span>
          <span className="font-medium text-gray-800">{r.trafficSourceName || '—'}</span>
          {r.sourceEngineName && <span className="text-gray-400"> · {r.sourceEngineName}</span>}
        </span>
      )}
      limit={15}
    />
  );
}

export function UtmTable({ slice }: { slice?: Slice<UtmRow> }) {
  const v = (s: string) => (s === 'NO_UTM' ? NO_UTM_LABEL : s);
  return (
    <SliceCard
      title="UTM-метки"
      subtitle="Метки визитов из Метрики; визиты без меток — отдельная строка «Без UTM», они входят в итог"
      slice={slice}
      first="utm_source / medium / campaign"
      rowKey={(r) => [r.utmSource, r.utmMedium, r.utmCampaign, r.utmContent, r.utmTerm].join('|')}
      rowLabel={(r) => (
        <span className={r.isNoUtm ? 'text-gray-500' : 'text-gray-800'}>
          {v(r.utmSource)} <span className="text-gray-400">/ {v(r.utmMedium)} / {v(r.utmCampaign)}</span>
        </span>
      )}
      limit={15}
    />
  );
}

export function LandingsTable({ slice }: { slice?: Slice<LandingRow> }) {
  return (
    <SliceCard title="Страницы входа" subtitle="С какой страницы начинались визиты" slice={slice} first="Страница входа" rowKey={(r) => r.normalizedPath} rowLabel={(r) => <span className="font-mono text-xs text-gray-800 break-all">{r.normalizedPath}</span>} limit={15} />
  );
}

export function DevicesTable({ slice }: { slice?: Slice<DeviceRow> }) {
  return <SliceCard title="Устройства" slice={slice} first="Устройство" rowKey={(r) => r.deviceCategory} rowLabel={(r) => DEVICE_LABELS[r.deviceCategory] ?? r.deviceCategory} />;
}

// ── Товары и каналы (CRM) ──────────────────────────────────────────────────

export function ProductsBlock({ slice }: { slice?: CrmSlice<ProductRow> }) {
  if (!slice) return <Card title="Товары"><StateBlock kind="loading" /></Card>;
  const unreliable = slice.quality.notes.includes('COGS_UNRELIABLE_ORDERS');
  return (
    <Card title="Товары" subtitle="По категории заказа в CRM: фото, футболки, холсты">
      <TableWrap>
        <thead className="bg-gray-50">
          <tr>
            <Th>Товар</Th>
            <Th right>Принято</Th>
            <Th right>Оплачено</Th>
            <Th right>Сумма принятых</Th>
            <Th right>Сумма оплаченных</Th>
            <Th right>Себестоимость</Th>
            <Th right>
              <span className="inline-flex items-center gap-1 justify-end">Валовой вклад <Hint text={labelOf('grossContribution').tooltip} label="Валовой вклад" /></span>
            </Th>
            <Th right>Средний чек</Th>
          </tr>
        </thead>
        <tbody>
          {slice.rows.map((r) => (
            <tr key={r.productCategory} className="border-b border-gray-100">
              <Td>
                <span className="font-medium">{PRODUCT_LABELS[r.productCategory] ?? r.productCategory}</span>
              </Td>
              <Td right>{formatCount(r.acceptedOrders)}</Td>
              <Td right>{formatCount(r.paidOrders)}</Td>
              <Td right>{formatMoney(r.contractValue)}</Td>
              <Td right>{formatMoney(r.paidOrderValue)}</Td>
              <Td right dim={r.cogsReliableOrders < r.acceptedOrders}>
                {formatMoney(r.cogs)}
                {r.cogsReliableOrders < r.acceptedOrders && <span className="text-[10px] text-amber-700 ml-1">неполно</span>}
              </Td>
              <Td right>{formatMoney(r.grossContribution)}</Td>
              <Td right>{formatMoney(r.paidAov)}</Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      <p className="mt-3 text-[11px] text-gray-400">
        Валовой вклад = сумма принятых заказов − себестоимость; это не прибыль. Прибыль по категориям — в блоке «Деньги» по правилам финансового отчёта.
        {unreliable && ' У части заказов нет позиций — себестоимость по ним не посчитана.'}
      </p>
    </Card>
  );
}

export function SalesChannelsBlock({ slice }: { slice?: CrmSlice<SalesChannelRow> }) {
  if (!slice) return <Card title="Каналы заказов"><StateBlock kind="loading" /></Card>;
  const unknown = slice.rows.find((r) => r.salesChannel === 'UNKNOWN');
  const hasUnknown = Boolean(unknown && (unknown.acceptedOrders > 0 || unknown.crmLeads > 0 || (unknown.realizedOrders ?? 0) > 0));
  return (
    <Card
      title="Каналы заказов"
      subtitle="Откуда заказ взялся: заявку создал сайт или её завели в CRM вручную (Avito, маркетплейсы). Это не источник рекламы — откуда пришёл человек, показывает блок «Источники визитов»."
    >
      <TableWrap>
        <thead className="bg-gray-50">
          <tr>
            <Th>Канал</Th>
            <Th right>Заявки</Th>
            <Th right>Принято</Th>
            <Th right>Оплачено</Th>
            <Th right>Выручка</Th>
            <Th right>Себестоимость</Th>
            <Th right>Прибыль</Th>
            <Th right>Средний чек</Th>
          </tr>
        </thead>
        <tbody>
          {slice.rows.map((r) => (
            <tr key={r.salesChannel} className="border-b border-gray-100">
              <Td>
                <span className="font-medium">{CHANNEL_LABELS[r.salesChannel] ?? r.salesChannel}</span>
              </Td>
              <Td right dim={r.crmLeads === 0}>{formatCount(r.crmLeads)}</Td>
              <Td right dim={r.acceptedOrders === 0}>{formatCount(r.acceptedOrders)}</Td>
              <Td right dim={r.paidOrders === 0}>{formatCount(r.paidOrders)}</Td>
              <Td right dim={!r.realizedRevenue}>{formatMoney(r.realizedRevenue)}</Td>
              <Td right dim={!r.cogs}>{formatMoney(r.cogs)}</Td>
              <Td right dim={!r.grossProfit}>{formatMoney(r.grossProfit)}</Td>
              <Td right>{formatMoney(r.averageCheck)}</Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      <p className="mt-3 text-[11px] text-gray-400">
        Прибыль канала — валовая: выручка за товар минус себестоимость заказов. Зарплата, реклама и прочие расходы бизнеса по каналам не делятся, поэтому чистая прибыль остаётся одна на весь бизнес (блок «Деньги»).
        {hasUnknown && ' Строка «Не определён» — старые заказы, происхождение которых по истории не доказано; они не приписаны ни сайту, ни Avito.'}
      </p>
    </Card>
  );
}

// ── Деньги подробно ────────────────────────────────────────────────────────

function MoneyRow({ k, value, hint }: { k: string; value: string; hint?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-600 inline-flex items-center gap-1">
        {labelOf(k).label || k}
        <Hint text={hint ?? labelOf(k).tooltip} label={labelOf(k).label} />
      </span>
      <span className="text-sm font-semibold text-gray-900 tabular-nums">{value}</span>
    </div>
  );
}

export function MoneyDetails({ o }: { o: Overview }) {
  const f = o.financials;
  const r = f.realized;
  return (
    <Card title="Деньги подробно" subtitle="Три разные суммы — по принятым, по оплаченным и по правилам финансового отчёта">
      <div className="grid sm:grid-cols-2 gap-x-8">
        <div>
          <MoneyRow k="contractValue" value={formatMoney(f.contract.contractValue)} />
          <MoneyRow k="paidOrderValue" value={formatMoney(f.paid.paidOrderValue)} />
          <MoneyRow k="grossContribution" value={formatMoney(f.contract.grossContribution)} hint={`${labelOf('grossContribution').tooltip} База — сумма принятых заказов.`} />
        </div>
        <div>
          {r ? (
            <>
              <MoneyRow k="realizedRevenue" value={formatMoney(r.realizedRevenue)} />
              <MoneyRow k="cogs" value={formatMoney(r.cogs)} />
              <MoneyRow k="netProfit" value={formatMoney(r.netProfit)} />
            </>
          ) : (
            <p className="text-sm text-gray-400 py-2">Финансовый отчёт за период недоступен</p>
          )}
        </div>
      </div>
      {r && (
        <p className="mt-3 text-[11px] text-gray-400">
          Прибыль по товарам: фото {formatMoney(r.byCategory.photo.profit)}, футболки {formatMoney(r.byCategory.tshirt.profit)}, холсты {formatMoney(r.byCategory.canvas.profit)} · зарплата начисленная{' '}
          {formatMoney(r.salaryAccrued)} · расходы {formatMoney(r.operatingExpenses)} · заработок на доставке {formatMoney(r.deliveryProfit)} · маржа {formatPercent(r.marginPct)}
        </p>
      )}
    </Card>
  );
}

// ── Качество данных и внимание ─────────────────────────────────────────────

function QualityItem({ k, value, sub }: { k: string; value: ReactNode; sub?: string }) {
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-2">
      <div className="text-xs text-gray-500 inline-flex items-center gap-1">
        {labelOf(k).label}
        <Hint text={labelOf(k).tooltip} label={labelOf(k).label} />
      </div>
      <div className="text-sm font-semibold text-gray-900 tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-gray-400">{sub}</div>}
    </div>
  );
}

export function DataQualityPanel({ o }: { o: Overview }) {
  const q = o.dataQuality;
  const f = o.financials.contract;
  const cogsShare = f.orders > 0 ? (f.cogsReliableOrders / f.orders) * 100 : null;
  const status = q.freshness.status;
  const tone = status === 'FRESH' ? 'text-emerald-700 bg-emerald-50' : status === 'STALE' ? 'text-amber-700 bg-amber-50' : 'text-rose-700 bg-rose-50';
  return (
    <Card title="Качество данных" subtitle="Насколько цифрам выше можно доверять">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <div className="rounded-lg bg-gray-50 px-3 py-2">
          <div className="text-xs text-gray-500">Свежесть данных</div>
          <div className={`inline-block mt-0.5 rounded-md px-1.5 py-0.5 text-xs font-semibold ${tone}`}>{FRESHNESS_LABELS[status]}</div>
          <div className="text-[11px] text-gray-400 mt-0.5">Последняя синхронизация: {formatAgo(q.freshness.metrikaDataAgeSeconds)}</div>
        </div>
        <QualityItem k="clientIdCoverage" value={formatPercent(q.clientIdCoverageAccepted)} sub={`оплаченные: ${formatPercent(q.clientIdCoveragePaid)}; готовы к сопоставлению: ${formatCount(q.eligibleAccepted)}`} />
        <QualityItem k="cogsReliability" value={formatPercent(cogsShare)} sub={`${formatCount(f.cogsReliableOrders)} из ${formatCount(f.orders)} принятых`} />
        <QualityItem k="paidWithoutDate" value={formatCount(q.paidWithoutDate)} sub="среди принятых в периоде" />
      </div>
      <dl className="mt-3 text-[11px] text-gray-400 space-y-0.5">
        <div>Заявки сайта считаются полностью с 13 сентября 2026; Метрика собирает данные с {o.metadata.cutovers.counterDataSince.split('-').reverse().join('.')}.</div>
        <div>Посетители периода — {q.snapshotAvailable ? 'из снимка Метрики' : 'снимка нет, показан прочерк'}; часовой пояс — Europe/Moscow.</div>
      </dl>
    </Card>
  );
}

export function AttentionCards({ o }: { o: Overview }) {
  const cards = attentionCards(o);
  if (cards.length === 0) return null;
  return (
    <Card title="Требует внимания" subtitle="Правила по цифрам, без объяснения причин">
      <ul className="grid sm:grid-cols-2 gap-2">
        {cards.map((c) => (
          <li key={c.code} className={`rounded-lg border px-3 py-2 ${c.tone === 'negative' ? 'border-rose-200 bg-rose-50' : 'border-amber-200 bg-amber-50'}`}>
            <div className={`text-sm font-semibold ${c.tone === 'negative' ? 'text-rose-800' : 'text-amber-800'}`}>{c.title}</div>
            <div className="text-xs text-gray-700 mt-0.5">{c.text}</div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
