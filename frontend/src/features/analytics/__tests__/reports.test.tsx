import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import { ReportsTab } from '../reports-sections';
import { reportsApi } from '../../../api/analytics';
import type { AnalyticsReport } from '../../../types/analytics-reports';

/**
 * Раздел «Отчёты для ИИ» (этап 16). Проверяем пользовательский сценарий целиком:
 * заказ отчёта, ожидание, скачивание готового файла и честный показ ошибки —
 * ради этого экрана этап и делался.
 */

vi.mock('../../../api/analytics', () => ({
  reportsApi: { create: vi.fn(), list: vi.fn(), download: vi.fn() },
}));

const report = (over: Partial<AnalyticsReport> = {}): AnalyticsReport => ({
  id: 'r-1',
  status: 'READY',
  periodType: 'preset7d',
  dateFrom: '2026-09-16',
  dateTo: '2026-09-22',
  requestedAt: '2026-09-23T06:00:00.000Z',
  generatedAt: '2026-09-23T06:00:20.000Z',
  productionBuild: '9ccd29351a728c7e43f58c1ad7b7bba894e6e6af',
  mdSizeBytes: 37436,
  htmlSizeBytes: 50623,
  errorMessage: null,
  formats: ['md', 'html'],
  ...over,
});

function show(items: AnalyticsReport[] = []) {
  vi.mocked(reportsApi.list).mockResolvedValue({ items, total: items.length });
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <ReportsTab />
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

it('пустой список: объясняет, что делать', async () => {
  show();
  expect(
    await screen.findByText(/Отчётов пока нет/),
  ).toBeInTheDocument();
});

it('заказ отчёта за 7 дней уходит пресетом', async () => {
  vi.mocked(reportsApi.create).mockResolvedValue(report({ status: 'QUEUED' }));
  show();
  fireEvent.click(await screen.findByRole('button', { name: 'Сформировать отчёт' }));
  await waitFor(() => expect(reportsApi.create).toHaveBeenCalledWith({ preset: '7d' }));
});

it('свой период уходит датами, и без обеих дат кнопка заблокирована', async () => {
  vi.mocked(reportsApi.create).mockResolvedValue(report({ status: 'QUEUED' }));
  show();
  fireEvent.change(await screen.findByLabelText('Период отчёта'), {
    target: { value: 'custom' },
  });
  const button = screen.getByRole('button', { name: 'Сформировать отчёт' });
  expect(button).toBeDisabled();

  fireEvent.change(screen.getByLabelText('Дата начала'), {
    target: { value: '2026-09-01' },
  });
  fireEvent.change(screen.getByLabelText('Дата окончания'), {
    target: { value: '2026-09-22' },
  });
  fireEvent.click(button);
  await waitFor(() =>
    expect(reportsApi.create).toHaveBeenCalledWith({
      dateFrom: '2026-09-01',
      dateTo: '2026-09-22',
    }),
  );
});

it('пока отчёт формируется, кнопка занята, а строка показывает состояние', async () => {
  show([report({ status: 'GENERATING', mdSizeBytes: null, formats: [] })]);
  // «Формируется…» видно и на кнопке, и в строке отчёта — это намеренно
  await waitFor(() => expect(screen.getAllByText('Формируется…').length).toBeGreaterThan(1));
  expect(screen.getByRole('button', { name: 'Формируется…' })).toBeDisabled();
  expect(
    screen.queryByRole('button', { name: /Скачать MD/ }),
  ).not.toBeInTheDocument();
});

it('готовый отчёт: период, размер, сборка и кнопки скачивания', async () => {
  show([report()]);
  expect(await screen.findByText('16.09.2026 – 22.09.2026')).toBeInTheDocument();
  expect(screen.getByText('Готов')).toBeInTheDocument();
  expect(screen.getByText('37 КБ')).toBeInTheDocument();
  expect(screen.getByText('9ccd293')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Скачать MD для ИИ/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Печатная версия/ })).toBeInTheDocument();
});

it('скачивание markdown идёт через API с токеном', async () => {
  vi.mocked(reportsApi.download).mockResolvedValue(new Blob(['# Отчёт']));
  const createUrl = vi.fn(() => 'blob:test');
  Object.defineProperty(URL, 'createObjectURL', { value: createUrl, writable: true });
  Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), writable: true });

  show([report()]);
  fireEvent.click(await screen.findByRole('button', { name: /Скачать MD для ИИ/ }));
  await waitFor(() => expect(reportsApi.download).toHaveBeenCalledWith('r-1', 'md'));
});

it('ошибка показывается человеческим текстом, без технических подробностей', async () => {
  show([
    report({
      status: 'FAILED',
      errorMessage: 'Не удалось сформировать отчёт',
      mdSizeBytes: null,
      formats: [],
    }),
  ]);
  expect(await screen.findByText('Ошибка')).toBeInTheDocument();
  expect(screen.getByText('Не удалось сформировать отчёт')).toBeInTheDocument();
  expect(screen.queryByText(/SELECT|stack|Error:/i)).not.toBeInTheDocument();
});

it('подсказывает, как получить PDF, и что текущий день не входит в период', async () => {
  show();
  expect(await screen.findByText(/Сохранить\s+как PDF/)).toBeInTheDocument();
  expect(screen.getByText(/Текущий день не входит в период/)).toBeInTheDocument();
});
