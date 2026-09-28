import type { PrismaService } from '../../prisma/prisma.service';

/** The newest successful dataset cannot make every other dataset fresh. */
export async function lastCompleteSyncAt(
  prisma: PrismaService,
  datasets: readonly string[],
): Promise<Date | null> {
  const runs = await prisma.metrikaSyncRun.groupBy({
    by: ['dataset'],
    where: { dataset: { in: [...datasets] }, status: 'SUCCESS', finishedAt: { not: null } },
    _max: { finishedAt: true },
  });
  if (datasets.some((dataset) => !runs.some((r) => r.dataset === dataset && r._max.finishedAt))) return null;
  return new Date(Math.min(...runs.map((r) => r._max.finishedAt!.getTime())));
}

export const OVERVIEW_DATASETS = ['traffic', 'goals', 'pages'] as const;
export const BEHAVIOR_REQUIRED_DATASETS = [
  'traffic', 'goals', 'devices', 'landings', 'behaviorDevices',
  'behaviorLandings', 'behaviorParams', 'behaviorPaths', 'behaviorEngagement',
] as const;
