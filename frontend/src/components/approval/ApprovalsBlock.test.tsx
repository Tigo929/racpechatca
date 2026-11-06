import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import { ApprovalsBlock } from './ApprovalsBlock';
import { approvalsApi } from '../../api/approvals';
import type { ItemTshirt, PrintApproval } from '../../types';

vi.mock('../../api/approvals', () => ({ approvalsApi: { list: vi.fn(), sendTelegram: vi.fn(), create: vi.fn() } }));
vi.mock('./ApprovalEditor', () => ({ ApprovalEditor: () => null }));

const approval: PrintApproval = {
  id: 'approval', orderId: 'order', version: 1, status: 'READY', shirtColor: 'Белый', shirtSize: 'M',
  createdAt: '2026-09-19T12:00:00Z', updatedAt: '2026-09-19T12:00:00Z', finalizedAt: '2026-09-19T12:00:00Z',
  sides: {}, comment: null, previewFile: 'sheet.png', fileOutdated: false,
};

function show(row: PrintApproval = approval, platform = 'TELEGRAM', url: string | null = '@client_test') {
  vi.mocked(approvalsApi.list).mockResolvedValue([row]);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(<QueryClientProvider client={qc}><ApprovalsBlock orderId="order" orderNumber="1" tshirtItems={[]} communicationPlatform={platform} communicationUrl={url} /></QueryClientProvider>);
  return { ...view, qc };
}

beforeEach(() => vi.clearAllMocks());

it('sends only after a staff click and prevents repeated clicks while the request is pending', async () => {
  vi.mocked(approvalsApi.sendTelegram).mockReturnValue(new Promise(() => {}));
  show();
  const button = await screen.findByRole('button', { name: 'Отправить клиенту на согласование' });
  expect(approvalsApi.sendTelegram).not.toHaveBeenCalled();
  fireEvent.click(button);
  await waitFor(() => expect(button).toBeDisabled());
  fireEvent.click(button);
  expect(approvalsApi.sendTelegram).toHaveBeenCalledTimes(1);
  expect(approvalsApi.sendTelegram).toHaveBeenCalledWith('approval');
});

it('hides sending for other communication channels', async () => {
  show(approval, 'AVITO');
  await screen.findByText('v1');
  expect(screen.queryByRole('button', { name: 'Отправить клиенту на согласование' })).not.toBeInTheDocument();
});

it.each([{ ...approval, fileOutdated: true }, { ...approval, previewFile: null }])('disables sending without a current generated image', async (row) => {
  show(row);
  expect(await screen.findByRole('button', { name: 'Отправить клиенту на согласование' })).toBeDisabled();
});

it('disables sending without a customer contact', async () => {
  show(approval, 'TELEGRAM', null);
  expect(await screen.findByRole('button', { name: 'Отправить клиенту на согласование' })).toBeDisabled();
});

it.each(['PENDING', 'SENDING', 'SENT', 'UNKNOWN'] as const)('does not allow duplicate delivery in %s', async (status) => {
  show({ ...approval, telegramDelivery: { id: 'delivery', channel: 'TELEGRAM' as const, status, recipient: 'client_test', createdAt: approval.createdAt, finalizedAt: approval.finalizedAt!, sentAt: approval.finalizedAt, errorCode: null } });
  expect(await screen.findByRole('button', { name: 'Отправить клиенту на согласование' })).toBeDisabled();
  expect(screen.getByRole('status')).toHaveTextContent('@client_test');
});

it('shows an explicit retry after a confirmed refusal', async () => {
  show({ ...approval, telegramDelivery: { id: 'delivery', channel: 'TELEGRAM' as const, status: 'FAILED', recipient: 'client_test', createdAt: approval.createdAt, finalizedAt: approval.finalizedAt!, sentAt: null, errorCode: 'privacy' } });
  expect(await screen.findByRole('button', { name: 'Повторить отправку' })).toBeEnabled();
  expect(screen.getByRole('status')).toHaveTextContent('Клиент запретил сообщения');
});

it('shows customer-owned printing instead of the fallback garment size', async () => {
  show({ ...approval, clientItem: true });
  expect(await screen.findByText('Печать на изделии клиента')).toBeInTheDocument();
  expect(screen.queryByText('Белый · M')).not.toBeInTheDocument();
});

it('refreshes the order when the delivery worker confirms sending', async () => {
  const pending = { ...approval, telegramDelivery: { id: 'delivery', channel: 'TELEGRAM' as const, status: 'SENDING' as const, recipient: 'client_test', createdAt: approval.createdAt, finalizedAt: approval.finalizedAt!, sentAt: null, errorCode: null } };
  const { qc } = show(pending);
  await screen.findByText('v1');
  const invalidate = vi.spyOn(qc, 'invalidateQueries');
  act(() => qc.setQueryData(['approvals', 'order'], [{ ...pending, telegramDelivery: { ...pending.telegramDelivery, status: 'SENT' } }]));
  await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['order', 'order'] }));
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['orders'] });
});

/**
 * Заказ на несколько размеров: по позиции на макет.
 *
 * Список версий отвечал на «что собрано», но не на «чего не хватает» —
 * и незакрытый размер замечали на готовой футболке.
 */
const items = [
  { id: 'a', color: 'Чёрный', size: 'S', quantity: 2 },
  { id: 'b', color: 'Белый', size: 'M', quantity: 1 },
] as unknown as ItemTshirt[];

function showWithItems(rows: PrintApproval[]) {
  vi.mocked(approvalsApi.list).mockResolvedValue(rows);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ApprovalsBlock orderId="order" orderNumber="1" tshirtItems={items} communicationPlatform="TELEGRAM" communicationUrl="@client_test" />
    </QueryClientProvider>,
  );
}

it('называет позицию без макета и считает готовые', async () => {
  showWithItems([{ ...approval, itemId: 'a', item: items[0] as never }]);

  // Лист по S собран, но клиент его ещё не видел — производство закрыто.
  expect(
    await screen.findByText('лист готов, клиенту не отправлен'),
  ).toBeInTheDocument();
  // Подпись позиции стоит и в таблице позиций, и в строке её версии.
  expect(screen.getAllByText('Чёрный S(46)')).toHaveLength(2);
  expect(screen.getByText('Белый M(48)')).toBeInTheDocument();
  expect(screen.getByText('макета нет')).toBeInTheDocument();
  expect(screen.getByText(/Готово 0 из 2/)).toBeInTheDocument();
});

it('создаёт макет именно для нажатой позиции', async () => {
  vi.mocked(approvalsApi.create).mockReturnValue(new Promise(() => {}));
  showWithItems([{ ...approval, itemId: 'a', item: items[0] as never }]);
  await screen.findByText('лист готов, клиенту не отправлен');

  // Кнопка одна: у S макет уже есть, не хватает только M.
  fireEvent.click(screen.getByRole('button', { name: 'Создать макет' }));

  // Размер и цвет не передаём: их берёт из позиции сервер.
  await waitFor(() =>
    expect(approvalsApi.create).toHaveBeenCalledWith({
      orderId: 'order',
      itemId: 'b',
    }),
  );
});

it('макет без привязки в заказе на два размера помечен как непригодный', async () => {
  showWithItems([{ ...approval, itemId: null }]);
  expect(
    await screen.findByText('не привязан к позиции — соберите макет заново'),
  ).toBeInTheDocument();
});
