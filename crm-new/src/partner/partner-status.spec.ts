import { EnumStatus } from 'src/generated/prisma/enums';
import {
  fromPartnerStatus,
  mapPartnerStage,
  shouldAdvanceTo,
  toPartnerStatus,
} from './partner-status';

describe('коды статусов ↔ партнёр', () => {
  it('туда-обратно по основным статусам', () => {
    expect(toPartnerStatus(EnumStatus.IN_PROGRESS)).toBe('in_progress');
    expect(fromPartnerStatus('ready')).toBe(EnumStatus.READY);
    expect(fromPartnerStatus('ОПЛАЧЕН')).toBeNull();
  });
});

describe('стадия производства партнёра → наш статус', () => {
  it('план не двигает заказ', () => {
    expect(mapPartnerStage('planning')).toBeNull();
    expect(mapPartnerStage('')).toBeNull();
    expect(mapPartnerStage(null)).toBeNull();
  });

  it('очередь/работа/ОТК → «В работе»', () => {
    for (const s of ['queued', 'in_work', 'qc', 'IN_WORK']) {
      expect(mapPartnerStage(s)).toBe(EnumStatus.IN_PROGRESS);
    }
  });

  it('готово/закрыто → «Готов»', () => {
    expect(mapPartnerStage('ready')).toBe(EnumStatus.READY);
    expect(mapPartnerStage('done')).toBe(EnumStatus.READY);
  });

  it('незнакомую стадию игнорирует', () => {
    expect(mapPartnerStage('whatever')).toBeNull();
  });
});

describe('движение только вперёд', () => {
  it('двигает вперёд по потоку', () => {
    expect(shouldAdvanceTo(EnumStatus.SENT, EnumStatus.IN_PROGRESS)).toBe(true);
    expect(shouldAdvanceTo(EnumStatus.SENT, EnumStatus.READY)).toBe(true);
    expect(shouldAdvanceTo(EnumStatus.IN_PROGRESS, EnumStatus.READY)).toBe(true);
  });

  it('не двигает назад', () => {
    expect(shouldAdvanceTo(EnumStatus.READY, EnumStatus.IN_PROGRESS)).toBe(false);
    expect(shouldAdvanceTo(EnumStatus.IN_PROGRESS, EnumStatus.IN_PROGRESS)).toBe(false);
  });

  it('никогда не перебивает «Оплачен»', () => {
    expect(shouldAdvanceTo(EnumStatus.PAID, EnumStatus.READY)).toBe(false);
    expect(shouldAdvanceTo(EnumStatus.PAID, EnumStatus.IN_PROGRESS)).toBe(false);
  });
});
