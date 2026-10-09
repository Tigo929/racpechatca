import { describe, expect, it } from 'vitest';
import {
  marketplaceStage,
  stageCounts,
  STAGE_ORDER,
  type MarketplaceCrmOrder,
} from './marketplace-stage';

/**
 * Этап отправления в нашем процессе.
 *
 * Столбец «Статус» в списке отправлений отвечает на вопрос «что с этим
 * заказом у нас», а не «что с ним у Ozon». Если подписи поедут, список
 * снова станет колонкой из одинакового текста, по которой ничего не найти.
 */

const crm = (over: Partial<MarketplaceCrmOrder> = {}): MarketplaceCrmOrder => ({
  id: 'o1',
  numberOrder: '20261008-3',
  status: 'NEW',
  approvalStatus: null,
  ...over,
});

describe('этап отправления', () => {
  it('заказа в CRM нет — «Не заведён», а не «Новый»', () => {
    // Разные вещи: из «не заведён» печатник не получит ничего.
    expect(marketplaceStage(null).label).toBe('Не заведён');
    expect(marketplaceStage(undefined).label).toBe('Не заведён');
  });

  it('заказ заведён — «Новый»', () => {
    expect(marketplaceStage(crm({ status: 'NEW' })).label).toBe('Новый');
  });

  it('лист ушёл клиенту — «На согласовании»', () => {
    expect(marketplaceStage(crm({ status: 'APPROVAL_SENT' })).label).toBe(
      'На согласовании',
    );
  });

  it('клиент подтвердил макет — «Согласован», хотя статус заказа ещё прежний', () => {
    // Своего статуса у этого шага нет: ответ приходит по листу.
    expect(
      marketplaceStage(
        crm({ status: 'APPROVAL_SENT', approvalStatus: 'APPROVED' }),
      ).label,
    ).toBe('Согласован');
  });

  it('правки от клиента согласованием не считаются', () => {
    expect(
      marketplaceStage(
        crm({ status: 'APPROVAL_SENT', approvalStatus: 'CHANGES_REQUESTED' }),
      ).label,
    ).toBe('На согласовании');
  });

  it('после передачи в производство статус заказа главнее ответа по макету', () => {
    // Иначе заказ у печатника показывался бы как «Согласован» — шаг назад.
    expect(
      marketplaceStage(crm({ status: 'SENT', approvalStatus: 'APPROVED' })).label,
    ).toBe('Передан в производство');
    expect(
      marketplaceStage(crm({ status: 'READY', approvalStatus: 'APPROVED' })).label,
    ).toBe('Готов');
  });

  it('отгруженный заказ назван так же, как в списке заказов', () => {
    expect(marketplaceStage(crm({ status: 'COMPLETED' })).label).toBe('Отгружен');
  });

  it('обращение показываем как новый заказ: в CRM он уже есть', () => {
    expect(marketplaceStage(crm({ status: 'LEAD' })).label).toBe('Новый');
  });

  it('у соседних этапов разные цвета — иначе столбец снова нечитаем', () => {
    const colors = [
      marketplaceStage(null),
      marketplaceStage(crm({ status: 'NEW' })),
      marketplaceStage(crm({ status: 'APPROVAL_SENT' })),
      marketplaceStage(crm({ status: 'APPROVAL_SENT', approvalStatus: 'APPROVED' })),
      marketplaceStage(crm({ status: 'SENT' })),
      marketplaceStage(crm({ status: 'COMPLETED' })),
    ];
    expect(new Set(colors.map((s) => s.chip)).size).toBe(colors.length);
    expect(new Set(colors.map((s) => s.stripe)).size).toBe(colors.length);
  });

  it('полоса слева и значок красятся одним цветом', () => {
    const stage = marketplaceStage(crm({ status: 'APPROVAL_SENT' }));
    expect(stage.chip).toContain('amber');
    expect(stage.stripe).toContain('amber');
  });
});

describe('фильтры по этапам', () => {
  const posting = (over: Partial<MarketplaceCrmOrder> | null) => ({
    crm: over === null ? null : crm(over),
  });

  it('считает отправления по этапам', () => {
    const counts = stageCounts([
      posting(null),
      posting(null),
      posting({ status: 'NEW' }),
      posting({ status: 'APPROVAL_SENT' }),
      posting({ status: 'APPROVAL_SENT', approvalStatus: 'APPROVED' }),
      posting({ status: 'COMPLETED' }),
    ]);
    expect(counts).toEqual([
      { key: 'NOT_CREATED', label: 'Не заведён', count: 2 },
      { key: 'NEW', label: 'Новый', count: 1 },
      { key: 'APPROVAL_SENT', label: 'На согласовании', count: 1 },
      { key: 'APPROVED', label: 'Согласован', count: 1 },
      { key: 'COMPLETED', label: 'Отгружен', count: 1 },
    ]);
  });

  it('порядок кнопок — рабочий, а не алфавитный', () => {
    // Сверху вниз по нему заказ и движется: видно, где начало очереди.
    const counts = stageCounts([
      posting({ status: 'COMPLETED' }),
      posting({ status: 'NEW' }),
      posting(null),
    ]);
    expect(counts.map((c) => c.key)).toEqual(['NOT_CREATED', 'NEW', 'COMPLETED']);
  });

  it('пустых кнопок не делаем: этап без заказов не показывается', () => {
    const counts = stageCounts([posting({ status: 'NEW' })]);
    expect(counts).toHaveLength(1);
    expect(counts[0].key).toBe('NEW');
  });

  it('список пуст — кнопок нет вовсе', () => {
    expect(stageCounts([])).toEqual([]);
  });

  it('унаследованные статусы не теряются: уходят в общий этап', () => {
    // Заказ со старым статусом должен остаться видимым хоть под какой-то
    // кнопкой, иначе он пропадёт из работы совсем.
    const counts = stageCounts([posting({ status: 'FOLDER_STRUCTURE_CREATED' })]);
    expect(counts).toHaveLength(1);
    expect(counts[0].key).toBe('OTHER');
    expect(counts[0].count).toBe(1);
  });

  it('у каждого этапа из порядка есть место в фильтрах', () => {
    expect(new Set(STAGE_ORDER).size).toBe(STAGE_ORDER.length);
  });
});
