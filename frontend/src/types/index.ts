export type EnumProductCategory = 'PHOTO' | 'TSHIRT' | 'CANVAS';

export type EnumTshirtSize = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | 'XXXL';
export type EnumPrintLocation = 'FRONT' | 'BACK' | 'FRONT_BACK' | 'SLEEVE_LEFT' | 'SLEEVE_RIGHT' | 'FULL' | 'BY_TZ';

export type EnumStatus = 'LEAD' | 'NEW' | 'APPROVAL_SENT' | 'FOLDER_STRUCTURE_CREATED' | 'IN_PROGRESS' | 'PRINTED' | 'READY' | 'SHIPMENT_CREATED' | 'DONE' | 'SENT' | 'PAID' | 'READY_FOR_REVIEW' | 'COMPLETED' | 'CANCELLED' | 'PROBLEM';

export type EnumSourceOrder = 'AVITO' | 'OZON' | 'WB' | 'LOCAL';

export type EnumCommunication = 'AVITO' | 'TELEGRAM' | 'MAX' | 'OZON';

export type EnumDeliveryMethod = 'YANDEX_PVZ' | 'OZON_PVZ' | 'PICKUP' | 'OZON_SELLER' | 'WB_SELLER' | 'PRODUCTION_MSK';

/** Материал холста по прайсу производства. */
export type EnumCanvasMaterial = 'SYNTHETIC' | 'COTTON';

export type EnumTypePaper = 'GLOSS' | 'MATTE';

export type EnumAccrualStatus = 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'SETTLED' | 'REVERSED';

/** Статус отправки заказа партнёру CoolABC (внешняя печать футболок). */
export type EnumPartnerSyncStatus = 'PENDING' | 'SENT' | 'FAILED';

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
  thermalCost: number;
  blankCost: number;
  designUrl?: string | null;
  designNote?: string | null;
  clientItem: boolean;
}

export interface ItemCanvas {
  id: string;
  createdAt: string;
  updatedAt: string;
  orderId: string;
  formatCanvas: string;
  /** Размер из прайса производства. Пусто у нестандартных позиций. */
  sizeKey: string | null;
  material: EnumCanvasMaterial | null;
  quantity: number;
  clientPrice: number;
  contractorPrice: number;
  pricePosition: number;
  contractorCostPosition: number;
  profitPosition: number;
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
  /** Стоимость «разработка дизайна» — входит в totalOrder (чек клиента). */
  designDevelopmentCost?: number;
  /** Плата за срочность: входит в чек клиента, но не в базу зарплаты. */
  urgencyFee?: number;
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
  /** Когда оператор нажал «Отправил клиенту» под напоминанием об отзыве. */
  reviewRequestSentAt?: string | null;
  /** Кто нажал «Отправил клиенту» (Telegram-ник/имя). */
  reviewRequestSentBy?: string | null;
  /** Когда статус менялся в последний раз — по нему видно зависшие заказы. */
  statusChangedAt?: string | null;
  executorId?: string | null;
  executor?: OrderExecutor | null;
  completedAt?: string | null;
  clientPaidAt?: string | null;
  /** Модель футболки — производственные данные для исполнителя-партнёра. */
  tshirtModel?: string | null;
  /** Первый ТЗ-файл (оставлен для старых заказов и совместимости). */
  techSpecPhotoPath?: string | null;
  /** Все прикреплённые ТЗ-файлы (согласованный макет + уточнения). */
  techSpecPhotoPaths?: string[] | null;
  /** Отправка заказа исполнителю-партнёру (только TSHIRT). */
  partnerSyncStatus?: EnumPartnerSyncStatus | null;
  partnerSyncError?: string | null;
  partnerSyncAt?: string | null;
  items: ItemPhoto[];
  tshirtItems: ItemTshirt[];
  canvasItems: ItemCanvas[];
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
  /** Напомнили в TG, но отзыв так и не отмечен — по этим стоит пройтись. */
  reviewRemindedCount: number | null;
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

export interface CreateCanvasItemDto {
  /** Размер из прайса. Задан — сервер сам поставит подпись и цену производства. */
  sizeKey?: string;
  material?: EnumCanvasMaterial;
  /** Нужны только для нестандартного размера, которого в прайсе нет. */
  formatCanvas?: string;
  contractorPrice?: number;
  quantity: number;
  clientPrice: number;
}

export interface UpdateCanvasItemDto {
  sizeKey?: string;
  material?: EnumCanvasMaterial;
  formatCanvas?: string;
  quantity?: number;
  clientPrice?: number;
  contractorPrice?: number;
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
  /** Стоимость «разработка дизайна» — входит в чек, база премии менеджера. */
  designDevelopmentCost?: number;
  /** Плата за срочность: входит в чек, но не в базу зарплаты. */
  urgencyFee?: number;
  /** Ручной итог заказа (если задан) — вместо расчёта из позиций. */
  customTotal?: number;
  isUrgent?: boolean;
  /** Модель футболки — производственные данные для исполнителя-партнёра. */
  tshirtModel?: string;
  items?: CreateItemDto[];
  tshirtItems?: CreateTshirtItemDto[];
  canvasItems?: CreateCanvasItemDto[];
}

export interface UpdateOrderDto {
  sourceOrder?: EnumSourceOrder;
  communicationPlatform?: EnumCommunication;
  urlCommunication?: string;
  deliveryMethod?: EnumDeliveryMethod;
  deliveryCost?: number;
  /** Стоимость «разработка дизайна» — входит в чек, база премии менеджера. */
  designDevelopmentCost?: number;
  /** Плата за срочность: входит в чек, но не в базу зарплаты. */
  urgencyFee?: number;
  note?: string;
  isUrgent?: boolean;
  tshirtModel?: string;
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

/**
 * MARKETPLACE_CLIENT — внешний продавец: пользуется только разделом
 * «Маркетплейсы» и только своими кабинетами. Это не сотрудник, а клиент
 * сервиса, поэтому ни заказов, ни зарплаты, ни отчётов он не видит.
 */
export type EnumRole = 'ADMIN' | 'EXECUTOR' | 'ORDER_MANAGER' | 'MARKETPLACE_CLIENT';

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
  /** Ставка премии за разработку дизайна (сотые процента). Для менеджера. */
  designRateBasisPoints: number | null;
  telegramUsername: string | null;
  createdAt: string;
  /** Заказов в работе — считаются до статуса «Готов» (текущая загрузка). */
  activeOrdersCount?: number;
  /** Готовых заказов, ожидающих выдачи или отправки. Загрузку не создают. */
  readyOrdersCount?: number;
  /** Заказов в работе, статус которых не менялся дольше порога. */
  stalledOrdersCount?: number;
}

/** «Старший дня» по отгрузкам — кого план дня тегает в блоке отгрузок. */
export interface ShipmentLead {
  userId: string | null;
  user: {
    id: string;
    username: string;
    role: EnumRole;
    telegramUsername: string | null;
  } | null;
}

export interface OrdersQuery {
  page?: number;
  limit?: number;
  status?: EnumStatus;
  sourceOrder?: EnumSourceOrder;
  productCategory?: EnumProductCategory;
  reviewLeft?: boolean;
  search?: string;
  /** Идентификатор исполнителя либо 'none' — заказы без исполнителя. */
  executorId?: string;
}

/** Строка сводки «кто сколько тянет» для отбора по исполнителю. */
export interface ExecutorWorkload {
  id: string;
  username: string;
  role: EnumRole | null;
  isActive: boolean;
  activeCount: number;
  urgentCount: number;
  overdueCount: number;
  readyCount: number;
  activeAmount: number;
}

// ── Salary types ──────────────────────────────────────────────────────────────

export type EnumAccrualKind = 'EXECUTOR' | 'MANAGER' | 'BONUS';

export interface AccrualBrief {
  id: string;
  /** Пусто у премий: они начисляются вне заказа. */
  orderNumber: string | null;
  completedAt: string | null;
  /** За что начислено — заполняется у премий. */
  note?: string | null;
  createdAt?: string;
  urlCommunication?: string | null;
  communicationPlatform?: EnumCommunication | null;
  /** Тип начисления: исполнителю за производство или менеджеру за оформление. */
  kind?: EnumAccrualKind;
  salaryBase: number;
  rateBasisPoints: number;
  /** Только для менеджера: база и ставка премии за дизайн. */
  designBase?: number;
  designRateBasisPoints?: number;
  salaryAmount: number;
  paidAmount: number;
  debt: number;
  status: EnumAccrualStatus;
}

export interface ClosedAccrualBrief {
  id: string;
  orderNumber: string | null;
  completedAt: string | null;
  kind?: EnumAccrualKind;
  note?: string | null;
  createdAt?: string;
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
  /** Роль получателя — исполнитель или менеджер по оформлению. */
  role?: EnumRole;
  isActive: boolean;
  rateBasisPoints: number | null;
  ratePercent: string | null;
  /** Ставка премии за дизайн (сотые процента) — только у менеджера. */
  designRateBasisPoints?: number | null;
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
    /** Пусто у премий — они начисляются вне заказа. */
    orderNumber: string | null;
    kind?: EnumAccrualKind;
    note?: string | null;
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
  canvasCount: number;
  avgCheck: number;
  // Выручка
  totalRevenue: number; // оборот (брутто)
  photoRevenue: number;
  tshirtRevenue: number;
  canvasRevenue: number;
  deliveryCost: number; // транзитная доставка
  netRevenue: number; // оборот − доставка
  // Себестоимость (материалы)
  materialsPhoto: number;
  materialsTshirt: number;
  canvasContractorCost: number;
  cogs: number; // materialsPhoto + materialsTshirt + canvasContractorCost
  grossProfit: number; // netRevenue − cogs
  // Операционные расходы
  deliverySupplies: number;
  equipment: number;
  marketing: number;
  partnerShare: number;
  partnerReward: number;
  other: number;
  operatingExpenses: number; // сумма всех операционных
  totalExpenses: number; // cogs + operatingExpenses (все расходные ордера)
  // Зарплата и итог
  salaryPaid: number; // выплачено за период — справочно, в прибыль не идёт
  salaryAccrued: number; // начислено за заказы периода — вычитается из прибыли
  netProfit: number; // заработок за вычетом всего
  margin: number; // netProfit / totalRevenue, %
  // Себестоимость, посчитанная по самим заказам
  photoMaterialCost: number; // бумага по формату позиций
  tshirtContractorCost: number; // вознаграждение партнёру
  // Доставка: взяли с клиента (deliveryCost) минус отдали перевозчику
  deliveryPaid: number;
  deliveryProfit: number;
  // Заработок по категориям — то, ради чего отчёт переделывался
  photoProfit: number;
  tshirtProfit: number;
  canvasProfit: number;
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

export type EnumExpenseCategory = 'MATERIALS_PHOTO' | 'MATERIALS_TSHIRT' | 'DELIVERY_SUPPLIES' | 'EQUIPMENT' | 'MARKETING' | 'PARTNER_SHARE' | 'PARTNER_REWARD' | 'CANVAS_CONTRACTOR' | 'OTHER';

export const EXPENSE_CATEGORY_LABELS: Record<EnumExpenseCategory, string> = {
  MATERIALS_PHOTO: 'Материалы — Фото',
  MATERIALS_TSHIRT: 'Материалы — Футболки',
  DELIVERY_SUPPLIES: 'Упаковка / Доставка',
  EQUIPMENT: 'Оборудование',
  MARKETING: 'Реклама',
  PARTNER_SHARE: 'Доля Гриши',
  PARTNER_REWARD: 'Вознаграждение партнёру',
  CANVAS_CONTRACTOR: 'Подрядчик — Холсты',
  OTHER: 'Прочее',
};

export interface ExpenseOrder {
  id: string;
  createdAt: string;
  kind?: 'EXPENSE_ORDER' | 'SALARY_PAYMENT';
  category: EnumExpenseCategory | 'SALARY';
  amount: number;
  note?: string | null;
  createdBy: { id: string; username: string };
  salaryPaymentId?: string;
  salaryExecutor?: { id: string; username: string };
  /** Заказ-источник (для авто-расходов вроде вознаграждения партнёру). */
  order?: { id: string; numberOrder: string } | null;
}

export interface CreateExpenseDto {
  category: EnumExpenseCategory;
  amount: number;
  note?: string;
}

/* ---------- Задачи ---------- */

export type EnumTaskStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';

export const TASK_STATUS_LABELS: Record<EnumTaskStatus, string> = {
  OPEN: 'Новая',
  IN_PROGRESS: 'В работе',
  DONE: 'Выполнена',
  CANCELLED: 'Отменена',
};

/** Порядок в интерфейсе: сначала то, что ещё в работе. */
export const TASK_STATUS_FLOW: EnumTaskStatus[] = ['OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED'];

export interface Task {
  id: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  description: string | null;
  status: EnumTaskStatus;
  deadline: string | null;
  completedAt: string | null;
  assigneeId: string;
  assignee: { id: string; username: string; telegramUsername: string | null };
  createdById: string;
  createdBy: { id: string; username: string };
  orderId: string | null;
  order: { id: string; numberOrder: string } | null;
  /** Сколько стоит выполнение. 0 — задача без оплаты. */
  rewardAmount?: number;
  /** Начисление, созданное при выполнении (если задача платная). */
  rewardAccrualId?: string | null;
}

export interface CreateTaskDto {
  title: string;
  description?: string;
  assigneeId: string;
  deadline?: string;
  orderId?: string;
  /** Оплата за выполнение задачи. Начислится сотруднику при закрытии. */
  rewardAmount?: number;
}

export interface TaskCountResponse {
  open: number;
  overdue: number;
}

/* ---------- Avito Messenger ---------- */

export type EnumAvitoMessageDirection = 'IN' | 'OUT';

export interface AvitoLinkedOrder {
  id: string;
  numberOrder: string;
  status: EnumStatus;
}

export interface AvitoChat {
  id: string;
  createdAt: string;
  updatedAt: string;
  avitoChatId: string;
  avitoAccountId: string;
  avitoItemId: string | null;
  itemTitle: string | null;
  itemUrl: string | null;
  itemPrice: string | null;
  clientAvitoId: string | null;
  clientName: string | null;
  clientProfileUrl: string | null;
  clientAvatarUrl: string | null;
  chatCreatedAt: string | null;
  lastMessageAt: string | null;
  lastMessageText: string | null;
  lastMessageType: string | null;
  lastDirection: EnumAvitoMessageDirection | null;
  orderId: string | null;
  order?: AvitoLinkedOrder | null;
  unreadCount: number;
}

export interface AvitoMessage {
  id: string;
  createdAt: string;
  updatedAt: string;
  avitoMessageId: string;
  chatId: string;
  authorAvitoId: string | null;
  direction: EnumAvitoMessageDirection;
  type: string;
  text: string | null;
  content: unknown;
  sentAt: string;
  isRead: boolean;
  readAt: string | null;
  sentById: string | null;
  sentBy?: { id: string; username: string } | null;
}

export interface AvitoMessengerSyncResult {
  skipped?: boolean;
  chatsSynced?: number;
  messagesSynced?: number;
  errors?: string[];
}

/* ---------- Расчёт с партнёром (футболки) ---------- */

export interface PartnerSettings {
  thermalTransferCost: number;
  blankTshirtCost: number;
  partnerRateBasisPoints: number;
  partnerName: string;
  /** Шаблон ссылки на переписку в MAX: {phone} / {phone_plus}. */
  maxLinkTemplate: string;
  /** Себестоимость фотопечати: коробка бумаги и сколько в ней листов. */
  photoBoxCost: number;
  photoSheetsPerBox: number;
  /** Сколько платим перевозчику — клиенту называем больше, разница наш заработок. */
  deliveryCostYandexPvz: number;
  deliveryCostOzonPvz: number;
  /** Кого всегда тегать в общем чате при заявке с сайта (через запятую). */
  leadMentionUsernames: string;
}

export interface OrderSettlement {
  materials: number;
  margin: number;
  reward: number;
  partnerProfit: number;
  ownerProfit: number;
  tshirtRevenue: number;
  rateBasisPoints: number;
}

// ── Согласование печати ──────────────────────────────────────

export type EnumApprovalSide = 'FRONT' | 'BACK';

export type EnumApprovalStatus =
  | 'DRAFT'
  | 'READY'
  | 'SENT'
  | 'APPROVED'
  | 'CHANGES_REQUESTED';

/** Шаблон мокапа: фотография изделия и калибровка зоны печати. */
export interface MockupTemplate {
  id: string;
  createdAt: string;
  updatedAt: string;
  key: string;
  title: string;
  garmentType: string;
  color: string;
  side: EnumApprovalSide;
  imageFile: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  printAreaX: number;
  printAreaY: number;
  printAreaWidth: number;
  printAreaHeight: number;
  /** Реальный размер зоны печати в миллиметрах — связь пикселей с сантиметрами. */
  printAreaWidthMm: number;
  printAreaHeightMm: number;
  isActive: boolean;
  sortOrder: number;
}

/**
 * Размещение принта на одной стороне. Координаты нормализованы: x и y — центр
 * принта в долях зоны печати, поэтому положение переживает и смену экрана,
 * и замену фотографии мокапа.
 */
export interface ApprovalSideState {
  templateKey: string;
  printFile: string | null;
  printOriginalName: string | null;
  printWidthPx: number;
  printHeightPx: number;
  widthMm: number;
  heightMm: number;
  lockRatio: boolean;
  x: number;
  y: number;
  rotation: number;
}

export interface PrintApproval {
  id: string;
  createdAt: string;
  updatedAt: string;
  orderId: string;
  version: number;
  status: EnumApprovalStatus;
  shirtColor: string;
  shirtSize: EnumTshirtSize;
  comment: string | null;
  sides: Partial<Record<EnumApprovalSide, ApprovalSideState>>;
  previewFile: string | null;
  finalizedAt: string | null;
  createdBy?: { id: string; username: string } | null;
  /** Согласование правили после того, как файл был сформирован. */
  fileOutdated: boolean;
}

export interface CreateApprovalDto {
  orderId: string;
  shirtColor: string;
  shirtSize: EnumTshirtSize;
  copyFromId?: string;
}

export interface UpdateApprovalDto {
  shirtColor?: string;
  shirtSize?: EnumTshirtSize;
  comment?: string;
  sides?: Partial<Record<EnumApprovalSide, ApprovalSideState>>;
  status?: EnumApprovalStatus;
}

// ── Генератор карточек Ozon ──────────────────────────────────

/** Прямоугольник в пикселях шаблона. */
export interface CardRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Шаблон карточки: готовая композиция с футболкой, фоном и инфографикой. */
export interface ImageCardTemplate {
  id: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  /** Ключ цвета изделия: black, white. */
  shirtColor: string;
  templateFile: string | null;
  canvasWidth: number;
  canvasHeight: number;
  placementArea: Partial<CardRect>;
  safeArea: Partial<CardRect> | null;
  /** Растёт при каждой замене картинки или области размещения. */
  version: number;
  active: boolean;
}

export type CardMode = 'BLACK' | 'WHITE' | 'BOTH';

export type EnumCardBatchStatus =
  | 'DRAFT'
  | 'PROCESSING'
  | 'REVIEW'
  | 'FINALIZING'
  | 'COMPLETED'
  | 'FAILED';

export type EnumSourceAssetStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'ERROR';

export interface ImageCardBatchSettings {
  mode?: CardMode;
  removeWhiteBackground?: boolean;
  autoPlacement?: boolean;
  templateIds?: string[];
}

/** Один загруженный макет принта. */
export interface ImageCardSource {
  id: string;
  createdAt: string;
  batchId: string;
  originalName: string;
  /** Очищенное имя, из которого строятся имена итоговых файлов. */
  baseName: string;
  sourceType: string;
  sourceFile: string;
  widthPx: number;
  heightPx: number;
  hasAlpha: boolean;
  status: EnumSourceAssetStatus;
  errorMessage: string | null;
}

export interface ImageCardBatchProgress {
  total: number;
  ready: number;
  failed: number;
  pending: number;
  done: number;
}

/** Сводка по пачке — то, что показывается отчётом. */
export interface ImageCardBatchReport {
  sourcesTotal: number;
  sourcesReady: number;
  sourcesFailed: number;
  cardsExpected: number;
  cardsTotal: number;
  generated: number;
  reviewRequired: number;
  approved: number;
  finalized: number;
  failed: number;
  skipped: number;
}

export interface ImageCardBatch {
  id: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  status: EnumCardBatchStatus;
  settings: ImageCardBatchSettings;
  completedAt: string | null;
  createdBy?: { id: string; username: string } | null;
  sources?: ImageCardSource[];
  progress?: ImageCardBatchProgress;
  report?: ImageCardBatchReport;
  _count?: { sources: number; cards: number };
}

export type EnumGeneratedCardStatus =
  | 'GENERATED'
  | 'REVIEW_REQUIRED'
  | 'APPROVED'
  | 'FINALIZED'
  | 'ERROR'
  | 'SKIPPED';

/** Положение принта в долях области размещения. */
export interface CardTransform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

export interface ImageCardGenerated {
  id: string;
  createdAt: string;
  updatedAt: string;
  batchId: string;
  sourceId: string;
  templateId: string;
  shirtColor: string;
  status: EnumGeneratedCardStatus;
  transform: Partial<CardTransform>;
  removeWhiteBackground: boolean;
  previewFile: string | null;
  finalFile: string | null;
  /** Почему карточку стоит посмотреть либо что с ней пошло не так. */
  note: string | null;
  /** Снимок шаблона на момент сборки: им карточка и рисуется. */
  templateSnapshot?: Record<string, unknown>;
  source: {
    id: string;
    originalName: string;
    baseName: string;
    widthPx: number;
    heightPx: number;
  };
}
