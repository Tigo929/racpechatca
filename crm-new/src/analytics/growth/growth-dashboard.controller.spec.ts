import { NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ROLES_KEY } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { AnalyticsGrowthService } from './analytics-growth.service';
import { CreateChangeDto, UpdateChangeDto } from './dto/change.dto';
import { GrowthDashboardController } from './growth-dashboard.controller';

/**
 * API роста (этап 11, раздел 20): ADMIN only, флаг дашборда, DTO-валидация
 * (whitelist отсекает лишние поля — PII не пройдёт), контроллер ничего не считает.
 */
function fakeService() {
  const calls: string[] = [];
  const stub = (name: string) =>
    jest.fn((...args: unknown[]) => {
      calls.push(
        `${name}:${args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(',')}`,
      );
      return Promise.resolve({ name });
    });
  const service = {
    status: stub('status'),
    listChanges: stub('list'),
    getChange: stub('get'),
    createChange: stub('create'),
    updateChange: stub('update'),
    evaluate: stub('evaluate'),
    listEvaluations: stub('evaluations'),
    getEvaluation: stub('evaluation'),
  } as unknown as AnalyticsGrowthService;
  return { service, calls };
}

const VALID: CreateChangeDto = {
  name: 'Новая форма',
  changeType: 'SITE',
  startedAt: '2026-09-24T12:00:00Z',
  surface: 'site:form',
  primaryMetric: 'siteLeadRate',
  expectedDirection: 'INCREASE',
};

describe('GrowthDashboardController', () => {
  it('защищён JwtAuthGuard + RolesGuard и открыт только ADMIN', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, GrowthDashboardController),
    ).toEqual([JwtAuthGuard, RolesGuard]);
    expect(Reflect.getMetadata(ROLES_KEY, GrowthDashboardController)).toEqual([
      'ADMIN',
    ]);
  });

  it('выключенный флаг → 404 на всё, кроме status; сервис не вызывается', async () => {
    const { service, calls } = fakeService();
    const c = new GrowthDashboardController(service, { enabled: false });
    expect(() => c.list()).toThrow(NotFoundException);
    expect(() => c.create(VALID)).toThrow(NotFoundException);
    expect(() => c.evaluate('x')).toThrow(NotFoundException);
    expect(calls).toEqual([]);
    await c.status();
    expect(calls).toEqual(['status:false']);
  });

  it('маршруты зовут сервис: list / get / create / update / evaluate(manual) / evaluations / latest / version', async () => {
    const { service, calls } = fakeService();
    const c = new GrowthDashboardController(service, { enabled: true });
    await c.list();
    await c.one('a');
    await c.create(VALID);
    await c.update('a', { name: 'x' });
    await c.evaluate('a');
    await c.evaluations('a');
    await c.latest('a');
    await c.version('a', '2');
    expect(calls).toEqual([
      'list:',
      'get:a',
      `create:${JSON.stringify(VALID)}`,
      'update:a,{"name":"x"}',
      'evaluate:a,manual',
      'evaluations:a',
      'evaluation:a',
      'evaluation:a,2',
    ]);
    expect(() => c.version('a', 'abc')).toThrow(NotFoundException);
  });

  it('DTO: обязательные поля, перечисления, ISO-даты, аудитория только из одобренных измерений, лишние поля → ошибка whitelist', async () => {
    const ok = plainToInstance(CreateChangeDto, VALID);
    expect(
      await validate(ok, { whitelist: true, forbidNonWhitelisted: true }),
    ).toEqual([]);
    const bad = plainToInstance(CreateChangeDto, {
      ...VALID,
      changeType: 'HACK',
      startedAt: 'вчера',
      primaryMetric: 'revenuePerCustomerPhone',
      evaluationDays: 10,
    });
    const errors = await validate(bad, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(errors.map((e) => e.property).sort()).toEqual([
      'changeType',
      'evaluationDays',
      'primaryMetric',
      'startedAt',
    ]);
    const pii = plainToInstance(CreateChangeDto, {
      ...VALID,
      customerPhone: '+79990000000',
    });
    const piiErrors = await validate(pii, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(piiErrors.map((e) => e.property)).toEqual(['customerPhone']);
    const audience = plainToInstance(CreateChangeDto, {
      ...VALID,
      audienceDefinition: { dimension: 'email', values: ['a@b.c'] },
    });
    const audienceErrors = await validate(audience, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(audienceErrors.map((e) => e.property)).toEqual([
      'audienceDefinition',
    ]);
    const patch = plainToInstance(UpdateChangeDto, {
      status: 'COMPLETED',
      endedAt: '2026-10-01T00:00:00Z',
    });
    expect(
      await validate(patch, { whitelist: true, forbidNonWhitelisted: true }),
    ).toEqual([]);
  });
});
