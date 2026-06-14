/**
 * Расчётный листок по выплате зарплаты — печать через браузер.
 *
 * Почему не клиентский PDF-движок (@react-pdf/renderer): он весит ~1.4 МБ +
 * тянет шрифты ~1.1 МБ и парсит их при каждой генерации — медленно и иногда
 * срывается. Листок всё равно подписывают вручную («Выплатил/Получил»),
 * поэтому правильный инструмент — нативная печать: мгновенно, всегда работает,
 * кириллица системным шрифтом. Пользователь печатает или жмёт «Сохранить как PDF».
 */
import type { ExecutorSalaryData, PaymentByAccrualsResult } from '../../types/index';
import { formatCurrency, formatDate } from '../../utils/format';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildReceiptHtml(
  executor: ExecutorSalaryData,
  result: PaymentByAccrualsResult,
): string {
  const rows = result.accruals
    .map(
      (a) => `<tr>
        <td>${escapeHtml(a.orderNumber)}</td>
        <td>${formatDate(a.orderDate)}</td>
        <td class="num">${formatCurrency(a.totalOrder)}</td>
        <td class="num">${formatCurrency(a.deliveryCost)}</td>
        <td class="num">${formatCurrency(a.salaryBase)}</td>
        <td class="num">${(a.rateBasisPoints / 100).toFixed(0)}%</td>
        <td class="num bold">${formatCurrency(a.salaryAmount)}</td>
      </tr>`,
    )
    .join('');

  return `<!doctype html>
<html lang="ru"><head><meta charset="UTF-8"/>
<title>Расчётный листок — ${escapeHtml(executor.username)} — ${result.paidAt.slice(0, 10)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; font-size: 12px; color: #111; padding: 32px; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  .sub { color: #666; font-size: 11px; margin-bottom: 24px; }
  .meta { display: flex; gap: 32px; margin-bottom: 24px; padding: 14px 16px; background: #f6f6f6; border-radius: 8px; }
  .meta div span { display: block; font-size: 10px; color: #888; }
  .meta div b { font-size: 14px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 28px; }
  th { text-align: left; background: #f0f0f0; padding: 8px 10px; font-size: 10px; color: #555; text-transform: uppercase; letter-spacing: .03em; border-bottom: 2px solid #ddd; }
  td { padding: 7px 10px; border-bottom: 1px solid #eee; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .bold { font-weight: 700; }
  tr.total td { background: #f6f6f6; font-weight: 700; font-size: 13px; border-top: 2px solid #ccc; border-bottom: none; }
  .sign { display: flex; justify-content: space-between; margin-top: 48px; }
  .sign div { width: 220px; border-top: 1px solid #aaa; padding-top: 6px; text-align: center; font-size: 11px; color: #666; }
  @media print { body { padding: 12mm; } @page { margin: 0; } }
</style></head>
<body>
  <h1>Расчётный листок</h1>
  <p class="sub">Дата формирования: ${formatDate(result.paidAt)}</p>
  <div class="meta">
    <div><span>Исполнитель</span><b>${escapeHtml(executor.username)}</b></div>
    <div><span>Ставка</span><b>${executor.ratePercent ?? '—'}%</b></div>
    <div><span>Дата выплаты</span><b>${formatDate(result.paidAt)}</b></div>
    <div><span>Кол-во заказов</span><b>${result.accruals.length}</b></div>
  </div>
  <table>
    <thead><tr>
      <th>№ заказа</th><th>Дата</th><th class="num">Выручка</th>
      <th class="num">Доставка</th><th class="num">База</th><th class="num">%</th><th class="num">ЗП</th>
    </tr></thead>
    <tbody>
      ${rows}
      <tr class="total"><td colspan="6">Итого выплачено</td><td class="num">${formatCurrency(result.totalAmount)}</td></tr>
    </tbody>
  </table>
  <div class="sign">
    <div>Выплатил: _______________</div>
    <div>Получил: _______________</div>
  </div>
</body></html>`;
}

/**
 * Открывает системный диалог печати с расчётным листком в скрытом iframe.
 * Синхронно по клику — без блокировки попапов и без тяжёлых библиотек.
 */
export function printReceipt(
  executor: ExecutorSalaryData,
  result: PaymentByAccrualsResult,
): void {
  const html = buildReceiptHtml(executor, result);

  const iframe = document.createElement('iframe');
  iframe.setAttribute(
    'style',
    'position:fixed;right:0;bottom:0;width:0;height:0;border:0;',
  );
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  if (!win) {
    iframe.remove();
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();

  // даём iframe тик на верстку, затем печатаем
  window.setTimeout(() => {
    win.focus();
    win.print();
  }, 100);

  // убираем iframe после возврата фокуса (закрытие диалога печати)
  const cleanup = () => {
    window.setTimeout(() => iframe.remove(), 500);
    window.removeEventListener('focus', cleanup);
  };
  window.addEventListener('focus', cleanup);
}
