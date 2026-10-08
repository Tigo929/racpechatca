import { describe, expect, it } from 'vitest';
import { marketplaceStage, type MarketplaceCrmOrder } from './marketplace-stage';

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
