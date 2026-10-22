import { beforeEach, expect, it, vi } from 'vitest';
import { ordersApi } from './orders';
import { api } from './client';

/**
 * Сборка строки запроса к списку заказов.
 *
 * Параметры здесь перечисляются вручную, и забытый параметр ломается тихо:
 * интерфейс показывает активный фильтр, запрос уходит без него, сервер
 * применяет своё правило по умолчанию. Так и случилось с отбором «Откуда»:
 * заказы с маркетплейсов в списке футболок сервер скрывает, пока его не
 * попросят явно, а просьба до него не доезжала — и заказы Ozon выглядели
 * как отсутствующие.
 *
 * Поэтому проверяем не поведение экрана, а то, что каждый фильтр доходит
 * до сервера.
 */

vi.mock('./client', () => ({
  api: { get: vi.fn().mockResolvedValue({ data: { data: [], meta: {} } }) },
}));

/** Разбирает URL последнего запроса в набор параметров. */
function lastQuery(): URLSearchParams {
  const calls = vi.mocked(api.get).mock.calls;
  const url = String(calls[calls.length - 1]?.[0] ?? '');
  return new URLSearchParams(url.slice(url.indexOf('?') + 1));
}

beforeEach(() => vi.clearAllMocks());

it('передаёт отбор «только с маркетплейса» на сервер', async () => {
  await ordersApi.getAll({ productCategory: 'TSHIRT', marketplace: 'only' });
  expect(lastQuery().get('marketplace')).toBe('only');
});

it('передаёт «по заявкам» и «все» — это разные списки', async () => {
  await ordersApi.getAll({ productCategory: 'TSHIRT', marketplace: 'exclude' });
  expect(lastQuery().get('marketplace')).toBe('exclude');

  await ordersApi.getAll({ productCategory: 'TSHIRT', marketplace: 'all' });
  expect(lastQuery().get('marketplace')).toBe('all');
});

it('без отбора параметр не посылается — у сервера своё правило по умолчанию', async () => {
  await ordersApi.getAll({ productCategory: 'TSHIRT' });
  expect(lastQuery().has('marketplace')).toBe(false);
});

it('счётчики считают по тому же отбору, что и список', async () => {
  // Иначе на экране «С маркетплейса» список один, а числа по статусам — от
  // другого набора заказов.
  await ordersApi.getStats({ productCategory: 'TSHIRT', marketplace: 'only' });
  expect(lastQuery().get('marketplace')).toBe('only');
});

it('остальные фильтры тоже доезжают', async () => {
  await ordersApi.getAll({
    page: 2,
    limit: 25,
    status: 'NEW',
    sourceOrder: 'WEBSITE',
    productCategory: 'PHOTO',
    search: '20261020',
    executorId: 'user-1',
  });
  const query = lastQuery();
  expect(query.get('page')).toBe('2');
  expect(query.get('limit')).toBe('25');
  expect(query.get('status')).toBe('NEW');
  expect(query.get('sourceOrder')).toBe('WEBSITE');
  expect(query.get('productCategory')).toBe('PHOTO');
  expect(query.get('search')).toBe('20261020');
  expect(query.get('executorId')).toBe('user-1');
});
