import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { EnumRole } from 'src/generated/prisma/enums';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { SalaryService } from './salary.service';
import { DtoCreatePayment } from './dto/create-payment.dto';
import { DtoCreatePaymentByAccruals } from './dto/create-payment-by-accruals.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';

interface RequestUser {
  id: string;
}

/**
 * Контроллер целиком закрыт под ADMIN (см. @Roles ниже). Личный баланс —
 * единственное исключение: @Roles на методе перекрывает классовый (RolesGuard
 * использует getAllAndOverride), и исполнитель видит только свои деньги —
 * executorId берётся из токена, параметром его подменить нельзя.
 */

@Controller('salary')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(EnumRole.ADMIN)
export class SalaryController {
  constructor(private salaryService: SalaryService) {}

  @Get('me')
  @Roles(EnumRole.EXECUTOR, EnumRole.ADMIN)
  getMyBalance(@CurrentUser() me: RequestUser) {
    return this.salaryService.getMyBalance(me.id);
  }

  @Get('summary')
  getSummary() {
    return this.salaryService.getSummary();
  }

  @Get('accruals/:executorId')
  getAccruals(@Param('executorId') executorId: string) {
    return this.salaryService.getAccruals(executorId);
  }

  @Get('payments/:executorId')
  getPayments(@Param('executorId') executorId: string) {
    return this.salaryService.getPayments(executorId);
  }

  @Post('payments')
  createPayment(@Body() dto: DtoCreatePayment, @CurrentUser() me: RequestUser) {
    return this.salaryService.createPayment(dto, me.id);
  }

  @Post('payments/by-accruals')
  createPaymentByAccruals(
    @Body() dto: DtoCreatePaymentByAccruals,
    @CurrentUser() me: RequestUser,
  ) {
    return this.salaryService.createPaymentByAccruals(dto, me.id);
  }
}
