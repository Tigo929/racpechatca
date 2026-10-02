/**
 * Фундамент «Маркетплейсы»: заказы с площадок, что именно продаётся
 * и хватает ли заготовок на складе.
 *
 * Деньги по этим заказам считает площадка, а не CRM: в заказе с Ozon сумма
 * стоит нулевой намеренно — цену покупатель платит там, а у нас ведётся
 * производство и макет. Поэтому ни один инструмент здесь не показывает
 * выручку маркетплейса: показать пришлось бы нули, и модель объяснила бы
 * их как «продаж нет». Выручка площадки живёт в кабинете площадки.
 */

import { read } from '../db.js';
import { resolvePeriod, sqlRange } from '../period.js';
import { answer, int, share, table } from '../format.js';
import { SOURCE_LABELS, STATUS_LABELS, label } from '../statuses.js';
import { limitSchema, periodSchema, readLimit, type Tool } from './types.js';

export const marketplaceOrders: Tool = {
  name: 'marketplace_orders',
  title: 'Заказы с маркетплейсов',
  description:
    'Заказы, заведённые с площадок (Ozon, WB): по кабинетам и статусам, сколько в работе и сколько закрыто. ' +
    'Отвечает на «сколько заказов пришло с Ozon» и «что из них ещё не собрано». ' +
    'Сумм и выручки не показывает: деньги по таким заказам считает площадка, в CRM сумма заказа нулевая. Остатки — в stock_status.',
  schema: { ...periodSchema },
  async run(args) {
    const period = resolvePeriod(args as { from?: string; to?: string });
    const [from, to] = sqlRange(period);

    const byAccount = await read<{
      kabinet: string;
      ploshadka: string;
      zakazov: number;
      v_rabote: number;
      zakryto: number;
      s_artikulom: number;
    }>(
      `SELECT COALESCE(m.title, 'кабинет не указан') AS kabinet,
              COALESCE(m.marketplace::text, o."sourceOrder"::text) AS ploshadka,
              count(*)::int AS zakazov,
              count(*) FILTER (WHERE o."closedAt" IS NULL)::int AS v_rabote,
              count(*) FILTER (WHERE o."closedAt" IS NOT NULL)::int AS zakryto,
              count(*) FILTER (WHERE EXISTS (
                SELECT 1 FROM "ItemTshirt" t
                 WHERE t."orderId" = o.id AND t."marketplaceArticle" IS NOT NULL
              ))::int AS s_artikulom
         FROM "OrderPhoto" o
         LEFT JOIN "MarketplaceAccount" m ON m.id = o."marketplaceAccountId"
        WHERE o."createdAt" >= $1 AND o."createdAt" < $2
          AND (o."isMarketplacePrint" = true OR o."sourceOrder" IN ('OZON','WB'))
        GROUP BY kabinet, ploshadka
        ORDER BY zakazov DESC`,
      [from, to],
    );

    if (byAccount.length === 0) {
      return answer({
        title: 'Заказы с маркетплейсов',
        period: period.label,
        summary: ['За период заказов с площадок нет.'],
      });
    }

    const byStatus = await read<{ status: string; shtuk: number }>(
      `SELECT o.status::text AS status, count(*)::int AS shtuk
         FROM "OrderPhoto" o
        WHERE o."createdAt" >= $1 AND o."createdAt" < $2
          AND (o."isMarketplacePrint" = true OR o."sourceOrder" IN ('OZON','WB'))
        GROUP BY o.status
        ORDER BY shtuk DESC`,
      [from, to],
    );

    const total = byAccount.reduce((s, r) => s + r.zakazov, 0);

    return answer({
      title: 'Заказы с маркетплейсов',
      period: period.label,
      summary: [
        `Заказов с площадок: ${int(total)} · в работе: ${int(byAccount.reduce((s, r) => s + r.v_rabote, 0))}`,
      ],
      table: [
        table(
          ['кабинет', 'площадка', 'заказов', 'в работе', 'закрыто', 'с артикулом'],
          byAccount.map((r) => [
            r.kabinet,
            label(SOURCE_LABELS, r.ploshadka),
            int(r.zakazov),
            int(r.v_rabote),
            int(r.zakryto),
            int(r.s_artikulom),
          ]),
        ),
        'По статусам:\n' +
          table(
            ['статус', 'заказов', 'доля'],
            byStatus.map((r) => [label(STATUS_LABELS, r.status), int(r.shtuk), share(r.shtuk, total)]),
          ),
      ].join('\n\n'),
      note:
        'Заказ без артикула у позиции заведён руками, а не из кабинета: цвет и размер у него выбирал человек, и сверить их с карточкой площадки нельзя.',
    });
  },
};

export const marketplaceArticles: Tool = {
  name: 'marketplace_articles',
  title: 'Что продаётся на площадке',
  description:
    'Артикулы площадки в заказах: какой принт, цвет и размер заказывают чаще. ' +
    'Отвечает на «что пошло» и «какие размеры заканчиваются первыми». ' +
    'Считает заказанные штуки, а не остатки и не деньги: цена в таких заказах нулевая, остатки — в stock_status.',
  schema: { ...periodSchema, limit: limitSchema },
  async run(args) {
    const period = resolvePeriod(args as { from?: string; to?: string });
    const [from, to] = sqlRange(period);
    const limit = readLimit(args);

    const rows = await read<{
      article: string;
      color: string;
      size: string;
      zakazov: number;
      shtuk: number;
    }>(
      `SELECT COALESCE(NULLIF(t."marketplaceArticle", ''), 'без артикула') AS article,
              t.color,
              t.size::text AS size,
              count(DISTINCT t."orderId")::int AS zakazov,
              COALESCE(sum(t.quantity), 0)::int AS shtuk
         FROM "ItemTshirt" t
         JOIN "OrderPhoto" o ON o.id = t."orderId"
        WHERE o."createdAt" >= $1 AND o."createdAt" < $2
          AND (o."isMarketplacePrint" = true OR o."sourceOrder" IN ('OZON','WB'))
          AND o.status <> 'CANCELLED'
        GROUP BY article, t.color, size
        ORDER BY shtuk DESC
        LIMIT $3`,
      [from, to, limit],
    );

    if (rows.length === 0) {
      return answer({
        title: 'Что продаётся на площадке',
        period: period.label,
        summary: ['За период позиций с площадок нет.'],
      });
    }

    const shtuk = rows.reduce((s, r) => s + r.shtuk, 0);
    const bySize = await read<{ size: string; shtuk: number }>(
      `SELECT t.size::text AS size, COALESCE(sum(t.quantity), 0)::int AS shtuk
         FROM "ItemTshirt" t
         JOIN "OrderPhoto" o ON o.id = t."orderId"
        WHERE o."createdAt" >= $1 AND o."createdAt" < $2
          AND (o."isMarketplacePrint" = true OR o."sourceOrder" IN ('OZON','WB'))
          AND o.status <> 'CANCELLED'
        GROUP BY t.size
        ORDER BY shtuk DESC`,
      [from, to],
    );

    return answer({
      title: 'Что продаётся на площадке',
      period: period.label,
      summary: [`Заказано штук: ${int(shtuk)} в ${rows.length} артикулах (показаны самые ходовые)`],
      table: [
        table(
          ['артикул', 'цвет', 'размер', 'заказов', 'штук'],
          rows.map((r) => [r.article, r.color, r.size, int(r.zakazov), int(r.shtuk)]),
        ),
        'По размерам:\n' +
          table(
            ['размер', 'штук', 'доля'],
            bySize.map((r) => [r.size, int(r.shtuk), share(r.shtuk, shtuk)]),
          ),
      ].join('\n\n'),
      note: 'Артикул собран как «принт-цвет-размер»: из него и выведены цвет с размером в заказе.',
    });
  },
};

export const stockStatus: Tool = {
  name: 'stock_status',
  title: 'Остатки заготовок',
  description:
    'Склад заготовок футболок: сколько чего осталось по цвету и размеру, и сколько списано за период. ' +
    'Отвечает на «что заканчивается» и «что заказывать». ' +
    'Это наш склад, а не остатки на площадке: сколько Ozon видит у себя, знает кабинет площадки, а не CRM.',
  schema: { ...periodSchema },
  async run(args) {
    const period = resolvePeriod(args as { from?: string; to?: string });
    const [from, to] = sqlRange(period);

    const stock = await read<{ color: string; size: string; quantity: number; spisano: number }>(
      `SELECT s.color, s.size::text AS size, s.quantity,
              COALESCE((
                SELECT sum(m.quantity)::int FROM "StockMovement" m
                 WHERE m.color = s.color AND m.size = s.size
                   AND m."createdAt" >= $1 AND m."createdAt" < $2
              ), 0)::int AS spisano
         FROM "TshirtStock" s
        ORDER BY s.quantity ASC, s.color, s.size`,
      [from, to],
    );

    if (stock.length === 0) {
      return answer({
        title: 'Остатки заготовок',
        period: period.label,
        summary: ['Склад заготовок пуст — ни одной позиции не заведено.'],
      });
    }

    const total = stock.reduce((s, r) => s + r.quantity, 0);
    const spisano = stock.reduce((s, r) => s + r.spisano, 0);
    const days = Math.max(
      1,
      Math.round(
        (Date.parse(`${period.to}T00:00:00Z`) - Date.parse(`${period.from}T00:00:00Z`)) / 86_400_000,
      ) + 1,
    );
    const zero = stock.filter((r) => r.quantity <= 0).length;
    const low = stock.filter((r) => r.quantity > 0 && r.quantity <= 3).length;

    const perDay = spisano / days;
    const raskhod =
      spisano === 0
        ? 'За период не списано ни одной заготовки — насколько хватит запаса, посчитать не из чего.'
        : `Списано за период: ${int(spisano)}, это ${perDay.toFixed(1)} в день — текущего запаса хватит примерно на ${Math.floor(total / perDay)} дн.`;

    return answer({
      title: 'Остатки заготовок',
      period: `остатки на сейчас, расход за ${period.label}`,
      summary: [
        `Заготовок на складе: ${int(total)} в ${stock.length} позициях`,
        `Кончились: ${int(zero)} позиций · осталось 3 и меньше: ${int(low)}`,
        raskhod,
      ],
      table: table(
        ['цвет', 'размер', 'остаток', 'списано за период'],
        stock.map((r) => [r.color, r.size, int(r.quantity), int(r.spisano)]),
      ),
      note:
        'Списание идёт при переходе заказа в «Отправлен» и возвращается при откате, поэтому расход за период — это отправленные заказы, а не начатые. Прогноз «хватит на N дней» верен только если спрос останется таким же.',
    });
  },
};

export const marketplaceTools = [marketplaceOrders, marketplaceArticles, stockStatus];
