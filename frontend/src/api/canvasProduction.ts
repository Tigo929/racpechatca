import { api } from './client';
import type { EnumCanvasMaterial } from '../types/index';

/**
 * Прайс производства на холст: две колонки одной таблицы. Закрыт ролью
 * ADMIN — это условия договора, не витрина.
 *
 * Розницу называем клиенту, опт отдаём производству: «розница минус опт» —
 * заработок на полотне. Прежняя система (розница минус 20%) отменена,
 * выбирать больше не из чего.
 *
 * Себестоимость считает сервер и отдаёт готовой: пересчитывать её
 * в браузере нельзя — разойдётся с тем, что запишется в заказ.
 */

export interface CanvasProductionSize {
  key: string;
  label: string;
  widthCm: number;
  heightCm: number;
  /** Розница производства по материалам — она же цена клиенту. */
  retail: Record<EnumCanvasMaterial, number>;
  /** Оптовые цены по материалам — они же наш долг. */
  wholesale: Record<EnumCanvasMaterial, number>;
  /** Сколько должны производству: та же оптовая цена, посчитанная сервером. */
  cost: Record<EnumCanvasMaterial, number>;
  /**
   * Цена для клиента — та, что стоит на сайте.
   *
   * Из единственного источника цены: сайт читает тот же список. По ней
   * подставляется «клиент / шт» при смене размера, чтобы заказ не
   * расходился с витриной. `null` — размера нет в витринном прайсе,
   * подставлять нечего.
   */
  clientPrice: number | null;
}

export interface CanvasProductionPricing {
  delivery: { cost: number; price: number };
  materialLabels: Record<EnumCanvasMaterial, string>;
  sizes: CanvasProductionSize[];
}

export const canvasProductionApi = {
  pricing: async (): Promise<CanvasProductionPricing> => {
    const { data } = await api.get<CanvasProductionPricing>('/canvas/production/pricing');
    return data;
  },
};
