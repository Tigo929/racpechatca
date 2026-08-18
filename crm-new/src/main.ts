import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';

/*
 * BigInt в JSON.
 *
 * Идентификаторы товаров Ozon не помещаются в обычное число, поэтому в базе
 * они BigInt. JSON.stringify такой тип не умеет и падает с «Do not know how
 * to serialize a BigInt» — то есть любой ответ, где есть опубликованный
 * вариант, превращался в 500. Ломалась вся вкладка создания: список принтов,
 * публикация, добавление цвета.
 *
 * Отдаём строкой, а не числом: идентификатор Ozon длиннее, чем безопасно
 * помещается в число JavaScript, и превращение в Number молча испортило бы
 * последние цифры.
 */
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function (
  this: bigint,
) {
  return this.toString();
};

/**
 * Разрешённые источники для CORS. Задаются списком через запятую в
 * ALLOWED_ORIGINS; FRONTEND_URL поддержан для совместимости со старым
 * окружением. Звёздочка (*) не поддерживается намеренно: с ней любой сайт
 * смог бы дёргать CRM из браузера пользователя, уже вошедшего в систему.
 */
function allowedOrigins(): string[] {
  // Именно ||, а не ??: docker-compose передаёт незаданную переменную пустой
  // строкой, и с ?? список источников оказался бы пустым — CORS закрылся бы
  // для всех, включая саму панель.
  const raw =
    process.env.ALLOWED_ORIGINS ||
    process.env.FRONTEND_URL ||
    'http://localhost:5173';
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin && origin !== '*');
}

async function bootstrap() {
  // rawBody нужен для проверки подписи заявок с сайта: подпись считается по
  // байтам тела, а не по разобранному JSON — иначе она разъедется из-за любой
  // разницы в сериализации (порядок ключей, пробелы, юникод).
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const logger = new Logger('Bootstrap');

  // Доверяем ровно одному прокси — nginx фронтенда. Без этого req.ip у всех
  // запросов равен адресу nginx, и ограничение частоты становится общим
  // ведром на всех сотрудников сразу. Значение 1, а не true: при true Express
  // берёт левую запись X-Forwarded-For, которую клиент может подделать сам.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // Заголовки безопасности: X-Frame-Options против кликджекинга, nosniff,
  // HSTS, скрытие X-Powered-By. CSP выключен — бэкенд отдаёт только JSON и
  // PDF, а политику для страниц задаёт nginx фронтенда.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      // Стикеры и отчёты фронт забирает как blob с другого источника.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  const origins = allowedOrigins();
  if (!process.env.ALLOWED_ORIGINS && !process.env.FRONTEND_URL) {
    logger.warn(
      'ALLOWED_ORIGINS не задан — CORS открыт только для http://localhost:5173',
    );
  }
  app.enableCors({
    origin: origins,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      // whitelist срезает поля, которых нет в DTO; forbidNonWhitelisted
      // превращает их в явную ошибку 400. Без второго флага расхождение
      // имён между системами (сайт слал comment, в DTO его не было)
      // проходило молча, и данные клиента терялись без следа.
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
  logger.log(`CORS разрешён для: ${origins.join(', ')}`);
}
void bootstrap();
