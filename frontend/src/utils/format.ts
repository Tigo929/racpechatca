/** Денежный формат (рубли, без копеек): 1 350 ₽ */
export const formatCurrency = (n: number): string =>
  n.toLocaleString('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  });

/** Короткая дата: 14 июн. 2026 (или «—» если значения нет) */
export const formatDate = (s: string | null | undefined): string =>
  s
    ? new Date(s).toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—';
