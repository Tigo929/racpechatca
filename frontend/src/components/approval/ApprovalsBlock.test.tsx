import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import { ApprovalsBlock } from './ApprovalsBlock';
import { approvalsApi } from '../../api/approvals';
import type { PrintApproval } from '../../types';

vi.mock('../../api/approvals', () => ({ approvalsApi: { list: vi.fn(), sendTelegram: vi.fn() } }));
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
  show({ ...approval, telegramDelivery: { id: 'delivery', status, recipient: 'client_test', createdAt: approval.createdAt, finalizedAt: approval.finalizedAt!, sentAt: approval.finalizedAt, errorCode: null } });
  expect(await screen.findByRole('button', { name: 'Отправить клиенту на согласование' })).toBeDisabled();
  expect(screen.getByRole('status')).toHaveTextContent('@client_test');
});

it('shows an explicit retry after a confirmed refusal', async () => {
  show({ ...approval, telegramDelivery: { id: 'delivery', status: 'FAILED', recipient: 'client_test', createdAt: approval.createdAt, finalizedAt: approval.finalizedAt!, sentAt: null, errorCode: 'privacy' } });
  expect(await screen.findByRole('button', { name: 'Повторить отправку' })).toBeEnabled();
  expect(screen.getByRole('status')).toHaveTextContent('Клиент запретил сообщения');
});

it('shows customer-owned printing instead of the fallback garment size', async () => {
  show({ ...approval, clientItem: true });
  expect(await screen.findByText('Печать на изделии клиента')).toBeInTheDocument();
  expect(screen.queryByText('Белый · M')).not.toBeInTheDocument();
});

it('refreshes the order when the delivery worker confirms sending', async () => {
  const pending = { ...approval, telegramDelivery: { id: 'delivery', status: 'SENDING' as const, recipient: 'client_test', createdAt: approval.createdAt, finalizedAt: approval.finalizedAt!, sentAt: null, errorCode: null } };
  const { qc } = show(pending);
  await screen.findByText('v1');
  const invalidate = vi.spyOn(qc, 'invalidateQueries');
  act(() => qc.setQueryData(['approvals', 'order'], [{ ...pending, telegramDelivery: { ...pending.telegramDelivery, status: 'SENT' } }]));
  await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['order', 'order'] }));
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['orders'] });
});
