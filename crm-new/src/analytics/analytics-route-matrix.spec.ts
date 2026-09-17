import {
  type CanActivate,
  type ExecutionContext,
  type INestApplication,
  NotFoundException,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BehaviorDashboardController } from './behavior/behavior-dashboard.controller';
import { BehaviorMetricsService } from './behavior/behavior-metrics.service';
import {
  AnalyticsDashboardController,
  DASHBOARD_OPTIONS,
  type DashboardOptions,
} from './dashboard/analytics-dashboard.controller';
import { DashboardCache } from './dashboard/dashboard-cache';
import { AnalyticsGrowthService } from './growth/analytics-growth.service';
import { GrowthDashboardController } from './growth/growth-dashboard.controller';
import { AnalyticsInsightsService } from './insights/analytics-insights.service';
import { InsightsDashboardController } from './insights/insights-dashboard.controller';
import { AnalyticsMetricsService } from './metrics/analytics-metrics.service';
import { OpsDashboardController } from './ops/ops-dashboard.controller';
import { OpsStatusService } from './ops/ops-status.service';

/**
 * Матрица маршрутов аналитики этапов 09–13 (этап 13, раздел 16): реальные
 * HTTP-вызовы через Nest + supertest с настоящими RolesGuard, InsightsEnabledGuard
 * и ValidationPipe (whitelist + forbidNonWhitelisted, как в main.ts). Подменён
 * только JwtAuthGuard: роль берётся из заголовка `x-test-role`, без заголовка —
 * 401. Сервисы — заглушки: матрица проверяет доступ, флаги и валидацию, а не
 * расчёты.
 *
 * Колонки матрицы: без токена / EXECUTOR / ADMIN при OFF / ADMIN при ON /
 * невалидное DTO / неизвестный ресурс. Контракт «404 до ValidationPipe» —
 * у этапа 12 (guard); у этапа 11 флаг проверяется в обработчике, поэтому
 * невалидное тело при OFF даёт 400 (отклонение § 9.5 rollout-плана этапа 11 —
 * зафиксировано здесь как факт, не как цель).
 */
class HeaderRoleGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx
      .switchToHttp()
      .getRequest<{ headers: Record<string, string>; user?: unknown }>();
    const role = req.headers['x-test-role'];
    if (!role) throw new UnauthorizedException();
    req.user = { id: 'u1', username: role.toLowerCase(), role };
    return true;
  }
}

const KNOWN = '11111111-1111-4111-8111-111111111111';
const UNKNOWN = '00000000-0000-4000-8000-000000000000';

function stub<T extends string>(names: readonly T[]) {
  const out: Record<string, jest.Mock> = {};
  for (const n of names)
    out[n] = jest.fn((...args: unknown[]) => {
      const id = args.find(
        (a) => typeof a === 'string' && /^[0-9a-f-]{36}$/.test(a),
      );
      if (id === UNKNOWN)
        return Promise.reject(new NotFoundException('не найдено'));
      return Promise.resolve({ ok: true, method: n });
    });
  return out;
}

describe('матрица маршрутов аналитики (этапы 09–13)', () => {
  let app: INestApplication;
  const options: DashboardOptions = { enabled: true };
  const cache = new DashboardCache();
  const metrics = stub([
    'getOverview',
    'getTrend',
    'getTrafficSources',
    'getUtm',
    'getLandings',
    'getDevices',
    'getProducts',
    'getSalesChannels',
  ] as const);
  const behavior = stub([
    'getSummary',
    'getFunnels',
    'getErrors',
    'getPages',
    'getDevices',
    'getPaths',
    'getIssues',
  ] as const);
  const growth: Record<string, jest.Mock> = {
    ...stub([
      'listChanges',
      'getChange',
      'createChange',
      'updateChange',
      'evaluate',
      'listEvaluations',
      'getEvaluation',
    ] as const),
    status: jest.fn((enabled: boolean) => Promise.resolve({ enabled })),
  };
  const insights: Record<string, jest.Mock> = {
    ...stub([
      'feed',
      'quality',
      'get',
      'versions',
      'acknowledge',
      'resolve',
      'run',
    ] as const),
    status: jest.fn(() => Promise.resolve({ enabled: options.enabled })),
  };
  const ops = {
    status: jest.fn(() => Promise.resolve({ subsystems: {}, conditions: [] })),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [
        AnalyticsDashboardController,
        BehaviorDashboardController,
        GrowthDashboardController,
        InsightsDashboardController,
        OpsDashboardController,
      ],
      providers: [
        { provide: DASHBOARD_OPTIONS, useValue: options },
        { provide: DashboardCache, useValue: cache },
        { provide: AnalyticsMetricsService, useValue: metrics },
        { provide: BehaviorMetricsService, useValue: behavior },
        { provide: AnalyticsGrowthService, useValue: growth },
        { provide: AnalyticsInsightsService, useValue: insights },
        { provide: OpsStatusService, useValue: ops },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(HeaderRoleGuard)
      .compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // getHttpServer() типизирован как any — единственное место, где это неизбежно
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const http = () => request(app.getHttpServer());
  /** Явный выбор метода — supertest типизирует .get/.post/.patch по-разному. */
  const call = (m: 'get' | 'post' | 'patch', p: string) =>
    m === 'get'
      ? http().get(p)
      : m === 'post'
        ? http().post(p)
        : http().patch(p);
  type Body = { enabled?: boolean; message?: unknown };
  const D = '/analytics/dashboard';
  const G = `${D}/growth`;
  const I = `${D}/insights`;

  /** Маршруты данных: путь, метод, валидное тело. */
  const DATA_ROUTES: {
    m: 'get' | 'post' | 'patch';
    p: string;
    body?: object;
  }[] = [
    { m: 'get', p: `${D}/overview?preset=last_7_days` },
    { m: 'get', p: `${D}/trend?preset=last_7_days` },
    { m: 'get', p: `${D}/sources?preset=last_7_days` },
    { m: 'get', p: `${D}/behavior/summary?preset=last_7_days` },
    { m: 'get', p: `${D}/behavior/issues?preset=last_7_days` },
    { m: 'get', p: `${G}/changes` },
    { m: 'get', p: `${G}/changes/${KNOWN}/evaluations/latest` },
    {
      m: 'post',
      p: `${G}/changes`,
      body: {
        name: 'probe',
        changeType: 'SITE',
        startedAt: '2026-09-12T10:19:00Z',
        surface: 'site:forms',
        primaryMetric: 'siteLeadRate',
        expectedDirection: 'INCREASE',
      },
    },
    { m: 'get', p: `${I}/feed` },
    { m: 'get', p: `${I}/quality` },
    { m: 'get', p: `${I}/${KNOWN}` },
    { m: 'post', p: `${I}/${KNOWN}/acknowledge` },
    {
      m: 'post',
      p: `${I}/${KNOWN}/resolve`,
      body: { reason: 'проверка матрицы' },
    },
    { m: 'post', p: `${I}/run` },
    { m: 'get', p: `/analytics/ops/status` },
  ];
  const STATUS_ROUTES = [
    `${D}/status`,
    `${D}/behavior/status`,
    `${G}/status`,
    `${I}/status`,
  ];
  const ALL_ROUTES: typeof DATA_ROUTES = [
    ...DATA_ROUTES,
    ...STATUS_ROUTES.map((p) => ({ m: 'get' as const, p })),
  ];

  it('без токена — 401 на каждом маршруте, включая status и диагностику', async () => {
    for (const r of ALL_ROUTES) {
      const res = await call(r.m, r.p).send(r.body ?? {});
      expect(`${r.m} ${r.p} → ${res.status}`).toBe(`${r.m} ${r.p} → 401`);
    }
  });

  it('EXECUTOR — 403 на каждом маршруте (разделы только для ADMIN)', async () => {
    for (const r of ALL_ROUTES) {
      const res = await call(r.m, r.p)
        .set('x-test-role', 'EXECUTOR')
        .send(r.body ?? {});
      expect(`${r.m} ${r.p} → ${res.status}`).toBe(`${r.m} ${r.p} → 403`);
    }
  });

  it('ADMIN при флаге OFF: status → 200 с enabled:false; маршруты данных → 404; диагностика доступна', async () => {
    options.enabled = false;
    try {
      for (const p of STATUS_ROUTES) {
        const res = await http().get(p).set('x-test-role', 'ADMIN');
        expect(`${p} → ${res.status}`).toBe(`${p} → 200`);
        expect((res.body as Body).enabled).toBe(false);
      }
      for (const r of DATA_ROUTES.filter(
        (x) => !x.p.startsWith('/analytics/ops'),
      )) {
        const res = await call(r.m, r.p)
          .set('x-test-role', 'ADMIN')
          .send(r.body ?? {});
        expect(`${r.m} ${r.p} → ${res.status}`).toBe(`${r.m} ${r.p} → 404`);
      }
      const opsRes = await http()
        .get('/analytics/ops/status')
        .set('x-test-role', 'ADMIN');
      expect(opsRes.status).toBe(200);
    } finally {
      options.enabled = true;
    }
  });

  it('этап 12 при OFF: невалидное тело и лишние поля → 404 (guard до ValidationPipe), сервис не вызывался', async () => {
    options.enabled = false;
    try {
      insights.resolve.mockClear();
      insights.run.mockClear();
      for (const [p, body] of [
        [`${I}/${KNOWN}/resolve`, {}],
        [`${I}/${KNOWN}/resolve`, { reason: 'x' }],
        [
          `${I}/${KNOWN}/resolve`,
          { reason: 'ok reason', customerPhone: '+79990000000' },
        ],
        [`${I}/run`, { anything: true }],
      ] as const) {
        const res = await http().post(p).set('x-test-role', 'ADMIN').send(body);
        expect(`${p} ${JSON.stringify(body)} → ${res.status}`).toBe(
          `${p} ${JSON.stringify(body)} → 404`,
        );
      }
      const q = await http()
        .get(`${I}/feed?severity=WRONG`)
        .set('x-test-role', 'ADMIN');
      expect(q.status).toBe(404);
      expect(insights.resolve).not.toHaveBeenCalled();
      expect(insights.run).not.toHaveBeenCalled();
    } finally {
      options.enabled = true;
    }
  });

  it('этап 11 при OFF: флаг проверяется в обработчике — валидное тело → 404, невалидное → 400 (факт § 9.5 этапа 11)', async () => {
    options.enabled = false;
    try {
      const valid = await http()
        .post(`${G}/changes`)
        .set('x-test-role', 'ADMIN')
        .send(
          DATA_ROUTES.find((r) => r.p === `${G}/changes` && r.m === 'post')!
            .body,
        );
      expect(valid.status).toBe(404);
      const invalid = await http()
        .post(`${G}/changes`)
        .set('x-test-role', 'ADMIN')
        .send({});
      expect(invalid.status).toBe(400);
      expect(growth.createChange).not.toHaveBeenCalled();
    } finally {
      options.enabled = true;
    }
  });

  it('ADMIN при ON: маршруты данных → 200/201; DTO whitelist — лишнее поле → 400 с именем поля, PII-поля не принимаются', async () => {
    for (const r of DATA_ROUTES) {
      const res = await call(r.m, r.p)
        .set('x-test-role', 'ADMIN')
        .send(r.body ?? {});
      expect([200, 201]).toContain(res.status);
    }
    const pii = await http()
      .post(`${I}/${KNOWN}/resolve`)
      .set('x-test-role', 'ADMIN')
      .send({ reason: 'ok reason', customerPhone: '+79990000000' });
    expect(pii.status).toBe(400);
    expect(JSON.stringify((pii.body as Body).message)).toMatch(
      /customerPhone should not exist/,
    );
    const badQuery = await http()
      .get(`${I}/feed?severity=WRONG&clientId=1`)
      .set('x-test-role', 'ADMIN');
    expect(badQuery.status).toBe(400);
    const badPeriod = await http()
      .get(`${D}/overview?preset=whenever`)
      .set('x-test-role', 'ADMIN');
    expect(badPeriod.status).toBe(400);
    const badChange = await http()
      .post(`${G}/changes`)
      .set('x-test-role', 'ADMIN')
      .send({ name: 'x', customerPhone: '+79990000000' });
    expect(badChange.status).toBe(400);
  });

  it('неизвестный ресурс → 404 без перечисления соседей (тело — только сообщение)', async () => {
    for (const p of [
      `${I}/${UNKNOWN}`,
      `${I}/${UNKNOWN}/versions`,
      `${G}/changes/${UNKNOWN}`,
      `${G}/changes/${UNKNOWN}/evaluations/latest`,
    ]) {
      const res = await http().get(p).set('x-test-role', 'ADMIN');
      expect(`${p} → ${res.status}`).toBe(`${p} → 404`);
      expect(Object.keys(res.body as object).sort()).toEqual([
        'error',
        'message',
        'statusCode',
      ]);
    }
    const ver = await http()
      .get(`${G}/changes/${KNOWN}/evaluations/not-a-number`)
      .set('x-test-role', 'ADMIN');
    expect(ver.status).toBe(404);
  });

  it('F7: сервис дашборда падает → явная ошибка 500 без данных, а не 200 с нулями; следующий запрос снова работает', async () => {
    cache.clear(); // иначе ответит кэш предыдущего успешного запроса (TTL этапа 09)
    metrics.getOverview.mockRejectedValueOnce(new Error('база недоступна'));
    const res = await http()
      .get(`${D}/overview?preset=last_7_days`)
      .set('x-test-role', 'ADMIN');
    expect(res.status).toBe(500);
    const body = res.body as Body & { statusCode?: number; visits?: unknown };
    expect(body.statusCode).toBe(500);
    expect(body.visits).toBeUndefined();
    // текст исключения (детали базы) не утекает наружу — стандартный ответ Nest
    expect(JSON.stringify(body)).not.toMatch(/база недоступна/);
    const again = await http()
      .get(`${D}/overview?preset=last_7_days`)
      .set('x-test-role', 'ADMIN');
    expect(again.status).toBe(200);
  });

  it('поверхность методов: DELETE / PUT на маршрутах аналитики отсутствуют (404), OPTIONS не раскрывает данных', async () => {
    for (const p of [
      `${I}/${KNOWN}`,
      `${G}/changes/${KNOWN}`,
      `${D}/overview`,
    ]) {
      expect((await http().delete(p).set('x-test-role', 'ADMIN')).status).toBe(
        404,
      );
      expect(
        (await http().put(p).set('x-test-role', 'ADMIN').send({})).status,
      ).toBe(404);
    }
    const opt = await http().options(`${I}/feed`);
    expect(opt.status).toBeLessThan(500);
    expect(JSON.stringify(opt.body as unknown)).not.toMatch(
      /items|fingerprint/,
    );
  });
});
