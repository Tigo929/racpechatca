/**
 * Фундамент «Качество данных»: почему заявки удаляют, как идут отзывы
 * и где в CRM пустые места, из-за которых отчёты врут.
 *
 * Этот фундамент важнее, чем кажется. Модель, получив красивую цифру,
 * объяснит её причиной из жизни — «конверсия упала, потому что подорожал
 * клик», — тогда как настоящая причина бывает в незаполненном поле.
 * data_health существует, чтобы у модели была возможность сперва
 * проверить, можно ли вообще верить числам за этот период.
 */

import { read } from '../db.js';
import { resolvePeriod, sqlRange } from '../period.js';
import { answer, int, money, share, table } from '../format.js';
import { CATEGORY_LABELS, SOURCE_LABELS, label, paidSql } from '../statuses.js';
import { limitSchema, periodSchema, readLimit, type Tool } from './types.js';

export const deletionReasons: Tool = {
  name: 'deletion_reasons',
  title: 'Почему удаляют заявки',
  description:
    'Удалённые заявки и причины удаления словами, по источникам и по людям. ' +
    'Отвечает на «сколько заявок выбрасываем и почему». ' +
    'Причина — свободный текст, поэтому группировка тут не по категориям, а по самому тексту: одинаковые формулировки сойдутся, похожие — нет. ' +
    'Это сбор сведений, а не готовая статистика отказов.',
  schema: { ...periodSchema, limit: limitSchema },
  async run(args) {
    const period = resolvePeriod(args as { from?: string; to?: string });
    const [from, to] = sqlRange(period);
    const limit = readLimit(args, 20);

    const totals = await read<{
      udaleno: number;
      summa: number;
      iz_leadov: number;
    }>(
      `SELECT count(*)::int AS udaleno,
              COALESCE(sum(d."totalOrder"), 0)::int AS summa,
              count(*) FILTER (WHERE d.status = 'LEAD')::int AS iz_leadov
         FROM "OrderDeletion" d
        WHERE d."deletedAt" >= $1 AND d."deletedAt" < $2`,
      [from, to],
    );

    const t = totals[0];
    if (!t || t.udaleno === 0) {
      return answer({
        title: 'Почему удаляют заявки',
        period: period.label,
        summary: ['За период заявки не удаляли.'],
      });
    }

    const reasons = await read<{ reason: string; shtuk: number; summa: number }>(
      `SELECT btrim(lower(d.reason)) AS reason,
              count(*)::int AS shtuk,
              COALESCE(sum(d."totalOrder"), 0)::int AS summa
         FROM "OrderDeletion" d
        WHERE d."deletedAt" >= $1 AND d."deletedAt" < $2
        GROUP BY reason
        ORDER BY shtuk DESC, summa DESC
        LIMIT $3`,
      [from, to, limit],
    );

    const bySource = await read<{ src: string; shtuk: number; kto: string }>(
      `SELECT d."sourceOrder" AS src,
              count(*)::int AS shtuk,
              string_agg(DISTINCT COALESCE(d."deletedByName", '—'), ', ') AS kto
         FROM "OrderDeletion" d
        WHERE d."deletedAt" >= $1 AND d."deletedAt" < $2
        GROUP BY src
        ORDER BY shtuk DESC`,
      [from, to],
    );

    return answer({
      title: 'Почему удаляют заявки',
      period: period.label,
      summary: [
        `Удалено: ${int(t.udaleno)} заявок на ${money(t.summa)}`,
        `Из них не дошли до заказа (были «Обратился»): ${int(t.iz_leadov)} (${share(t.iz_leadov, t.udaleno)})`,
      ],
      table: [
        table(
          ['причина (как написали)', 'раз', 'сумма'],
          reasons.map((r) => [r.reason || '—', int(r.shtuk), money(r.summa)]),
        ),
        'По источникам:\n' +
          table(
            ['источник', 'удалено', 'кто удалял'],
            bySource.map((r) => [label(SOURCE_LABELS, r.src), int(r.shtuk), r.kto]),
          ),
      ].join('\n\n'),
      note:
        'Текст приведён к нижнему регистру, пробелы по краям убраны — иначе «Дубль» и «дубль » считались бы разными причинами. Смысловой группировки нет: «не отвечает» и «клиент пропал» останутся двумя строками.',
    });
  },
};

export const reviews: Tool = {
  name: 'reviews',
  title: 'Отзывы клиентов',
  description:
    'Как идёт сбор отзывов: у скольких заказов попросили отзыв, у скольких он получен, где напоминание ушло, но отзыва нет. ' +
    'Отвечает на «сколько отзывов собрали» и «кому ещё не написали». ' +
    'Отзыв отмечается в CRM вручную, поэтому это учёт нашей работы с отзывами, а не число отзывов на Яндекс.Картах.',
  schema: { ...periodSchema },
  async run(args) {
    const period = resolvePeriod(args as { from?: string; to?: string });
    const [from, to] = sqlRange(period);

    const rows = await read<{
      src: string;
      zakazov: number;
      napomnili: number;
      poprosili: number;
      ostavili: number;
    }>(
      `SELECT o."sourceOrder"::text AS src,
              count(*)::int AS zakazov,
              count(*) FILTER (WHERE o."reviewReminderNotifiedAt" IS NOT NULL)::int AS napomnili,
              count(*) FILTER (WHERE o."reviewRequestSentAt" IS NOT NULL)::int AS poprosili,
              count(*) FILTER (WHERE o."clientReviewLeft" = true)::int AS ostavili
         FROM "OrderPhoto" o
        WHERE o."createdAt" >= $1 AND o."createdAt" < $2
          AND ${paidSql()}
        GROUP BY src
        ORDER BY zakazov DESC`,
      [from, to],
    );

    if (rows.length === 0) {
      return answer({
        title: 'Отзывы клиентов',
        period: period.label,
        summary: ['За период нет оплаченных заказов — просить отзыв пока не у кого.'],
      });
    }

    const zakazov = rows.reduce((s, r) => s + r.zakazov, 0);
    const poprosili = rows.reduce((s, r) => s + r.poprosili, 0);
    const ostavili = rows.reduce((s, r) => s + r.ostavili, 0);
    const napomnili = rows.reduce((s, r) => s + r.napomnili, 0);

    return answer({
      title: 'Отзывы клиентов',
      period: period.label,
      summary: [
        `Оплаченных заказов: ${int(zakazov)} · CRM напомнила попросить отзыв по ${int(napomnili)}`,
        `Отзыв попросили: ${int(poprosili)} (${share(poprosili, napomnili)} от напоминаний) · отзыв получен: ${int(ostavili)} (${share(ostavili, poprosili)} от просьб)`,
      ],
      table: table(
        ['источник', 'оплачено', 'напомнили', 'попросили', 'получено', 'просьба → отзыв'],
        rows.map((r) => [
          label(SOURCE_LABELS, r.src),
          int(r.zakazov),
          int(r.napomnili),
          int(r.poprosili),
          int(r.ostavili),
          share(r.ostavili, r.poprosili),
        ]),
      ),
      note:
        'Разрыв между «напомнили» и «попросили» — потеря на нашей стороне: напоминание ушло в чат, а клиенту никто не написал. Разрыв между «попросили» и «получено» — решение клиента.',
    });
  },
};

export const dataHealth: Tool = {
  name: 'data_health',
  title: 'Можно ли верить цифрам',
  description:
    'Проверка полноты данных за период: незаполненные поля и сбои обмена, из-за которых отчёты занижают или завышают числа. ' +
    'Вызывайте это ПЕРЕД тем, как объяснять причинами из жизни падение конверсии, выручки или окупаемости рекламы: ' +
    'часто причина в пустом поле, а не в рынке. Перечисляет проблемы и говорит, на какой вывод каждая из них влияет.',
  schema: { ...periodSchema },
  async run(args) {
    const period = resolvePeriod(args as { from?: string; to?: string });
    const [from, to] = sqlRange(period);

    const orders = await read<{
      vsego: number;
      paid_bez_daty: number;
      bez_predoplaty: number;
      bez_ispolnitelya: number;
      bez_oformitelya: number;
      nulevaya_summa: number;
    }>(
      `SELECT count(*)::int AS vsego,
              count(*) FILTER (WHERE o.status IN ('PAID','READY_FOR_REVIEW','COMPLETED') AND o."clientPaidAt" IS NULL)::int AS paid_bez_daty,
              count(*) FILTER (WHERE o."prepaidAmount" IS NULL AND NOT ${paidSql()} AND o.status NOT IN ('LEAD','CANCELLED'))::int AS bez_predoplaty,
              count(*) FILTER (WHERE o."executorId" IS NULL AND o."productCategory" <> 'PHOTO' AND o.status NOT IN ('LEAD','CANCELLED'))::int AS bez_ispolnitelya,
              count(*) FILTER (WHERE o."processedById" IS NULL AND o.status NOT IN ('LEAD','CANCELLED'))::int AS bez_oformitelya,
              count(*) FILTER (WHERE o."totalOrder" = 0 AND o."isMarketplacePrint" = false AND o.status NOT IN ('LEAD','CANCELLED'))::int AS nulevaya_summa
         FROM "OrderPhoto" o
        WHERE o."createdAt" >= $1 AND o."createdAt" < $2`,
      [from, to],
    );

    const site = await read<{
      zayavok: number;
      bez_clientid: number;
      bez_utm: number;
    }>(
      `SELECT count(*)::int AS zayavok,
              count(*) FILTER (WHERE o."yandexClientId" IS NULL OR o."yandexClientId" = '')::int AS bez_clientid,
              count(*) FILTER (WHERE (o."utmSource" IS NULL OR o."utmSource" = '') AND (o.yclid IS NULL OR o.yclid = ''))::int AS bez_utm
         FROM "OrderPhoto" o
        WHERE o."createdAt" >= $1 AND o."createdAt" < $2
          AND o."sourceOrder" = 'WEBSITE'`,
      [from, to],
    );

    const outbox = await read<{ status: string; shtuk: number }>(
      `SELECT b.status, count(*)::int AS shtuk
         FROM "MetrikaOrderOutbox" b
        WHERE b."createdAt" >= $1 AND b."createdAt" < $2
        GROUP BY b.status`,
      [from, to],
    );

    const sync = await read<{ dataset: string; poslednyaya: Date | null; status: string; sampled: boolean | null }>(
      `SELECT DISTINCT ON (r.dataset) r.dataset, r."startedAt" AS poslednyaya, r.status, r.sampled
         FROM "MetrikaSyncRun" r
        ORDER BY r.dataset, r."startedAt" DESC`,
    );

    const adsDays = await read<{ dney: number }>(
      `SELECT count(DISTINCT a.date)::int AS dney
         FROM "AdSpend" a
        WHERE a.date >= $1::date AND a.date <= $2::date`,
      [period.from, period.to],
    );

    const trafficDays = await read<{ dney: number }>(
      `SELECT count(*)::int AS dney
         FROM "MetrikaDailyTraffic" t
        WHERE t.date >= $1::date AND t.date <= $2::date`,
      [period.from, period.to],
    );

    /**
     * Расход на рекламу записан в CRM дважды: в AdSpend (по дням и кампаниям,
     * для расчёта окупаемости) и расходом с категорией «Реклама» (для P&L).
     * Это два независимых ввода, и расходиться они могут молча — тогда
     * окупаемость считается по одному числу, а прибыль по другому.
     */
    const adVsExpense = await read<{ ad: number; expense: number }>(
      `SELECT (SELECT COALESCE(sum(a.spend), 0)::int FROM "AdSpend" a
                WHERE a.date >= $1::date AND a.date <= $2::date) AS ad,
              (SELECT COALESCE(sum(e.amount), 0)::int FROM "ExpenseOrder" e
                WHERE e."createdAt" >= $3 AND e."createdAt" < $4
                  AND e.category = 'MARKETING') AS expense`,
      [period.from, period.to, from, to],
    );

    const periodDays =
      Math.round(
        (Date.parse(`${period.to}T00:00:00Z`) - Date.parse(`${period.from}T00:00:00Z`)) / 86_400_000,
      ) + 1;

    const o = orders[0];
    const s = site[0];
    const problems: [string, string, string][] = [];

    if (o) {
      if (o.paid_bez_daty > 0)
        problems.push([
          'Оплачены, но без даты оплаты',
          int(o.paid_bez_daty),
          'срок «от заявки до денег» и выручка по дате оплаты по ним не считаются',
        ]);
      if (o.bez_predoplaty > 0)
        problems.push([
          'Предоплата не отмечена',
          int(o.bez_predoplaty),
          'остаток долга завышен: в prepayments такой заказ выглядит неоплаченным целиком',
        ]);
      if (o.bez_ispolnitelya > 0)
        problems.push([
          'Нет исполнителя (не фотопечать)',
          int(o.bez_ispolnitelya),
          'в загрузке исполнителей уходят в «не назначен», зарплата по ним не начислится',
        ]);
      if (o.bez_oformitelya > 0)
        problems.push([
          'Не указано, кто оформил',
          int(o.bez_oformitelya),
          'премия менеджера по таким заказам не начисляется',
        ]);
      if (o.nulevaya_summa > 0)
        problems.push([
          'Нулевая сумма у обычного заказа',
          int(o.nulevaya_summa),
          'занижают выручку и средний чек (у маркетплейсных ноль — это норма, они исключены)',
        ]);
    }

    if (s && s.zayavok > 0) {
      if (s.bez_clientid > 0)
        problems.push([
          'Заявки с сайта без ClientID Метрики',
          `${int(s.bez_clientid)} из ${int(s.zayavok)}`,
          'Метрика не свяжет их с визитом — окупаемость рекламы по ним не посчитается',
        ]);
      if (s.bez_utm > 0)
        problems.push([
          'Заявки с сайта без меток и без yclid',
          `${int(s.bez_utm)} из ${int(s.zayavok)}`,
          'источник неизвестен: в ad_economics они не попадут ни в рекламу, ни в органику',
        ]);
    }

    const failed = outbox.find((r) => r.status === 'failed');
    const pending = outbox.find((r) => r.status === 'pending');
    if (failed && failed.shtuk > 0)
      problems.push([
        'Заказы не ушли в Метрику (ошибка)',
        int(failed.shtuk),
        'в Метрике этих заказов нет, её отчёты по продажам занижены',
      ]);
    if (pending && pending.shtuk > 0)
      problems.push(['Заказы в очереди на отправку в Метрику', int(pending.shtuk), 'ещё не отправлены, это нормально, если очередь движется']);

    const adDays = adsDays[0]?.dney ?? 0;
    if (adDays < periodDays)
      problems.push([
        'Дни без данных о расходе на рекламу',
        `${int(periodDays - adDays)} из ${int(periodDays)}`,
        'расход занижен, а цена заявки и ДРР выглядят лучше настоящих',
      ]);

    const trDays = trafficDays[0]?.dney ?? 0;
    if (trDays < periodDays)
      problems.push([
        'Дни без синхронизации Метрики',
        `${int(periodDays - trDays)} из ${int(periodDays)}`,
        'трафик сайта за эти дни не показывается вовсе',
      ]);

    const ad = adVsExpense[0]?.ad ?? 0;
    const adExpense = adVsExpense[0]?.expense ?? 0;
    const bigger = Math.max(ad, adExpense);
    if (bigger > 0 && Math.abs(ad - adExpense) > bigger * 0.1) {
      problems.push([
        'Расход на рекламу записан двумя числами',
        `${money(ad)} в AdSpend против ${money(adExpense)} в расходах`,
        'окупаемость (ad_economics) считается по первому, прибыль в P&L — по второму; одно из двух неполно',
      ]);
    }

    const sampledSets = sync.filter((r) => r.sampled === true).map((r) => r.dataset);
    if (sampledSets.length)
      problems.push([
        'Метрика отдала данные с семплированием',
        sampledSets.join(', '),
        'числа в этих наборах приблизительные, а не точные',
      ]);

    const failedSync = sync.filter((r) => r.status === 'FAILED').map((r) => r.dataset);
    if (failedSync.length)
      problems.push([
        'Последняя синхронизация набора упала',
        failedSync.join(', '),
        'данные по этим наборам устарели на момент сбоя',
      ]);

    if (problems.length === 0) {
      return answer({
        title: 'Можно ли верить цифрам',
        period: period.label,
        summary: [
          `Проверено ${int(o?.vsego ?? 0)} заказов за период. Существенных пропусков не нашлось — числам за этот период можно верить.`,
        ],
        note: 'Проверка смотрит на полноту заполнения и обмена, а не на правильность сумм: ошибку в цене она не увидит.',
      });
    }

    return answer({
      title: 'Можно ли верить цифрам',
      period: period.label,
      summary: [
        `Заказов за период: ${int(o?.vsego ?? 0)} · заявок с сайта: ${int(s?.zayavok ?? 0)}`,
        `Нашлось ${problems.length} мест, где данные неполны. Учитывайте их, прежде чем объяснять цифры причинами из жизни.`,
      ],
      table: table(['что не так', 'сколько', 'на что это влияет'], problems),
      note: 'Проверка смотрит на полноту заполнения и обмена, а не на правильность сумм: ошибку в цене она не увидит.',
    });
  },
};

export const orderMix: Tool = {
  name: 'order_mix',
  title: 'Состав заказов',
  description:
    'Что именно заказывают: категории товара, форматы фотопечати, способы доставки, доля срочных и со скидкой. ' +
    'Отвечает на «что у нас основной продукт» и «из чего состоит заказ». ' +
    'Считает состав и штуки, а не деньги по позициям: выручка и средний чек — в revenue_summary. Отменённые заказы и необработанные обращения исключены.',
  schema: { ...periodSchema },
  async run(args) {
    const period = resolvePeriod(args as { from?: string; to?: string });
    const [from, to] = sqlRange(period);

    const cats = await read<{
      cat: string;
      zakazov: number;
      srochnyh: number;
      so_skidkoy: number;
      s_dizaynom: number;
      pozitsiy: number;
    }>(
      `SELECT o."productCategory"::text AS cat,
              count(*)::int AS zakazov,
              count(*) FILTER (WHERE o."isUrgent" = true)::int AS srochnyh,
              count(*) FILTER (WHERE o."discountAmount" > 0)::int AS so_skidkoy,
              count(*) FILTER (WHERE o."designDevelopmentCost" > 0)::int AS s_dizaynom,
              COALESCE(sum(
                (SELECT count(*) FROM "ItemPhoto" i WHERE i."orderId" = o.id)
                + (SELECT count(*) FROM "ItemTshirt" t WHERE t."orderId" = o.id)
                + (SELECT count(*) FROM "ItemCanvas" c WHERE c."orderId" = o.id)
              ), 0)::int AS pozitsiy
         FROM "OrderPhoto" o
        WHERE o."createdAt" >= $1 AND o."createdAt" < $2
          AND o.status NOT IN ('LEAD','CANCELLED')
        GROUP BY cat
        ORDER BY zakazov DESC`,
      [from, to],
    );

    if (cats.length === 0) {
      return answer({
        title: 'Состав заказов',
        period: period.label,
        summary: ['За период заказов нет.'],
      });
    }

    const delivery = await read<{ method: string; zakazov: number; stoimost: number }>(
      `SELECT o."deliveryMethod"::text AS method, count(*)::int AS zakazov,
              COALESCE(sum(o."deliveryCost"), 0)::int AS stoimost
         FROM "OrderPhoto" o
        WHERE o."createdAt" >= $1 AND o."createdAt" < $2
          AND o.status NOT IN ('LEAD','CANCELLED')
        GROUP BY method
        ORDER BY zakazov DESC`,
      [from, to],
    );

    const formats = await read<{ format: string; pozitsiy: number; shtuk: number; summa: number }>(
      `SELECT i."formatPaper" AS format, count(*)::int AS pozitsiy,
              COALESCE(sum(i.quantity), 0)::int AS shtuk,
              COALESCE(sum(i."pricePosition"), 0)::int AS summa
         FROM "ItemPhoto" i
         JOIN "OrderPhoto" o ON o.id = i."orderId"
        WHERE o."createdAt" >= $1 AND o."createdAt" < $2
          AND o.status NOT IN ('LEAD','CANCELLED')
        GROUP BY format
        ORDER BY shtuk DESC
        LIMIT 12`,
      [from, to],
    );

    const zakazov = cats.reduce((s, r) => s + r.zakazov, 0);
    const deliveryLabels: Record<string, string> = {
      YANDEX_PVZ: 'Яндекс ПВЗ',
      OZON_PVZ: 'Ozon ПВЗ',
      PICKUP: 'Самовывоз',
      OZON_SELLER: 'Ozon, продавец',
      WB_SELLER: 'WB, продавец',
      PRODUCTION_MSK: 'Своя доставка по Москве',
    };

    const blocks = [
      table(
        ['товар', 'заказов', 'доля', 'позиций', 'срочных', 'со скидкой', 'с дизайном'],
        cats.map((r) => [
          label(CATEGORY_LABELS, r.cat),
          int(r.zakazov),
          share(r.zakazov, zakazov),
          int(r.pozitsiy),
          int(r.srochnyh),
          int(r.so_skidkoy),
          int(r.s_dizaynom),
        ]),
      ),
      'Доставка:\n' +
        table(
          ['способ', 'заказов', 'доля', 'взято с клиентов'],
          delivery.map((r) => [
            label(deliveryLabels, r.method),
            int(r.zakazov),
            share(r.zakazov, zakazov),
            money(r.stoimost),
          ]),
        ),
      formats.length
        ? 'Форматы фотопечати:\n' +
          table(
            ['формат', 'позиций', 'отпечатков', 'сумма'],
            formats.map((r) => [r.format, int(r.pozitsiy), int(r.shtuk), money(r.summa)]),
          )
        : '',
    ].filter(Boolean);

    return answer({
      title: 'Состав заказов',
      period: period.label,
      summary: [`Заказов: ${int(zakazov)} · позиций в них: ${int(cats.reduce((s, r) => s + r.pozitsiy, 0))}`],
      table: blocks.join('\n\n'),
    });
  },
};

export const qualityTools = [deletionReasons, reviews, dataHealth, orderMix];
