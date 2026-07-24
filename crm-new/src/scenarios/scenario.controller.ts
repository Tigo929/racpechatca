import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { EnumRole } from 'src/generated/prisma/enums';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { SCENARIOS, findScenario } from './scenario.registry';
import { detectProduct, evaluateScenario } from './scenario.engine';
import type { Answers } from './scenario.types';
import { DtoDetectProduct } from './dto/detect-product.dto';
import { DtoScenarioAnswers } from './dto/scenario-answers.dto';

/**
 * Описание сценариев для панели оформления.
 *
 * Сервер — единственный источник правды: браузер не хранит собственную копию
 * полей и вопросов, а получает их отсюда. Поэтому новый продукт появляется в
 * интерфейсе сразу после деплоя бэкенда, без правок фронтенда.
 */
@Controller('scenarios')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ScenarioController {
  @Get()
  @Roles(EnumRole.ADMIN)
  list() {
    return SCENARIOS;
  }

  @Get(':key')
  @Roles(EnumRole.ADMIN)
  one(@Param('key') key: string) {
    const scenario = findScenario(key);
    if (!scenario) throw new NotFoundException(`Сценарий «${key}» не найден`);
    return scenario;
  }

  /** По названию объявления и первому сообщению — что это за продукт. */
  @Post('detect')
  @Roles(EnumRole.ADMIN)
  detect(@Body() dto: DtoDetectProduct) {
    return { guesses: detectProduct(dto.text, SCENARIOS) };
  }

  /**
   * Что уже собрано и что осталось выяснить.
   * Считает сервер, чтобы список подсказок и проверка при оформлении заказа
   * не разъехались между собой.
   */
  @Post(':key/progress')
  @Roles(EnumRole.ADMIN)
  progress(@Param('key') key: string, @Body() dto: DtoScenarioAnswers) {
    const scenario = findScenario(key);
    if (!scenario) throw new NotFoundException(`Сценарий «${key}» не найден`);
    return evaluateScenario(scenario, (dto.answers ?? {}) as Answers);
  }
}
