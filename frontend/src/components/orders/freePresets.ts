/**
 * Название позиции «печать на изделии заказчика».
 *
 * Раньше здесь лежал список готовых названий, и рядом с полем стояли
 * кнопки-подсказки. Вместе с галочкой ниже это давало три надписи об одном
 * и том же на одном экране: два варианта названия и та же формулировка
 * в самой галочке. Осталось одно название, и подставляет его выбор режима —
 * человеку не нужно выбирать между «нанесение принта» и «печать», если
 * система всё равно считает их одинаково.
 */
export const CLIENT_ITEM_PRINT_NAME = 'Нанесение принта на изделие заказчика';

/** Название позиции «печать термотрансферов» — по тому же правилу. */
export const TRANSFER_PRINT_NAME = 'Печать термотрансферов';

/** Пояснение под полем цены: количество на неё не влияет. */
export const FREE_PRICE_HINT =
  'Договорная сумма за всю позицию — на количество не умножается.';

/**
 * Как платим партнёру за свободную позицию.
 *
 * Режимов стало три, и галочка «изделие заказчика» перестала отвечать на
 * вопрос: печать термотрансферов — тоже работа исполнителя, но изделия в
 * ней нет и вычитать из его доли нечего. Два флажка рядом позволяли
 * поставить оба сразу и получить позицию, про которую непонятно, как её
 * считать, поэтому выбор один и взаимоисключающий.
 */
export type PartnerPayout = 'NONE' | 'MARGIN_SHARE' | 'REVENUE_SHARE';

export interface PayoutOption {
  value: PartnerPayout;
  label: string;
  hint: string;
  /** Название, которое подставляется в пустое поле при выборе режима. */
  presetName?: string;
}

export const PAYOUT_OPTIONS: readonly PayoutOption[] = [
  {
    value: 'NONE',
    label: 'Не платим — работа не партнёра',
    hint: 'Кружка, багет, срочность и прочее, что исполнитель не делает.',
  },
  {
    value: 'MARGIN_SHARE',
    label: 'Доля от маржи — печать по изделию заказчика',
    hint: 'Заготовку не покупаем. Партнёру возвращаем плёнку и платим долю от того, что осталось.',
    presetName: CLIENT_ITEM_PRINT_NAME,
  },
  {
    value: 'REVENUE_SHARE',
    label: 'Процент от суммы — печать термотрансферов',
    hint: 'Изделия нет, плёнку печатает исполнитель. Процент считается от суммы позиции, себестоимость не вычитается.',
    presetName: TRANSFER_PRINT_NAME,
  },
];

export function payoutOption(value: PartnerPayout): PayoutOption {
  return PAYOUT_OPTIONS.find((o) => o.value === value) ?? PAYOUT_OPTIONS[0];
}

/**
 * Режим позиции, пришедшей с сервера.
 *
 * У позиций, заведённых до появления режимов, поля нет — тогда отвечаем по
 * старому флагу, ровно как это делает сервер. Иначе в форме редактирования
 * у давно оформленной позиции стояло бы «не платим», и первое же сохранение
 * молча отняло бы у исполнителя деньги.
 */
export function payoutOf(item: {
  partnerPayout?: PartnerPayout | null;
  printOnClientItem?: boolean | null;
}): PartnerPayout {
  if (item.partnerPayout) return item.partnerPayout;
  return item.printOnClientItem ? 'MARGIN_SHARE' : 'NONE';
}

/** Проценты из поля в сотые доли процента для сервера. Пусто — не передаём. */
export function ratePercentToBasisPoints(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed.replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) return undefined;
  return Math.round(parsed * 100);
}

/** Обратно — чтобы в форме правки показать уже зафиксированную ставку. */
export function basisPointsToRatePercent(
  value: number | null | undefined,
): string {
  if (value == null) return '';
  return String(value / 100);
}
