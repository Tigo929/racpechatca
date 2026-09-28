/**
 * Разбор выгрузки рекламных расходов.
 *
 * Почему CSV, а не API Директа: у системы нет OAuth-доступа к кабинету, и
 * получить его — отдельная внешняя работа владельца. Выгрузка отчёта из
 * кабинета занимает минуту и доступна прямо сейчас, а формат данных от
 * источника не зависит: когда появится API, он положит те же строки.
 *
 * Разбор терпим к тому, как кабинет отдаёт файл: разделитель — запятая,
 * точка с запятой или табуляция; числа — с пробелами-разделителями тысяч
 * и запятой вместо точки; заголовки — по-русски или по-английски.
 * Неразобранная строка не портит импорт: она возвращается в ошибках
 * с номером, чтобы владелец увидел, что именно не поняли.
 */

export interface ParsedSpendRow {
  /** ISO-день расхода. */
  date: string;
  campaignId: string;
  campaignName: string;
  /** Рубли с точностью до 4 знаков, как в API Метрики. */
  spend: number;
  clicks: number;
  impressions: number;
}

export interface ParseResult {
  rows: ParsedSpendRow[];
  /** Строки, которые не разобрались: номер в файле и причина. */
  errors: { line: number; reason: string }[];
}

/** Заголовки, которые встречаются в выгрузках кабинета и в ручных таблицах. */
const COLUMN_ALIASES: Record<keyof ParsedSpendRow, string[]> = {
  date: ['date', 'дата', 'день'],
  campaignId: [
    'campaignid',
    'campaign_id',
    'id кампании',
    'номер кампании',
    '№ кампании',
  ],
  campaignName: [
    'campaignname',
    'campaign_name',
    'кампания',
    'название кампании',
  ],
  spend: [
    'spend',
    'cost',
    'расход',
    'расход (руб.)',
    'расход, ₽',
    'расход (руб)',
    'затраты',
    'стоимость',
  ],
  clicks: ['clicks', 'клики', 'клики (все)', 'переходы'],
  impressions: ['impressions', 'показы', 'показы (все)'],
};

function splitLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (char === delimiter && !quoted) {
      cells.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells.map((c) => c.trim());
}

function detectDelimiter(header: string): string {
  const counts = [',', ';', '\t'].map((d) => ({
    d,
    n: header.split(d).length,
  }));
  counts.sort((a, b) => b.n - a.n);
  return counts[0].n > 1 ? counts[0].d : ',';
}

/** «1 234,56» и «1234.56» — одно и то же число; дробная часть сохраняется. */
export function parseMoney(value: string): number | null {
  const normalized = value
    .replace(new RegExp(String.fromCharCode(160), 'g'), '')
    .replace(/\s/g, '')
    .replace(/,/g, '.');
  if (!normalized) return null;
  const num = Number(normalized);
  return Number.isFinite(num) && num >= 0
    ? Math.round(num * 10000) / 10000
    : null;
}

/** Дата кабинета: 2026-09-24, 24.09.2026 или 24/09/2026. */
export function parseSpendDate(value: string): string | null {
  const raw = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[ T]00:00:00)?$/.exec(raw);

  const local = /^(\d{2})[./](\d{2})[./](\d{4})$/.exec(raw);
  const date = iso
    ? `${iso[1]}-${iso[2]}-${iso[3]}`
    : local
      ? `${local[3]}-${local[2]}-${local[1]}`
      : null;
  if (!date) return null;
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date
    ? date
    : null;
}

export function parseSpendCsv(content: string): ParseResult {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) {
    return { rows: [], errors: [{ line: 0, reason: 'файл пуст' }] };
  }

  const headerAt = lines.findIndex((line) => {
    const cells = splitLine(line, detectDelimiter(line)).map((h) =>
      h.toLowerCase(),
    );
    return (
      cells.some((h) => COLUMN_ALIASES.date.includes(h)) &&
      cells.some((h) => COLUMN_ALIASES.spend.includes(h))
    );
  });
  const delimiter = detectDelimiter(lines[Math.max(0, headerAt)]);
  const header = splitLine(lines[Math.max(0, headerAt)], delimiter).map((h) =>
    h.toLowerCase(),
  );
  const indexOf = (field: keyof ParsedSpendRow): number =>
    header.findIndex((h) => COLUMN_ALIASES[field].includes(h));

  const dateAt = indexOf('date');
  const spendAt = indexOf('spend');
  if (dateAt < 0 || spendAt < 0) {
    return {
      rows: [],
      errors: [
        {
          line: 1,
          reason:
            'в заголовке нет колонок даты и расхода; ожидаются «Дата»/«date» и «Расход»/«cost»',
        },
      ],
    };
  }
  const idAt = indexOf('campaignId');
  const nameAt = indexOf('campaignName');
  const clicksAt = indexOf('clicks');
  const showsAt = indexOf('impressions');

  const rows: ParsedSpendRow[] = [];
  const errors: ParseResult['errors'] = [];
  for (let i = headerAt + 1; i < lines.length; i += 1) {
    const cells = splitLine(lines[i], delimiter);
    if (/^(итого|total)/i.test(cells[0] ?? '')) continue;
    const date = parseSpendDate(cells[dateAt] ?? '');
    if (!date) {
      errors.push({
        line: i + 1,
        reason: `не разобрана дата «${cells[dateAt] ?? ''}»`,
      });
      continue;
    }
    const spend = parseMoney(cells[spendAt] ?? '');
    if (spend === null) {
      errors.push({
        line: i + 1,
        reason: `не разобран расход «${cells[spendAt] ?? ''}»`,
      });
      continue;
    }
    const clicks = clicksAt >= 0 ? parseMoney(cells[clicksAt] ?? '') : 0;
    const impressions = showsAt >= 0 ? parseMoney(cells[showsAt] ?? '') : 0;
    if (
      clicks === null ||
      impressions === null ||
      !Number.isSafeInteger(clicks) ||
      !Number.isSafeInteger(impressions)
    ) {
      errors.push({
        line: i + 1,
        reason: 'клики и показы должны быть неотрицательными целыми числами',
      });
      continue;
    }
    rows.push({
      date,
      campaignId: (idAt >= 0 ? (cells[idAt] ?? '') : '').slice(0, 64),
      campaignName: (nameAt >= 0 ? (cells[nameAt] ?? '') : '').slice(0, 200),
      spend: Math.max(0, spend),
      clicks,
      impressions,
    });
  }

  return { rows: mergeDuplicates(rows), errors };
}

/**
 * Один день и одна кампания — одна строка.
 *
 * Кабинет умеет отдавать разбивку глубже, чем нам нужно (по объявлениям,
 * по площадкам). Схлопываем: иначе уникальный ключ импорта отбросил бы
 * всё, кроме последней строки, и расход бы занизился.
 */
function mergeDuplicates(rows: ParsedSpendRow[]): ParsedSpendRow[] {
  const byKey = new Map<string, ParsedSpendRow>();
  for (const row of rows) {
    const key = `${row.date}|${row.campaignId}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...row });
      continue;
    }
    existing.spend = Math.round((existing.spend + row.spend) * 10000) / 10000;
    existing.clicks += row.clicks;
    existing.impressions += row.impressions;
    if (!existing.campaignName) existing.campaignName = row.campaignName;
  }
  return [...byKey.values()].sort((a, b) =>
    a.date === b.date
      ? a.campaignId.localeCompare(b.campaignId)
      : a.date.localeCompare(b.date),
  );
}
