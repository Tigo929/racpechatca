import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_DAYS, MAX_DAYS, PeriodError, resolvePeriod, sqlRange } from '../src/period.ts';

const NOW = new Date('2026-09-30T12:00:00Z');

test('без дат берутся последние 30 дней, считая сегодняшний', () => {
  const period = resolvePeriod({}, NOW);
  assert.equal(period.to, '2026-09-30');
  assert.equal(period.from, '2026-09-01');
  assert.match(period.label, new RegExp(`${DEFAULT_DAYS} дн`));
});

test('границы включительные: с 1 по 28 сентября — это 28 дней, а не 27', () => {
  const period = resolvePeriod({ from: '2026-09-01', to: '2026-09-28' }, NOW);
  assert.match(period.label, /28 дн/);
});

test('один день — это один день', () => {
  const period = resolvePeriod({ from: '2026-09-15', to: '2026-09-15' }, NOW);
  assert.match(period.label, /1 дн/);
});

test('только from — конец периода сегодня', () => {
  const period = resolvePeriod({ from: '2026-09-20' }, NOW);
  assert.equal(period.to, '2026-09-30');
});

test('только to — от него отсчитываются 30 дней назад, а не от сегодня', () => {
  const period = resolvePeriod({ to: '2026-08-31' }, NOW);
  assert.equal(period.from, '2026-08-02');
  assert.equal(period.to, '2026-08-31');
});

test('дата не в формате ГГГГ-ММ-ДД — понятная ошибка с примером', () => {
  assert.throws(() => resolvePeriod({ from: '01.09.2026' }, NOW), (error: unknown) => {
    assert.ok(error instanceof PeriodError);
    assert.match(error.message, /ГГГГ-ММ-ДД/);
    assert.match(error.message, /2026-09-01/);
    return true;
  });
});

test('переставленные даты не молчат', () => {
  assert.throws(
    () => resolvePeriod({ from: '2026-09-30', to: '2026-09-01' }, NOW),
    /переставлены/,
  );
});

test('период длиннее потолка отклоняется с названным потолком', () => {
  assert.throws(() => resolvePeriod({ from: '2020-01-01', to: '2026-09-30' }, NOW), (error: unknown) => {
    assert.ok(error instanceof PeriodError);
    assert.match(error.message, new RegExp(String(MAX_DAYS)));
    return true;
  });
});

test('ровно потолок ещё проходит', () => {
  const from = new Date('2026-09-30T00:00:00Z');
  from.setUTCDate(from.getUTCDate() - (MAX_DAYS - 1));
  const period = resolvePeriod({ from: from.toISOString().slice(0, 10), to: '2026-09-30' }, NOW);
  assert.match(period.label, new RegExp(`${MAX_DAYS} дн`));
});

test('пробелы по краям даты не ломают разбор', () => {
  const period = resolvePeriod({ from: ' 2026-09-01 ', to: ' 2026-09-10 ' }, NOW);
  assert.equal(period.from, '2026-09-01');
  assert.equal(period.to, '2026-09-10');
});

test('граница для SQL — начало следующего дня: вечерние заказы не теряются', () => {
  const [from, to] = sqlRange(resolvePeriod({ from: '2026-09-01', to: '2026-09-28' }, NOW));
  assert.equal(from, '2026-09-01T00:00:00Z');
  assert.equal(to, '2026-09-29T00:00:00.000Z');
});
