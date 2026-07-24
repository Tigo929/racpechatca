/**
 * Описание сценария оформления заказа.
 *
 * Главное правило этого модуля: сценарий — это ДАННЫЕ, а не код. Всё описание
 * сериализуется в JSON и отдаётся фронтенду, который по нему сам рисует форму и
 * список «что ещё выяснить у клиента». Поэтому здесь нет функций-предикатов:
 * условия описаны структурой (см. Condition), а не стрелочными функциями.
 *
 * Что это даёт: новый продукт = один файл в products/ + строка в реестре.
 * Фронтенд при этом не трогаем вообще — он узнаёт о продукте из API.
 */

/** Значение ответа менеджера. Namespace ограничен намеренно: всё, что сложнее,
 *  превращается в отдельный шаг — иначе форму нельзя нарисовать автоматически. */
export type AnswerValue = string | number | boolean | null;

export type Answers = Record<string, AnswerValue>;

/**
 * Условие показа/обязательности шага.
 *
 * Набор операторов намеренно крошечный. Соблазн сделать «язык выражений» тут
 * большой, но каждый новый оператор нужно поддержать и на сервере, и в браузере,
 * и покрыть тестами. Пока хватает этих — новый добавляем, когда реально прижмёт.
 */
export type Condition =
  /** Никогда. Нужен, чтобы честно пометить шаг необязательным. */
  | { op: 'never' }
  | { op: 'equals'; field: string; value: AnswerValue }
  | { op: 'notEquals'; field: string; value: AnswerValue }
  | { op: 'in'; field: string; values: AnswerValue[] }
  /** Поле заполнено: не null/undefined, не пустая строка, не false. */
  | { op: 'filled'; field: string }
  | { op: 'gt'; field: string; value: number }
  | { op: 'and'; of: Condition[] }
  | { op: 'or'; of: Condition[] }
  | { op: 'not'; of: Condition };

export type FieldKind =
  | 'text'
  | 'textarea'
  | 'number'
  | 'money'
  | 'select'
  | 'boolean'
  | 'date';

export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldSpec {
  kind: FieldKind;
  /** Только для kind: 'select'. */
  options?: FieldOption[];
  min?: number;
  max?: number;
  placeholder?: string;
  /** Подпись справа от числового поля: «шт.», «₽», «см». */
  unit?: string;
}

export interface ScenarioStep {
  /** Ключ ответа. Стабильный: по нему сохранён черновик, менять нельзя. */
  key: string;
  /** Подпись поля в панели оформления. */
  label: string;
  /**
   * Готовая формулировка вопроса клиенту. Менеджер отправляет её в переписку
   * одной кнопкой — это и есть «подсказка, что ещё спросить».
   */
  ask?: string;
  /** Пояснение менеджеру: зачем поле и как уточнять. Клиенту не показывается. */
  hint?: string;
  field: FieldSpec;
  /**
   * Когда шаг обязателен. Не задано — обязателен всегда.
   * Пример: адрес нужен, только если доставка не самовывоз.
   */
  requiredWhen?: Condition;
  /** Когда шаг вообще показывать. Не задано — показывать всегда. */
  visibleWhen?: Condition;
  /** Заголовок блока в панели: шаги одной группы идут вместе. */
  group?: string;
}

export interface ProductScenario {
  /** Совпадает с EnumProductCategory, пока продукты и категории — одно и то же. */
  key: string;
  label: string;
  /**
   * Слова, по которым обращение относят к этому продукту. Сравниваются с
   * названием объявления Авито и текстом первого сообщения.
   */
  keywords: string[];
  steps: ScenarioStep[];
}

/** Незаполненный обязательный шаг — строка в списке «осталось выяснить». */
export interface MissingStep {
  key: string;
  label: string;
  ask?: string;
}

export interface ScenarioProgress {
  /** Сколько обязательных шагов видно при текущих ответах. */
  requiredTotal: number;
  /** Сколько из них заполнено. */
  requiredFilled: number;
  missing: MissingStep[];
  /** Все обязательные шаги закрыты — можно оформлять заказ. */
  ready: boolean;
}

export interface ProductGuess {
  key: string;
  label: string;
  /** Сколько ключевых слов сценария нашлось в тексте. */
  score: number;
}
