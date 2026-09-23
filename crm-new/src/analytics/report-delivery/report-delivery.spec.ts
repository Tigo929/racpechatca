import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EnumRole } from 'src/generated/prisma/enums';
import { ROLES_KEY } from 'src/auth/decorators/roles.decorator';
import { PATH_METADATA } from '@nestjs/common/constants';
import { AnalyticsReportController } from './analytics-report.controller';
import {
  AnalyticsReportService,
  REPORT_RETENTION_DAYS,
  REPORT_RETENTION_KEEP,
  STALE_GENERATING_MS,
} from './analytics-report.service';
import { AnalyticsReportWorker } from './analytics-report.worker';
import {
  resolvePeriod,
  MAX_CUSTOM_DAYS,
  lastCompleteDay,
} from './report-period';
import { scanReportContent } from './report-safety';
import {
  assertSafeId,
  fileName,
  filePath,
  reportDir,
  writeAtomic,
} from './report-storage';

/**
 * Выдача отчётов из панели (этап 16).
 *
 * Здесь стерегут три вещи: отчёт с деньгами бизнеса не должен утечь (роль,
 * путь скачивания, проверка содержимого), очередь не должна съесть сервер с
 * одним ядром (один воркер, дедупликация двойного клика), и недоделанный
 * отчёт не должен показаться пользователю готовым.
 */

const NOW = new Date('2026-09-23T09:00:00.000Z'); // 12:00 MSK 23.09

// ── период ──────────────────────────────────────────────────────────────────

describe('период отчёта', () => {
  it('пресеты считаются от последнего полного московского дня', () => {
    expect(lastCompleteDay(NOW)).toBe('2026-09-22');
    expect(resolvePeriod({ preset: '7d' }, NOW)).toEqual({
      periodType: 'preset7d',
      from: '2026-09-16',
      to: '2026-09-22',
      days: 7,
    });
    expect(resolvePeriod({ preset: '30d' }, NOW).from).toBe('2026-08-24');
  });

  it('незнакомый пресет отклоняется', () => {
    expect(() => resolvePeriod({ preset: '90d' }, NOW)).toThrow(
      BadRequestException,
    );
  });

  it('свои даты: начало позже конца — отказ', () => {
    expect(() =>
      resolvePeriod({ dateFrom: '2026-09-20', dateTo: '2026-09-10' }, NOW),
    ).toThrow(/позже/);
  });

  it('конец периода в будущем — отказ (текущий день ещё не закончился)', () => {
    expect(() =>
      resolvePeriod({ dateFrom: '2026-09-20', dateTo: '2026-09-23' }, NOW),
    ).toThrow(/не может заканчиваться позже 2026-09-22/);
  });

  it('период длиннее года — отказ', () => {
    expect(() =>
      resolvePeriod({ dateFrom: '2025-01-01', dateTo: '2026-09-22' }, NOW),
    ).toThrow(new RegExp(`не длиннее ${MAX_CUSTOM_DAYS}`));
  });

  it('корректный произвольный период принимается', () => {
    expect(
      resolvePeriod({ dateFrom: '2026-09-01', dateTo: '2026-09-22' }, NOW),
    ).toEqual({
      periodType: 'custom',
      from: '2026-09-01',
      to: '2026-09-22',
      days: 22,
    });
  });

  it('ни пресета, ни дат — отказ с понятным текстом', () => {
    expect(() => resolvePeriod({}, NOW)).toThrow(/Укажите период/);
  });
});

// ── хранилище ───────────────────────────────────────────────────────────────

describe('хранилище файлов', () => {
  const root = mkdtempSync(join(tmpdir(), 'reports-'));
  const env = { ANALYTICS_REPORTS_DIR: root } as NodeJS.ProcessEnv;
  const id = '11111111-2222-4333-8444-555555555555';

  it('идентификатор — только uuid, ничего похожего на путь', () => {
    for (const bad of ['../etc', 'a/b', '..', 'not-a-uuid', `${id}/../x`]) {
      expect(() => assertSafeId(bad)).toThrow(/Некорректный идентификатор/);
    }
    expect(() => assertSafeId(id)).not.toThrow();
  });

  it('каталог отчёта всегда внутри хранилища', () => {
    expect(reportDir(id, env)).toBe(join(root, id));
    expect(() => reportDir('../../etc', env)).toThrow();
  });

  it('имя файла не принимает путь', () => {
    expect(() => filePath(id, '../../etc/passwd', env)).toThrow(
      /Некорректное имя/,
    );
    expect(() => filePath(id, 'a/b.md', env)).toThrow(/Некорректное имя/);
    expect(filePath(id, fileName('md', '2026-09-16', '2026-09-22'), env)).toBe(
      join(root, id, 'analytics-report-2026-09-16_2026-09-22.md'),
    );
  });

  it('запись атомарна: временного файла после неё не остаётся', () => {
    const target = filePath(id, 'analytics-report-x.md', env);
    const size = writeAtomic(target, 'привет');
    expect(existsSync(target)).toBe(true);
    expect(existsSync(`${target}.tmp`)).toBe(false);
    expect(readFileSync(target, 'utf8')).toBe('привет');
    expect(size).toBeGreaterThan(0);
  });
});

// ── проверка содержимого ────────────────────────────────────────────────────

describe('проверка отчёта перед выдачей', () => {
  it('чистый отчёт проходит', () => {
    expect(scanReportContent('# Отчёт\n| Визиты | 115 |').ok).toBe(true);
  });

  it('персональные данные и секреты ловятся по именам, без значений', () => {
    const cases: [string, RegExp][] = [
      ['почта клиента: ivan@example.com', /почта/],
      ['телефон +7 900 000-00-00', /телефон/],
      ['адрес 192.168.0.1', /IP/],
      ['ClientID 1788954327123456789', /длинный идентификатор/],
      ['ссылка /catalog?yclid=1234567890', /метка клика/],
      ['authorization: Bearer abcdefghijklmnopqrst', /заголовок авторизации/],
      ['token eyJhbGciOiJIUzI1NiIsInR5cCI6', /JWT/],
      ['y0_AgAAAABxxxxxxxxx', /OAuth/],
      ['postgresql://user:pass@host:5432/crm', /строка подключения/],
      ['JWT_SECRET=abc', /секрет/],
    ];
    for (const [text, expected] of cases) {
      const result = scanReportContent(text);
      expect(result.ok).toBe(false);
      expect(result.violations.join(' ')).toMatch(expected);
      // в результат не попадает само значение
      expect(result.violations.join(' ')).not.toContain('example.com');
    }
  });

  it('проверяются оба файла разом', () => {
    expect(scanReportContent('чисто', 'почта a@b.ru').ok).toBe(false);
  });
});

// ── очередь ─────────────────────────────────────────────────────────────────

interface Row {
  id: string;
  status: string;
  updatedAt: Date;
  periodType: string;
  dateFrom: Date;
  dateTo: Date;
  requestedAt: Date;
  requestedBy: string;
  generatedAt: Date | null;
  productionBuild: string | null;
  mdFilename: string | null;
  htmlFilename: string | null;
  mdSizeBytes: number | null;
  htmlSizeBytes: number | null;
  errorMessage: string | null;
}

function makeDb(rows: Row[] = []) {
  let seq = rows.length;
  type Where = Record<string, unknown>;
  const match = (row: Row, where: Where): boolean => {
    for (const [key, value] of Object.entries(where)) {
      const actual = (row as unknown as Record<string, unknown>)[key];
      const cond = value as { in?: unknown[]; lt?: Date; gte?: Date } | null;
      if (cond && typeof cond === 'object' && 'in' in cond) {
        if (!(cond.in ?? []).includes(actual)) return false;
      } else if (cond && typeof cond === 'object' && 'lt' in cond) {
        if (!((actual as Date) < (cond.lt as Date))) return false;
      } else if (cond && typeof cond === 'object' && 'gte' in cond) {
        if (!((actual as Date) >= (cond.gte as Date))) return false;
      } else if (actual instanceof Date && value instanceof Date) {
        if (actual.getTime() !== value.getTime()) return false;
      } else if (actual !== value) return false;
    }
    return true;
  };
  const analyticsReport = {
    rows,
    create: jest.fn(({ data }: { data: Partial<Row> }) => {
      seq += 1;
      const row: Row = {
        id: `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`,
        status: 'QUEUED',
        updatedAt: new Date(),
        periodType: 'preset7d',
        dateFrom: new Date('2026-09-16'),
        dateTo: new Date('2026-09-22'),
        requestedAt: new Date(),
        requestedBy: 'admin',
        generatedAt: null,
        productionBuild: null,
        mdFilename: null,
        htmlFilename: null,
        mdSizeBytes: null,
        htmlSizeBytes: null,
        errorMessage: null,
        ...data,
      };
      rows.push(row);
      return Promise.resolve(row);
    }),
    findFirst: jest.fn(
      ({
        where = {},
        orderBy,
      }: {
        where?: Where;
        orderBy?: Record<string, string>;
      }) => {
        let found = rows.filter((r) => match(r, where));
        if (orderBy?.requestedAt === 'asc')
          found = found.sort((a, b) => +a.requestedAt - +b.requestedAt);
        if (orderBy?.requestedAt === 'desc')
          found = found.sort((a, b) => +b.requestedAt - +a.requestedAt);
        return Promise.resolve(found[0] ?? null);
      },
    ),
    findUnique: jest.fn(({ where }: { where: { id: string } }) =>
      Promise.resolve(rows.find((r) => r.id === where.id) ?? null),
    ),
    findMany: jest.fn(
      ({
        where = {},
        orderBy,
        take,
        skip = 0,
      }: {
        where?: Where;
        orderBy?: Record<string, string>;
        take?: number;
        skip?: number;
      }) => {
        let found = rows.filter((r) => match(r, where));
        if (orderBy?.requestedAt === 'desc')
          found = found.sort((a, b) => +b.requestedAt - +a.requestedAt);
        if (skip) found = found.slice(skip);
        if (take) found = found.slice(0, take);
        return Promise.resolve(found);
      },
    ),
    count: jest.fn(({ where = {} }: { where?: Where } = {}) =>
      Promise.resolve(rows.filter((r) => match(r, where)).length),
    ),
    update: jest.fn(
      ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
        const row = rows.find((r) => r.id === where.id)!;
        Object.assign(row, data);
        return Promise.resolve(row);
      },
    ),
    updateMany: jest.fn(
      ({ where, data }: { where: Where; data: Partial<Row> }) => {
        const found = rows.filter((r) => match(r, where));
        found.forEach((r) => Object.assign(r, data));
        return Promise.resolve({ count: found.length });
      },
    ),
    delete: jest.fn(({ where }: { where: { id: string } }) => {
      const i = rows.findIndex((r) => r.id === where.id);
      if (i < 0) return Promise.reject(new Error('строки нет'));
      const [row] = rows.splice(i, 1);
      return Promise.resolve(row);
    }),
    deleteMany: jest.fn(({ where }: { where: { id: { in: string[] } } }) => {
      const ids: string[] = where.id.in;
      const before = rows.length;
      for (const id of ids) {
        const i = rows.findIndex((r) => r.id === id);
        if (i >= 0) rows.splice(i, 1);
      }
      return Promise.resolve({ count: before - rows.length });
    }),
  };
  return { analyticsReport, rows };
}

function makeService(db: ReturnType<typeof makeDb>, env: NodeJS.ProcessEnv) {
  return new AnalyticsReportService(db as never, () => NOW, env);
}

describe('очередь отчётов', () => {
  const env = {
    ANALYTICS_REPORTS_DIR: mkdtempSync(join(tmpdir(), 'reports-q-')),
  } as NodeJS.ProcessEnv;

  it('заказ встаёт в очередь со статусом QUEUED', async () => {
    const db = makeDb();
    const summary = await makeService(db, env).create(
      { preset: '7d' },
      'admin-1',
    );
    expect(summary.status).toBe('QUEUED');
    expect(summary.dateFrom).toBe('2026-09-16');
    expect(summary.dateTo).toBe('2026-09-22');
    expect(summary.formats).toEqual([]);
  });

  it('двойной клик не создаёт второй заказ на тот же период', async () => {
    const db = makeDb();
    const service = makeService(db, env);
    const first = await service.create({ preset: '7d' }, 'admin-1');
    const second = await service.create({ preset: '7d' }, 'admin-1');
    expect(second.id).toBe(first.id);
    expect(db.rows).toHaveLength(1);
  });

  it('другой период — отдельный заказ', async () => {
    const db = makeDb();
    const service = makeService(db, env);
    await service.create({ preset: '7d' }, 'admin-1');
    await service.create({ preset: '30d' }, 'admin-1');
    expect(db.rows).toHaveLength(2);
  });

  it('скачивание недоступно, пока отчёт не готов', async () => {
    const db = makeDb();
    const service = makeService(db, env);
    const created = await service.create({ preset: '7d' }, 'admin-1');
    await expect(service.download(created.id, 'md')).rejects.toThrow(
      /не готов/,
    );
  });

  it('несуществующий отчёт — 404', async () => {
    const service = makeService(makeDb(), env);
    await expect(
      service.get('00000000-0000-4000-8000-000000000999'),
    ).rejects.toThrow(NotFoundException);
  });
});

// ── воркер ──────────────────────────────────────────────────────────────────

function makeWorker(
  db: ReturnType<typeof makeDb>,
  env: NodeJS.ProcessEnv,
  generate: () => Promise<{ markdown: string; html: string }>,
) {
  const service = makeService(db, env);
  const worker = new AnalyticsReportWorker(
    db as never,
    service,
    {} as never,
    {} as never,
    env,
  );
  // подменяем сам сбор данных: очередь и запись файлов проверяются без базы
  (worker as unknown as { generate: unknown }).generate = generate;
  return { worker, service };
}

describe('воркер очереди', () => {
  const root = mkdtempSync(join(tmpdir(), 'reports-w-'));
  const env = {
    ANALYTICS_REPORTS_DIR: root,
    NODE_ENV: 'test',
    BUILD_SHA: '9ccd29351a728c7e43f58c1ad7b7bba894e6e6af',
  } as NodeJS.ProcessEnv;

  const good = () =>
    Promise.resolve({
      markdown: '# Отчёт\n\n| Визиты | 115 |\n| Выручка | 62 361 ₽ |',
      html: '<html><body><td>115</td><td>62 361 ₽</td></body></html>',
    });

  it('пустая очередь — воркер ничего не делает', async () => {
    const { worker } = makeWorker(makeDb(), env, good);
    await expect(worker.tick()).resolves.toBe('idle');
  });

  it('QUEUED → GENERATING → READY, файлы записаны, размеры сохранены', async () => {
    const db = makeDb();
    const { worker, service } = makeWorker(db, env, good);
    const created = await service.create({ preset: '7d' }, 'admin-1');

    await expect(worker.tick()).resolves.toBe('done');

    const row = db.rows[0];
    expect(row.status).toBe('READY');
    expect(row.generatedAt).toBeInstanceOf(Date);
    expect(row.productionBuild).toBe(env.BUILD_SHA);
    expect(row.mdSizeBytes).toBeGreaterThan(0);
    expect(row.htmlSizeBytes).toBeGreaterThan(0);

    const md = readFileSync(join(root, created.id, row.mdFilename!), 'utf8');
    const html = readFileSync(
      join(root, created.id, row.htmlFilename!),
      'utf8',
    );
    expect(md).toContain('62 361 ₽');
    expect(html).toContain('62 361 ₽');

    const ready = await service.get(created.id);
    expect(ready.formats).toEqual(['md', 'html']);
    const file = await service.download(created.id, 'md');
    expect(file.content).toContain('Визиты');
    expect(file.filename).toMatch(
      /^analytics-report-2026-09-16_2026-09-22\.md$/,
    );
  });

  it('ошибка генерации — FAILED с безопасным текстом и без файлов', async () => {
    const db = makeDb();
    const { worker, service } = makeWorker(db, env, () =>
      Promise.reject(
        new Error('SELECT * FROM "OrderPhoto" — соединение упало'),
      ),
    );
    const created = await service.create({ preset: '7d' }, 'admin-2');

    await expect(worker.tick()).resolves.toBe('failed');
    const row = db.rows[0];
    expect(row.status).toBe('FAILED');
    expect(row.errorMessage).toBe('Не удалось сформировать отчёт');
    expect(row.errorMessage).not.toMatch(/SELECT|OrderPhoto/);
    expect(row.mdFilename).toBeNull();
    expect(existsSync(join(root, created.id))).toBe(false);
    await expect(service.download(created.id, 'md')).rejects.toThrow(
      /не готов/,
    );
  });

  it('отчёт с персональными данными не становится READY', async () => {
    const db = makeDb();
    const { worker, service } = makeWorker(db, env, () =>
      Promise.resolve({
        markdown: '# Отчёт\nклиент ivan@example.com',
        html: '<html>ivan@example.com</html>',
      }),
    );
    const created = await service.create({ preset: '7d' }, 'admin-3');
    await worker.tick();
    expect(db.rows[0].status).toBe('FAILED');
    expect(existsSync(join(root, created.id))).toBe(false);
  });

  it('одновременно работает только один отчёт', async () => {
    const db = makeDb();
    let running = 0;
    let maxParallel = 0;
    const slow = async () => {
      running += 1;
      maxParallel = Math.max(maxParallel, running);
      await new Promise((r) => setTimeout(r, 10));
      running -= 1;
      return good();
    };
    const { worker, service } = makeWorker(db, env, slow);
    await service.create({ preset: '7d' }, 'a');
    await service.create({ preset: '30d' }, 'b');

    const [first, second] = await Promise.all([worker.tick(), worker.tick()]);
    expect([first, second]).toContain('busy'); // второй проход не взял работу
    expect(maxParallel).toBe(1);
  });
});

// ── уборка ──────────────────────────────────────────────────────────────────

describe('уборка отчётов', () => {
  const root = mkdtempSync(join(tmpdir(), 'reports-r-'));
  const env = { ANALYTICS_REPORTS_DIR: root } as NodeJS.ProcessEnv;

  const row = (over: Partial<Row>): Row => ({
    id: over.id ?? '00000000-0000-4000-8000-000000000001',
    status: 'READY',
    updatedAt: NOW,
    periodType: 'preset7d',
    dateFrom: new Date('2026-09-16'),
    dateTo: new Date('2026-09-22'),
    requestedAt: NOW,
    requestedBy: 'admin',
    generatedAt: NOW,
    productionBuild: 'abc',
    mdFilename: 'analytics-report.md',
    htmlFilename: 'analytics-report.html',
    mdSizeBytes: 10,
    htmlSizeBytes: 10,
    errorMessage: null,
    ...over,
  });

  const uuid = (n: number) =>
    `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

  it('отчёты старше 180 дней удаляются вместе с файлами', async () => {
    const old = uuid(1);
    mkdirSync(join(root, old), { recursive: true });
    writeFileSync(join(root, old, 'analytics-report.md'), 'x');
    const db = makeDb([
      row({
        id: old,
        requestedAt: new Date(
          NOW.getTime() - (REPORT_RETENTION_DAYS + 1) * 86_400_000,
        ),
      }),
      row({ id: uuid(2) }),
    ]);
    const { removed } = await makeService(db, env).applyRetention();
    expect(removed).toBe(1);
    expect(db.rows.map((r) => r.id)).toEqual([uuid(2)]);
    expect(existsSync(join(root, old))).toBe(false);
  });

  it('сверх 50 готовых удаляются самые старые', async () => {
    const rows = Array.from({ length: REPORT_RETENTION_KEEP + 3 }, (_, i) =>
      row({
        id: uuid(i + 1),
        requestedAt: new Date(NOW.getTime() - i * 3600_000),
      }),
    );
    const db = makeDb(rows);
    const { removed } = await makeService(db, env).applyRetention();
    expect(removed).toBe(3);
    expect(db.rows).toHaveLength(REPORT_RETENTION_KEEP);
    // остались самые свежие
    expect(db.rows.some((r) => r.id === uuid(1))).toBe(true);
    expect(db.rows.some((r) => r.id === uuid(REPORT_RETENTION_KEEP + 3))).toBe(
      false,
    );
  });

  it('заказы в работе уборка не трогает', async () => {
    const old = new Date(
      NOW.getTime() - (REPORT_RETENTION_DAYS + 5) * 86_400_000,
    );
    const db = makeDb([
      row({
        id: uuid(1),
        status: 'QUEUED',
        requestedAt: old,
        generatedAt: null,
      }),
      row({
        id: uuid(2),
        status: 'GENERATING',
        requestedAt: old,
        generatedAt: null,
      }),
    ]);
    const { removed } = await makeService(db, env).applyRetention();
    expect(removed).toBe(0);
    expect(db.rows).toHaveLength(2);
  });
});

// ── доступ ──────────────────────────────────────────────────────────────────

describe('доступ к отчётам — только администратор', () => {
  it('на контроллере стоит ADMIN и общий префикс', () => {
    expect(Reflect.getMetadata(ROLES_KEY, AnalyticsReportController)).toEqual([
      EnumRole.ADMIN,
    ]);
    expect(Reflect.getMetadata(PATH_METADATA, AnalyticsReportController)).toBe(
      'analytics/report',
    );
  });

  it('скачивание принимает только md и html', async () => {
    const controller = new AnalyticsReportController({} as never);
    await expect(
      controller.download('id', '../../etc/passwd', {} as never),
    ).rejects.toThrow(/только md или html/);
    await expect(controller.download('id', 'pdf', {} as never)).rejects.toThrow(
      BadRequestException,
    );
  });
});

// ── совместимость с этапом 15 ───────────────────────────────────────────────

describe('кнопка и командная строка собирают отчёт одним путём', () => {
  const read = (p: string) =>
    readFileSync(join(__dirname, '..', ...p.split('/')), 'utf8');

  it('и воркер, и CLI зовут общий generateReport, а не цепочку по частям', () => {
    const worker = read('report-delivery/analytics-report.worker.ts');
    const cli = read('analytics-report-cli.ts');
    for (const source of [worker, cli]) {
      expect(source).toMatch(/generateReport/);
      // никто не собирает отчёт в обход общей функции
      expect(source).not.toMatch(/\bbuildReportModel\(/);
      expect(source).not.toMatch(/\brenderMarkdown\(/);
      expect(source).not.toMatch(/\brenderPrintableHtml\(/);
      expect(source).not.toMatch(/\bcollectReport\(/);
    }
  });

  it('в выдаче отчётов нет своих формул выручки и прибыли', () => {
    for (const file of [
      'report-delivery/analytics-report.service.ts',
      'report-delivery/analytics-report.worker.ts',
      'report-delivery/analytics-report.controller.ts',
    ]) {
      const source = read(file);
      expect(source).not.toMatch(/realizedRevenue|netProfit|marginPct|cogs/);
    }
  });
});

// ── восстановление брошенных заказов (FIX_01) ───────────────────────────────

describe('брошенные заказы возвращаются в очередь', () => {
  const root = mkdtempSync(join(tmpdir(), 'reports-stale-'));
  const env = {
    ANALYTICS_REPORTS_DIR: root,
    NODE_ENV: 'test',
    BUILD_SHA: 'abc1234',
  } as NodeJS.ProcessEnv;
  const uuid = (n: number) =>
    `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

  const generating = (n: number, ageMs: number): Row => ({
    id: uuid(n),
    status: 'GENERATING',
    updatedAt: new Date(NOW.getTime() - ageMs),
    periodType: 'preset7d',
    dateFrom: new Date('2026-09-16'),
    dateTo: new Date('2026-09-22'),
    requestedAt: new Date(NOW.getTime() - ageMs),
    requestedBy: 'admin-1',
    generatedAt: null,
    productionBuild: null,
    mdFilename: null,
    htmlFilename: null,
    mdSizeBytes: null,
    htmlSizeBytes: null,
    errorMessage: null,
  });

  it('свежий GENERATING не трогается: отчёт может просто считаться', async () => {
    const db = makeDb([generating(1, 60_000)]);
    const { recovered } = await makeService(db, env).recoverStale();
    expect(recovered).toBe(0);
    expect(db.rows[0].status).toBe('GENERATING');
  });

  it('GENERATING дольше таймаута возвращается в QUEUED без второго отчёта', async () => {
    const db = makeDb([generating(2, STALE_GENERATING_MS + 60_000)]);
    const before = { ...db.rows[0] };
    const { recovered } = await makeService(db, env).recoverStale();

    expect(recovered).toBe(1);
    expect(db.rows).toHaveLength(1); // второй заказ не создаётся
    const row = db.rows[0];
    expect(row.status).toBe('QUEUED');
    expect(row.errorMessage).toBeNull();
    expect(row.mdFilename).toBeNull();
    // период и заказчик не меняются
    expect(row.requestedBy).toBe(before.requestedBy);
    expect(row.dateFrom).toEqual(before.dateFrom);
    expect(row.dateTo).toEqual(before.dateTo);
  });

  it('удаляются только недописанные файлы этого заказа', async () => {
    const stale = uuid(3);
    const alive = uuid(4);
    for (const id of [stale, alive]) {
      mkdirSync(join(root, id), { recursive: true });
      writeFileSync(join(root, id, 'analytics-report.md'), 'частичный файл');
    }
    const db = makeDb([
      generating(3, STALE_GENERATING_MS + 60_000),
      {
        ...generating(4, 0),
        id: alive,
        status: 'READY',
        mdFilename: 'analytics-report.md',
      },
    ]);
    await makeService(db, env).recoverStale();

    expect(existsSync(join(root, stale))).toBe(false);
    // готовый отчёт другого заказа не тронут
    expect(existsSync(join(root, alive, 'analytics-report.md'))).toBe(true);
    expect(db.rows.find((r) => r.id === alive)!.status).toBe('READY');
  });

  it('после восстановления воркер доводит отчёт до READY', async () => {
    const db = makeDb([generating(5, STALE_GENERATING_MS + 60_000)]);
    const { worker, service } = makeWorker(db, env, () =>
      Promise.resolve({
        markdown: '# Отчёт\n| Визиты | 115 |',
        html: '<html><td>115</td></html>',
      }),
    );
    await service.recoverStale();
    expect(db.rows[0].status).toBe('QUEUED');

    await expect(worker.tick()).resolves.toBe('done');
    expect(db.rows[0].status).toBe('READY');
    expect(db.rows[0].mdSizeBytes).toBeGreaterThan(0);
  });

  it('присмотр за очередью работает сам по себе, без новых заказов', async () => {
    const db = makeDb([
      generating(6, STALE_GENERATING_MS + 60_000),
      {
        ...generating(7, 0),
        id: uuid(7),
        status: 'READY',
        requestedAt: new Date(
          NOW.getTime() - (REPORT_RETENTION_DAYS + 1) * 86_400_000,
        ),
      },
    ]);
    const { worker } = makeWorker(db, env, () =>
      Promise.resolve({ markdown: '#', html: '<html></html>' }),
    );

    const result = await worker.maintenance();
    expect(result.recovered).toBe(1);
    expect(result.removed).toBe(1);
    // ни одного нового отчёта уборка не создала
    expect(db.rows).toHaveLength(1);
    expect(db.rows[0].status).toBe('QUEUED');
  });

  it('обычная уборка не трогает ни QUEUED, ни свежий GENERATING', async () => {
    const old = new Date(
      NOW.getTime() - (REPORT_RETENTION_DAYS + 5) * 86_400_000,
    );
    const db = makeDb([
      { ...generating(8, 0), status: 'QUEUED', requestedAt: old },
      { ...generating(9, 60_000), id: uuid(9), requestedAt: old },
    ]);
    const { removed } = await makeService(db, env).applyRetention();
    expect(removed).toBe(0);
    expect(db.rows.map((r) => r.status)).toEqual(['QUEUED', 'GENERATING']);
  });

  it('пропавший файл не ломает уборку остальных отчётов', async () => {
    const withFile = uuid(10);
    mkdirSync(join(root, withFile), { recursive: true });
    writeFileSync(join(root, withFile, 'analytics-report.md'), 'x');
    const old = new Date(
      NOW.getTime() - (REPORT_RETENTION_DAYS + 2) * 86_400_000,
    );
    const db = makeDb([
      // у первого каталога нет вовсе — удаление файлов должно пережить это
      { ...generating(11, 0), id: uuid(11), status: 'READY', requestedAt: old },
      { ...generating(12, 0), id: withFile, status: 'READY', requestedAt: old },
    ]);
    const { removed } = await makeService(db, env).applyRetention();
    expect(removed).toBe(2);
    expect(db.rows).toHaveLength(0);
    expect(existsSync(join(root, withFile))).toBe(false);
  });
});
