import { EnumStatus } from 'src/generated/prisma/enums';

export function toGulianStatus(status: EnumStatus, executorSentAt: Date | null): string {
  if (status === EnumStatus.CANCELLED) return 'cancelled';
  if ((status as string) === 'PROBLEM') return 'problem';
  if (!executorSentAt) return 'new';
  switch (status) {
    case EnumStatus.IN_PROGRESS:
    case EnumStatus.PRINTED:
      return 'in_progress';
    case EnumStatus.READY:
    case EnumStatus.DONE:
      return 'ready';
    default:
      return 'sent';
  }
}