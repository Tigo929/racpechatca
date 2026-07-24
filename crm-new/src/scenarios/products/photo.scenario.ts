import type { ProductScenario } from '../scenario.types';
import { DELIVERY_STEPS, NOTE_STEP, OPTIONAL } from './common-steps';

/**
 * Печать фотографий.
 *
 * Формат хранится строкой (так же, как в существующей форме заказа), поэтому
 * список — это подсказка, а не жёсткий справочник: вариант «Другое» открывает
 * поле для произвольного названия.
 */
export const PHOTO_SCENARIO: ProductScenario = {
  key: 'PHOTO',
  label: 'Печать фотографий',
  keywords: [
    'фото',
    'фотограф',
    'фотки',
    'печать фото',
    'polaroid',
    'полароид',
    'instax',
    'инстакс',
    '10х15',
    '10x15',
    'магнит',
  ],
  steps: [
    {
      key: 'photoFormat',
      label: 'Формат',
      group: 'Что печатаем',
      ask: 'В каком формате печатаем — 10×15, Polaroid или Instax?',
      field: {
        kind: 'select',
        options: [
          { value: '10×15', label: '10×15' },
          { value: 'Polaroid', label: 'Polaroid' },
          { value: 'Instax', label: 'Instax' },
          { value: 'other', label: 'Другое' },
        ],
      },
    },
    {
      key: 'photoFormatOther',
      label: 'Какой именно формат',
      group: 'Что печатаем',
      field: { kind: 'text', placeholder: 'A4, 15×21, магнит…' },
      visibleWhen: { op: 'equals', field: 'photoFormat', value: 'other' },
    },
    {
      key: 'paperType',
      label: 'Бумага',
      group: 'Что печатаем',
      ask: 'Бумага глянцевая или матовая?',
      field: {
        kind: 'select',
        options: [
          { value: 'GLOSS', label: 'Глянцевая' },
          { value: 'MATTE', label: 'Матовая' },
        ],
      },
    },
    {
      key: 'quantity',
      label: 'Количество',
      group: 'Что печатаем',
      ask: 'Сколько фотографий печатаем?',
      field: { kind: 'number', min: 1, unit: 'шт.' },
    },
    {
      key: 'filesReceived',
      label: 'Файлы получены',
      group: 'Что печатаем',
      ask: 'Пришлите, пожалуйста, фотографии файлами — так качество не потеряется.',
      hint: 'Пока файлов нет, заказ запускать нельзя: печатать будет нечего.',
      field: { kind: 'boolean' },
    },
    {
      key: 'retouchNote',
      label: 'Обработка / пожелания к печати',
      group: 'Что печатаем',
      hint: 'Кадрирование, цветокоррекция, «убрать дату в углу» и т.п.',
      field: { kind: 'textarea', placeholder: 'Что поправить перед печатью' },
      requiredWhen: OPTIONAL,
    },
    ...DELIVERY_STEPS,
    {
      key: 'photoPrice',
      label: 'Сумма за печать, без доставки',
      group: 'Деньги и договорённости',
      hint: 'Сумма, которую клиент подтвердил в переписке. Доставка считается отдельно и прибавляется к итогу.',
      field: { kind: 'money', min: 0, unit: '₽' },
    },
    NOTE_STEP,
  ],
};
