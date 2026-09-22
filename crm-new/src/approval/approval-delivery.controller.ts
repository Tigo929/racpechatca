import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { SiteLeadTokenGuard } from 'src/order-photo/site-lead-token.guard';
import { ApprovalDeliveryService } from './approval-delivery.service';
import {
  ClaimApprovalDeliveryDto,
  CompleteApprovalDeliveryDto,
} from './dto/approval-delivery.dto';

@Controller('order-photo-approval-delivery')
@UseGuards(SiteLeadTokenGuard)
export class ApprovalDeliveryController {
  constructor(private readonly delivery: ApprovalDeliveryService) {}

  @Post('claim')
  async claim(@Body() dto: ClaimApprovalDeliveryDto) {
    return { item: await this.delivery.claim(dto.claimToken) };
  }

  @Post(':id/image')
  async image(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ClaimApprovalDeliveryDto,
    @Res() res: Response,
  ) {
    const image = await this.delivery.image(id, dto.claimToken);
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'no-store');
    res.end(image);
  }

  @Post(':id/complete')
  complete(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteApprovalDeliveryDto,
  ) {
    return this.delivery.complete(id, dto);
  }
}
