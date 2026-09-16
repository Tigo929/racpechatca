/**
 * Языковая политика сигналов (INSIGHTS_LANGUAGE_POLICY.md).
 *
 * Факт — числа и подписи. Гипотеза — только в сослагательной форме и только
 * из сопутствующих проверяемых фактов. Рекомендация — следующее действие для
 * проверки. Причинные формулировки запрещены и проверяются тестом по всем
 * шаблонам и, на всякий случай, движком перед записью.
 */

/** Запрещённые причинные и психологические формулировки (регистр не важен). */
export const FORBIDDEN_PHRASES: RegExp[] = [
  /из-за/i,
  /благодаря/i,
  /привел[оаи] к/i,
  /привело/i,
  // \b в JS не знает кириллицы — граница слова через отрицательный просмотр вперёд
  /вызвал[оаи]?(?![а-яё])/i,
  /причин[аыой](?![а-яё])/i,
  /доказ(ано|ывает|ал)/i,
  /следовательно/i,
  /поэтому упал/i,
  /отпугива/i,
  /не нравится/i,
  /не доверя/i,
  /слаб(ый|ая) cta/i,
  /плох(ой|ая) дизайн/i,
  /пользовател[ия] (стали|перестали)/i,
];

/** Исключения — отрицания причинности разрешены («причинность не установлена»). */
const ALLOWED_EXCEPTIONS: RegExp[] = [
  /причинность не установлена/i,
  /не доказывает/i,
  /нельзя приписать/i,
  /не является эффектом/i,
  /не установлена/i,
];

export function violatesLanguagePolicy(text: string): string | null {
  let probe = text;
  for (const ok of ALLOWED_EXCEPTIONS) probe = probe.replace(ok, ' ');
  for (const re of FORBIDDEN_PHRASES) {
    const m = probe.match(re);
    if (m) return m[0];
  }
  return null;
}

/** Обязательная приписка к гипотезе — гипотеза никогда не выглядит фактом. */
export const HYPOTHESIS_PREFIX = 'Гипотеза: ';
export const HYPOTHESIS_SUFFIX = ' Причинность не установлена.';

export function hypothesisText(body: string): string {
  return `${HYPOTHESIS_PREFIX}${body}${HYPOTHESIS_SUFFIX}`;
}

export const NO_HYPOTHESIS_TEXT =
  'Гипотезы нет: сопутствующих фактов, которые могли бы объяснить наблюдение, в данных не найдено.';

export const DISCLAIMER =
  'Сигнал — наблюдение по данным, а не установленная причина: совпадение по времени не доказывает связь.';

const NBSP = new RegExp('[' + String.fromCharCode(0xa0, 0x202f) + ']', 'g');

// ── Форматирование чисел для фактов ─────────────────────────────────────────

export function fmtPct(v: number | null, digits = 1): string {
  if (v === null || !Number.isFinite(v)) return '—';
  return `${v.toFixed(digits).replace('.', ',')} %`;
}

export function fmtPoints(v: number | null, digits = 1): string {
  if (v === null || !Number.isFinite(v)) return '—';
  const s = v.toFixed(digits).replace('.', ',');
  return `${v > 0 ? '+' : ''}${s} п.п.`;
}

export function fmtInt(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return '—';
  // Локаль ru-RU разделяет разряды неразрывными пробелами (U+00A0 / U+202F) — в тексте нужны обычные.
  return Math.round(v).toLocaleString('ru-RU').replace(NBSP, ' ');
}

export function fmtRub(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return '—';
  return `${fmtInt(v)} ₽`;
}

export function fmtSigned(v: number | null, unit: string): string {
  if (v === null || !Number.isFinite(v)) return '—';
  const s =
    Math.abs(v) >= 100
      ? fmtInt(v)
      : (Math.round(v * 10) / 10).toString().replace('.', ',');
  return `${v > 0 ? '+' : ''}${s}${unit ? ' ' + unit : ''}`;
}

export function fmtRel(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return '';
  return ` (${v > 0 ? '+' : ''}${v.toFixed(1).replace('.', ',')} %)`;
}

export function fmtPeriod(p: { from: string; to: string }): string {
  const d = (iso: string) =>
    `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
  return p.from === p.to ? d(p.from) : `${d(p.from)}–${d(p.to)}`;
}
