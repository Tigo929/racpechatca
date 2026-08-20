import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  EnumProductCategory,
  EnumStatus,
} from 'src/generated/prisma/enums';
import {
  photoMaterialCostKopecks,
  sheetCostKopecks,
} from 'src/order-photo/photo-material';
import { settleOrder } from 'src/partner/partner-settlement';

const MONTH_LABELS = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

/**
 * Единый принцип учёта (согласован с владельцем 15.08.2026).
 *
 * Отчёт отвечает на один вопрос: сколько владелец заработал. Раньше он
 * отвечал на другой — какой был оборот, и цифры расходились в разы: холсты
 * на 6 828 ₽ оборота приносили 1 276 ₽, а в таблице стояли первые.
 *
 *  - Выручка признаётся ПО ОПЛАТЕ КЛИЕНТОМ: деньги пришли — заказ в отчёте.
 *    Совпадает с выпиской по счёту и с чеками «Моего налога». Для старых
 *    заказов без даты оплаты — откат на дату отправки, затем на создание.
 *  - Зарплата берётся НАЧИСЛЕННАЯ и ложится в месяц заказа, а не в месяц
 *    выплаты. Иначе месяц без выплат выглядит сверхприбыльным: так август
 *    показывал маржу 77% при непогашенном долге сотрудникам 12 555 ₽.
 *  - Себестоимость считается по заказу, а не по закупкам: бумага по формату
 *    (photo-material.ts), футболки — вознаграждение партнёру, холсты — цена
 *    подрядчика. Поэтому закупки материалов больше НЕ вычитаются повторно:
 *    коробка бумаги — это запас, расходом она становится при печати.
 *  - Доставка НЕ транзит. Клиенту называют 300 ₽, перевозчику платят 99 ₽
 *    (Озон 140 ₽) — разница тоже заработок.
 *
 * Чистая прибыль = выручка за товар − себестоимость − зарплата начисленная
 *                  − операционные расходы + заработок на доставке.
 * Эта же методика применяется и к месячному, и к недельному отчёту.
 */

/** Сырые накопленные суммы за период (до вычисления производных метрик). */
interface PnlRaw {
  orderCount: number;
  photoCount: number;
  tshirtCount: number;
  canvasCount: number;
  totalRevenue: number; // оборот (сумма заказов, брутто)
  photoRevenue: number;
  tshirtRevenue: number;
  canvasRevenue: number;
  deliveryCost: number; // транзитная доставка
  materialsPhoto: number; // себестоимость — фотоматериалы
  materialsTshirt: number; // себестоимость — футболки/печать
  canvasContractorCost: number; // себестоимость — подрядчик по холстам
  deliverySupplies: number; // операц. — упаковка/доставка
  equipment: number; // операц. — оборудование
  marketing: number; // операц. — реклама
  partnerShare: number; // операц. — доля Гриши (партнёр)
  partnerReward: number; // операц. — вознаграждение партнёру за футболки
  other: number; // операц. — прочее
  salaryPaid: number; // зарплата выплаченная (справочно, в прибыль не идёт)

  // --- Себестоимость, посчитанная по самим заказам ---
  photoMaterialKopecks: number; // бумага, в копейках: лист стоит 1,6 ₽
  tshirtContractorCost: number; // вознаграждение партнёру по футболкам
  salaryAccrued: number; // зарплата начисленная — она и вычитается
  deliveryPaid: number; // сколько отдали перевозчику

  // --- Заработок по категориям ---
  photoProfit: number;
  tshirtProfit: number;
  canvasProfit: number;
}

type OrderRow = {
  sentAt: Date | null;
  createdAt: Date;
  clientPaidAt: Date | null;
  totalOrder: number | null;
  deliveryCost: number | null;
  deliveryMethod: string;
  productCategory: string;
  items: { formatPaper: string; quantity: number }[];
  tshirtItems: {
    pricePosition: number;
    quantity: number;
    designCost: number;
    thermalCost: number;
    blankCost: number;
    clientItem: boolean;
  }[];
  canvasItems: { contractorCostPosition: number }[];
  accruals: { salaryAmount: number }[];
};

/** Цены, по которым считается себестоимость. Живут в настройках партнёра. */
export interface CostSettings {
  sheetCostKopecks: number;
  deliveryCostYandexPvz: number;
  deliveryCostOzonPvz: number;
  /** Своя доставка производства холстов по Москве: сколько платим мы. */
  canvasDeliveryCost: number;
  partnerRateBasisPoints: number;
}

/**
 * Сколько платим перевозчику. Самовывоз и отгрузки маркетплейсам сюда не
 * попадают: там доставка либо не наша, либо её нет.
 */
function deliveryPaidFor(method: string, s: CostSettings): number {
  if (method === 'YANDEX_PVZ') return s.deliveryCostYandexPvz;
  if (method === 'OZON_PVZ') return s.deliveryCostOzonPvz;
  // Своя доставка производства холстов по Москве: платим 700, клиенту
  // называем 800 — разница остаётся у нас и должна попасть в отчёт.
  if (method === 'PRODUCTION_MSK') return s.canvasDeliveryCost;
  return 0;
}
type ExpenseRow = { createdAt: Date; amount: number; category: string };
type SalaryRow = { createdAt: Date; amount: number };

/**
 * Дата, по которой заказ попадает в отчёт: оплата клиента. Для старых
 * заказов без неё — отправка, затем создание.
 */
function recognitionDate(o: OrderRow): Date {
  return o.clientPaidAt ?? o.sentAt ?? o.createdAt;
}

function emptyBucket(): PnlRaw {
  return {
    orderCount: 0,
    photoCount: 0,
    tshirtCount: 0,
    canvasCount: 0,
    totalRevenue: 0,
    photoRevenue: 0,
    tshirtRevenue: 0,
    canvasRevenue: 0,
    deliveryCost: 0,
    materialsPhoto: 0,
    materialsTshirt: 0,
    canvasContractorCost: 0,
    deliverySupplies: 0,
    equipment: 0,
    marketing: 0,
    partnerShare: 0,
    partnerReward: 0,
    other: 0,
    salaryPaid: 0,
    photoMaterialKopecks: 0,
    tshirtContractorCost: 0,
    salaryAccrued: 0,
    deliveryPaid: 0,
    photoProfit: 0,
    tshirtProfit: 0,
    canvasProfit: 0,
  };
}

function addOrder(b: PnlRaw, order: OrderRow, s: CostSettings): void {
  const total = order.totalOrder ?? 0;
  const deliveryCharged = order.deliveryCost ?? 0;
  // Платим перевозчику только если доставка была: у самовывоза списывать не с чего.
  const deliveryPaid =
    deliveryCharged > 0 ? deliveryPaidFor(order.deliveryMethod, s) : 0;
  const salary = order.accruals.reduce((sum, a) => sum + a.salaryAmount, 0);
  // Выручка за товар — без доставки: на ней зарабатывают отдельной строкой.
  const goodsRevenue = total - deliveryCharged;

  b.orderCount += 1;
  b.totalRevenue += total;
  b.deliveryCost += deliveryCharged;
  b.deliveryPaid += deliveryPaid;
  b.salaryAccrued += salary;

  const deliveryProfit = deliveryCharged - deliveryPaid;

  if (order.productCategory === 'PHOTO') {
    const kopecks = photoMaterialCostKopecks(order.items, s.sheetCostKopecks);
    b.photoCount += 1;
    b.photoRevenue += total;
    b.photoMaterialKopecks += kopecks;
    b.photoProfit +=
      goodsRevenue - Math.ceil(kopecks / 100) - salary + deliveryProfit;
  } else if (order.productCategory === 'TSHIRT') {
    // Партнёру уходит стоимость материалов плюс его доля от маржи.
    const reward = settleOrder(order.tshirtItems, s.partnerRateBasisPoints).reward;
    b.tshirtCount += 1;
    b.tshirtRevenue += total;
    b.tshirtContractorCost += reward;
    b.tshirtProfit += goodsRevenue - reward - salary + deliveryProfit;
  } else if (order.productCategory === 'CANVAS') {
    const contractor = order.canvasItems.reduce(
      (sum, i) => sum + i.contractorCostPosition,
      0,
    );
    b.canvasCount += 1;
    b.canvasRevenue += total;
    b.canvasContractorCost += contractor;
    b.canvasProfit += goodsRevenue - contractor - salary + deliveryProfit;
  }
}

/*
 * Закупки материалов и авто-расходы подрядчиков копятся отдельно и в прибыль
 * НЕ идут: себестоимость уже посчитана по самим заказам. Иначе одна коробка
 * бумаги вычлась бы дважды — при покупке и при печати, — а вознаграждение
 * партнёру и подрядчик по холстам вообще трижды. Суммы сохраняются, чтобы
 * было видно движение денег и можно было сверить формулу с фактом закупок.
 */
function addExpense(b: PnlRaw, e: ExpenseRow): void {
  switch (e.category) {
    case 'MATERIALS_PHOTO':
      b.materialsPhoto += e.amount;
      break;
    case 'MATERIALS_TSHIRT':
      b.materialsTshirt += e.amount;
      break;
    case 'DELIVERY_SUPPLIES':
      b.deliverySupplies += e.amount;
      break;
    case 'EQUIPMENT':
      b.equipment += e.amount;
      break;
    case 'MARKETING':
      b.marketing += e.amount;
      break;
    case 'PARTNER_SHARE':
      b.partnerShare += e.amount;
      break;
    case 'PARTNER_REWARD':
      b.partnerReward += e.amount;
      break;
    case 'CANVAS_CONTRACTOR':
      b.canvasContractorCost += e.amount;
      break;
    default:
      b.other += e.amount;
      break;
  }
}

function sumBuckets(buckets: PnlRaw[]): PnlRaw {
  return buckets.reduce((acc, b) => {
    (Object.keys(acc) as (keyof PnlRaw)[]).forEach((k) => {
      acc[k] += b[k];
    });
    return acc;
  }, emptyBucket());
}

/** Добавляет производные метрики (чистая выручка, прибыль, маржа, средний чек). */
function finalize(b: PnlRaw) {
  // Выручка за товар: доставка вынесена, на ней зарабатываем отдельно.
  const netRevenue = b.totalRevenue - b.deliveryCost;
  // Себестоимость — по заказам, а не по закупкам (см. addExpense).
  const photoMaterialCost = Math.ceil(b.photoMaterialKopecks / 100);
  const cogs =
    photoMaterialCost + b.tshirtContractorCost + b.canvasContractorCost;
  const grossProfit = netRevenue - cogs;
  const deliveryProfit = b.deliveryCost - b.deliveryPaid;
  // Реклама, оборудование, упаковка — расходы бизнеса, не заказа. Закупки
  // материалов и авто-расходы подрядчиков сюда не входят: уже в cogs.
  const operatingExpenses =
    b.deliverySupplies + b.equipment + b.marketing + b.partnerShare + b.other;
  const totalExpenses = cogs + operatingExpenses;
  const netProfit =
    grossProfit - operatingExpenses - b.salaryAccrued + deliveryProfit;
  const margin =
    b.totalRevenue > 0
      ? Math.round((netProfit / b.totalRevenue) * 1000) / 10
      : 0;
  const avgCheck =
    b.orderCount > 0 ? Math.round(b.totalRevenue / b.orderCount) : 0;
  return {
    ...b,
    netRevenue,
    cogs,
    photoMaterialCost,
    deliveryProfit,
    operatingExpenses,
    totalExpenses,
    grossProfit,
    netProfit,
    margin,
    avgCheck,
  };
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Настройки себестоимости; строки нет — берём значения по умолчанию. */
  private async costSettings(): Promise<CostSettings> {
    const s = await this.prisma.partnerSettings.findUnique({
      where: { id: 'default' },
    });
    return {
      sheetCostKopecks: sheetCostKopecks(
        s?.photoBoxCost ?? 800,
        s?.photoSheetsPerBox ?? 500,
      ),
      deliveryCostYandexPvz: s?.deliveryCostYandexPvz ?? 99,
      canvasDeliveryCost: s?.canvasDeliveryCost ?? 700,
      deliveryCostOzonPvz: s?.deliveryCostOzonPvz ?? 140,
      partnerRateBasisPoints: s?.partnerRateBasisPoints ?? 3000,
    };
  }

  /**
   * Тянет заказы периода, расходы и зарплаты.
   *
   * Период определяется датой признания выручки — оплатой клиента. Заказы
   * без даты оплаты (старые, до появления поля) отбираются по отправке, а
   * совсем древние — по созданию: потерять их в отчёте хуже, чем показать
   * с приблизительной датой.
   */
  private async fetchPeriod(start: Date, endExclusive: Date) {
    const inPeriod = { gte: start, lt: endExclusive };
    const periodWhere = [
      { clientPaidAt: inPeriod },
      { clientPaidAt: null, sentAt: inPeriod },
      { clientPaidAt: null, sentAt: null, createdAt: inPeriod },
    ];
    const [orders, expenses, salaryPayments] = await Promise.all([
      this.prisma.orderPhoto.findMany({
        where: {
          OR: [
            {
              status: EnumStatus.SENT,
              productCategory: { not: EnumProductCategory.CANVAS },
              OR: periodWhere,
            },
            {
              status: EnumStatus.PAID,
              OR: periodWhere,
            },
          ],
        },
        select: {
          sentAt: true,
          createdAt: true,
          clientPaidAt: true,
          totalOrder: true,
          deliveryCost: true,
          deliveryMethod: true,
          productCategory: true,
          // Позиции нужны для себестоимости: бумага по формату, партнёр по
          // футболкам, подрядчик по холстам. Без них считать нечем.
          items: { select: { formatPaper: true, quantity: true } },
          tshirtItems: {
            select: {
              pricePosition: true,
              quantity: true,
              designCost: true,
              thermalCost: true,
              blankCost: true,
              clientItem: true,
            },
          },
          canvasItems: { select: { contractorCostPosition: true } },
          // Зарплата по начислению — она и вычитается из прибыли.
          accruals: {
            where: { status: { not: 'REVERSED' } },
            select: { salaryAmount: true },
          },
        },
      }),
      this.prisma.expenseOrder.findMany({
        where: { createdAt: { gte: start, lt: endExclusive } },
        select: { createdAt: true, amount: true, category: true },
      }),
      this.prisma.salaryPayment.findMany({
        where: { createdAt: { gte: start, lt: endExclusive } },
        select: { createdAt: true, amount: true },
      }),
    ]);
    return {
      orders: orders as OrderRow[],
      expenses: expenses as ExpenseRow[],
      salaryPayments: salaryPayments as SalaryRow[],
    };
  }

  async getMonthlyReport(year: number) {
    const start = new Date(year, 0, 1);
    const endExclusive = new Date(year + 1, 0, 1);
    const [{ orders, expenses, salaryPayments }, settings] = await Promise.all([
      this.fetchPeriod(start, endExclusive),
      this.costSettings(),
    ]);

    const buckets = Array.from({ length: 12 }, () => emptyBucket());

    for (const o of orders) {
      const d = recognitionDate(o);
      addOrder(buckets[d.getMonth()], o, settings);
    }
    for (const e of expenses) addExpense(buckets[e.createdAt.getMonth()], e);
    for (const p of salaryPayments)
      buckets[p.createdAt.getMonth()].salaryPaid += p.amount;

    const months = buckets.map((b, i) => ({
      month: i + 1,
      label: MONTH_LABELS[i],
      ...finalize(b),
    }));
    const totals = finalize(sumBuckets(buckets));

    return { year, months, totals };
  }

  async getWeeklyReport(year: number, month: number) {
    const start = new Date(year, month - 1, 1);
    const endExclusive = new Date(year, month, 1);
    const [{ orders, expenses, salaryPayments }, settings] = await Promise.all([
      this.fetchPeriod(start, endExclusive),
      this.costSettings(),
    ]);

    const weekDefs = this.buildWeeks(year, month);
    const buckets = weekDefs.map(() => emptyBucket());
    const findWeek = (d: Date) =>
      weekDefs.findIndex((w) => d >= w.start && d < w.endExclusive);

    for (const o of orders) {
      const idx = findWeek(recognitionDate(o));
      if (idx >= 0) addOrder(buckets[idx], o, settings);
    }
    for (const e of expenses) {
      const idx = findWeek(e.createdAt);
      if (idx >= 0) addExpense(buckets[idx], e);
    }
    for (const p of salaryPayments) {
      const idx = findWeek(p.createdAt);
      if (idx >= 0) buckets[idx].salaryPaid += p.amount;
    }

    const weeks = weekDefs.map((w, i) => ({
      weekNum: w.weekNum,
      displayStart: w.displayStart,
      displayEnd: w.displayEnd,
      ...finalize(buckets[i]),
    }));
    const totals = finalize(sumBuckets(buckets));

    return { year, month, monthLabel: MONTH_LABELS[month - 1], weeks, totals };
  }

  async getAvailableYears() {
    const first = await this.prisma.orderPhoto.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });
    const currentYear = new Date().getFullYear();
    const startYear = first ? first.createdAt.getFullYear() : currentYear;
    const years: number[] = [];
    for (let y = startYear; y <= currentYear; y++) years.push(y);
    return years.reverse();
  }

  /** Разбивает месяц на недели пн–вс, обрезая крайние недели по границам месяца. */
  private buildWeeks(year: number, month: number) {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0); // последний день месяца

    const dow = firstDay.getDay(); // 0=Вс…6=Сб
    const daysFromMon = dow === 0 ? 6 : dow - 1;
    const firstMonday = new Date(firstDay);
    firstMonday.setDate(firstDay.getDate() - daysFromMon);

    const pad = (n: number) => String(n).padStart(2, '0');
    const disp = (d: Date) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;

    const result: {
      weekNum: number;
      start: Date;
      endExclusive: Date;
      displayStart: string;
      displayEnd: string;
    }[] = [];
    const cur = new Date(firstMonday);
    let num = 1;

    while (cur <= lastDay) {
      const sun = new Date(cur);
      sun.setDate(cur.getDate() + 6);

      const clampStart = cur < firstDay ? new Date(firstDay) : new Date(cur);
      const clampEnd = sun > lastDay ? new Date(lastDay) : new Date(sun);

      const endExclusive = new Date(clampEnd);
      endExclusive.setDate(clampEnd.getDate() + 1);

      result.push({
        weekNum: num++,
        start: clampStart,
        endExclusive,
        displayStart: disp(clampStart),
        displayEnd: disp(clampEnd),
      });

      cur.setDate(cur.getDate() + 7);
    }

    return result;
  }
}
