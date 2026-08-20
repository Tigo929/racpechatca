import { api } from './client';
import type { EnumCanvasMaterial } from '../types/index';

/**
 * Прайс производства на холст: розница производства и то, сколько мы должны
 * ему после скидки. Закрыт ролью ADMIN — это условия договора, не витрина.
 *
 * Себестоимость считает сервер и отдаёт готовой: если пересчитывать скидку
 * в браузере, округление разойдётся с тем, что запишется в заказ.
 */

export interface CanvasProductionSize {
  key: string;
  label: string;
  widthCm: number;
  heightCm: number;
  /** Розница производства по материалам. */
  retail: Record<EnumCanvasMaterial, number>;
  /** Сколько должны производству — розница минус скидка. */
  cost: Record<EnumCanvasMaterial, number>;
}

export interface CanvasProductionPricing {
  discountBasisPoints: number;
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
