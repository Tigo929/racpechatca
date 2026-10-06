import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { approvalChip } from './order-approval-state';
import { MarketplaceBadge } from '../ui/MarketplaceBadge';
import type { ApprovalBrief } from '../../types/index';

/**
 * Отметки в общем списке заказов.
 *
 * Проверяем не вид, а смысл: по списку должно быть понятно, где заказ
 * с площадки и что сейчас с макетом. Если подпись начнёт говорить «ждём
 * клиента» про лист, который клиенту не дошёл, владелец снова будет
 * открывать заказы по одному — ровно то, от чего уходили.
 */

function brief(over: Partial<ApprovalBrief> = {}): ApprovalBrief {
  return { version: 1, status: 'DRAFT', ...over };
}

describe('состояние листа согласования в списке', () => {
  it('листа нет — подписи нет: пустое место честнее слова «нет»', () => {
    expect(approvalChip(undefined)).toBeNull();
    expect(approvalChip([])).toBeNull();
  });

  it('черновик — макет в работе', () => {
    expect(approvalChip([brief({ status: 'DRAFT' })])?.label).toBe('макет в работе');
  });

  it('лист готов, но не отправлен — это действие за нами', () => {
    const chip = approvalChip([brief({ status: 'READY' })]);
    expect(chip?.label).toBe('лист не отправлен');
    expect(chip?.needsAction).toBe(true);
  });

  it('лист у клиента — ждём ответа', () => {
    const chip = approvalChip([
      brief({ status: 'SENT', telegramDelivery: { status: 'SENT' } }),
    ]);
    expect(chip?.label).toBe('ждём ответа клиента');
    expect(chip?.needsAction).toBe(false);
  });

  it('доставка в пути — отдельная подпись, а не «ждём клиента»', () => {
    // Клиент ещё ничего не получил, спрашивать его не о чем.
    for (const status of ['PENDING', 'SENDING'] as const) {
      expect(
        approvalChip([brief({ status: 'SENT', telegramDelivery: { status } })])
          ?.label,
      ).toBe('лист отправляется');
    }
  });

  it('Telegram не доставил — громче всего остального', () => {
    const chip = approvalChip([
      brief({ status: 'SENT', telegramDelivery: { status: 'FAILED', errorCode: 'CHAT_NOT_FOUND' } }),
    ]);
    expect(chip?.label).toBe('лист не доставлен');
    expect(chip?.needsAction).toBe(true);
  });

  it('провал доставки виден и на листе, который ещё значится готовым', () => {
    // Статус листа возвращается в READY при неудаче — подпись не должна
    // превращаться в спокойное «не отправлен».
    expect(
      approvalChip([
        brief({ status: 'READY', telegramDelivery: { status: 'FAILED' } }),
      ])?.label,
    ).toBe('лист не доставлен');
  });

  it('клиент подтвердил — макет согласован', () => {
    expect(approvalChip([brief({ status: 'APPROVED' })])?.label).toBe(
      'макет согласован',
    );
  });

  it('клиент попросил переделать — правки видны в списке', () => {
    const chip = approvalChip([brief({ status: 'CHANGES_REQUESTED' })]);
    expect(chip?.label).toBe('правки от клиента');
    expect(chip?.needsAction).toBe(true);
  });

  it('смотрим на свежую версию: она идёт первой', () => {
    expect(
      approvalChip([
        brief({ version: 3, status: 'APPROVED' }),
        brief({ version: 2, status: 'CHANGES_REQUESTED' }),
      ])?.label,
    ).toBe('макет согласован');
  });

  it('у каждого состояния свой цвет — иначе подпись не работает издалека', () => {
    const colors = new Set(
      (
        [
          'DRAFT',
          'READY',
          'APPROVED',
          'CHANGES_REQUESTED',
        ] as const
      ).map((status) => approvalChip([brief({ status })])?.className),
    );
    expect(colors.size).toBe(4);
  });
});

describe('отметка площадки', () => {
  it('заказ с Ozon назван так же, как в кабинете', () => {
    render(<MarketplaceBadge source="OZON" postingNumber="61338075-0033-1" />);
    expect(screen.getByText('Ozon')).toBeInTheDocument();
    expect(screen.getByTitle(/61338075-0033-1/)).toBeInTheDocument();
  });

  it('Wildberries — своя отметка', () => {
    render(<MarketplaceBadge source="WB" />);
    expect(screen.getByText('WB')).toBeInTheDocument();
  });

  it('свой заказ отметки не получает: она значила бы неправду', () => {
    const { container } = render(<MarketplaceBadge source="AVITO" />);
    expect(container).toBeEmptyDOMElement();
    const site = render(<MarketplaceBadge source="WEBSITE" />);
    expect(site.container).toBeEmptyDOMElement();
  });
});
