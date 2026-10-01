import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_ROWS, SqlGuardError, guardSelect, isRedactedColumn } from '../src/sql-guard.ts';

/** Запрос, который должен проходить: обычное чтение. */
const OK = 'SELECT "numberOrder", status FROM "OrderPhoto" WHERE status = \'NEW\'';

function rejects(query: string, expected: RegExp): void {
  assert.throws(
    () => guardSelect(query),
    (error: unknown) => {
      assert.ok(error instanceof SqlGuardError, `ожидалась SqlGuardError, пришло: ${String(error)}`);
      assert.match(error.message, expected);
      return true;
    },
    `запрос должен быть отклонён: ${query}`,
  );
}

test('читающий запрос проходит и оборачивается ограничением строк', () => {
  const guarded = guardSelect(OK);
  assert.match(guarded.sql, /^SELECT \* FROM \(/);
  assert.match(guarded.sql, new RegExp(`LIMIT ${MAX_ROWS}$`));
  assert.equal(guarded.limit, MAX_ROWS);
});

test('WITH тоже чтение', () => {
  assert.doesNotThrow(() =>
    guardSelect('WITH x AS (SELECT 1 AS a) SELECT a FROM x'),
  );
});

test('точка с запятой в конце не мешает', () => {
  assert.doesNotThrow(() => guardSelect(`${OK};`));
  assert.doesNotThrow(() => guardSelect(`${OK};   `));
});

test('запись отклоняется — каждая команда своим словом', () => {
  rejects('UPDATE "OrderPhoto" SET status = \'PAID\'', /только читает|SELECT или WITH/);
  rejects('DELETE FROM "OrderPhoto"', /только читает|SELECT или WITH/);
  rejects('INSERT INTO "OrderPhoto" (id) VALUES (\'1\')', /только читает|SELECT или WITH/);
  rejects('DROP TABLE "OrderPhoto"', /только читает|SELECT или WITH/);
  rejects('TRUNCATE "OrderPhoto"', /только читает|SELECT или WITH/);
});

test('запись, спрятанная за SELECT, тоже отклоняется', () => {
  rejects(`${OK}; UPDATE "OrderPhoto" SET status = 'PAID'`, /больше одной команды/);
  // Здесь сработает та проверка, что раньше: и точка с запятой, и комментарий
  // — оба повода для отказа. Важно, что запрос не прошёл, а не какой текст.
  rejects(`${OK} -- ; DROP TABLE "OrderPhoto"`, /больше одной команды|Комментарии/);
  rejects(`${OK} -- безобидный комментарий`, /Комментарии/);
  rejects(`SELECT 1 /* ; DROP TABLE x */`, /Комментарии/);
});

test('SELECT … INTO создаёт таблицу — это запись, а не чтение', () => {
  rejects('SELECT * INTO copy_of FROM "OrderPhoto"', /INTO/);
});

test('менять параметры сессии нельзя', () => {
  rejects('SELECT set_config(\'x\', \'y\', true)', /set_config/);
});

test('функции за пределами чтения данных отклоняются', () => {
  rejects("SELECT pg_read_file('/etc/passwd')", /pg_read_file/);
  rejects('SELECT pg_sleep(60)', /pg_sleep/);
  rejects('SELECT pg_terminate_backend(1)', /pg_terminate_backend/);
});

test('закрытые таблицы не читаются: переписка и ключи', () => {
  rejects('SELECT * FROM "AvitoMessage"', /AvitoMessage/);
  rejects('SELECT * FROM "LocalAgentCredential"', /LocalAgentCredential/);
  rejects('SELECT t.* FROM "ApprovalTelegramDelivery" t', /ApprovalTelegramDelivery/);
});

test('запретное слово внутри данных не мешает: «update прайса» в примечании', () => {
  assert.doesNotThrow(() =>
    guardSelect(`SELECT note FROM "OrderPhoto" WHERE note LIKE '%update прайса%'`),
  );
  assert.doesNotThrow(() =>
    guardSelect(`SELECT note FROM "OrderPhoto" WHERE note = 'drop the base'`),
  );
});

test('похожие слова не ложные срабатывания: createdAt не CREATE', () => {
  assert.doesNotThrow(() =>
    guardSelect('SELECT "createdAt", "updatedAt" FROM "OrderPhoto"'),
  );
  assert.doesNotThrow(() => guardSelect('SELECT "deletedById" FROM "OrderDeletion"'));
  assert.doesNotThrow(() => guardSelect('SELECT "lockedAt" FROM "MetrikaOrderOutbox"'));
});

test('пустой и чрезмерно длинный запрос отклоняются', () => {
  rejects('   ', /пустой/);
  rejects(`SELECT ${'a'.repeat(5000)}`, /длиннее/);
});

test('своё ограничение строк уважается, но потолок выше не прыгает', () => {
  assert.equal(guardSelect(OK, 10).limit, 10);
  assert.equal(guardSelect(OK, 10_000).limit, MAX_ROWS);
  assert.equal(guardSelect(OK, 0).limit, MAX_ROWS);
  assert.equal(guardSelect(OK, -5).limit, 1);
});

test('личные данные и секреты распознаются по имени колонки', () => {
  for (const name of [
    'password',
    'apiKeySecret',
    'apiKeyHint',
    'claimToken',
    'urlCommunication',
    'telegramUsername',
    'clientDraftText',
    'recipient',
    'image',
    'scenarioAnswers',
  ]) {
    assert.ok(isRedactedColumn(name), `${name} должно скрываться`);
  }
});

test('рабочие колонки не скрываются: иначе инструмент бесполезен', () => {
  for (const name of [
    'numberOrder',
    'status',
    'totalOrder',
    'createdAt',
    'sourceOrder',
    'productCategory',
    'marketplaceArticle',
    'reason',
  ]) {
    assert.ok(!isRedactedColumn(name), `${name} скрывать не нужно`);
  }
});
