import { describe, expect, it } from 'vitest';
import {
  approvalCoverage,
  dispatchBlockers,
  orphanApprovals,
  requiresClientSend,
} from './approval-coverage';
import type { ItemTshirt, PrintApproval } from '../types/index';

/**
 * Зеркало серверного правила (crm-new/src/approval/approval-coverage.ts).
 * Оно показывает человеку, какой размер ещё без макета, и закрывает кнопку
 * отправки исполнителю. Расходиться с сервером нельзя: тогда кнопка
 * открыта, а заказ всё равно не уходит — или наоборот.
 */

const position = (id: string, size: string, quantity = 1) =>
  ({ id, size, color: 'Чёрный', quantity }) as unknown as ItemTshirt;

const sheet = (itemId: string | null, sent = false) =>
  ({
    id: `ap-${itemId}`,
    itemId,
    version: 1,
    previewFile: 'sheet.png',
    telegramDelivery: sent ? { status: 'SENT' } : null,
  }) as unknown as PrintApproval;

describe('макеты по позициям во фронте', () => {
  const positions = [position('a', 'S'), position('b', 'M')];

  it('позиция видит только свои макеты', () => {
    const coverage = approvalCoverage(positions, [sheet('a', true)]);
    expect(coverage.map((c) => [c.ready, c.sent])).toEqual([
      [true, true],
      [false, false],
    ]);
  });

  it('макет без привязки закрывает единственную позицию', () => {
    expect(approvalCoverage([position('a', 'S')], [sheet(null)])[0].ready).toBe(
      true,
    );
  });

  it('и не закрывает ничего в заказе на два размера', () => {
    const coverage = approvalCoverage(positions, [sheet(null)]);
    expect(coverage.every((c) => !c.ready)).toBe(true);
    // Такой лист виден отдельно: человеку надо сказать, что он не считается.
    expect(orphanApprovals(positions, [sheet(null)])).toHaveLength(1);
  });

  it('отправку клиенту требуем только там, где её делает CRM', () => {
    expect(requiresClientSend('TELEGRAM', false)).toBe(true);
    expect(requiresClientSend('OZON', false)).toBe(true);
    expect(requiresClientSend('AVITO', false)).toBe(false);
    // Заказ с площадки согласования не ждёт.
    expect(requiresClientSend('OZON', true)).toBe(false);
  });

  it('причины называют размер и считают ТЗ-файлы', () => {
    const blockers = dispatchBlockers({
      coverage: approvalCoverage(positions, [sheet('a')]),
      requireSent: true,
      techSpecCount: 1,
    });
    expect(blockers).toEqual([
      'Макет не собран: Чёрный M(48)',
      'Макет не отправлен клиенту: Чёрный S(46)',
      'ТЗ-файлов 1, а позиций 2 — нужен файл на каждую',
    ]);
  });

  it('всё на месте — препятствий нет', () => {
    expect(
      dispatchBlockers({
        coverage: approvalCoverage(positions, [sheet('a', true), sheet('b', true)]),
        requireSent: true,
        techSpecCount: 2,
      }),
    ).toEqual([]);
  });
});
