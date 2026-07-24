import type { ProductScenario } from '../scenario.types';
import { DELIVERY_STEPS, NOTE_STEP, OPTIONAL } from './common-steps';

/**
 * Печать на футболках.
 *
 * Изделие по умолчанию даёт партнёр — своих заготовок мы не держим, поэтому
 * вопрос «чья футболка» задаём, только если клиент сам заговорил про свою вещь.
 */
export const TSHIRT_SCENARIO: ProductScenario = {
  key: 'TSHIRT',
  label: 'Печать на футболках',
  keywords: [
    'футболк',
    'майк',
    'худи',
    'свитшот',
    'принт',
    'термопечать',
    'dtf',
    'нанесен',
  ],
  steps: [
    {
      key: 'tshirtModel',
      label: 'Модель / ткань',
      group: 'Изделие',
      ask: 'Какая модель нужна — обычная хлопковая футболка или что-то конкретное?',
      hint: 'Уходит партнёру в производственное задание.',
      field: { kind: 'text', placeholder: 'Хлопок 160 г, оверсайз…' },
    },
    {
      key: 'color',
      label: 'Цвет',
      group: 'Изделие',
      ask: 'Какого цвета футболку делаем?',
      field: { kind: 'text', placeholder: 'Белый, чёрный…' },
    },
    {
      key: 'size',
      label: 'Размер',
      group: 'Изделие',
      ask: 'Подскажите размер футболки.',
      field: {
        kind: 'select',
        options: [
          { value: 'XS', label: 'XS' },
          { value: 'S', label: 'S' },
          { value: 'M', label: 'M' },
          { value: 'L', label: 'L' },
          { value: 'XL', label: 'XL' },
          { value: 'XXL', label: 'XXL' },
          { value: 'XXXL', label: 'XXXL' },
        ],
      },
    },
    {
      key: 'gender',
      label: 'Крой',
      group: 'Изделие',
      field: {
        kind: 'select',
        options: [
          { value: 'UNISEX', label: 'Унисекс' },
          { value: 'MALE', label: 'Мужской' },
          { value: 'FEMALE', label: 'Женский' },
          { value: 'KIDS', label: 'Детский' },
        ],
      },
    },
    {
      key: 'quantity',
      label: 'Количество',
      group: 'Изделие',
      ask: 'Сколько футболок нужно?',
      field: { kind: 'number', min: 1, unit: 'шт.' },
    },
    {
      key: 'clientItem',
      label: 'Футболка клиента',
      group: 'Изделие',
      hint: 'По умолчанию заготовку даёт партнёр. Отмечаем, только если клиент привозит свою вещь — расчёт с партнёром тогда другой.',
      field: { kind: 'boolean' },
      requiredWhen: OPTIONAL,
    },
    {
      key: 'printLocation',
      label: 'Место печати',
      group: 'Печать',
      ask: 'Где размещаем принт — перед, спина или что-то другое?',
      field: {
        kind: 'select',
        options: [
          { value: 'FRONT', label: 'Перед' },
          { value: 'BACK', label: 'Спина' },
          { value: 'FRONT_BACK', label: 'Перед и спина' },
          { value: 'SLEEVE_LEFT', label: 'Левый рукав' },
          { value: 'SLEEVE_RIGHT', label: 'Правый рукав' },
          { value: 'FULL', label: 'Полная запечатка' },
          { value: 'BY_TZ', label: 'По макету' },
        ],
      },
    },
    {
      key: 'designReady',
      label: 'Макет от клиента получен',
      group: 'Печать',
      ask: 'Пришлите, пожалуйста, макет в хорошем качестве — PNG или PDF.',
      hint: 'Либо макет от клиента, либо разработка дизайна — что-то одно должно быть закрыто.',
      field: { kind: 'boolean' },
      requiredWhen: { op: 'not', of: { op: 'equals', field: 'designNeeded', value: true } },
    },
    {
      key: 'designNeeded',
      label: 'Нужна разработка дизайна',
      group: 'Печать',
      hint: 'Разработка дизайна — отдельная позиция заказа со своей ценой.',
      field: { kind: 'boolean' },
      requiredWhen: OPTIONAL,
    },
    {
      key: 'designBrief',
      label: 'Что рисуем',
      group: 'Печать',
      ask: 'Опишите, что должно быть на футболке: надпись, картинка, стиль.',
      field: { kind: 'textarea', placeholder: 'Описание будущего макета' },
      visibleWhen: { op: 'equals', field: 'designNeeded', value: true },
    },
    ...DELIVERY_STEPS,
    {
      key: 'pricePerItem',
      label: 'Цена за одну футболку',
      group: 'Деньги и договорённости',
      hint: 'Именно цена штуки, а не сумма заказа: от неё считается расчёт с партнёром.',
      field: { kind: 'money', min: 0, unit: '₽' },
    },
    {
      key: 'designDevelopmentCost',
      label: 'Разработка дизайна',
      group: 'Деньги и договорённости',
      hint: 'Отдельная строка в чеке. Партнёру не уходит — это заработок магазина.',
      field: { kind: 'money', min: 0, unit: '₽' },
      visibleWhen: { op: 'equals', field: 'designNeeded', value: true },
    },
    NOTE_STEP,
  ],
};
