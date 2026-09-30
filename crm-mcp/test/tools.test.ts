import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod';
import { allTools, assertUniqueNames } from '../src/tools/registry.ts';
import { PAID_STATUSES, label, paidSql } from '../src/statuses.ts';

/** Инструменты, которым аргумент обязателен: у остальных вызов без аргументов должен работать. */
const REQUIRES_ARGS = new Set(['order_find']);

test('имена инструментов не повторяются', () => {
  assert.doesNotThrow(() => assertUniqueNames());
});

test('дубль имени не проходит молча', () => {
  const one = allTools[0]!;
  assert.throws(() => assertUniqueNames([one, one]), /перезапишет/);
});

test('все фундаменты подключены', () => {
  const names = allTools.map((t) => t.name);
  for (const expected of [
    'orders_funnel',
    'revenue_summary',
    'ad_economics',
    'channels_summary',
    'production_load',
    'salary_summary',
    'marketplace_orders',
    'data_health',
  ]) {
    assert.ok(names.includes(expected), `нет инструмента ${expected}`);
  }
  assert.ok(allTools.length >= 15, `инструментов всего ${allTools.length}`);
});

test('имя — снейк-кейс латиницей: по нему модель обращается к инструменту', () => {
  for (const tool of allTools) {
    assert.match(tool.name, /^[a-z][a-z0-9_]*$/, `имя «${tool.name}» не годится`);
  }
});

test('у каждого инструмента есть заголовок и содержательное описание', () => {
  for (const tool of allTools) {
    assert.ok(tool.title.length > 3, `${tool.name}: пустой заголовок`);
    assert.ok(
      tool.description.length > 120,
      `${tool.name}: описание короче 120 символов — модель не поймёт границ`,
    );
  }
});

test('описание говорит, чего инструмент НЕ знает: иначе модель додумает', () => {
  for (const tool of allTools) {
    // \b в JavaScript опирается на ASCII и для кириллицы не срабатывает:
    // границу слова задаём через «не буква» в юникод-режиме.
    assert.match(
      tool.description,
      /(^|[^\p{L}])(не|нет|нельзя|только|кроме)([^\p{L}]|$)/iu,
      `${tool.name}: в описании нет границ применимости`,
    );
  }
});

test('вызов без аргументов проходит проверку схемы у всех, кроме поиска', () => {
  for (const tool of allTools) {
    const result = z.object(tool.schema).safeParse({});
    if (REQUIRES_ARGS.has(tool.name)) {
      assert.equal(result.success, false, `${tool.name} должен требовать аргумент`);
    } else {
      assert.equal(result.success, true, `${tool.name} не должен требовать аргументов`);
    }
  }
});

test('где есть from, есть и to: половина периода бессмысленна', () => {
  for (const tool of allTools) {
    const keys = Object.keys(tool.schema);
    assert.equal(
      keys.includes('from'),
      keys.includes('to'),
      `${tool.name}: период задан наполовину`,
    );
  }
});

test('каждое поле схемы описано — модель заполняет их по описанию', () => {
  for (const tool of allTools) {
    for (const [field, schema] of Object.entries(tool.schema)) {
      const described = (schema as z.ZodTypeAny).description;
      assert.ok(described && described.length > 5, `${tool.name}.${field} без описания`);
    }
  }
});

test('limit ограничен сверху: инструмент не должен превращаться в выгрузку', () => {
  for (const tool of allTools) {
    if (!('limit' in tool.schema)) continue;
    const schema = z.object(tool.schema);
    assert.equal(schema.safeParse({ limit: 1000 }).success, false, `${tool.name}: limit без потолка`);
    assert.equal(schema.safeParse({ limit: 10 }).success, true);
  }
});

test('признак оплаты учитывает и дату, и статус', () => {
  const sql = paidSql('o');
  assert.match(sql, /clientPaidAt/);
  for (const status of PAID_STATUSES) {
    assert.ok(sql.includes(`'${status}'`), `статус ${status} не учтён`);
  }
});

test('незнакомый код показывается как есть, а не прячется', () => {
  assert.equal(label({ A: 'Первый' }, 'A'), 'Первый');
  assert.equal(label({ A: 'Первый' }, 'НОВЫЙ_КОД'), 'НОВЫЙ_КОД');
  assert.equal(label({ A: 'Первый' }, null), '—');
});
