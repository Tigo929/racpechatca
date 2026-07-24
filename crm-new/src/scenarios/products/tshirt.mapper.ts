import type {
  EnumPrintLocation,
  EnumTshirtGender,
  EnumTshirtSize,
} from 'src/generated/prisma/enums';
import type { Answers } from '../scenario.types';
import {
  bool,
  date,
  deliveryOf,
  noteOf,
  num,
  str,
  type ScenarioOrderMapping,
} from '../scenario.mapping';

/**
 * Футболки → заказ.
 *
 * Здесь, в отличие от фотопечати, цена именно за штуку: на ней держится расчёт
 * с партнёром (материалы вычитаются из цены позиции). Договорную цену за всю
 * пачку тут ставить нельзя — расчёт партнёра станет неверным.
 *
 * Разработка дизайна — отдельная строка заказа, а не стоимость внутри позиции:
 * партнёру она не уходит и в его вознаграждении не участвует.
 */
export function tshirtToOrder(a: Answers): ScenarioOrderMapping {
  const quantity = Math.max(1, num(a, 'quantity'));
  const designNeeded = bool(a, 'designNeeded');
  const brief = str(a, 'designBrief');

  return {
    productCategory: 'TSHIRT',
    ...deliveryOf(a),
    deadline: date(a, 'deadline'),
    isUrgent: bool(a, 'isUrgent'),
    note: noteOf(a),
    tshirtModel: str(a, 'tshirtModel') || null,
    designDevelopmentCost: designNeeded ? num(a, 'designDevelopmentCost') : 0,
    photoItems: [],
    tshirtItems: [
      {
        color: str(a, 'color') || '—',
        size: (str(a, 'size') || 'M') as EnumTshirtSize,
        gender: (str(a, 'gender') || 'UNISEX') as EnumTshirtGender,
        printLocation: (str(a, 'printLocation') || 'FRONT') as EnumPrintLocation,
        // Способ печати в сценарии не спрашиваем: у партнёра это всегда DTF.
        // Появится второй — станет полем сценария, а не правкой этого файла.
        printType: 'DTF',
        quantity,
        price: num(a, 'pricePerItem'),
        clientItem: bool(a, 'clientItem'),
        designNote: brief || undefined,
      },
    ],
  };
}
