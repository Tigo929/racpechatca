import { EnumProductCategory, EnumStatus } from 'src/generated/prisma/enums';

/**
 * Когда у заказа начинает идти срок.
 *
 * Заявка с сайта приходит без срока и лежит в «Обращениях», пока с
 * человеком не договорились. Если считать три дня от момента, когда её
 * прислали, заказ попадает в работу уже «просроченным» — и тревожная
 * подпись перестаёт что-либо значить на всех остальных заказах.
 *
 * Поэтому срок ставится в момент, когда обращение переводят в работу:
 * у заказа, заведённого руками, это совпадает с созданием, у заявки
 * с сайта — с тем, когда ею занялись.
 */

/**
 * Сколько дней даётся на заказ по умолчанию. Та же величина, что при
 * создании заказа руками: сроки у ручного и у принятого обращения
 * одинаковые — это один и тот же заказ, просто пришёл разными путями.
 */
export const DEFAULT_DEADLINE_MS = 3 * 24 * 60 * 60 * 1000;

export interface DeadlineStartOrder {
  status: EnumStatus;
  deadline: Date | null;
  productCategory: EnumProductCategory;
}

/**
 * Поле `deadline` для обновления заказа — или пусто, если трогать нечего.
 *
 * Пусто в трёх случаях: заявка остаётся обращением; срок уже есть (задан
 * вручную или поставлен раньше — переводом статуса его не сдвигаем);
 * это футболка, где срок ведёт партнёр-исполнитель.
 */
export function deadlineOnAccept(
  order: DeadlineStartOrder,
  next: EnumStatus,
  now: Date = new Date(),
): { deadline?: Date } {
  const accepted = order.status === EnumStatus.LEAD && next !== EnumStatus.LEAD;
  if (!accepted) return {};
  if (order.deadline) return {};
  if (order.productCategory === EnumProductCategory.TSHIRT) return {};
  return { deadline: new Date(now.getTime() + DEFAULT_DEADLINE_MS) };
}
