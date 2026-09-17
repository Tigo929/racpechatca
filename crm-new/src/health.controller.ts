import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

/**
 * Идентификатор сборки (этап 13, раздел 20): хеш коммита, вшитый в образ на
 * сборке (Dockerfile.prebuilt: ARG BUILD_SHA → ENV). Не секрет — тот же хеш
 * виден в истории git и в теге образа `:<sha>`. Нужен, чтобы «правка не
 * работает» и «правка не доехала» различались без доступа к серверу, и чтобы
 * auto-update мог сверить фактически запущенную сборку с образом.
 */
export function buildIdentity(env: NodeJS.ProcessEnv = process.env): {
  build: string | null;
} {
  const sha = (env.BUILD_SHA ?? '').trim();
  return { build: /^[0-9a-f]{7,64}$/i.test(sha) ? sha.toLowerCase() : null };
}

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Дешёвая проверка живости: одна команда к базе, никаких обращений к
   * Метрике и внешним API (этап 13, раздел 6). Подробная диагностика
   * аналитики — отдельно, только для ADMIN: /analytics/ops/status.
   */
  @Get()
  async check() {
    await this.prisma.$queryRaw`SELECT 1`;

    return {
      status: 'ok',
      database: 'ok',
      ...buildIdentity(),
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
