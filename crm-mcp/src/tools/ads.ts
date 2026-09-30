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

export const adSpend: Tool = {
  name: 'ad_spend',
  title: 'Расход на рекламу',
  description:
    'Сколько потрачено на рекламу за период, по кампаниям: расход, клики, показы, цена клика, CTR. ' +
    'Отвечает на «куда ушёл бюджет» и «не подорожал ли клик». ' +
    'Данные из выгрузки кабинета, которую владелец загружает вручную (npm run ads:import) — за дни без загрузки расхода не будет, ' +
    'и это не нулевой расход, а отсутствующие данные. Заявок и заказов тут нет: они в ad_economics.',
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
    }>(
      `SELECT CASE WHEN a."campaignName" <> '' THEN a."campaignName"
                   WHEN a."campaignId" <> '' THEN 'кампания ' || a."campaignId"
                   ELSE 'без разбивки по кампаниям' END AS campaign,
              count(DISTINCT a.date)::int AS dney,
              COALESCE(sum(a.spend), 0)::int AS spend,
              COALESCE(sum(a.clicks), 0)::int AS clicks,
              COALESCE(sum(a.impressions), 0)::int AS impressions
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
        `Показы: ${int(impressions)} · CTR: ${share(clicks, impressions)}`,
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
          int(r.impressions),
          share(r.clicks, r.impressions),
        ]),
      ),
      note: 'Расход с НДС — как в кабинете.',
    });
  },
};

export const adEconomics: Tool = {
  name: 'ad_economics',
  title: 'Окупается ли реклама',
  description:
    'Главный вопрос по рекламе: расход против заявок и оплаченных заказов с рекламы — цена заявки, цена заказа, доля рекламы в выручке (ДРР). ' +
    'Рекламной считается заявка с меткой клика Директа (yclid). Заявки с utm, но без метки, показаны отдельно и в расчёт цены не входят. ' +
    'Заказы, заведённые руками (Авито, маркетплейсы, самотёк), рекламными не считаются никогда.',
  schema: { ...periodSchema },
  async run(args) {
    const period = resolvePeriod(args as { from?: string; to?: string });
    const [from, to] = sqlRange(period);

    const spendRows = await read<{ spend: number; clicks: number }>(
      `SELECT COALESCE(sum(a.spend), 0)::int AS spend, COALESCE(sum(a.clicks), 0)::int AS clicks
         FROM "AdSpend" a
        WHERE a.date >= $1::date AND a.date <= $2::date`,
      [period.from, period.to],
    );
    const spend = spendRows[0]?.spend ?? 0;
    const clicks = spendRows[0]?.clicks ?? 0;

    const leadRows = await read<{
      ad_zayavok: number;
      ad_zakazov: number;
      ad_oplacheno: number;
      ad_vyruchka: number;
      pohozhe_na_ad: number;
      sayt_vsego: number;
      bez_clientid: number;
    }>(
      `SELECT count(*) FILTER (WHERE ${AD_ORDER})::int AS ad_zayavok,
              count(*) FILTER (WHERE ${AD_ORDER} AND o.status NOT IN ('LEAD','CANCELLED'))::int AS ad_zakazov,
              count(*) FILTER (WHERE ${AD_ORDER} AND ${paidSql()})::int AS ad_oplacheno,
              COALESCE(sum(o."totalOrder") FILTER (WHERE ${AD_ORDER} AND ${paidSql()}), 0)::int AS ad_vyruchka,
              count(*) FILTER (WHERE ${AD_LIKE})::int AS pohozhe_na_ad,
              count(*)::int AS sayt_vsego,
              count(*) FILTER (WHERE o."yandexClientId" IS NULL OR o."yandexClientId" = '')::int AS bez_clientid
         FROM "OrderPhoto" o
        WHERE o."createdAt" >= $1 AND o."createdAt" < $2
          AND o."sourceOrder" = 'WEBSITE'`,
      [from, to],
    );

    const l = leadRows[0];
    if (!l) {
      return answer({
        title: 'Окупается ли реклама',
        period: period.label,
        summary: ['Не удалось собрать данные по заявкам.'],
      });
    }

    if (spend === 0 && l.ad_zayavok === 0) {
      return answer({
        title: 'Окупается ли реклама',
        period: period.label,
        summary: [
          'Ни расхода, ни заявок с меткой клика за период. Проверьте, загружена ли выгрузка кабинета за эти дни.',
          `Заявок с сайта всего: ${int(l.sayt_vsego)}, из них похожих на рекламу без метки: ${int(l.pohozhe_na_ad)}.`,
        ],
      });
    }

    return answer({
      title: 'Окупается ли реклама',
      period: period.label,
      table: table(
        ['показатель', 'значение'],
        [
          ['Расход', money(spend)],
          ['Клики по объявлениям', int(clicks)],
          ['Заявок с меткой клика', int(l.ad_zayavok)],
          ['Клик → заявка', share(l.ad_zayavok, clicks)],
          ['Цена заявки', per(spend, l.ad_zayavok)],
          ['Стали заказом', int(l.ad_zakazov)],
          ['Оплачено', int(l.ad_oplacheno)],
          ['Заявка → оплата', share(l.ad_oplacheno, l.ad_zayavok)],
          ['Цена оплаченного заказа', per(spend, l.ad_oplacheno)],
          ['Выручка с рекламы', money(l.ad_vyruchka)],
          ['ДРР (расход / выручка)', share(spend, l.ad_vyruchka)],
        ],
      ),
      summary: [
        `Заявок с сайта всего: ${int(l.sayt_vsego)} · с меткой клика: ${int(l.ad_zayavok)} · с utm, но без метки: ${int(l.pohozhe_na_ad)}`,
        `Без ClientID Метрики: ${int(l.bez_clientid)} — эти заявки Метрика к визиту не привяжет.`,
      ],
      note:
        'Выручка считается по заказам, созданным в периоде и уже оплаченным. Оплата приходит позже заявки, поэтому по свежим дням ДРР всегда выглядит хуже, чем окажется через две недели. ' +
        'Клик → заявка считается от кликов кабинета: часть кликов до сайта не доходит, и эта доля сюда не видна — смотрите site_traffic.',
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
