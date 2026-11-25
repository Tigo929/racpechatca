/**
 * Фундамент «Реклама»: сколько заплатили, что пришло и по какой цене.
 *
 * Правило привязки заказа к рекламе здесь одно и оно узкое: рекламным
 * считается заказ с заполненным yclid — меткой клика Яндекс.Директа,
 * которую сайт сохраняет в заявку. Всё остальное (utm_medium=cpc без
 * yclid, переход из письма с utm) показывается отдельной строкой, но
 * в цену заявки не попадает.
 *
 * Так сделано потому, что ошибка тут дороже пропуска: приписав рекламе
 * заявки, которые пришли сами, владелец увидит выдуманную окупаемость и
 * будет докладывать бюджет в кампанию, которая не работает. Недосчитать
 * заявки — потерять точность; насчитать лишние — потерять деньги.
 */

import { read } from '../db.js';
import { resolvePeriod, sqlRange } from '../period.js';
import { answer, int, money, per, share, table } from '../format.js';
import { paidSql } from '../statuses.js';
import { limitSchema, periodSchema, readLimit, type Tool } from './types.js';

/** Заказ пришёл с рекламы: есть метка клика Директа. */
const AD_ORDER = `o.yclid IS NOT NULL AND o.yclid <> ''`;
/** Похоже на рекламу, но метки клика нет: utm есть, yclid потерян. */
const AD_LIKE = `(o.yclid IS NULL OR o.yclid = '') AND o."utmMedium" IS NOT NULL AND o."utmMedium" <> ''`;
/** Заявка с рекламы Директа: метка клика или utm cpc от Яндекса (как на экране «Реклама»). */
const AD_LEAD = `(COALESCE(o.yclid, '') <> '' OR (lower(COALESCE(o."utmSource", '')) LIKE 'ya%' AND lower(COALESCE(o."utmMedium", '')) IN ('cpc','ppc')))`;

/**
 * НДС. Расход в CRM приходит из двух мест: API Метрики отдаёт суммы БЕЗ НДС
 * (vatBasis = EXCLUDED), ручные выгрузки кабинета — как в кабинете, то есть
 * с НДС (UNKNOWN). Разница — 20 %, и ровно настолько разъезжается цена
 * заявки, если сложить одно с другим и промолчать.
 *
 * Складывать всё равно приходится: разделить задним числом нельзя, у старых
 * строк основания не записано. Поэтому сумма одна, но в ответе всегда сказано,
 * из чего она собрана, — и если основания смешаны, это названо прямо.
 */
function vatNote(excluded: boolean, unknown: boolean): string {
  if (excluded && unknown) {
    return 'Внимание: расход собран из двух источников — часть без НДС (API Метрики), часть как в кабинете, с НДС (ручная выгрузка). Итог на 20 % неточен в той доле, что пришла с НДС; цена заявки и ДРР ниже настоящих.';
  }
  if (excluded) return 'Расход без НДС — так его отдаёт API Метрики. В кабинете те же дни выглядят на 20 % дороже.';
  if (unknown) return 'Расход как в ручной выгрузке кабинета, то есть с НДС.';
  return 'Основание по НДС у этих строк не записано.';
}

export const adSpend: Tool = {
  name: 'ad_spend',
  title: 'Расход на рекламу',
  description:
    'Сколько потрачено на рекламу за период, по кампаниям: расход, клики, показы, цена клика, CTR. ' +
    'Отвечает на «куда ушёл бюджет» и «не подорожал ли клик». ' +
    'Расход попадает в CRM из API Метрики (без НДС) или из ручной выгрузки кабинета (с НДС) — в ответе сказано, из чего собран итог. ' +
    'За дни без загрузки расхода не будет, и это не нулевой расход, а отсутствующие данные. Заявок и заказов тут нет: они в ad_economics.',
  schema: { ...periodSchema, limit: limitSchema },
  async run(args) {
    const period = resolvePeriod(args as { from?: string; to?: string });
    const limit = readLimit(args);

    const rows = await read<{
      campaign: string;
      dney: number;
      spend: number;
      clicks: number;
      impressions: number;
      /** Клики только тех строк, где есть показы: иначе CTR завышен. */
      clicks_s_pokazami: number;
      vat: string;
    }>(
      `SELECT CASE WHEN a."campaignName" <> '' THEN a."campaignName"
                   WHEN a."campaignId" <> '' THEN 'кампания ' || a."campaignId"
                   ELSE 'без разбивки по кампаниям' END AS campaign,
              count(DISTINCT a.date)::int AS dney,
              COALESCE(sum(a.spend), 0)::int AS spend,
              COALESCE(sum(a.clicks), 0)::int AS clicks,
              COALESCE(sum(a.impressions), 0)::int AS impressions,
              COALESCE(sum(a.clicks) FILTER (WHERE a.impressions IS NOT NULL), 0)::int AS clicks_s_pokazami,
              string_agg(DISTINCT a."vatBasis", ',') AS vat
         FROM "AdSpend" a
        WHERE a.date >= $1::date AND a.date <= $2::date
        GROUP BY campaign
        ORDER BY spend DESC
        LIMIT $3`,
      [period.from, period.to, limit],
    );

    if (rows.length === 0) {
      return answer({
        title: 'Расход на рекламу',
        period: period.label,
        summary: [
          'Данных о расходе за период нет. Расход попадает в CRM только из выгрузки кабинета — возможно, её не загружали.',
        ],
      });
    }

    const spend = rows.reduce((s, r) => s + r.spend, 0);
    const clicks = rows.reduce((s, r) => s + r.clicks, 0);
    const impressions = rows.reduce((s, r) => s + r.impressions, 0);
    const clicksWithImpressions = rows.reduce((s, r) => s + r.clicks_s_pokazami, 0);
    const vat = rows.flatMap((r) => (r.vat ?? '').split(',')).filter(Boolean);
    const covered = await read<{ dney: number }>(
      `SELECT count(DISTINCT a.date)::int AS dney
         FROM "AdSpend" a
        WHERE a.date >= $1::date AND a.date <= $2::date`,
      [period.from, period.to],
    );

    return answer({
      title: 'Расход на рекламу',
      period: period.label,
      summary: [
        `Потрачено: ${money(spend)} · клики: ${int(clicks)} · цена клика: ${per(spend, clicks)}`,
        `Показы: ${int(impressions)} · CTR: ${share(clicksWithImpressions, impressions)}`,
        `Данные есть за ${int(covered[0]?.dney ?? 0)} дней из периода.`,
      ],
      table: table(
        ['кампания', 'дней с данными', 'расход', 'клики', 'цена клика', 'показы', 'CTR'],
        rows.map((r) => [
          r.campaign,
          int(r.dney),
          money(r.spend),
          int(r.clicks),
          per(r.spend, r.clicks),
          r.impressions === 0 ? 'нет данных' : int(r.impressions),
          share(r.clicks_s_pokazami, r.impressions),
        ]),
      ),
      note:
        `${vatNote(vat.includes('EXCLUDED'), vat.includes('UNKNOWN'))} ` +
        'CTR считается только по строкам, где показы записаны: у части выгрузок их нет, и включать их клики в CTR означало бы завысить его.',
    });
  },
};

export const adEconomics: Tool = {
  name: 'ad_economics',
  title: 'Окупается ли реклама',
  description:
    'Главный вопрос по рекламе: расход против заявок, оплаченных заказов и выручки, пришедших С РЕКЛАМЫ — цена заявки, цена оплаченного заказа, доля расхода в выручке. ' +
    'Рекламной считается только заявка с меткой клика Директа (yclid или utm cpc от Яндекса); заявки с поиска и прямых заходов в знаменатель не попадают. ' +
    'Цены даны и без НДС (как в API), и с НДС (как в счёте). Разбивка по группам и ключам — на экране CRM «Аналитика → Реклама».',
  schema: { ...periodSchema },
  async run(args) {
    const period = resolvePeriod(args as { from?: string; to?: string });
    const [from, to] = sqlRange(period);

    const spendRows = await read<{ spend: number; clicks: number; dney: number; vat: string | null }>(
      `SELECT COALESCE(sum(a.spend), 0)::float AS spend,
              COALESCE(sum(a.clicks), 0)::int AS clicks,
              count(DISTINCT a.date)::int AS dney,
              string_agg(DISTINCT a."vatBasis", ',') AS vat
         FROM "AdSpend" a
        WHERE a.date >= $1::date AND a.date <= $2::date`,
      [period.from, period.to],
    );
    const spend = Math.round(spendRows[0]?.spend ?? 0);
    const clicks = spendRows[0]?.clicks ?? 0;
    const vat = (spendRows[0]?.vat ?? '').split(',').filter(Boolean);
    /** API Метрики отдаёт без НДС; ручные выгрузки — уже с НДС. */
    const spendVat = vat.length === 1 && vat[0] === 'EXCLUDED' ? Math.round(spend * 1.2) : spend;

    /** Заявки по цели Метрики — только визиты «по рекламе», не все источники. */
    const goalRows = await read<{ leads: number }>(
      `SELECT COALESCE(sum(s."leadReaches"), 0)::int AS leads
         FROM "MetrikaDailySource" s
        WHERE s.date >= $1::date AND s.date <= $2::date AND s."trafficSource" = 'ad'`,
      [period.from, period.to],
    );
    const metrikaLeads = goalRows[0]?.leads ?? 0;

    const siteRows = await read<{
      vsego: number;
      reklama: number;
      otmeneno: number;
      oplacheno: number;
      vyruchka: number;
      bez_metki_s_cid: number;
    }>(
      `SELECT count(*)::int AS vsego,
              count(*) FILTER (WHERE ${AD_LEAD})::int AS reklama,
              count(*) FILTER (WHERE ${AD_LEAD} AND o.status = 'CANCELLED')::int AS otmeneno,
              count(*) FILTER (WHERE ${AD_LEAD} AND o.status <> 'CANCELLED' AND ${paidSql()})::int AS oplacheno,
              COALESCE(sum(o."totalOrder") FILTER (WHERE ${AD_LEAD} AND o.status <> 'CANCELLED' AND ${paidSql()}), 0)::int AS vyruchka,
              count(*) FILTER (WHERE NOT (${AD_LEAD}) AND COALESCE(o."yandexClientId", '') <> '')::int AS bez_metki_s_cid
         FROM "OrderPhoto" o
        WHERE o."createdAt" >= $1 AND o."createdAt" < $2
          AND o."sourceOrder" = 'WEBSITE'`,
      [from, to],
    );
    const st = siteRows[0];
    if (!st) {
      return answer({ title: 'Окупается ли реклама', period: period.label, summary: ['Не удалось собрать данные по заказам сайта.'] });
    }

    if (spend === 0) {
      return answer({
        title: 'Окупается ли реклама',
        period: period.label,
        summary: [
          'Расхода за период в CRM нет — либо реклама не крутилась, либо расход не загрузился (проверьте data_health). Бесплатной рекламой это считать нельзя.',
          `Для справки: рекламных заявок ${int(st.reklama)}, из них оплачено ${int(st.oplacheno)}.`,
        ],
      });
    }

    const MIN_PAID = 5;
    const scarce = st.oplacheno < MIN_PAID;
    const shareVat = st.vyruchka > 0 ? share(spendVat, st.vyruchka) : '—';

    const rows: (string | number)[][] = [
      ['Расход без НДС / с НДС', `${money(spend)} / ${money(spendVat)}`],
      ['Клики', int(clicks)],
      ['Заявок с рекламы (метка клика в CRM)', int(st.reklama)],
      ['Цена заявки, с НДС', per(spendVat, st.reklama)],
      ['Заявок по цели Метрики в рекламных визитах', int(metrikaLeads)],
      ['Оплачено рекламных заказов', int(st.oplacheno)],
      ['Отменено', int(st.otmeneno)],
      ['Цена оплаченного заказа, с НДС', scarce ? `${per(spendVat, st.oplacheno)} — всего ${int(st.oplacheno)} оплат, это не показатель` : per(spendVat, st.oplacheno)],
      ['Выручка рекламных заказов', money(st.vyruchka)],
      ['Реклама от выручки (с НДС)', shareVat],
    ];

    return answer({
      title: 'Окупается ли реклама',
      period: period.label,
      summary: [
        `Заявок с сайта: ${int(st.vsego)}, из них с рекламы ${int(st.reklama)}. Расход данных есть за ${int(spendRows[0]?.dney ?? 0)} дн. периода.`,
        `Заявка с рекламы стоит ${per(spendVat, st.reklama)} с НДС, оплаченный заказ — ${per(spendVat, st.oplacheno)}; реклама съедает ${shareVat} выручки этих заказов.`,
        ...(st.bez_metki_s_cid > 0
          ? [`Ещё ${int(st.bez_metki_s_cid)} заявок без метки клика, но с ClientID: это поиск, прямые заходы или потерянная метка — к рекламе они не отнесены.`]
          : []),
      ],
      table: table(['показатель', 'значение'], rows),
      note:
        `${vatNote(vat.includes('EXCLUDED'), vat.includes('UNKNOWN'))} ` +
        'Оплачен — дата оплаты стоит или статус «Отправлен» и дальше (владелец: к отправке деньги уже получены). ' +
        'Заявки и оплаты считаются по дню заявки, поэтому за свежие дни оплат меньше, чем будет. Повторные заказы не учитываются. ' +
        'Цель Метрики видит только визиты с согласием на cookie — её число для справки, считать по нему цену заявки нельзя.',
    });
  },
};

export const adAttribution: Tool = {
  name: 'ad_attribution',
  title: 'Откуда заявки с сайта',
  description:
    'Заявки с сайта в разрезе utm-меток: источник, канал, кампания — сколько заявок, сколько стало заказами, сколько оплачено и на какую сумму. ' +
    'Отвечает на «какая кампания приносит заказы, а какая только клики». ' +
    'Расхода здесь нет (он в ad_spend): названия кампаний в кабинете и utm_campaign в ссылках совпадают не всегда, и делить одно на другое автоматически было бы выдумкой.',
  schema: { ...periodSchema, limit: limitSchema },
  async run(args) {
    const period = resolvePeriod(args as { from?: string; to?: string });
    const [from, to] = sqlRange(period);
    const limit = readLimit(args);

    const rows = await read<{
      utm_source: string;
      utm_medium: string;
      utm_campaign: string;
      zayavok: number;
      zakazov: number;
      oplacheno: number;
      vyruchka: number;
      s_metkoy: number;
    }>(
      `SELECT COALESCE(NULLIF(o."utmSource", ''), 'без метки') AS utm_source,
              COALESCE(NULLIF(o."utmMedium", ''), '—')         AS utm_medium,
              COALESCE(NULLIF(o."utmCampaign", ''), '—')       AS utm_campaign,
              count(*)::int AS zayavok,
              count(*) FILTER (WHERE o.status NOT IN ('LEAD','CANCELLED'))::int AS zakazov,
              count(*) FILTER (WHERE ${paidSql()})::int AS oplacheno,
              COALESCE(sum(o."totalOrder") FILTER (WHERE ${paidSql()}), 0)::int AS vyruchka,
              count(*) FILTER (WHERE ${AD_ORDER})::int AS s_metkoy
         FROM "OrderPhoto" o
        WHERE o."createdAt" >= $1 AND o."createdAt" < $2
          AND o."sourceOrder" = 'WEBSITE'
        GROUP BY utm_source, utm_medium, utm_campaign
        ORDER BY zayavok DESC
        LIMIT $3`,
      [from, to, limit],
    );

    if (rows.length === 0) {
      return answer({
        title: 'Откуда заявки с сайта',
        period: period.label,
        summary: ['За период заявок с сайта нет.'],
      });
    }

    const zayavok = rows.reduce((s, r) => s + r.zayavok, 0);

    return answer({
      title: 'Откуда заявки с сайта',
      period: period.label,
      summary: [`Заявок с сайта: ${int(zayavok)} в ${rows.length} сочетаниях меток`],
      table: table(
        ['источник', 'канал', 'кампания', 'заявок', 'заказов', 'оплачено', 'выручка', 'с меткой клика'],
        rows.map((r) => [
          r.utm_source,
          r.utm_medium,
          r.utm_campaign,
          int(r.zayavok),
          int(r.zakazov),
          int(r.oplacheno),
          money(r.vyruchka),
          int(r.s_metkoy),
        ]),
      ),
      note:
        'Метки берутся из заявки, то есть это последний переход перед обращением, а не первое знакомство с сайтом. «Без метки» — прямой заход, поиск или потерянные параметры.',
    });
  },
};

export const adTools = [adSpend, adEconomics, adAttribution];
