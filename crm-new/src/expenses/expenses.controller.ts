import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { DtoCreateExpense } from './dto/create-expense.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { EnumRole } from 'src/generated/prisma/enums';

interface RequestUser {
  id: string;
}

@Controller('expenses')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(EnumRole.ADMIN)
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  create(@Body() dto: DtoCreateExpense, @CurrentUser() me: RequestUser) {
    return this.expensesService.create(dto, me.id);
  }

  @Get()
  findAll(@Query('year') year?: string) {
    return this.expensesService.findAll(year ? Number(year) : undefined);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.expensesService.remove(id);
  }
}
