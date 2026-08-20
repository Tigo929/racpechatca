import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { EnumRole } from 'src/generated/prisma/enums';
import { PartnerSettingsService } from 'src/partner/partner-settings.service';
import {
  CANVAS_MATERIAL_KIND_LABELS,
  CANVAS_PRODUCTION_PRICES,
  canvasContractorCost,
} from './canvas-production-price';

/**
 * Прайс производства для расчёта внутри CRM.
 *
 * Закрыт ролью ADMIN, в отличие от витринного `/canvas/pricing`: здесь видно,
 * почём мы берём холст у производства и какая у нас скидка. Это условия
 * договора, а не публичная цена.
 *
 * Отдаём сразу и розницу производства, и то, сколько мы должны, — чтобы
 * калькулятор в браузере не пересчитывал скидку сам и не разошёлся с сервером
 * на округлении.
 */
@Controller('canvas/production')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(EnumRole.ADMIN)
export class CanvasProductionController {
  constructor(private readonly settings: PartnerSettingsService) {}

  @Get('pricing')
  async pricing() {
    const s = await this.settings.get();
    const discount = s.canvasDiscountBasisPoints;

    return {
      discountBasisPoints: discount,
      delivery: {
        cost: s.canvasDeliveryCost,
        price: s.canvasDeliveryPrice,
      },
      materialLabels: CANVAS_MATERIAL_KIND_LABELS,
      sizes: CANVAS_PRODUCTION_PRICES.map((row) => ({
        key: row.key,
        label: `${row.widthCm} × ${row.heightCm} см`,
        widthCm: row.widthCm,
        heightCm: row.heightCm,
        retail: { SYNTHETIC: row.synthetic, COTTON: row.cotton },
        cost: {
          SYNTHETIC: canvasContractorCost(row.key, 'SYNTHETIC', discount),
          COTTON: canvasContractorCost(row.key, 'COTTON', discount),
        },
      })),
    };
  }
}
