/**
 * Сборка MCP-сервера: регистрация инструментов и общая обработка ошибок.
 *
 * Ошибка здесь — тоже ответ. Если запрос упал, модель должна прочитать
 * человеческую причину («период слишком длинный», «база недоступна»), а не
 * получить пустоту: иначе она либо повторит тот же вызов, либо — хуже —
 * ответит владельцу по памяти, выдав догадку за данные. Поэтому каждая
 * ошибка превращается в текст с пометкой isError, а не в исключение
 * транспорта.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { PeriodError } from './period.js';
import { allTools, assertUniqueNames } from './tools/registry.js';

export const SERVER_NAME = 'raspechatka-crm';
export const SERVER_VERSION = '1.0.0';

/** Что сервер рассказывает о себе клиенту до первого вызова. */
const INSTRUCTIONS = `Факты из CRM «Распечатка»: заказы, деньги, реклама, производство, зарплата, маркетплейсы.

Сервер только читает. Изменить заказ, отправить сообщение или удалить что-либо через него нельзя — для этого CRM.

Как пользоваться:
— Период задаётся датами from/to (ГГГГ-ММ-ДД). Без них берутся последние 30 дней.
— Все доли, средние и цены уже посчитаны в ответе. Не пересчитывайте их сами и не складывайте числа из разных инструментов: у них разные знаменатели.
— Прежде чем объяснять падение выручки, конверсии или окупаемости рекламы причинами из жизни, вызовите data_health. Частая причина — незаполненное поле, а не рынок.
— Прибыль сервер не считает: единственная верная формула себестоимости живёт в P&L-отчёте CRM. Если спрашивают о прибыли, скажите, что её нужно смотреть в отчёте, и дайте то, что известно: выручку и проведённые расходы.
— Чего в ответе нет, того нет в CRM. Не достраивайте пропуски догадками — скажите, что данных нет.`;

/** Текст ошибки для модели: коротко, по-русски, с подсказкой что делать. */
function errorText(error: unknown): string {
  if (error instanceof PeriodError) return error.message;
  const message = error instanceof Error ? error.message : String(error);
  if (/statement timeout|canceling statement/i.test(message)) {
    return 'База не ответила за 15 секунд. Возьмите период короче.';
  }
  if (/ECONNREFUSED|ENOTFOUND|timeout expired|Connection terminated/i.test(message)) {
    return 'База CRM недоступна — ответить нечем. Это сбой соединения, а не отсутствие данных: не делайте вывода «показателей нет».';
  }
  if (/DATABASE_URL/.test(message)) return message;
  return `Запрос не выполнен: ${message}`;
}

export function buildServer(): McpServer {
  assertUniqueNames();

  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { instructions: INSTRUCTIONS },
  );

  for (const tool of allTools) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.schema,
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      async (args: Record<string, unknown>) => {
        try {
          const text = await tool.run(args ?? {});
          return { content: [{ type: 'text' as const, text }] };
        } catch (error) {
          return {
            content: [{ type: 'text' as const, text: errorText(error) }],
            isError: true,
          };
        }
      },
    );
  }

  return server;
}
