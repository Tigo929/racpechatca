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
    'Главный вопрос по рекламе: расход против заявок, заказов и выручки сайта — цена заявки, цена заказа, ДРР. ' +
    'Отдаёт ДВА счёта заявок рядом: по достижениям цели Метрики (так считает дашборд CRM) и по метке клика в заказе (строгий счёт). ' +
    'Окупаемость (ДРР, отдача на рубль) показывает ТОЛЬКО если связь «реклама → заказ» доказана хотя бы на половине заказов сайта; ' +
    'иначе отказывается считать и говорит, почему — то же правило, что в аналитике CRM. Заказы, заведённые руками, рекламными не считаются никогда.',
  schema: { ...periodSchema },
  async run(args) {
    const period = resolvePeriod(args as { from?: string; to?: string });
    const [from, to] = sqlRange(period);

    const spendRows = await read<{ spend: number; clicks: number; vat: string | null }>(
      `SELECT COALESCE(sum(a.spend), 0)::int AS spend,
              COALESCE(sum(a.clicks), 0)::int AS clicks,
              string_agg(DISTINCT a."vatBasis", ',') AS vat
         FROM "AdSpend" a
        WHERE a.date >= $1::date AND a.date <= $2::date`,
      [period.from, period.to],
    );
    const spend = spendRows[0]?.spend ?? 0;
    const clicks = spendRows[0]?.clicks ?? 0;
    const vat = (spendRows[0]?.vat ?? '').split(',').filter(Boolean);

    /** Заявки по цели Метрики — тот же счёт, что у дашборда CRM. */
    const goalRows = await read<{ leads: number }>(
      `SELECT COALESCE(sum(s."leadReaches"), 0)::int AS leads
         FROM "MetrikaDailySource" s
        WHERE s.date >= $1::date AND s.date <= $2::date`,
      [period.from, period.to],
    );
    const metrikaLeads = goalRows[0]?.leads ?? 0;

    const siteRows = await read<{
      vsego: number;
      prinyato: number;
      s_lichnostyu: number;
      s_metkoy: number;
      oplacheno: number;
      oplacheno_bez_daty: number;
      vyruchka: number;
    }>(
      `SELECT count(*)::int AS vsego,
              count(*) FILTER (WHERE o.status <> 'LEAD')::int AS prinyato,
              count(*) FILTER (
                WHERE o.status <> 'LEAD'
                  AND (COALESCE(o."yandexClientId", '') <> '' OR COALESCE(o.yclid, '') <> '')
              )::int AS s_lichnostyu,
              count(*) FILTER (WHERE ${AD_ORDER})::int AS s_metkoy,
              count(*) FILTER (WHERE o."clientPaidAt" IS NOT NULL)::int AS oplacheno,
              count(*) FILTER (
                WHERE o."clientPaidAt" IS NULL
                  AND o.status IN ('PAID','READY_FOR_REVIEW','COMPLETED')
              )::int AS oplacheno_bez_daty,
              COALESCE(sum(o."totalOrder") FILTER (WHERE o."clientPaidAt" IS NOT NULL), 0)::int AS vyruchka
         FROM "OrderPhoto" o
        WHERE o."createdAt" >= $1 AND o."createdAt" < $2
          AND o."sourceOrder" = 'WEBSITE'`,
      [from, to],
    );

    const st = siteRows[0];
    if (!st) {
      return answer({
        title: 'Окупается ли реклама',
        period: period.label,
        summary: ['Не удалось собрать данные по заказам сайта.'],
      });
    }

    if (spend === 0) {
      return answer({
        title: 'Окупается ли реклама',
        period: period.label,
        summary: [
          'Расхода за период в CRM нет — окупаемость считать не из чего. Это отсутствующие данные, а не бесплатная реклама: возможно, выгрузку не загружали.',
          `Для справки: заявок по цели Метрики ${int(metrikaLeads)}, заказов с сайта ${int(st.vsego)}, из них оплачено ${int(st.oplacheno)}.`,
        ],
      });
    }

    /**
     * Покрытие атрибуции — доля заказов сайта, у которых есть ClientID или
     * метка клика. Ниже половины связь «реклама → заказ» не доказана, и тогда
     * ДРР не показывается вовсе: при покрытии в треть он означал бы
     * «реклама окупается», хотя две трети заказов отнесены к ней наугад.
     * Порог и правило взяты из crm-new/src/analytics/ads/ad-spend.ts,
     * чтобы агент и дашборд не спорили друг с другом.
     */
    const coverage = st.prinyato > 0 ? (st.s_lichnostyu / st.prinyato) * 100 : null;
    const reliable = coverage !== null && coverage >= 50;

    /**
     * Минимальное число оплаченных заказов, при котором ДРР о чём-то говорит.
     * Правило CRM про покрытие атрибуции проверяет, доказана ли связь, но не
     * размер выборки: ДРР, посчитанный по одному заказу, формально верен и
     * при этом бессмыслен — один крупный заказ делает рекламу «окупившейся»,
     * один мелкий хоронит её. Поэтому число остаётся, но рядом сказано,
     * на скольких заказах оно стоит.
     */
    const MIN_PAID_FOR_DRR = 5;
    /** «по 1 заказу», но «по 2 заказам»: показывается только при 1–4. */
    const zakazam = (n: number) => `${int(n)} ${n === 1 ? 'заказу' : 'заказам'}`;
    const scarce = st.oplacheno < MIN_PAID_FOR_DRR;
    const drr = !reliable
      ? 'считать нельзя — связь не доказана'
      : st.vyruchka === 0
        ? '—'
        : scarce
          ? `${share(spend, st.vyruchka)} — но посчитано по ${zakazam(st.oplacheno)}, это не показатель`
          : share(spend, st.vyruchka);

    const rows: (string | number)[][] = [
      ['Расход', money(spend)],
      ['Клики по объявлениям', int(clicks)],
      ['Заявки по цели Метрики', int(metrikaLeads)],
      ['Цена заявки по Метрике', per(spend, metrikaLeads)],
      ['Заявки с меткой клика в CRM', int(st.s_metkoy)],
      ['Цена заявки по метке', per(spend, st.s_metkoy)],
      ['Заказов с сайта принято', int(st.prinyato)],
      ['Цена принятого заказа', per(spend, st.prinyato)],
      ['Из них оплачено (есть дата оплаты)', int(st.oplacheno)],
      ['Оплачены по статусу, но без даты', int(st.oplacheno_bez_daty)],
      [
        'Цена оплаченного заказа',
        scarce ? `${per(spend, st.oplacheno)} — по ${zakazam(st.oplacheno)}` : per(spend, st.oplacheno),
      ],
      ['Выручка оплаченных заказов сайта', money(st.vyruchka)],
      ['ДРР (расход / выручка)', drr],
    ];

    return answer({
      title: 'Окупается ли реклама',
      period: period.label,
      summary: [
        reliable
          ? `Связь «реклама → заказ» доказана: ${coverage!.toFixed(0)} % заказов сайта имеют ClientID или метку клика (нужно от 50 %).`
          : `Связь «реклама → заказ» НЕ доказана: ${coverage === null ? 'заказов сайта за период нет' : `только ${coverage.toFixed(0)} % заказов сайта имеют ClientID или метку клика, нужно от 50 %`}. Окупаемость по таким данным не считается.`,
        `Заявок с сайта в CRM: ${int(st.vsego)} · принято в работу: ${int(st.prinyato)} · оплачено с датой: ${int(st.oplacheno)}`,
        ...(st.oplacheno_bez_daty > 0
          ? [
              `Ещё ${int(st.oplacheno_bez_daty)} заказов сайта оплачены по статусу, но без даты оплаты — в выручку периода они не попали, и ДРР из-за этого завышен. Дата ставится в CRM руками.`,
            ]
          : []),
      ],
      table: table(['показатель', 'значение'], rows),
      note:
        `${vatNote(vat.includes('EXCLUDED'), vat.includes('UNKNOWN'))} ` +
        'Два счёта заявок расходятся по построению: Метрика считает достижения цели в визитах с согласием на cookie, CRM — заведённые заявки с меткой клика. ' +
        'Дашборд CRM показывает первый; второй строже и всегда меньше. Называйте, какой из них приводите, иначе число не сойдётся с дашбордом. ' +
        'Выручка — по заказам сайта с датой оплаты в периоде. Оплата приходит позже заявки, поэтому по свежим дням ДРР выглядит хуже, чем окажется через две недели.',
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
