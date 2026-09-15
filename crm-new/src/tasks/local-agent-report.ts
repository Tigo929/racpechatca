import { EnumTaskAssigneeKind } from 'src/generated/prisma/enums';
import { escapeHtml } from './task-reminder-rules';

const TELEGRAM_MESSAGE_LIMIT = 4096;

export function localAgentName(kind: EnumTaskAssigneeKind): string {
  if (kind === EnumTaskAssigneeKind.CODEX) return 'Codex';
  if (kind === EnumTaskAssigneeKind.CLOUD_CODE) return 'Claude Code';
  return 'агент';
}

function escapeAndTruncateForTelegram(text: string, maxLength: number): string {
  const characters = Array.from(text.trim());
  const escaped = escapeHtml(characters.join(''));
  if (escaped.length <= maxLength) return escaped;

  let low = 0;
  let high = characters.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    const candidate = escapeHtml(
      characters.slice(0, middle).join('').trimEnd(),
    );
    if (candidate.length + 1 <= maxLength) low = middle;
    else high = middle - 1;
  }

  return `${escapeHtml(characters.slice(0, low).join('').trimEnd())}…`;
}

export function buildLocalAgentReportMessage(
  task: {
    id: string;
    title: string;
    assigneeKind: EnumTaskAssigneeKind;
    order?: { numberOrder: string } | null;
  },
  summary: string,
  status: 'done' | 'failed',
): string {
  const statusLine =
    status === 'done' ? 'завершил задачу' : 'сообщил о проблеме в задаче';
  const orderLine = task.order?.numberOrder
    ? `\nЗаказ: <b>${escapeHtml(task.order.numberOrder)}</b>`
    : '';
  const header = [
    `🤖 <b>${escapeHtml(localAgentName(task.assigneeKind))} ${statusLine}</b>`,
    `Задача: <b>${escapeHtml(task.title)}</b>`,
    `ID: <code>${escapeHtml(task.id)}</code>${orderLine}`,
    '',
    '<b>Отчёт</b>',
    '',
  ].join('\n');
  const available = TELEGRAM_MESSAGE_LIMIT - header.length;
  return `${header}${escapeAndTruncateForTelegram(summary, available)}`;
}
