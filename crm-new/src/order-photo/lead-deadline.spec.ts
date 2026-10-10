import { EnumProductCategory, EnumStatus } from 'src/generated/prisma/enums';
import { deadlineOnAccept } from './deadline-start';

/**
 * Срок начинает идти, когда обращение стало заказом.
 *
 * Заявка с сайта приходит без срока и лежит в «Обращениях», пока с
 * человеком не договорились. Если считать три дня от момента, когда её
 * прислали, заказ попадает в работу уже «просроченным» — и тревожная
 * подпись перестаёт что-либо значить на всех остальных заказах.
 *
 * Здесь проверяется то самое правило, которым пользуется сервер при смене
 * статуса, — не его копия.
 */

const lead = {
  status: EnumStatus.LEAD,
  deadline: null,
  productCategory: EnumProductCategory.PHOTO,
};

describe('срок у заявки с сайта', () => {
  it('ставится при переводе обращения в работу', () => {
    const now = new Date('2026-10-10T12:00:00Z');
    const patch = deadlineOnAccept(lead, EnumStatus.NEW, now);
    expect(patch.deadline?.toISOString()).toBe('2026-10-13T12:00:00.000Z');
  });

  it('пока заявка остаётся обращением, срока нет', () => {
    expect(deadlineOnAccept(lead, EnumStatus.LEAD)).toEqual({});
  });

  it('заданный вручную срок правкой статуса не трогаем', () => {
    const fixed = { ...lead, deadline: new Date('2026-10-20T00:00:00Z') };
    expect(deadlineOnAccept(fixed, EnumStatus.NEW)).toEqual({});
  });

  it('у футболок срока нет вовсе: его ведёт партнёр', () => {
    const tshirt = { ...lead, productCategory: EnumProductCategory.TSHIRT };
    expect(deadlineOnAccept(tshirt, EnumStatus.NEW)).toEqual({});
  });

  it('заказ, уже бывший в работе, срок не переставляет', () => {
    // Иначе возврат статуса назад давал бы лишние три дня.
    const inWork = { ...lead, status: EnumStatus.NEW };
    expect(deadlineOnAccept(inWork, EnumStatus.IN_PROGRESS)).toEqual({});
  });

  it('обращение можно перевести сразу дальше — срок всё равно появится', () => {
    expect(deadlineOnAccept(lead, EnumStatus.IN_PROGRESS).deadline).toBeInstanceOf(
      Date,
    );
  });
});
