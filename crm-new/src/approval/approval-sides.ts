import type { EnumApprovalSide } from 'src/generated/prisma/enums';

/**
 * Какие стороны изделия должны быть на листе согласования.
 *
 * Сторону печати выбирают при оформлении заказа, и она там единственная
 * правда: «перед», «спина» или «перед и спина». Лист согласования до сих пор
 * про неё не знал — оператор раскладывал макет по памяти. Забыл про спину у
 * двусторонней печати — лист ушёл с одной стороной, печатник сделал по листу,
 * и ошибка обнаружилась на готовой футболке, когда переделывать уже дорого.
 *
 * Поэтому лист теперь собирается строго по заказу: нужные стороны берутся
 * отсюда, лишние не показываются, а незаполненная обязательная сторона не даёт
 * сформировать лист.
 */

/** Стороны, которые умеет показывать лист: мокапы есть только для них. */
const FRONT: EnumApprovalSide = 'FRONT';
const BACK: EnumApprovalSide = 'BACK';

/**
 * Перевод места печати в стороны листа.
 *
 * `null` означает «по заказу не определить»: так у печати по ТЗ и у мест,
 * для которых мокапа нет вовсе (рукава, печать по всему изделию). В этих
 * случаях ограничивать оператора нельзя — он раскладывает по договорённости
 * с клиентом, и правило требует лишь, чтобы сторона была хотя бы одна.
 */
const BY_LOCATION: Record<string, EnumApprovalSide[] | null> = {
  FRONT: [FRONT],
  BACK: [BACK],
  FRONT_BACK: [FRONT, BACK],
  BY_TZ: null,
  FULL: null,
  SLEEVE_LEFT: null,
  SLEEVE_RIGHT: null,
};

export interface RequiredSides {
  /** Что обязано быть на листе. Пусто — заказ стороны не задаёт. */
  sides: EnumApprovalSide[];
  /**
   * Задаёт ли заказ стороны однозначно. Нет — лист собирается как раньше:
   * достаточно любой одной стороны.
   */
  strict: boolean;
}

/**
 * Стороны по позициям заказа.
 *
 * Если позиции спорят между собой — у одной перед, у другой спина, — берём
 * объединение. Так в 4 заказах из 113, и выбор сделан в сторону лишнего
 * вопроса оператору, а не молчаливой потери стороны: лишняя сторона на листе
 * заметна сразу, недостающая — только на готовом изделии.
 */
export function requiredApprovalSides(
  printLocations: readonly string[],
): RequiredSides {
  if (printLocations.length === 0) return { sides: [], strict: false };

  const sides = new Set<EnumApprovalSide>();
  for (const location of printLocations) {
    const mapped = BY_LOCATION[location];
    // Хотя бы одна позиция «по ТЗ» — и заказ перестаёт задавать стороны
    // однозначно: по нему уже нельзя сказать, чего не хватает.
    if (mapped === null || mapped === undefined) {
      return { sides: [], strict: false };
    }
    for (const side of mapped) sides.add(side);
  }

  // Перед всегда первым: в том же порядке идут страницы листа.
  const ordered = [FRONT, BACK].filter((side) => sides.has(side));
  return { sides: ordered, strict: ordered.length > 0 };
}

/** Человеческое название стороны — для сообщений оператору. */
export const SIDE_NAME: Record<EnumApprovalSide, string> = {
  FRONT: 'лицевая сторона',
  BACK: 'спина',
};

/**
 * Чего не хватает на листе. Пусто — всё на месте.
 *
 * Возвращает названия, а не коды: текст уходит оператору в интерфейс, и
 * «BACK» ему ничего не говорит.
 */
export function missingSides(
  required: RequiredSides,
  filled: readonly EnumApprovalSide[],
): string[] {
  if (!required.strict) return [];
  return required.sides
    .filter((side) => !filled.includes(side))
    .map((side) => SIDE_NAME[side]);
}
