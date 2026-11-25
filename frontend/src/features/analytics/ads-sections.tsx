import { Fragment, useState } from 'react';
import type { AdDataQuality, AdPerformance, AdStats } from '../../types/ads';
import { formatCount, formatMoney, formatPeriod } from './analytics-view';
import { Card, Notice } from './ui';

/**
 * Экран «Реклама»: сколько стоит заявка и оплаченный заказ по кампании,
 * группе и ключу. Все числа посчитаны на сервере (computeAdPerformance);
 * здесь только раскраска и подписи.
 */

type Verdict = { tone: 'red' | 'amber' | 'green' | 'gray'; text: string };

/** Ниже этой суммы расход без заявок — ещё шум, а не вывод. */
const NOISE_SPEND = 500;

function verdict(s: AdStats): Verdict {
  if (s.spend === 0 && s.leads === 0) return { tone: 'gray', text: '—' };
  if (s.leads === 0) {
    return s.spend >= NOISE_SPEND ? { tone: 'red', text: 'тратит без заявок' } : { tone: 'gray', text: 'мало данных' };
  }
  if (s.paidOrders === 0) {
    return s.spend >= NOISE_SPEND ? { tone: 'amber', text: 'заявки без оплат' } : { tone: 'gray', text: 'мало данных' };
  }
  // Есть себестоимость — судим по деньгам, оставшимся после рекламы.
  if (s.marginAfterAds !== null && s.spend > 0) {
    if (s.marginAfterAds < 0) return { tone: 'red', text: 'реклама в минус' };
    if (s.romi !== null && s.romi < 30) return { tone: 'amber', text: 'почти в ноль' };
    return { tone: 'green', text: 'окупается' };
  }
  if (s.spendShare === null) return { tone: 'gray', text: '—' };
  if (s.spendShare > 100) return { tone: 'red', text: 'реклама дороже выручки' };
  if (s.spendShare > 50) return { tone: 'amber', text: 'дорого' };
  return { tone: 'green', text: 'окупается' };
}

const TONE: Record<Verdict['tone'], string> = {
  red: 'bg-rose-50 text-rose-700 border-rose-200',
  amber: 'bg-amber-50 text-amber-800 border-amber-200',
  green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  gray: 'bg-gray-50 text-gray-500 border-gray-200',
};

function Badge({ v }: { v: Verdict }) {
  return <span className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] ${TONE[v.tone]}`}>{v.text}</span>;
}

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-xl font-semibold text-gray-900 mt-1 tabular-nums">{value}</div>
      {note && <div className="text-[11px] text-gray-400 mt-0.5">{note}</div>}
    </div>
  );
}

const pct = (v: number | null) => (v === null ? '—' : `${v.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} %`);

function Cells({ s }: { s: AdStats }) {
  return (
    <>
      <td className="px-2 py-2 text-right tabular-nums">{formatMoney(s.spend)}</td>
      <td className="px-2 py-2 text-right tabular-nums">{formatCount(s.clicks)}</td>
      <td className="px-2 py-2 text-right tabular-nums">{formatCount(s.leads)}</td>
      <td className="px-2 py-2 text-right tabular-nums">{formatMoney(s.costPerLead)}</td>
      <td className="px-2 py-2 text-right tabular-nums">{formatCount(s.paidOrders)}</td>
      <td className="px-2 py-2 text-right tabular-nums">{formatMoney(s.costPerOrder)}</td>
      <td className="px-2 py-2 text-right tabular-nums">{formatMoney(s.revenue)}</td>
      <td className="px-2 py-2 text-right tabular-nums">{pct(s.spendShare)}</td>
      <td className={`px-2 py-2 text-right tabular-nums ${s.marginAfterAds !== null && s.marginAfterAds < 0 ? 'text-rose-700' : ''}`} title={s.paidWithoutCogs ? `у ${s.paidWithoutCogs} оплат нет себестоимости` : undefined}>
        {s.marginAfterAds === null && s.paidWithoutCogs ? 'нет себест.' : formatMoney(s.marginAfterAds)}
      </td>
      <td className="px-2 py-2">
        <Badge v={verdict(s)} />
      </td>
    </>
  );
}

export function AdsTab({ data }: { data: AdPerformance }) {
  const t = data.totals;
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setOpen((o) => ({ ...o, [id]: !(o[id] ?? true) }));

  const warnings: { code: string; text: string }[] = [];
  if (data.spendDays === 0) {
    warnings.push({ code: 'no-spend', text: 'Расхода по объявлениям за период нет: либо реклама не крутилась, либо данные ещё не загружены.' });
  } else if (data.spendLastDate && data.spendLastDate < data.period.to) {
    warnings.push({ code: 'spend-lag', text: `Расход загружен по ${formatPeriod(data.spendLastDate, data.spendLastDate)} — за последние дни он появится после ночной синхронизации.` });
  }
  if (t.leads > 0 && t.adLeadsWithKeyword < t.leads) {
    warnings.push({
      code: 'no-term',
      text: `У ${t.leads - t.adLeadsWithKeyword} из ${t.leads} рекламных заявок нет ключевого слова в метке — они показаны строкой «Ключ не передан» и в цену отдельных ключей не входят.`,
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tile label="Потрачено на рекламу" value={formatMoney(t.spend)} note={`с НДС · без НДС ${formatMoney(t.spendWithoutVat)}`} />
        <Tile label="Заявок с рекламы" value={formatCount(t.leads)} note={`из ${formatCount(t.siteLeads)} заявок с сайта`} />
        <Tile label="Цена заявки" value={formatMoney(t.costPerLead)} />
        <Tile label="Цена оплаченного заказа" value={formatMoney(t.costPerOrder)} note={`оплачено ${formatCount(t.paidOrders)} заказов`} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tile label="Выручка рекламных заказов" value={formatMoney(t.revenue)} note={`реклама — ${pct(t.spendShare)} выручки`} />
        <Tile label="Прибыль заказов до рекламы" value={formatMoney(t.marginBeforeAds)} note={t.paidWithoutCogs ? `не считается: у ${t.paidWithoutCogs} оплат нет себестоимости` : 'как в отчёте о прибыли'} />
        <Tile label="Осталось после рекламы" value={formatMoney(t.marginAfterAds)} note="прибыль заказов минус расход с НДС" />
        <Tile label="Отдача рекламы (ROMI)" value={pct(t.romi)} note="сколько осталось на каждый рубль рекламы" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tile label="Клики" value={formatCount(t.clicks)} note={`цена клика ${formatMoney(t.clicks ? Math.round(t.spend / t.clicks) : null)}`} />
        <Tile label="Заявки не с рекламы" value={formatCount(t.nonAdLeads)} note="поиск, прямые заходы, ссылки" />
      </div>

      {warnings.map((w) => (
        <Notice key={w.code} warning={w} />
      ))}

      <Card title="Кампании, группы и ключевые слова" subtitle="Нажмите на группу, чтобы свернуть ключи. Заявка привязана к ключу по метке клика — без догадок.">
        <div className="overflow-x-auto -mx-4 sm:-mx-5">
          <table className="min-w-[1080px] w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-100">
                <th className="px-2 py-2 text-left font-medium pl-4 sm:pl-5">Кампания / группа / ключ</th>
                <th className="px-2 py-2 text-right font-medium">Расход</th>
                <th className="px-2 py-2 text-right font-medium">Клики</th>
                <th className="px-2 py-2 text-right font-medium">Заявки</th>
                <th className="px-2 py-2 text-right font-medium">Цена заявки</th>
                <th className="px-2 py-2 text-right font-medium">Оплачено</th>
                <th className="px-2 py-2 text-right font-medium">Цена заказа</th>
                <th className="px-2 py-2 text-right font-medium">Выручка</th>
                <th className="px-2 py-2 text-right font-medium">Реклама от выручки</th>
                <th className="px-2 py-2 text-right font-medium">Осталось после рекламы</th>
                <th className="px-2 py-2 text-left font-medium">Итог</th>
              </tr>
            </thead>
            <tbody>
              {data.campaigns.map((c) => (
                <Fragment key={`c${c.id}`}>
                  <tr className="bg-gray-50 font-semibold text-gray-900 border-b border-gray-100">
                    <td className="px-2 py-2 pl-4 sm:pl-5">{c.name}</td>
                    <Cells s={c} />
                  </tr>
                  {c.groups.map((g) => {
                    const gid = `${c.id}:${g.id}`;
                    const isOpen = open[gid] ?? true;
                    return (
                      <Fragment key={gid}>
                        <tr className="border-b border-gray-100 font-medium text-gray-800">
                          <td className="px-2 py-2 pl-7 sm:pl-8">
                            <button type="button" onClick={() => toggle(gid)} aria-expanded={isOpen} className="text-left hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded">
                              <span aria-hidden="true" className="inline-block w-4 text-gray-400">{isOpen ? '▾' : '▸'}</span>
                              {g.name}
                            </button>
                          </td>
                          <Cells s={g} />
                        </tr>
                        {isOpen &&
                          g.keywords.map((k) => (
                            <tr key={`${gid}:${k.key}`} className="border-b border-gray-50 text-gray-600">
                              <td className="px-2 py-1.5 pl-12 sm:pl-14 max-w-[320px] truncate" title={k.label}>
                                {k.label}
                              </td>
                              <Cells s={k} />
                            </tr>
                          ))}
                      </Fragment>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <QualityCard q={data.quality} />

      <Card title="Как считается">
        <ul className="text-xs text-gray-600 space-y-1.5 list-disc pl-4">
          <li>Расход — из Директа через Метрику, показан с НДС 20 %: столько уходит со счёта.</li>
          <li>Рекламная заявка — заявка с сайта, в которой есть метка клика Директа. Ключ и объявление берутся из этой же метки, поэтому заявка привязана точно, без распределения «на глаз».</li>
          <li>Оплачен — как в отчёте о прибыли: стоит дата оплаты, или заказ оплачен/завершён/отгружен, или фото «Отправлено». У футболок и холстов «Отправлен» — это передача производителю, оплатой он не считается.</li>
          <li>Прибыль заказа — та же формула, что в отчёте о прибыли: выручка минус себестоимость (бумага, партнёр по футболкам, подрядчик по холстам) и начисленная зарплата, плюс заработок на доставке. Если у оплаченного заказа нет себестоимости, прибыль строки не считается вовсе, чтобы не показать выдуманную маржу.</li>
          <li>«Осталось после рекламы» — прибыль заказов минус расход с НДС. «Реклама в минус» — реклама съела больше, чем заработали на её заказах.</li>
          <li>Заявки и заказы считаются по дню заявки: заказ, оплаченный позже, всё равно относится к рекламе того периода. Поэтому за последние дни оплат меньше, чем будет потом.</li>
          <li>«Тратит без заявок» — потрачено от {NOISE_SPEND} ₽ и ни одной заявки. «Почти в ноль» — на каждый рубль рекламы осталось меньше 30 копеек.</li>
          <li>Повторные заказы тех же клиентов здесь пока не учитываются.</li>
        </ul>
      </Card>
    </div>
  );
}

function QualityRow({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-gray-600">{label}</span>
      <span className={`tabular-nums font-medium ${bad ? 'text-rose-700' : 'text-gray-900'}`}>{value}</span>
    </div>
  );
}

function QualityCard({ q }: { q: AdDataQuality }) {
  // Момент открытия экрана: «сейчас» не должно меняться от перерисовки.
  const [now] = useState(() => Date.now());
  const synced = q.metrikaSyncedAt ? new Date(q.metrikaSyncedAt) : null;
  const stale = !synced || now - synced.getTime() > 36 * 3600_000;
  return (
    <Card title="Качество данных" subtitle="Насколько можно верить цифрам выше">
      <div className="grid md:grid-cols-2 gap-x-8 text-sm">
        <div>
          <QualityRow label="Последняя загрузка из Метрики" value={synced ? synced.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }) : 'не было'} bad={stale} />
          <QualityRow label="Расход загружен по" value={q.spendLastDate ? formatPeriod(q.spendLastDate, q.spendLastDate) : 'нет данных'} bad={!q.spendLastDate} />
          <QualityRow label="Дней с расходом в периоде" value={`${q.spendDays} из ${q.periodDays}`} />
          <QualityRow label="Заказы ждут отправки в Метрику" value={formatCount(q.outboxPending)} />
          <QualityRow label="Заказы не ушли в Метрику (ошибка)" value={formatCount(q.outboxFailed)} bad={q.outboxFailed > 0} />
        </div>
        <div>
          <QualityRow label="Заявок с сайта / с меткой рекламы" value={`${formatCount(q.siteLeads)} / ${formatCount(q.adLeads)}`} />
          <QualityRow label="Без метки, но браузер известен" value={formatCount(q.leadsClientIdOnly)} />
          <QualityRow label="Источник неизвестен совсем" value={formatCount(q.leadsNoIdentity)} />
          <QualityRow label="Рекламных без ключа / без группы" value={`${formatCount(q.adLeadsWithoutKeyword)} / ${formatCount(q.adLeadsWithoutGroup)}`} bad={q.adLeads > 0 && q.adLeadsWithoutKeyword / q.adLeads > 0.3} />
          <QualityRow label="Оплат без себестоимости" value={formatCount(q.paidWithoutCogs)} bad={q.paidWithoutCogs > 0} />
        </div>
      </div>
    </Card>
  );
}
