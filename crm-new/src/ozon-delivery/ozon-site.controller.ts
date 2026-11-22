import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { SiteLeadTokenGuard } from 'src/order-photo/site-lead-token.guard';
import { OzonPointsService } from './ozon-points.service';
import { OzonShipmentService } from './ozon-shipment.service';

class DtoPointSearch {
  @IsOptional() @IsString() @MaxLength(120) q?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-90) @Max(90) lat?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;
  @IsOptional()
  @IsArray()
  @ArrayMinSize(4)
  @ArrayMaxSize(4)
  @IsNumber({}, { each: true })
  bbox?: [number, number, number, number];
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(500)
  limit?: number;
}

class DtoCheckPhone {
  @IsString() @MaxLength(40) phone!: string;
}

/**
 * Для сайта: поиск пунктов Ozon на карте и проверка, есть ли у клиента
 * аккаунт Ozon. Тем же подписанным каналом, что и заявки (SiteLeadTokenGuard):
 * наружу это не торчит, ходит только сервер сайта по внутренней сети.
 *
 * Без ограничения частоты: все посетители сайта приходят сюда с одного
 * адреса — сервера сайта, и общий лимит задушил бы карту в час пик.
 */
@Controller('order-photo')
@UseGuards(SiteLeadTokenGuard)
@SkipThrottle()
export class OzonSiteController {
  constructor(
    private readonly points: OzonPointsService,
    private readonly shipments: OzonShipmentService,
  ) {}

  @Post('ozon-points')
  @HttpCode(200)
  async search(@Body() dto: DtoPointSearch) {
    return { points: await this.points.search(dto) };
  }

  @Post('ozon-check-phone')
  @HttpCode(200)
  async checkPhone(@Body() dto: DtoCheckPhone) {
    return { canBeDelivered: await this.shipments.checkClient(dto.phone) };
  }
}
