export type EnumProductCategory = 'PHOTO' | 'TSHIRT';

export interface TshirtStock {
  id: string;
  size: EnumTshirtSize;
  color: string;
  quantity: number;
  updatedAt: string;
}

export interface SetStockDto {
  size: EnumTshirtSize;
  color: string;
  quantity: number;
}

export type EnumTshirtSize = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | 'XXXL';
export type EnumPrintLocation =
  | 'FRONT'
  | 'BACK'
  | 'FRONT_BACK'
  | 'SLEEVE_LEFT'
  | 'SLEEVE_RIGHT'
  | 'FULL'
  | 'BY_TZ';

export type EnumStatus =
  | 'LEAD'
  | 'NEW'
  | 'FOLDER_STRUCTURE_CREATED'
  | 'IN_PROGRESS'
  | 'PRINTED'
  | 'READY'
  | 'DONE'
  | 'SENT'
  | 'PAID'
  | 'READY_FOR_REVIEW'
  | 'COMPLETED'
  | 'CANCELLED';

export type EnumSourceOrder = 'AVITO' | 'OZON' | 'WB' | 'LOCAL';

export type EnumCommunication = 'AVITO' | 'TELEGRAM' | 'MAX' | 'OZON';

export type EnumDeliveryMethod =
  | 'YANDEX_PVZ'
  | 'OZON_PVZ'
  | 'PICKUP'
  | 'OZON_SELLER'
  | 'WB_SELLER';

export type EnumTypePaper = 'GLOSS' | 'MATTE';

export type EnumAccrualStatus =
  | 'PENDING'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'SETTLED'
  | 'REVERSED';

export interface ItemTshirt {
  id: string;
  createdAt: string;
  updatedAt: string;
  orderId: string;
  color: string;
  size: EnumTshirtSize;
  printLocation: EnumPrintLocation;
  quantity: number;
  price: number;
  pricePosition: number;
  designCost: number;
  designUrl?: string | null;
  designNote?: string | null;
  clientItem: boolean;
}

export interface ItemPhoto {
  id: string;
  createdAt: string;
  updatedAt: string;
  orderId: string;
  formatPaper: string;
  typePaper: EnumTypePaper;
  quantity: number;
  price: number;
  pricePosition: number;
  isFreePrice?: boolean;
}

export interface OrderExecutor {
  id: string;
  username: string;
}

export interface OrderAccrualBrief {
  id: string;
  status: EnumAccrualStatus;
  salaryAmount: number;
  paidAmount: number;
  rateBasisPoints: number;
}

export interface OrderPhoto {
  id: string;
  createdAt: string;
  updatedAt: string;
  numberOrder: string;
  sourceOrder: EnumSourceOrder;
  communicationPlatform: EnumCommunication;
  urlCommunication: string;
  deliveryMethod: EnumDeliveryMethod;
  deliveryCost: number;
  totalOrder: number;
  status: EnumStatus;
  note?: string;
  productCategory: EnumProductCategory;
  deadline?: string | null;
  isUrgent: boolean;
  /** Свободная (договорная) цена: сумма позиции = её цене, кол-во не умножается. */
  isFreePrice?: boolean;
  /** Оставил ли клиент отзыв (отмечается вручную в списке заказов). */
  clientReviewLeft?: boolean;
  /** Когда CRM напомнила рабочей группе попросить отзыв. */
  reviewReminderNotifiedAt?: string | null;
  executorId?: string | null;
  executor?: OrderExecutor | null;
  completedAt?: string | null;
  clientPaidAt?: string | null;
  items: ItemPhoto[];
  tshirtItems: ItemTshirt[];
  accruals?: OrderAccrualBrief[];
}

export interface OrdersResponse {
  data: OrderPhoto[];
  meta: {
    page: number;
    limit: number;
    quantityElements: number;
    totalPages: number;
  };
}

export interface OrdersStats {
  contextTotal: number;
  matchingTotal: number;
  activeCount: number;
  leadCount: number;
  newCount: number;
  inProgressCount: number;
  readyCount: number;
  sentUnpaidCount: number;
  sentUnpaidAmount: number | null;
  paidCount: number;
  reviewPendingCount: number | null;
  reviewReminderDueCount: number | null;
  overdueCount: number;
  urgentCount: number;
  alertCount: number;
  byStatus: Record<EnumStatus, number>;
  byProduct: Record<EnumProductCategory, number>;
}

export interface CreateItemDto {
  formatPaper: string;
  typePaper: EnumTypePaper;
  quantity: number;
  price: number;
  isFreePrice?: boolean;
}

export interface CreateTshirtItemDto {
  color: string;
  size: EnumTshirtSize;
  printLocation: EnumPrintLocation;
  quantity: number;
  price: number;
  designCost?: number;
  designUrl?: string;
  designNote?: string;
  clientItem?: boolean;
}

export interface UpdateTshirtItemDto {
  color?: string;
  size?: EnumTshirtSize;
  printLocation?: EnumPrintLocation;
  quantity?: number;
  price?: number;
  designCost?: number;
  designUrl?: string;
  designNote?: string;
  clientItem?: boolean;
}

export interface CreateOrderDto {
  sourceOrder: EnumSourceOrder;
  communicationPlatform: EnumCommunication;
  urlCommunication: string;
  deliveryMethod: EnumDeliveryMethod;
  deliveryCost: number;
  note?: string;
  productCategory?: EnumProductCategory;
  status?: EnumStatus;
  executorId?: string | null;
  /** Свободная (договорная) цена: кол-во не умножается на цену. */
  freePrice?: boolean;
  /** Ручной итог заказа (если задан) — вместо расчёта из позиций. */
  customTotal?: number;
  items?: CreateItemDto[];
  tshirtItems?: CreateTshirtItemDto[];
}

export interface UpdateOrderDto {
  sourceOrder?: EnumSourceOrder;
  communicationPlatform?: EnumCommunication;
  urlCommunication?: string;
  deliveryMethod?: EnumDeliveryMethod;
  deliveryCost?: number;
  note?: string;
  isUrgent?: boolean;
}

export interface UpdateStatusDto {
  status: EnumStatus;
}

export interface UpdateItemDto {
  formatPaper?: string;
  typePaper?: EnumTypePaper;
  quantity?: number;
  price?: number;
  isFreePrice?: boolean;
}

export type EnumRole = 'ADMIN' | 'EXECUTOR';

export interface AuthUser {
  id: string;
  username: string;
  role: EnumRole;
}

export interface LoginResponse {
  access_token: string;
  role: EnumRole;
  username: string;
}

export interface AppUser {
  id: string;
  username: string;
  role: EnumRole;
  isActive: boolean;
  rateBasisPoints: number | null;
  telegramUsername: string | null;
  createdAt: string;
}

export interface OrdersQuery {
  page?: number;
  limit?: number;
  status?: EnumStatus;
  sourceOrder?: EnumSourceOrder;
  productCategory?: EnumProductCategory;
  reviewLeft?: boolean;
  search?: string;
}

// ── Salary types ──────────────────────────────────────────────────────────────

export interface AccrualBrief {
  id: string;
  orderNumber: string;
  completedAt: string | null;
  urlCommunication?: string | null;
  communicationPlatform?: EnumCommunication | null;
  salaryBase: number;
  rateBasisPoints: number;
  salaryAmount: number;
  paidAmount: number;
  debt: number;
  status: EnumAccrualStatus;
}

export interface ClosedAccrualBrief {
  id: string;
  orderNumber: string;
  completedAt: string | null;
  salaryAmount: number;
  paidAmount: number;
  status: EnumAccrualStatus;
}

export interface RecentPayment {
  id: string;
  createdAt: string;
  amount: number;
  note?: string | null;
  paidBy: {
    id: string;
    username: string;
  };
}

export interface ExecutorSalaryData {
  id: string;
  username: string;
  isActive: boolean;
  rateBasisPoints: number | null;
  ratePercent: string | null;
  totalDebt: number;
  totalPaid: number;
  pendingAccruals: AccrualBrief[];
  closedAccruals: ClosedAccrualBrief[];
  recentPayments: RecentPayment[];
}

export interface CreatePaymentDto {
  executorId: string;
  amount: number;
  note?: string;
}

export interface CreatePaymentByAccrualsDto {
  executorId: string;
  accrualIds: string[];
  note?: string;
}

export interface PaymentByAccrualsResult {
  paymentId: string;
  paidAt: string;
  totalAmount: number;
  accruals: Array<{
    id: string;
    orderNumber: string;
    orderDate: string;
    totalOrder: number;
    deliveryCost: number;
    salaryBase: number;
    rateBasisPoints: number;
    salaryAmount: number;
  }>;
}

// ── Reports types ─────────────────────────────────────────────────────────────

/** Единый набор P&L-метрик за период (месяц/неделя/итог). */
export interface PnlMetrics {
  // Объём
  orderCount: number;
  photoCount: number;
  tshirtCount: number;
  avgCheck: number;
  // Выручка
  totalRevenue: number;   // оборот (брутто)
  photoRevenue: number;
  tshirtRevenue: number;
  deliveryCost: number;   // транзитная доставка
  netRevenue: number;     // оборот − доставка
  // Себестоимость (материалы)
  materialsPhoto: number;
  materialsTshirt: number;
  cogs: number;           // materialsPhoto + materialsTshirt
  grossProfit: number;    // netRevenue − cogs
  // Операционные расходы
  deliverySupplies: number;
  equipment: number;
  marketing: number;
  other: number;
  operatingExpenses: number; // сумма 4 операционных
  totalExpenses: number;     // cogs + operatingExpenses (все расходные ордера)
  // Зарплата и итог
  salaryPaid: number;
  netProfit: number;      // grossProfit − operatingExpenses − salaryPaid
  margin: number;         // netProfit / totalRevenue, %
}

export interface MonthData extends PnlMetrics {
  month: number;
  label: string;
}

export interface MonthlyReport {
  year: number;
  months: MonthData[];
  totals: PnlMetrics;
}

export interface FunnelMonthData {
  month: number;
  label: string;
  leads: number;
  converted: number;
}

export interface FunnelReport {
  year: number;
  totalLeads: number;
  totalConverted: number;
  paidFromLeads: number;
  conversionRate: number;
  closeRate: number;
  byMonth: FunnelMonthData[];
}

export interface WeekData extends PnlMetrics {
  weekNum: number;
  displayStart: string;
  displayEnd: string;
}

export interface WeeklyReport {
  year: number;
  month: number;
  monthLabel: string;
  weeks: WeekData[];
  totals: PnlMetrics;
}

// ── Expense Order types ───────────────────────────────────────────────────────

export type EnumExpenseCategory =
  | 'MATERIALS_PHOTO'
  | 'MATERIALS_TSHIRT'
  | 'DELIVERY_SUPPLIES'
  | 'EQUIPMENT'
  | 'MARKETING'
  | 'OTHER';

export const EXPENSE_CATEGORY_LABELS: Record<EnumExpenseCategory, string> = {
  MATERIALS_PHOTO:   'Материалы — Фото',
  MATERIALS_TSHIRT:  'Материалы — Футболки',
  DELIVERY_SUPPLIES: 'Упаковка / Доставка',
  EQUIPMENT:         'Оборудование',
  MARKETING:         'Реклама',
  OTHER:             'Прочее',
};

export interface ExpenseOrder {
  id: string;
  createdAt: string;
  category: EnumExpenseCategory;
  amount: number;
  note?: string | null;
  createdBy: { id: string; username: string };
}

export interface CreateExpenseDto {
  category: EnumExpenseCategory;
  amount: number;
  note?: string;
}
