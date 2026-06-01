/**
 * Возвращает CSS-классы Tailwind для строки таблицы по дедлайну заказа.
 *
 * Если deadline не задан — вычисляем из createdAt + 3 дня.
 *
 * Психологическая шкала:
 *   > 2 дней  → зелёный   — всё спокойно
 *   2 дня     → жёлтый    — пора заняться
 *   1 день    → оранжевый — срочно
 *   0 дней    → красный   — критично, сегодня!
 *   просрочен → тёмно-красный — дедлайн пропущен
 */
export function getDeadlineInfo(
  deadline: string | null | undefined,
  createdAt?: string,
): {
  daysLeft: number | null;
  rowClass: string;
  badgeClass: string;
  label: string;
} {
  // Если дедлайн не задан — вычисляем из даты создания + 3 дня
  let due: Date | null = null;
  if (deadline) {
    due = new Date(deadline);
  } else if (createdAt) {
    due = new Date(new Date(createdAt).getTime() + 3 * 24 * 60 * 60 * 1000);
  }

  if (!due) {
    return { daysLeft: null, rowClass: '', badgeClass: '', label: '' };
  }

  const now = new Date();
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const daysLeft = Math.round((dueDay.getTime() - nowDay.getTime()) / (1000 * 60 * 60 * 24));

  if (daysLeft > 2) {
    return {
      daysLeft,
      rowClass: 'bg-emerald-50/60 hover:bg-emerald-100/60',
      badgeClass: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
      label: `${daysLeft} д.`,
    };
  }
  if (daysLeft === 2) {
    return {
      daysLeft,
      rowClass: 'bg-yellow-50/60 hover:bg-yellow-100/60',
      badgeClass: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
      label: '2 дня',
    };
  }
  if (daysLeft === 1) {
    return {
      daysLeft,
      rowClass: 'bg-orange-50/60 hover:bg-orange-100/60',
      badgeClass: 'bg-orange-100 text-orange-700 border border-orange-200',
      label: '1 день',
    };
  }
  if (daysLeft === 0) {
    return {
      daysLeft,
      rowClass: 'bg-red-50/60 hover:bg-red-100/60',
      badgeClass: 'bg-red-100 text-red-700 border border-red-300 font-semibold',
      label: 'Сегодня!',
    };
  }
  return {
    daysLeft,
    rowClass: 'bg-red-100/80 hover:bg-red-200/80',
    badgeClass: 'bg-red-600 text-white border border-red-700 font-semibold',
    label: `Просрочен ${Math.abs(daysLeft)} д.`,
  };
}
