import { describe, expect, it } from 'vitest';
import { nextSort } from './orders-sort';

/**
 * Нажатия по заголовку столбца.
 *
 * Порядок работы в списке — главное, что он сообщает: активные сверху,
 * срочные выше. Сортировка его временно отменяет, и вернуть его надо
 * уметь тем же жестом, которым отменили.
 */
describe('переключение порядка списка', () => {
  it('первое нажатие — по убыванию', () => {
    // У дедлайна это «сначала самые поздние», у суммы — «самые дорогие».
    expect(nextSort({}, 'deadline')).toEqual({ sort: 'deadline', dir: 'desc' });
  });

  it('второе нажатие переворачивает', () => {
    expect(nextSort({ sort: 'deadline', dir: 'desc' }, 'deadline')).toEqual({
      sort: 'deadline',
      dir: 'asc',
    });
  });

  it('третье возвращает обычный порядок работы', () => {
    // Иначе человек остаётся в выбранном порядке навсегда и теряет из
    // виду, что горит.
    expect(nextSort({ sort: 'deadline', dir: 'asc' }, 'deadline')).toEqual({});
  });

  it('другой столбец начинает с убывания, а не продолжает чужое направление', () => {
    expect(nextSort({ sort: 'deadline', dir: 'asc' }, 'total')).toEqual({
      sort: 'total',
      dir: 'desc',
    });
  });
});
