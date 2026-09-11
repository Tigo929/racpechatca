import { Module } from '@nestjs/common';
import { YandexMetrikaClient } from './metrika-api.client';
import { metrikaConfigFromEnv } from './metrika.config';

/**
 * Модуль Метрики. Клиент собирается из окружения при старте, но
 * отсутствие переменных ничего не ломает: клиент просто не настроен,
 * и любой явный вызов отвечает `not_configured`. Так CRM поднимается
 * без токена — интеграция не обязана существовать, чтобы работал приём
 * заказов.
 */
@Module({
  providers: [
    {
      provide: YandexMetrikaClient,
      useFactory: () => new YandexMetrikaClient(metrikaConfigFromEnv()),
    },
  ],
  exports: [YandexMetrikaClient],
})
export class MetrikaModule {}
