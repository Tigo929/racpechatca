import { ClientInvoiceService } from './client-invoice.service';

/**
 * Счёт, который уходит клиенту сам.
 *
 * Проверяем то, из-за чего эту очередь вообще можно доверить автомату:
 * воркер получает готовый текст (а не собирает его сам), удача закрывает
 * заказ от повторной отправки, а отказ зовёт человека с причиной.
 */

const confirmed = {
  id: 'o1',
  numberOrder: '20261106-001',
  urlCommunication: 'https://t.me/client_name',
};

function build(rows: Record<string, unknown>[] = [confirmed]) {
  const findMany = jest.fn().mockResolvedValue(rows);
  const update = jest.fn().mockResolvedValue({
    numberOrder: '20261106-001',
    totalOrder: 1490,
    urlCommunication: 'https://t.me/client_name',
  });
  const sendToOwner = jest.fn().mockResolvedValue(true);
  const textFor = jest
    .fn()
    .mockResolvedValue('✅ Отлично, ваш заказ подтверждён!\nИтого: 1 490 ₽');
  const service = new ClientInvoiceService(
    { orderPhoto: { findMany, update } } as never,
    { sendToOwner } as never,
    { textFor } as never,
  );
  return { service, findMany, update, sendToOwner, textFor };
}

/** Аргумент вызова мока с типом: без него линтер видит `any`. */
function argOf<T>(fn: jest.Mock, call = 0): T {
  return (fn.mock.calls[call] as unknown[])[0] as T;
}

type UpdateCall = { data: Record<string, unknown> };

describe('счёт клиенту после согласия', () => {
  it('в очередь попадает готовый текст подтверждения и ник', async () => {
    const { service, textFor } = build();

    const items = await service.pending(5);

    expect(items).toHaveLength(1);
    expect(items[0].username).toBe('client_name');
    expect(items[0].text).toContain('заказ подтверждён');
    // Текст собирает CRM тем же кодом, что отдаёт его карточке: двух
    // разных писем об одном заказе быть не должно.
    expect(textFor).toHaveBeenCalledWith('o1', 'CONFIRMATION');
  });

  it('заказ без разборчивого ника сразу отдаётся человеку', async () => {
    const { service, update } = build([
      { ...confirmed, urlCommunication: 'телефон 8 900 000 00 00' },
    ]);

    const items = await service.pending(5);

    expect(items).toHaveLength(0);
    expect(argOf<UpdateCall>(update).data).toMatchObject({
      invoiceStatus: 'not_found',
    });
  });

  it('удачная отправка закрывает заказ от повторной и сообщает владельцу', async () => {
    const { service, update, sendToOwner } = build();

    await service.mark('o1', 'sent');

    expect(argOf<UpdateCall>(update).data.invoiceSentAt).toBeInstanceOf(Date);
    expect(argOf<UpdateCall>(update).data.invoiceStatus).toBe('sent');
    const notice = argOf<string>(sendToOwner);
    expect(notice).toContain('Счёт отправлен клиенту');
    expect(notice).toContain('1490');
  });

  it('отказ не ставит отметку об отправке и называет причину', async () => {
    const { service, update, sendToOwner } = build();

    await service.mark('o1', 'privacy');

    expect(argOf<UpdateCall>(update).data.invoiceSentAt).toBeUndefined();
    const notice = argOf<string>(sendToOwner);
    expect(notice).toContain('Счёт клиенту не ушёл');
    expect(notice).toContain('не принимает сообщения от незнакомых');
    // Человеку нужно сказать, что делать, а не только что сломалось.
    expect(notice).toContain('«Подтверждение»');
  });
});
