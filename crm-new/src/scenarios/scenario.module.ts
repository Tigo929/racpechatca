import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { ScenarioController } from './scenario.controller';
import { validateAllScenarios } from './scenario.registry';

@Module({
  controllers: [ScenarioController],
})
export class ScenarioModule implements OnModuleInit {
  private readonly logger = new Logger(ScenarioModule.name);

  /**
   * Сценарии описаны данными, а не кодом, поэтому опечатку в них компилятор не
   * поймает. Проверяем на старте и громко пишем в лог: тихо сломанный сценарий
   * означает поле, которое менеджер никогда не увидит.
   */
  onModuleInit() {
    const errors = validateAllScenarios();
    for (const e of errors) this.logger.error(e);
    if (errors.length) {
      this.logger.error(`Сценарии оформления: ошибок в описании — ${errors.length}`);
    }
  }
}
