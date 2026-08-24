import type { EnumApprovalSide } from 'src/generated/prisma/enums';

/**
 * Размещение принта на одной стороне футболки.
 *
 * Координаты нормализованы: x и y — центр принта в долях зоны печати, а не
 * в пикселях. Благодаря этому согласование открывается через неделю на другом
 * экране (и даже после замены фотографии мокапа) ровно там, где его оставили.
 *
 * Масштаба здесь намеренно нет. Размер принта задаётся физически — widthMm и
 * heightMm, — а в пиксели он переводится калибровкой шаблона. Иначе «28 × 35 см»
 * было бы просто подписью, не связанной с картинкой.
 */
export interface ApprovalSideState {
  /** Ключ шаблона мокапа (MockupTemplate.key). */
  templateKey: string;
  /** Имя файла принта в хранилище. Пусто — принт для стороны не загружен. */
  printFile: string | null;
  /** Как файл назывался у сотрудника. Показываем в интерфейсе, к диску отношения не имеет. */
  printOriginalName: string | null;
  /** Разрешение исходника — по нему считается фактический DPI печати. */
  printWidthPx: number;
  printHeightPx: number;
  /** Физический размер печати. В миллиметрах: целые числа не копят ошибку округления. */
  widthMm: number;
  heightMm: number;
  /** Сохранять пропорции при изменении размера. Снимается сотрудником осознанно. */
  lockRatio: boolean;
  /** Центр принта в долях зоны печати. 0.5/0.5 — ровно по центру зоны. */
  x: number;
  y: number;
  /** Поворот в градусах по часовой стрелке. */
  rotation: number;
}

export type ApprovalSides = Partial<
  Record<EnumApprovalSide, ApprovalSideState>
>;

const SIDES: EnumApprovalSide[] = ['FRONT', 'BACK'];

/** Пределы физического размера печати: 1 см … 2 м. Защита от опечатки в поле ввода. */
export const MIN_PRINT_MM = 10;
export const MAX_PRINT_MM = 2000;

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Разбирает JSON из базы в состояние сторон.
 *
 * Читаем защитно: колонка Json типизирована как «что угодно», а данные в ней
 * пишутся не только текущей версией кода. Мусор молча отбрасываем, а не роняем
 * карточку заказа — потерять согласование хуже, чем открыть его без стороны.
 */
export function parseSides(value: unknown): ApprovalSides {
  if (!value || typeof value !== 'object') return {};
  const raw = value as Record<string, unknown>;
  const result: ApprovalSides = {};

  for (const side of SIDES) {
    const entry = raw[side];
    if (!entry || typeof entry !== 'object') continue;
    const s = entry as Record<string, unknown>;
    const templateKey = str(s.templateKey);
    if (!templateKey) continue;

    result[side] = {
      templateKey,
      printFile: str(s.printFile),
      printOriginalName: str(s.printOriginalName),
      printWidthPx: Math.max(0, Math.round(num(s.printWidthPx, 0))),
      printHeightPx: Math.max(0, Math.round(num(s.printHeightPx, 0))),
      widthMm: clamp(
        Math.round(num(s.widthMm, 280)),
        MIN_PRINT_MM,
        MAX_PRINT_MM,
      ),
      heightMm: clamp(
        Math.round(num(s.heightMm, 350)),
        MIN_PRINT_MM,
        MAX_PRINT_MM,
      ),
      lockRatio: s.lockRatio !== false,
      // Центр принта разрешаем увести за пределы зоны (значения вне 0..1):
      // выход за область — предупреждение, а не запрет. Но не бесконечно,
      // иначе принт уезжает за пределы фотографии и его не найти.
      x: clamp(num(s.x, 0.5), -1, 2),
      y: clamp(num(s.y, 0.5), -1, 2),
      rotation: clamp(num(s.rotation, 0), -180, 180),
    };
  }

  return result;
}

/** Стороны, у которых загружен принт — только их есть смысл рисовать. */
export function filledSides(
  sides: ApprovalSides,
): { side: EnumApprovalSide; state: ApprovalSideState }[] {
  return SIDES.filter((side) => sides[side]?.printFile).map((side) => ({
    side,
    state: sides[side] as ApprovalSideState,
  }));
}
