import { GreetingWatchdogService } from './greeting-watchdog.service';
import { GREETING_ALERT_REPEAT_MS } from './greeting-stuck';

/**
 * Сторож первых сообщений клиентам.
 *
 * Проверяется то, ради чего он написан: молчание рабочего аккаунта
 * становится слышным. И обратное — что он не кричит о заявках, которые
 * и не должны быть приветствованы.
 */
describe('сторож приветствий', () => {
  const NOW = new Date('2026-10-30T12:00:00Z');

  function build(rows: { numberOrder: string }[] | Error) {
    const alerts: string[] = [];
    const seen: Record<string, unknown>[] = [];
    const prisma = {
      orderPhoto: {
        findMany: async (args: Record<string, unknown>) => {
          seen.push(args);
          if (rows instanceof Error) throw rows;
          return rows;
        },
      },
    };
    const telegram = {
      sendLeadAlert: async (text: string) => {
        alerts.push(text);
        return true;
      },
    };
    const service = new GreetingWatchdogService(
      prisma as never,
      telegram as never,
    );
    return { service, alerts, seen };
  }

  it('заявка висит без приветствия — владелец узнаёт об этом', async () => {
    const { service, alerts } = build([{ numberOrder: '20261028-319' }]);

    await expect(service.scan(NOW)).resolves.toBe(1);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toContain('20261028-319');
  });

  it('очередь разошлась — молчим', async () => {
    const { service, alerts } = build([]);

    await expect(service.scan(NOW)).resolves.toBe(0);
    expect(alerts).toEqual([]);
  });

  it('о том же отказе не кричим каждые десять минут', async () => {
    const { service, alerts } = build([{ numberOrder: '20261028-319' }]);

    await service.scan(NOW);
    await service.scan(new Date(NOW.getTime() + 10 * 60 * 1000));

    expect(alerts).toHaveLength(1);
  });

  it('но и не замолкаем навсегда: через шесть часов напоминаем', async () => {
    const { service, alerts } = build([{ numberOrder: '20261028-319' }]);

    await service.scan(NOW);
    await service.scan(new Date(NOW.getTime() + GREETING_ALERT_REPEAT_MS));

    expect(alerts).toHaveLength(2);
  });

  it('после починки следующий отказ звучит сразу, а не через шесть часов', async () => {
    const stuck = build([{ numberOrder: '20261028-319' }]);
    await stuck.service.scan(NOW);
    expect(stuck.alerts).toHaveLength(1);

    // Тот же сторож: очередь разошлась, потом встала снова.
    const prismaRows: { numberOrder: string }[][] = [[], [{ numberOrder: '20261029-330' }]];
    let call = 0;
    const alerts: string[] = [];
    const service = new GreetingWatchdogService(
      {
        orderPhoto: { findMany: async () => prismaRows[call++] ?? [] },
      } as never,
      {
        sendLeadAlert: async (text: string) => {
          alerts.push(text);
          return true;
        },
      } as never,
    );
    await service.scan(NOW);
    await service.scan(new Date(NOW.getTime() + 10 * 60 * 1000));
    expect(alerts).toHaveLength(1);
  });

  it('смотрит только на свежие заявки с сайта в телеграм', async () => {
    // Заказы с Авито приветствовать не нужно: переписка уже идёт там.
    // Заявку старше срока давности очередь не берёт — тревожить не о чем.
    const { service, seen } = build([]);
    await service.scan(NOW);

    const where = (seen[0] as { where: Record<string, unknown> }).where;
    expect(where).toMatchObject({
      clientGreetedAt: null,
      communicationPlatform: 'TELEGRAM',
      externalRequestId: { startsWith: 'web-photo' },
    });
    const created = where.createdAt as { gte: Date; lte: Date };
    expect(created.lte.getTime()).toBeLessThan(NOW.getTime());
    expect(created.gte.getTime()).toBeLessThan(created.lte.getTime());
  });

  it('недоступная база не роняет сторожа', async () => {
    // Иначе одна её заминка выключила бы проверку насовсем.
    const { service, alerts } = build(new Error('база недоступна'));

    await expect(service.scan(NOW)).resolves.toBe(0);
    expect(alerts).toEqual([]);
  });

  it('не сказали из-за сбоя связи — скажем на следующем заходе', async () => {
    const alerts: string[] = [];
    let first = true;
    const service = new GreetingWatchdogService(
      {
        orderPhoto: { findMany: async () => [{ numberOrder: '20261028-319' }] },
      } as never,
      {
        sendLeadAlert: async (text: string) => {
          if (first) {
            first = false;
            throw new Error('Telegram недоступен');
          }
          alerts.push(text);
          return true;
        },
      } as never,
    );

    await expect(service.scan(NOW)).resolves.toBe(0);
    await expect(
      service.scan(new Date(NOW.getTime() + 10 * 60 * 1000)),
    ).resolves.toBe(1);
    expect(alerts).toHaveLength(1);
  });
});
