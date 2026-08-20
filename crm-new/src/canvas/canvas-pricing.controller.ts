import { Controller, Get } from '@nestjs/common';
import {
  CANVAS_FRAME_LABELS,
  CANVAS_MATERIAL_LABELS,
  CANVAS_SIZES,
  FRAME_PRICE,
  GLOSS_SURCHARGE_RATE,
  URGENT_SURCHARGE_RATE,
} from '../scenarios/products/canvas.pricing';

/**
 * Публичный прайс на холст для сайта.
 *
 * Зачем эндпоинт: цена на холст живёт в одном месте — `canvas.pricing.ts`.
 * Сайт не хранит свою копию, а читает эту, поэтому цена в калькуляторе,
 * в таблице и в заказе не может разъехаться (правило ТЗ, блок 11).
 *
 * Авторизации нет намеренно: прайс и так печатается на страницах сайта,
 * закрывать его токеном значило бы усложнить без выигрыша.
 *
 * ВАЖНО: `contractorCost` наружу не отдаётся — это себестоимость у
 * подрядчика, коммерческая тайна, и на сайте она не нужна.
 */
@Controller('canvas')
export class CanvasPricingController {
  @Get('pricing')
  getPricing() {
    return {
      sizes: CANVAS_SIZES.map((size) => ({
        key: size.key,
        label: size.label,
        widthCm: size.widthCm,
        heightCm: size.heightCm,
        price: size.price,
        minPixels: size.minPixels,
      })),
      glossSurchargeRate: GLOSS_SURCHARGE_RATE,
      framePrice: FRAME_PRICE,
      urgentSurchargeRate: URGENT_SURCHARGE_RATE,
      materialLabels: CANVAS_MATERIAL_LABELS,
      frameLabels: CANVAS_FRAME_LABELS,
    };
  }
}
