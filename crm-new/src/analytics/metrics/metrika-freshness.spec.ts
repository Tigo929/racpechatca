import { lastCompleteSyncAt, OVERVIEW_DATASETS } from './metrika-freshness';

describe('dataset freshness', () => {
  it('keeps old goals stale even when traffic was just refreshed', async () => {
    const prisma = { metrikaSyncRun: { groupBy: jest.fn().mockResolvedValue([
      { dataset: 'traffic', _max: { finishedAt: new Date('2026-09-27T10:00:00Z') } },
      { dataset: 'goals', _max: { finishedAt: new Date('2026-09-25T10:00:00Z') } },
      { dataset: 'pages', _max: { finishedAt: new Date('2026-09-27T10:00:00Z') } },
    ]) } };
    expect(await lastCompleteSyncAt(prisma as any, OVERVIEW_DATASETS)).toEqual(new Date('2026-09-25T10:00:00Z'));
  });
  it('does not report complete data when a required dataset never synced', async () => {
    const prisma = { metrikaSyncRun: { groupBy: jest.fn().mockResolvedValue([
      { dataset: 'traffic', _max: { finishedAt: new Date() } },
    ]) } };
    expect(await lastCompleteSyncAt(prisma as any, OVERVIEW_DATASETS)).toBeNull();
  });
});
