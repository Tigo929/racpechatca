import type { Answers, ProductScenario } from './scenario.types';
import type { ScenarioOrderMapping } from './scenario.mapping';
import { PHOTO_SCENARIO } from './products/photo.scenario';
import { TSHIRT_SCENARIO } from './products/tshirt.scenario';
import { photoToOrder } from './products/photo.mapper';
import { tshirtToOrder } from './products/tshirt.mapper';

/** Продукт целиком: что спрашиваем у клиента и как это становится заказом. */
export interface ProductDefinition {
  scenario: ProductScenario;
  toOrder: (answers: Answers) => ScenarioOrderMapping;
}

/**
 * Реестр продуктов.
 *
 * Добавить новый продукт = два файла в products/ (описание и преобразование) и
 * одна запись здесь. Ни контроллер, ни фронтенд трогать не нужно: описание
 * отдаётся по API, и панель оформления строится по нему.
 */
export const PRODUCTS: ProductDefinition[] = [
  { scenario: PHOTO_SCENARIO, toOrder: photoToOrder },
  { scenario: TSHIRT_SCENARIO, toOrder: tshirtToOrder },
];

export const SCENARIOS: ProductScenario[] = PRODUCTS.map((p) => p.scenario);

export function findProduct(key: string): ProductDefinition | undefined {
  return PRODUCTS.find((p) => p.scenario.key === key);
}

export function findScenario(key: string): ProductScenario | undefined {
  return findProduct(key)?.scenario;
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
