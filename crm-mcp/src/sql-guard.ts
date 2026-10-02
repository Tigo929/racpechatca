/**
 * Проверка произвольного запроса перед тем, как пустить его в базу.
 *
 * Зачем это нужно, если транзакция и так READ ONLY. Postgres не даст
 * записать, но запретом записи опасности не исчерпываются: один запрос
 * может выгрузить переписку с клиентами в контекст модели, заблокировать
 * таблицу, усыпить соединение на минуту или вытащить ключ от кабинета
 * Ozon. Транзакция от этого не защищает — защищает проверка здесь.
 *
 * Правило простое: мы не пытаемся угадать, что запрос «хочет сделать».
 * Мы пропускаем только то, что уверенно распознали как чтение, и
 * отказываем во всём остальном с объяснением. Отказ по ошибке —
 * неудобство; пропуск по ошибке — утечка.
 */

/** Сколько строк отдаём максимум: ответ читает модель, а не человек с экраном. */
export const MAX_ROWS = 200;

/** Предел длины самого запроса: мегабайтный SQL — это не вопрос к данным. */
const MAX_QUERY_LENGTH = 4000;

export class SqlGuardError extends Error {}

/**
 * Слова, которых в читающем запросе быть не может.
 *
 * `into` здесь не случайно: `SELECT … INTO new_table` создаёт таблицу, и это
 * запись, не похожая на запись. `set` — потому что им меняют параметры сессии,
 * включая те, что ослабляют остальные ограничения.
 */
const FORBIDDEN_KEYWORDS = [
  'insert',
  'update',
  'delete',
  'drop',
  'alter',
  'create',
  'truncate',
  'grant',
  'revoke',
  'copy',
  'vacuum',
  'reindex',
  'cluster',
  'lock',
  'call',
  'do',
  'set',
  'reset',
  'begin',
  'commit',
  'rollback',
  'savepoint',
  'listen',
  'notify',
  'unlisten',
  'prepare',
  'execute',
  'deallocate',
  'refresh',
  'import',
  'into',
];

/**
 * Функции, которыми читают файлы сервера, ходят в сеть, засыпают и рубят
 * чужие соединения. Чтение данных без них обходится.
 */
const FORBIDDEN_FUNCTIONS = [
  'pg_read_file',
  'pg_read_binary_file',
  'pg_ls_dir',
  'pg_stat_file',
  'pg_sleep',
  'pg_terminate_backend',
  'pg_cancel_backend',
  'pg_reload_conf',
  'pg_rotate_logfile',
  'lo_import',
  'lo_export',
  'dblink',
  'set_config',
  'query_to_xml',
];

/**
 * Таблицы, которых модель не увидит целиком ни под каким предлогом:
 * переписка с клиентами, ключи доступа, готовые к отправке картинки с
 * адресатом. Это не «коммерческая тайна от агента» — это требование
 * не отдавать наружу личные данные и секреты, записанное в архитектуре.
 */
const FORBIDDEN_TABLES = [
  'AvitoMessage',
  'AvitoChat',
  'LocalAgentCredential',
  'ApprovalTelegramDelivery',
  'PushSubscription',
];

/**
 * Колонки, значения которых вырезаются из ответа, даже если запрос их
 * выбрал. Проверка идёт по ИМЕНАМ колонок результата, а не по тексту
 * запроса, — поэтому `SELECT *` тоже обезличивается, и обойти это
 * переименованием нельзя: псевдоним с запретным именем тоже попадёт
 * под правило, а псевдоним без него уже не скажет модели, что это было.
 */
const REDACTED_COLUMN_PATTERNS = [
  /pass/i,
  /secret/i,
  /token/i,
  /hash/i,
  /phone/i,
  /email/i,
  /urlcommunication/i,
  /telegram/i,
  /clientdrafttext/i,
  /recipient/i,
  /apikey/i,
  /image/i,
  /scenarioanswers/i,
];

export function isRedactedColumn(name: string): boolean {
  return REDACTED_COLUMN_PATTERNS.some((re) => re.test(name));
}

/**
 * Убрать строковые литералы, чтобы запретные слова искались в коде запроса,
 * а не в данных: заказ с примечанием «update прайса» не должен выглядеть
 * попыткой записи.
 */
function withoutStringLiterals(sql: string): string {
  return sql.replace(/'(?:[^']|'')*'/g, "''").replace(/"(?:[^"]|"")*"/g, '""');
}

/** Есть ли слово как слово, а не как часть другого (`created` ≠ `create`). */
function hasWord(haystack: string, word: string): boolean {
  return new RegExp(`(^|[^a-z0-9_])${word}([^a-z0-9_]|$)`, 'i').test(haystack);
}

export interface GuardedQuery {
  /** Запрос, обёрнутый ограничением на число строк. */
  sql: string;
  /** Сколько строк максимум вернётся. */
  limit: number;
}

/**
 * Проверить запрос и обернуть его ограничением строк.
 *
 * Ограничение ставится снаружи (`SELECT * FROM (запрос) LIMIT n`), а не
 * дописыванием LIMIT в текст: своё LIMIT внутри запроса остаётся в силе,
 * а забытое не превращает ответ в выгрузку на сорок тысяч строк.
 */
export function guardSelect(raw: string, limit = MAX_ROWS): GuardedQuery {
  const query = raw.trim().replace(/;\s*$/, '');

  if (query.length === 0) {
    throw new SqlGuardError('Запрос пустой.');
  }
  if (query.length > MAX_QUERY_LENGTH) {
    throw new SqlGuardError(
      `Запрос длиннее ${MAX_QUERY_LENGTH} символов. Такой вопрос лучше разбить или задать готовым инструментом.`,
    );
  }

  const code = withoutStringLiterals(query);

  if (code.includes('--') || code.includes('/*')) {
    throw new SqlGuardError(
      'Комментарии в запросе не разрешены: ими прячут вторую команду. Уберите «--» и «/* */».',
    );
  }
  if (code.includes(';')) {
    throw new SqlGuardError(
      'В запросе больше одной команды. Разрешён ровно один SELECT — пришлите его отдельно.',
    );
  }
  if (!/^\s*(select|with)\b/i.test(code)) {
    throw new SqlGuardError(
      'Разрешены только читающие запросы: начните с SELECT или WITH. Изменить данные через этот инструмент нельзя — см. описание.',
    );
  }

  for (const word of FORBIDDEN_KEYWORDS) {
    if (hasWord(code, word)) {
      throw new SqlGuardError(
        `Слово «${word.toUpperCase()}» в запросе не разрешено: этот инструмент только читает. ` +
          (word === 'into'
            ? 'SELECT … INTO создаёт таблицу — это запись.'
            : word === 'set'
              ? 'Менять параметры сессии нельзя.'
              : 'Данные меняются в CRM, а не здесь.'),
      );
    }
  }

  for (const fn of FORBIDDEN_FUNCTIONS) {
    if (hasWord(code, fn)) {
      throw new SqlGuardError(
        `Функция ${fn}() не разрешена: она выходит за пределы чтения данных.`,
      );
    }
  }

  for (const tableName of FORBIDDEN_TABLES) {
    if (new RegExp(`(^|[^a-z0-9_"])"?${tableName}"?([^a-z0-9_"]|$)`, 'i').test(query)) {
      throw new SqlGuardError(
        `Таблица «${tableName}» закрыта: в ней переписка с клиентами или ключи доступа, и наружу они не уходят. ` +
          'Если нужен факт из неё — скажите какой, он появится отдельным инструментом в обезличенном виде.',
      );
    }
  }

  const safeLimit = Math.min(Math.max(Math.trunc(limit) || MAX_ROWS, 1), MAX_ROWS);
  return {
    sql: `SELECT * FROM (${query}) AS "запрос агента" LIMIT ${safeLimit}`,
    limit: safeLimit,
  };
}
