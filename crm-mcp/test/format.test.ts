import assert from 'node:assert/strict';
import test from 'node:test';
import { answer, int, money, per, share, table } from '../src/format.ts';

test('деление на ноль даёт «—», а не NaN и не 0 %', () => {
  assert.equal(share(5, 0), '—');
  assert.equal(per(1000, 0), '—');
});

test('доля считается кодом и подписана процентом', () => {
  assert.equal(share(1, 4), '25.0 %');
  assert.equal(share(0, 4), '0.0 %');
});

test('среднее на штуку — это деньги', () => {
  assert.match(per(1000, 4), /250/);
  assert.match(per(1000, 4), /₽/);
});

test('пусто — это «—», а не ноль: отсутствие данных и нуль разные ответы', () => {
  assert.equal(money(null), '—');
  assert.equal(money(undefined), '—');
  assert.equal(int(null), '—');
  assert.equal(money(0), '0 ₽');
  assert.equal(int(0), '0');
});

test('суммы округляются до рубля', () => {
  // toLocaleString('ru-RU') ставит НЕразрывный пробел — сравниваем по смыслу,
  // а не по байтам, иначе тест ломается от смены версии ICU.
  assert.equal(money(1234.6).replace(/\s/g, ' '), '1 235 ₽');
  assert.equal(money(1234.4).replace(/\s/g, ' '), '1 234 ₽');
});

test('таблица выравнивается по столбцам', () => {
  const rendered = table(['имя', 'сумма'], [['ozon', '1 ₽'], ['длинное имя', '22 ₽']]);
  const lines = rendered.split('\n');
  assert.equal(lines.length, 4, 'заголовок, разделитель и две строки');
  assert.ok(lines[0]!.startsWith('имя        '), 'заголовок расширен до ширины столбца');
  assert.ok(lines[1]!.includes('─'));
});

test('пустая таблица честно говорит, что данных нет', () => {
  assert.equal(table(['а'], []), 'нет данных за период');
});

test('ответ начинается заголовком с периодом и заканчивается примечанием', () => {
  const text = answer({
    title: 'Воронка',
    period: '2026-09-01 … 2026-09-30 (30 дн.)',
    summary: ['Заказов: 10'],
    table: table(['а'], [['1']]),
    note: 'оплата приходит позже',
  });
  const lines = text.split('\n');
  assert.equal(lines[0], 'Воронка · 2026-09-01 … 2026-09-30 (30 дн.)');
  assert.equal(lines.at(-1), 'оплата приходит позже');
});

test('ответ без периода не печатает пустой разделитель', () => {
  const text = answer({ title: 'Заказ 1' });
  assert.equal(text, 'Заказ 1');
});
