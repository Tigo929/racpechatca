import { EnumTaskAssigneeKind } from 'src/generated/prisma/enums';

export function assigneeKindLabel(kind: EnumTaskAssigneeKind) {
  if (kind === EnumTaskAssigneeKind.CODEX) return 'Codex';
  if (kind === EnumTaskAssigneeKind.CLOUD_CODE) return 'Claude Code';
  return 'сотрудник';
}
