import { buildOrdersOrderBy } from './order-photo.service';

/**
 * Порядок списка заказов.
 *
 * Без выбора список отвечает на вопрос «что делать сейчас»: активные
 * сверху, срочные выше, дальше по дате. Этот порядок важнее любой
 * сортировки в ежедневной работе, и подменять его молча нельзя.
 *
 * С выбором — наоборот: человек нажал «по сумме» и ждёт список по
 * сумме. Оставить часть прежнего порядка значит показать дешёвый заказ
 * выше дорогого без видимой причины, то есть сломанную сортировку.
 */
describe('порядок списка заказов', () => {
  it('без выбора — обычный порядок работы, закрытые внизу', () => {
    const order = buildOrdersOrderBy(undefined, undefined);
    expect(order[0]).toEqual({ closedAt: { sort: 'asc', nulls: 'first' } });
    expect(order[1]).toEqual({ isUrgent: 'desc' });
  });

  it('по дедлайну — от позднего к раннему и обратно', () => {
    expect(buildOrdersOrderBy('deadline', 'desc')[0]).toEqual({
      deadline: { sort: 'desc', nulls: 'last' },
    });
    expect(buildOrdersOrderBy('deadline', 'asc')[0]).toEqual({
      deadline: { sort: 'asc', nulls: 'last' },
    });
  });

  it('заказы без срока уходят в конец при любом направлении', () => {
    // Пустой дедлайн — не «самый ранний» и не «самый поздний», его нет.
    // Наверху списка он занимал бы место настоящих сроков.
    for (const dir of ['asc', 'desc'] as const) {
      expect(buildOrdersOrderBy('deadline', dir)[0]).toMatchObject({
        deadline: { nulls: 'last' },
      });
    }
  });

  it('по сумме — по полю заказа, а не по позициям', () => {
    expect(buildOrdersOrderBy('total', 'desc')[0]).toEqual({
      totalOrder: 'desc',
    });
  });

  it('выбранный порядок вытесняет прежний целиком', () => {
    // Иначе на экране это выглядит как сломанная сортировка.
    const order = buildOrdersOrderBy('total', 'desc');
    expect(JSON.stringify(order)).not.toContain('closedAt');
    expect(JSON.stringify(order)).not.toContain('isUrgent');
  });

  it('у одинаковых значений порядок устойчивый', () => {
    // Без второго ключа две строки с одним сроком меняются местами между
    // страницами: заказ показывается дважды или не показывается вовсе.
    expect(buildOrdersOrderBy('deadline', 'asc')[1]).toEqual({
      createdAt: 'asc',
    });
    expect(buildOrdersOrderBy('total', 'asc')[1]).toEqual({
      createdAt: 'asc',
    });
  });

  it('неизвестное направление считается убыванием, а не ошибкой', () => {
    // Параметр приходит из адреса страницы и может быть любым.
    expect(buildOrdersOrderBy('total', undefined)[0]).toEqual({
      totalOrder: 'desc',
    });
  });
});
