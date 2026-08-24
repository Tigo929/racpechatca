import { ImageCardProcessorService } from './image-card-processor.service';

/**
 * Один проход очереди должен разгребать её до конца.
 *
 * Раньше проход брал горсть файлов и засыпал на четыре секунды. На полусотне
 * макетов это давало минуту ожидания на ровном месте: сама обработка занимает
 * секунды, а ждали такты. Тест держит это исправленным — он считает, сколько
 * исходников разобрано за один tick.
 */
describe('очередь обработки исходников', () => {
  function makeService(pendingCount: number) {
    const processed: string[] = [];
    const pending = Array.from({ length: pendingCount }, (_, i) => ({
      id: `src-${i}`,
      batchId: 'batch',
      baseName: `design-${i}`,
      sourceFile: `design-${i}.png`,
      sourceType: 'png',
      originalName: `design-${i}.png`,
    }));

    const prisma = {
      imageCardSource: {
        findMany: ({ take }: { take: number }) =>
          Promise.resolve(
            pending.filter((s) => !processed.includes(s.id)).slice(0, take),
          ),
        // Занятие строки: помечаем обработанной, как это делает настоящий код.
        updateMany: ({ where }: { where: { id?: string } }) => {
          if (where.id && !processed.includes(where.id)) {
            processed.push(where.id);
            return Promise.resolve({ count: 1 });
          }
          return Promise.resolve({ count: 0 });
        },
        findUnique: ({ where }: { where: { id: string } }) =>
          Promise.resolve(pending.find((s) => s.id === where.id) ?? null),
        update: () => Promise.resolve({}),
      },
      imageCardGenerated: { findMany: () => Promise.resolve([]) },
      imageCardBatch: { findMany: () => Promise.resolve([]) },
    };

    const storage = {
      ensureAssetDir: () => Promise.resolve('/tmp'),
      rasterPath: () => '/tmp/raster.png',
      sourcePath: () => '/tmp/source.png',
    };

    const service = new ImageCardProcessorService(
      prisma as never,
      storage as never,
      { isAvailable: () => Promise.resolve(true) } as never,
      {} as never,
    );
    return { service, processed };
  }

  it('за один проход разбирает всю очередь, а не первую горсть', async () => {
    const { service, processed } = makeService(17);

    // Растеризация и чтение метаданных нас здесь не интересуют: проверяем
    // только то, сколько строк проход успевает занять.
    jest
      .spyOn(
        service as unknown as { processOne: (id: string) => Promise<void> },
        'processOne',
      )
      .mockImplementation(async (id: string) => {
        processed.push(id);
        return Promise.resolve();
      });

    await service.tick();

    expect(processed).toHaveLength(17);
  });

  it('пустая очередь не уводит проход в бесконечный цикл', async () => {
    const { service } = makeService(0);
    await expect(service.tick()).resolves.toBeUndefined();
  });

  it('параллельные проходы не запускаются', async () => {
    const { service, processed } = makeService(5);
    jest
      .spyOn(
        service as unknown as { processOne: (id: string) => Promise<void> },
        'processOne',
      )
      .mockImplementation(async (id: string) => {
        processed.push(id);
        return Promise.resolve();
      });

    // Второй вызов приходит, пока первый ещё идёт: он обязан выйти сразу,
    // иначе один и тот же файл обработается дважды.
    await Promise.all([service.tick(), service.tick()]);
    expect(processed).toHaveLength(5);
  });
});
