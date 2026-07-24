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

const PAPER_LABEL: Record<string, string> = {
  GLOSS: 'глянец',
  MATTE: 'мат',
};

/**
 * Фотопечать → заказ.
 *
 * Позиция одна и с договорной ценой: менеджер согласовывает с клиентом сумму за
 * всю пачку, а не цену за штуку. Количество при этом сохраняем — оно нужно
 * исполнителю, просто на сумму не умножается.
 */
export function photoToOrder(a: Answers): ScenarioOrderMapping {
  const format = str(a, 'photoFormat');
  const formatLabel =
    format === 'other' ? str(a, 'photoFormatOther') || 'Печать' : format;
  const paper = str(a, 'paperType');
  const paperLabel = PAPER_LABEL[paper] ?? '';
  const quantity = Math.max(1, num(a, 'quantity'));

  const retouch = str(a, 'retouchNote');

  return {
    productCategory: 'PHOTO',
    ...deliveryOf(a),
    deadline: date(a, 'deadline'),
    isUrgent: bool(a, 'isUrgent'),
    note: noteOf(a, retouch ? [`Обработка: ${retouch}`] : []),
    tshirtModel: null,
    designDevelopmentCost: 0,
    photoItems: [
      {
        formatPaper: paperLabel ? `${formatLabel} (${paperLabel})` : formatLabel,
        typePaper: paper === 'MATTE' ? 'MATTE' : 'GLOSS',
        quantity,
        price: num(a, 'photoPrice'),
        isFreePrice: true,
      },
    ],
    tshirtItems: [],
  };
}
