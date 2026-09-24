import { api } from './client';
import type { EnumCanvasMaterial } from '../types/index';

/**
 * Прайс производства на холст: цены обеих систем и то, сколько мы должны
 * по действующей. Закрыт ролью ADMIN — это условия договора, не витрина.
 *
 * Систем две: розничный прайс минус договорная скидка (как было) и оптовый
 * прайс, где цена и есть наш долг. Какая действует — говорит `mode`, и
 * интерфейс обязан это называть: иначе цифру «должен» не с чем сверить.
 *
 * Себестоимость считает сервер и отдаёт готовой: если пересчитывать её
 * в браузере, округление разойдётся с тем, что запишется в заказ.
 */

export type CanvasPriceMode = 'RETAIL' | 'WHOLESALE';

export interface CanvasProductionSize {
  key: string;
  label: string;
  widthCm: number;
  heightCm: number;
  /** Розница производства по материалам. */
  retail: Record<EnumCanvasMaterial, number>;
  /** Оптовые цены по материалам. */
  wholesale: Record<EnumCanvasMaterial, number>;
  /** Сколько должны производству по действующей системе. */
  cost: Record<EnumCanvasMaterial, number>;
}

export interface CanvasProductionPricing {
  /** Действующая система цен. */
  mode: CanvasPriceMode;
  modeLabels: Record<CanvasPriceMode, string>;
  /** Договорная скидка; работает только в розничной системе. */
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
