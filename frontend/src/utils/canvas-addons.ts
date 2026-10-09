/**
 * Допы к холсту на стороне интерфейса — зеркало серверного расчёта
 * (crm-new/src/order-photo/canvas-addons.ts), и ответы обязаны совпадать.
 *
 * Здесь он нужен, чтобы показать выручку и себестоимость позиции до того,
 * как её сохранили: оператор называет клиенту цену, видя свою маржу,
 * а не угадывая её.
 */

export interface CanvasAddonsInput {
  varnish?: boolean;
  varnishClientPrice?: number | string;
  varnishContractorPrice?: number | string;
  frame?: boolean;
  frameClientPrice?: number | string;
  frameContractorPrice?: number | string;
}

const money = (value: number | string | undefined): number =>
  Math.max(0, Math.round(Number(value) || 0));

/** Надбавка к цене клиенту за штуку. Выключенный доп не считается. */
export function addonsClientPrice(input: CanvasAddonsInput): number {
  return (
    (input.varnish ? money(input.varnishClientPrice) : 0) +
    (input.frame ? money(input.frameClientPrice) : 0)
  );
}

/** Надбавка к себестоимости за штуку. */
export function addonsContractorPrice(input: CanvasAddonsInput): number {
  return (
    (input.varnish ? money(input.varnishContractorPrice) : 0) +
    (input.frame ? money(input.frameContractorPrice) : 0)
  );
}

/** «лак, багет» — чем дополнен холст. Пусто, если допов нет. */
export function addonsSummary(input: CanvasAddonsInput): string {
  const parts: string[] = [];
  if (input.varnish) parts.push('лак');
  if (input.frame) parts.push('багет');
  return parts.join(', ');
}
