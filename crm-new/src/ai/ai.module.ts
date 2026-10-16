import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

/**
 * ИИ-агент. Своей логики у модуля нет: вся работа — на шлюзе,
 * который живёт отдельным контейнером и ходит в MCP и в модель.
 */
@Module({
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
