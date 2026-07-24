import type { ProductScenario } from './scenario.types';
import { PHOTO_SCENARIO } from './products/photo.scenario';
import { TSHIRT_SCENARIO } from './products/tshirt.scenario';

/**
 * Реестр продуктов.
 *
 * Добавить новый продукт = создать файл в products/ и дописать его сюда.
 * Ни контроллер, ни фронтенд трогать не нужно: список сценариев отдаётся по
 * API, и панель оформления строится по нему.
 */
export const SCENARIOS: ProductScenario[] = [PHOTO_SCENARIO, TSHIRT_SCENARIO];

export function findScenario(key: string): ProductScenario | undefined {
  return SCENARIOS.find((s) => s.key === key);
}

/**
 * Проверка целостности описания.
 *
 * Ловит две ошибки, которые иначе всплывут уже у менеджера: одинаковые ключи
 * шагов (ответ на один вопрос молча затрёт другой) и условие, ссылающееся на
 * несуществующий шаг (поле никогда не появится, и никто не поймёт почему).
 */
export function validateScenario(scenario: ProductScenario): string[] {
  const errors: string[] = [];
  const keys = new Set<string>();

  for (const step of scenario.steps) {
    if (keys.has(step.key)) {
      errors.push(`${scenario.key}: повторяющийся ключ шага «${step.key}»`);
    }
    keys.add(step.key);

    if (step.field.kind === 'select' && !step.field.options?.length) {
      errors.push(`${scenario.key}.${step.key}: у списка нет вариантов`);
    }
  }

  const collectFields = (cond: unknown, acc: string[]): string[] => {
    if (!cond || typeof cond !== 'object') return acc;
    const c = cond as Record<string, unknown>;
    if (typeof c.field === 'string') acc.push(c.field);
    if (Array.isArray(c.of)) c.of.forEach((x) => collectFields(x, acc));
    else if (c.of) collectFields(c.of, acc);
    return acc;
  };

  for (const step of scenario.steps) {
    for (const cond of [step.visibleWhen, step.requiredWhen]) {
      for (const field of collectFields(cond, [])) {
        if (!keys.has(field)) {
          errors.push(
            `${scenario.key}.${step.key}: условие ссылается на неизвестный шаг «${field}»`,
          );
        }
      }
    }
  }

  return errors;
}

export function validateAllScenarios(): string[] {
  return SCENARIOS.flatMap(validateScenario);
}
