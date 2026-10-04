import { missingSides, requiredApprovalSides } from './approval-sides';

/**
 * Какие стороны обязан показать лист согласования.
 *
 * Ошибка здесь доходит до готового изделия: забытая спина у двусторонней
 * печати уходит в производство, печатник делает по листу, и переделывать
 * приходится саму футболку. Поэтому правило живёт отдельной функцией и
 * проверяется по каждому месту печати.
 */
describe('стороны листа согласования по заказу', () => {
  it('печать спереди — только лицевая', () => {
    expect(requiredApprovalSides(['FRONT'])).toEqual({
      sides: ['FRONT'],
      strict: true,
    });
  });

  it('печать сзади — только спина', () => {
    expect(requiredApprovalSides(['BACK'])).toEqual({
      sides: ['BACK'],
      strict: true,
    });
  });

  it('двусторонняя — обе, перед первым', () => {
    expect(requiredApprovalSides(['FRONT_BACK'])).toEqual({
      sides: ['FRONT', 'BACK'],
      strict: true,
    });
  });

  it('по ТЗ — заказ стороны не задаёт, оператора не ограничиваем', () => {
    expect(requiredApprovalSides(['BY_TZ'])).toEqual({
      sides: [],
      strict: false,
    });
  });

  it('место без мокапа (рукав, всё изделие) тоже не ограничивает', () => {
    for (const location of ['SLEEVE_LEFT', 'SLEEVE_RIGHT', 'FULL']) {
      expect(requiredApprovalSides([location]).strict).toBe(false);
    }
  });

  it('незнакомое место не выдумывает сторону', () => {
    expect(requiredApprovalSides(['ЧТО-ТО']).strict).toBe(false);
  });

  it('позиций нет — требовать нечего', () => {
    expect(requiredApprovalSides([])).toEqual({ sides: [], strict: false });
  });

  it('позиции спорят — берём объединение: лишний вопрос дешевле потерянной стороны', () => {
    expect(requiredApprovalSides(['FRONT', 'BACK'])).toEqual({
      sides: ['FRONT', 'BACK'],
      strict: true,
    });
  });

  it('одна позиция «по ТЗ» снимает строгость со всего заказа', () => {
    // По такому заказу уже нельзя сказать, чего не хватает: держать человека
    // на правиле, которое мы сами не знаем, нельзя.
    expect(requiredApprovalSides(['FRONT_BACK', 'BY_TZ']).strict).toBe(false);
  });
});

describe('чего не хватает на листе', () => {
  it('двусторонняя печать без спины — спина названа словами', () => {
    const required = requiredApprovalSides(['FRONT_BACK']);
    expect(missingSides(required, ['FRONT'])).toEqual(['спина']);
  });

  it('двусторонняя печать без переда — названа лицевая', () => {
    const required = requiredApprovalSides(['FRONT_BACK']);
    expect(missingSides(required, ['BACK'])).toEqual(['лицевая сторона']);
  });

  it('обе на месте — не хватает ничего', () => {
    const required = requiredApprovalSides(['FRONT_BACK']);
    expect(missingSides(required, ['FRONT', 'BACK'])).toEqual([]);
  });

  it('пустой лист у двусторонней печати — обе стороны в списке', () => {
    const required = requiredApprovalSides(['FRONT_BACK']);
    expect(missingSides(required, [])).toEqual(['лицевая сторона', 'спина']);
  });

  it('когда заказ стороны не задаёт, не хватает ничего и так', () => {
    expect(missingSides(requiredApprovalSides(['BY_TZ']), [])).toEqual([]);
  });

  it('лишняя сторона не считается нехваткой', () => {
    const required = requiredApprovalSides(['BACK']);
    expect(missingSides(required, ['FRONT', 'BACK'])).toEqual([]);
  });
});
