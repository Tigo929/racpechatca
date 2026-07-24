import type {
  AnswerValue,
  Answers,
  Condition,
  MissingStep,
  ProductGuess,
  ProductScenario,
  ScenarioProgress,
  ScenarioStep,
} from './scenario.types';

/**
 * Чистые функции разбора сценария. Ни базы, ни Nest — только вычисления,
 * поэтому это же поведение легко покрыть тестами и (позже) повторить один в
 * один в браузере, чтобы форма не расходилась с проверкой на сервере.
 */

/**
 * Заполнено ли поле.
 *
 * `false` считается НЕзаполненным намеренно: у флажков «нужен дизайн» состояние
 * по умолчанию — выключено, и если считать его ответом, панель будет говорить
 * «всё собрано», когда менеджер ещё ничего не спросил. Ноль, наоборот, ответ
 * настоящий: «0 фотографий» — осмысленное значение, которое надо увидеть.
 */
export function isFilled(value: AnswerValue | undefined): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'boolean') return value;
  return true;
}

export function evaluateCondition(cond: Condition, answers: Answers): boolean {
  switch (cond.op) {
    case 'never':
      return false;
    case 'equals':
      return answers[cond.field] === cond.value;
    case 'notEquals':
      return answers[cond.field] !== cond.value;
    case 'in':
      return cond.values.includes(answers[cond.field]);
    case 'filled':
      return isFilled(answers[cond.field]);
    case 'gt': {
      const v = answers[cond.field];
      return typeof v === 'number' && v > cond.value;
    }
    case 'and':
      return cond.of.every((c) => evaluateCondition(c, answers));
    case 'or':
      return cond.of.some((c) => evaluateCondition(c, answers));
    case 'not':
      return !evaluateCondition(cond.of, answers);
  }
}

export function isStepVisible(step: ScenarioStep, answers: Answers): boolean {
  return step.visibleWhen ? evaluateCondition(step.visibleWhen, answers) : true;
}

/**
 * Обязателен ли шаг ПРЯМО СЕЙЧАС. Скрытый шаг обязательным быть не может —
 * иначе панель потребует то, чего менеджер даже не видит на экране.
 */
export function isStepRequired(step: ScenarioStep, answers: Answers): boolean {
  if (!isStepVisible(step, answers)) return false;
  return step.requiredWhen ? evaluateCondition(step.requiredWhen, answers) : true;
}

/** Шаги, которые нужно показать в панели при текущих ответах. */
export function visibleSteps(
  scenario: ProductScenario,
  answers: Answers,
): ScenarioStep[] {
  return scenario.steps.filter((s) => isStepVisible(s, answers));
}

/**
 * Что уже собрано и что осталось выяснить.
 *
 * Порядок `missing` — как в сценарии: это подсказка менеджеру, в каком порядке
 * вести разговор, а не просто перечень дырок в форме.
 */
export function evaluateScenario(
  scenario: ProductScenario,
  answers: Answers,
): ScenarioProgress {
  const missing: MissingStep[] = [];
  let requiredTotal = 0;
  let requiredFilled = 0;

  for (const step of scenario.steps) {
    if (!isStepRequired(step, answers)) continue;
    requiredTotal += 1;
    if (isFilled(answers[step.key])) {
      requiredFilled += 1;
    } else {
      missing.push({ key: step.key, label: step.label, ask: step.ask });
    }
  }

  return {
    requiredTotal,
    requiredFilled,
    missing,
    ready: missing.length === 0,
  };
}

/** Приводим текст к виду, в котором сравнение не зависит от «ё» и регистра. */
function normalize(text: string): string {
  return text.toLowerCase().replace(/ё/g, 'е');
}

/**
 * По какому продукту обращение.
 *
 * Считаем совпадения ключевых слов в тексте (название объявления Авито + первое
 * сообщение). Результат — ПОДСКАЗКА: последнее слово всегда за менеджером,
 * поэтому возвращаем весь список с очками, а не одну «правильную» догадку.
 * Автоматика тут ошибётся обязательно — важно, чтобы ошибка была видна и
 * исправлялась одним кликом, а не всплывала уже в готовом заказе.
 */
export function detectProduct(
  text: string,
  scenarios: ProductScenario[],
): ProductGuess[] {
  const haystack = normalize(text);

  return scenarios
    .map((s) => ({
      key: s.key,
      label: s.label,
      score: s.keywords.reduce(
        (acc, kw) => (haystack.includes(normalize(kw)) ? acc + 1 : acc),
        0,
      ),
    }))
    .filter((g) => g.score > 0)
    .sort((a, b) => b.score - a.score);
}

/**
 * Отбрасываем ответы на шаги, которых в сценарии нет или которые сейчас скрыты.
 *
 * Нужно при смене продукта: менеджер начал оформлять фото, выяснилось, что речь
 * о футболке — мусор от прошлого сценария не должен уехать в заказ. Заодно это
 * защита от лишних полей, присланных клиентом мимо формы.
 */
export function pickRelevantAnswers(
  scenario: ProductScenario,
  answers: Answers,
): Answers {
  const result: Answers = {};
  for (const step of visibleSteps(scenario, answers)) {
    if (step.key in answers) result[step.key] = answers[step.key];
  }
  return result;
}
