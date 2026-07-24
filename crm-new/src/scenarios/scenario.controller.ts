import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { EnumRole } from 'src/generated/prisma/enums';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { SCENARIOS, findScenario } from './scenario.registry';
import { detectProduct, evaluateScenario } from './scenario.engine';
import { ScenarioDraftService } from './scenario-draft.service';
import type { Answers } from './scenario.types';
import { DtoDetectProduct } from './dto/detect-product.dto';
import { DtoScenarioAnswers } from './dto/scenario-answers.dto';
import { DtoSaveDraft } from './dto/save-draft.dto';

interface RequestUser {
  id: string;
  username: string;
  role: string;
}

/** Заказами менеджер по оформлению управляет наравне с админом. */
const ORDER_ROLES = [EnumRole.ADMIN, EnumRole.ORDER_MANAGER];

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
  constructor(private readonly drafts: ScenarioDraftService) {}

  @Get()
  @Roles(...ORDER_ROLES)
  list() {
    return SCENARIOS;
  }

  @Get(':key')
  @Roles(...ORDER_ROLES)
  one(@Param('key') key: string) {
    const scenario = findScenario(key);
    if (!scenario) throw new NotFoundException(`Сценарий «${key}» не найден`);
    return scenario;
  }

  /** По названию объявления и первому сообщению — что это за продукт. */
  @Post('detect')
  @Roles(...ORDER_ROLES)
  detect(@Body() dto: DtoDetectProduct) {
    return { guesses: detectProduct(dto.text, SCENARIOS) };
  }

  /**
   * Что уже собрано и что осталось выяснить.
   * Считает сервер, чтобы список подсказок и проверка при оформлении заказа
   * не разъехались между собой.
   */
  @Post(':key/progress')
  @Roles(...ORDER_ROLES)
  progress(@Param('key') key: string, @Body() dto: DtoScenarioAnswers) {
    const scenario = findScenario(key);
    if (!scenario) throw new NotFoundException(`Сценарий «${key}» не найден`);
    return evaluateScenario(scenario, (dto.answers ?? {}) as Answers);
  }

  // ── Черновик оформления на конкретной заявке ────────────────────────────────

  @Get('drafts/:orderId')
  @Roles(...ORDER_ROLES)
  getDraft(@Param('orderId') orderId: string) {
    return this.drafts.getDraft(orderId);
  }

  /** Автосохранение по мере разговора: панель шлёт только изменённые поля. */
  @Patch('drafts/:orderId')
  @Roles(...ORDER_ROLES)
  saveDraft(@Param('orderId') orderId: string, @Body() dto: DtoSaveDraft) {
    return this.drafts.saveDraft(orderId, {
      scenarioKey: dto.scenarioKey,
      answers: dto.answers as Answers | undefined,
    });
  }

  /** Обязательное собрано — обращение становится заказом. */
  @Post('drafts/:orderId/convert')
  @Roles(...ORDER_ROLES)
  convert(@Param('orderId') orderId: string, @CurrentUser() me: RequestUser) {
    return this.drafts.convertToOrder(orderId, me.id);
  }
}
