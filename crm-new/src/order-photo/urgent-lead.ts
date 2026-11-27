/**
 * Срочная печать с сайта (решение владельца 28.11.2026).
 *
 * Клиент нажимает «Срочная печать» на карточке: +30% к стоимости печати,
 * доставка в надбавку не входит. Сайт показывает ту же сумму, но CRM её
 * на веру не берёт — считает от своей проверенной суммы позиций, тем же
 * округлением (Math.round), что и сайт (web-photo lib/urgent.ts).
 */
export const URGENT_LEAD_PERCENT = 30;

export function urgentLeadFee(positionsTotal: number): number {
  if (!Number.isFinite(positionsTotal) || positionsTotal <= 0) return 0;
  return Math.round((positionsTotal * URGENT_LEAD_PERCENT) / 100);
}
