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

  it('отметку об отправке показываем, но производство ею не держим', () => {
    // Подпись в таблице позиций зависит от канала: там, где отправляет
    // сама CRM, видно «клиенту не отправлен».
    expect(requiresClientSend('TELEGRAM', false)).toBe(true);
    expect(requiresClientSend('AVITO', false)).toBe(false);
    expect(requiresClientSend('OZON', true)).toBe(false);
    // А в причинах отказа отправки клиенту нет: CRM может до клиента не
    // дотянуться, и тогда лист отправляет человек.
    expect(
      dispatchBlockers({
        coverage: approvalCoverage(positions, [sheet('a'), sheet('b')]),
        techSpecCount: 2,
      }),
    ).toEqual([]);
  });

  it('причины называют размер и считают ТЗ-файлы', () => {
    const blockers = dispatchBlockers({
      coverage: approvalCoverage(positions, [sheet('a')]),
      techSpecCount: 1,
    });
    expect(blockers).toEqual([
      'Макет не собран: Чёрный M(48)',
      'ТЗ-файлов 1, а позиций 2 — нужен файл на каждую',
    ]);
  });

  it('количество в позиции в число файлов не складывается', () => {
    expect(
      dispatchBlockers({
        coverage: approvalCoverage([position('a', 'S', 4)], [sheet('a')]),
        techSpecCount: 1,
      }),
    ).toEqual([]);
  });
});
