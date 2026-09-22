/**
 * Проверка готового отчёта перед выдачей пользователю (этап 16).
 *
 * Отчёт уезжает во внешний сервис — значит попадание в него телефона, почты,
 * полного ClientID или тем более токена стоит дороже, чем любая ошибка
 * форматирования. Модель отчёта персональных данных не содержит по построению,
 * но проверка стоит миллисекунды и ловит будущие правки рендера, поэтому файл
 * не становится READY, пока не прошёл скан.
 */

export interface SafetyPattern {
  name: string;
  re: RegExp;
}

export const SAFETY_PATTERNS: SafetyPattern[] = [
  { name: 'почта', re: /[\w.+-]+@[\w-]+\.[a-z]{2,}/i },
  {
    name: 'телефон',
    re: /(\+7|\b8)[\s(-]?\d{3}[\s)-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}\b/,
  },
  { name: 'IP-адрес', re: /\b(\d{1,3}\.){3}\d{1,3}\b/ },
  { name: 'длинный идентификатор (ClientID/yclid)', re: /\b\d{15,}\b/ },
  { name: 'метка клика в ссылке', re: /yclid=\d+/i },
  { name: 'cookie', re: /\b(set-cookie|document\.cookie)\b/i },
  {
    name: 'заголовок авторизации',
    re: /\bauthorization:\s|\bBearer\s+[\w.-]{10,}/i,
  },
  { name: 'JWT', re: /\beyJ[\w.-]{10,}/ },
  { name: 'OAuth-токен Яндекса', re: /\by0_[\w.-]+/ },
  {
    name: 'строка подключения к БД',
    re: /\b(postgresql|postgres|mysql|mongodb):\/\/\S*:\S*@/i,
  },
  {
    name: 'секрет в переменной',
    re: /(JWT_SECRET|PASSWORD=|client_secret|api[_-]?key\s*[:=])/i,
  },
];

export interface SafetyResult {
  ok: boolean;
  /** Имена сработавших шаблонов — без самих значений, чтобы не тиражировать утечку. */
  violations: string[];
}

export function scanReportContent(...parts: string[]): SafetyResult {
  const violations: string[] = [];
  for (const pattern of SAFETY_PATTERNS) {
    if (parts.some((part) => pattern.re.test(part)))
      violations.push(pattern.name);
  }
  return { ok: violations.length === 0, violations };
}
