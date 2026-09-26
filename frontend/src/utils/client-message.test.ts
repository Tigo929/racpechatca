import { describe, expect, it } from 'vitest';
import { buildClientMessage, prepaymentNeedsAttention } from './client-message';
import type { OrderPhoto } from '../types/index';

/**
 * Два сообщения клиенту — одна цепочка.
 *
 * Эти тесты сторожат не формулировки, а три свойства, из-за которых
 * менеджер жаловался: текст должен выглядеть одинаково во всех каналах
 * (никакой разметки, которая доходит звёздочками), подтверждение и
 * готовность должны называть одни и те же деньги, и ни в одном из них
 * не должно быть внутренних реплик CRM.
 */

const order = (patch: Partial<OrderPhoto> = {}): OrderPhoto =>
  ({
    id: 'order-1',
    createdAt: '2026-09-20T09:00:00.000Z',
    updatedAt: '2026-09-20T09:00:00.000Z',
    numberOrder: '20260920-001',
    sourceOrder: 'AVITO',
    communicationPlatform: 'AVITO',
    urlCommunication: 'https://avito.ru/chat',
    deliveryMethod: 'PICKUP',
    deliveryCost: 0,
    totalOrder: 3000,
    status: 'NEW',
    productCategory: 'PHOTO',
    isUrgent: false,
    prepaidAmount: null,
    items: [
      {
        id: 'item-1',
        formatPaper: '10x15',
        typePaper: 'GLOSS',
        quantity: 10,
        price: 300,
        pricePosition: 3000,
      },
    ],
    ...patch,
  }) as unknown as OrderPhoto;

describe('сообщение клиенту', () => {
  it('не содержит разметки, которая доходит до клиента символами', () => {
    // Звёздочки и подчёркивание юникодной линией под каждым знаком —
    // это и было «криво скопировалось» в Авито, Ozon и на iPhone.
    for (const kind of ['CONFIRMATION', 'READY'] as const) {
      const text = buildClientMessage(
        order({ deliveryMethod: 'YANDEX_PVZ', deliveryCost: 400, status: 'READY' }),
        kind,
      );
      expect(text).not.toContain('**');
      expect(text).not.toContain('__');
      expect(text).not.toContain(String.fromCharCode(0x0332));
    }
  });

  it('в Telegram номер заказа моноширинный, в остальных каналах — обычный', () => {
    const tg = buildClientMessage(
      order({ communicationPlatform: 'TELEGRAM' }),
      'CONFIRMATION',
    );
    expect(tg).toContain('`20260920-001`');
    const avito = buildClientMessage(order(), 'CONFIRMATION');
    expect(avito).toContain('20260920-001');
    expect(avito).not.toContain('`');
  });

  it('заказ с маркетплейса назван номером площадки', () => {
    const text = buildClientMessage(
      order({ marketplaceOrderNumber: '0123-4567-8901' }),
      'READY',
    );
    expect(text).toContain('0123-4567-8901');
    expect(text).not.toContain('20260920-001');
  });

  it('готовность называет те же деньги, что и подтверждение', () => {
    // Предоплата не записана: остаётся ориентир 50%, названный при
    // оформлении. Готовность обязана повторить его, а не выставить счёт
    // на всю сумму заново.
    const unpaid = order({ status: 'READY', prepaidAmount: null });
    const confirmation = buildClientMessage(unpaid, 'CONFIRMATION');
    const ready = buildClientMessage(unpaid, 'READY');
    const sum = (1500).toLocaleString('ru-RU');
    expect(confirmation).toContain(`предоплата 50%: ${sum}`);
    expect(ready).toContain(`Предоплата: ${sum}`);
    expect(ready).toContain(`Осталось доплатить: ${sum}`);
    expect(ready).not.toContain('3 000 ₽ (до подтверждения');
  });

  it('в сообщении клиенту нет служебных реплик CRM', () => {
    const text = buildClientMessage(
      order({ status: 'READY', prepaidAmount: null }),
      'READY',
    );
    expect(text).not.toContain('CRM');
    expect(text).not.toContain('не отмечена');
    expect(text).not.toContain('перед выдачей');
  });

  it('записанная предоплата считается от реальной суммы', () => {
    const text = buildClientMessage(
      order({ status: 'READY', prepaidAmount: 2000 }),
      'READY',
    );
    expect(text).toContain(`Предоплата: ${(2000).toLocaleString('ru-RU')}`);
    expect(text).toContain(`Осталось доплатить: ${(1000).toLocaleString('ru-RU')}`);
  });

  it('переплата называется возвратом, а не доплатой с минусом', () => {
    const text = buildClientMessage(
      order({ status: 'READY', prepaidAmount: 3500 }),
      'READY',
    );
    expect(text).toContain('Переплата к возврату');
    expect(text).not.toContain('−500');
  });

  it('полностью оплаченный заказ не просит денег', () => {
    const text = buildClientMessage(
      order({ status: 'READY', prepaidAmount: 3000 }),
      'READY',
    );
    expect(text).toContain('Заказ оплачен полностью');
  });

  it('состав, суммы и реквизиты одинаковы в обоих сообщениях', () => {
    const paid = order({ status: 'READY', prepaidAmount: 1500, deliveryCost: 0 });
    const confirmation = buildClientMessage(paid, 'CONFIRMATION').split('\n');
    const ready = buildClientMessage(paid, 'READY').split('\n');
    const composition = (lines: string[]) => lines.filter((l) => l.startsWith('•'));
    expect(composition(ready)).toEqual(composition(confirmation));
    const totals = (lines: string[]) =>
      lines.filter((l) => l.startsWith('💰') || l.startsWith('📦 Итого'));
    expect(totals(ready)).toEqual(totals(confirmation));
    const requisites = (lines: string[]) =>
      lines.slice(lines.findIndex((l) => l.startsWith('📲')));
    expect(requisites(ready)[1]).toEqual(requisites(confirmation)[1]);
  });

  it('срок изготовления обещаем только в подтверждении', () => {
    const o = order({ status: 'READY', prepaidAmount: 1500 });
    expect(buildClientMessage(o, 'CONFIRMATION')).toContain('Срок изготовления');
    expect(buildClientMessage(o, 'READY')).not.toContain('Срок изготовления');
  });

  it('скидка названа отдельной строкой — иначе итог не сходится', () => {
    const text = buildClientMessage(
      order({ discountAmount: 500, totalOrder: 2500 }),
      'CONFIRMATION',
    );
    expect(text).toContain(`Скидка: −${(500).toLocaleString('ru-RU')}`);
  });

  it('напоминание о ПВЗ есть только у доставки в пункт выдачи', () => {
    const pvz = buildClientMessage(
      order({ deliveryMethod: 'YANDEX_PVZ', deliveryCost: 400 }),
      'READY',
    );
    expect(pvz).toContain('Яндекс ПВЗ и номер телефона');
    expect(buildClientMessage(order(), 'READY')).not.toContain('номер телефона');
  });

  it('предупреждение о предоплате — задача карточки, а не текста', () => {
    expect(prepaymentNeedsAttention(order({ status: 'READY' }))).toBe(true);
    expect(
      prepaymentNeedsAttention(order({ status: 'READY', prepaidAmount: 1500 })),
    ).toBe(false);
    // Оплаченный заказ проверять нечего.
    expect(prepaymentNeedsAttention(order({ status: 'PAID' }))).toBe(false);
  });
});
