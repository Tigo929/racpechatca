/**
 * Запуск сервера.
 *
 * По умолчанию stdio: так его подключают агенты на этом же ноутбуке, и это
 * самый безопасный вариант — никакого порта, никакой сети, доступ есть
 * только у процесса, который сервер запустил.
 *
 * HTTP включается, если задан PORT, — нужен, когда агент живёт в другом
 * контейнере. Сервер слушает только localhost, если явно не сказано иначе:
 * в базе CRM лежат заказы и переписка, и открывать её в сеть по случайности
 * нельзя. Каждый запрос обслуживается своим экземпляром сервера (режим без
 * сессий): состояние между запросами не копится, перезапуск ничего не теряет.
 *
 * В stdio-режиме нельзя писать в stdout — там протокол. Все сообщения
 * о жизни процесса идут в stderr.
 */

import { createServer } from 'node:http';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { closePool } from './db.js';
import { SERVER_NAME, SERVER_VERSION, buildServer } from './server.js';
import { allTools } from './tools/registry.js';

/** Сколько принимаем в теле запроса: вызов инструмента — это байты, не мегабайты. */
const MAX_BODY_BYTES = 256 * 1024;

function log(message: string): void {
  process.stderr.write(`[${SERVER_NAME}] ${message}\n`);
}

async function startStdio(): Promise<void> {
  const server = buildServer();
  await server.connect(new StdioServerTransport());
  log(`stdio, инструментов: ${allTools.length}, версия ${SERVER_VERSION}`);
}

async function readBody(
  req: import('node:http').IncomingMessage,
): Promise<unknown | undefined> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new Error('Тело запроса слишком большое.');
    chunks.push(chunk as Buffer);
  }
  if (chunks.length === 0) return undefined;
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function startHttp(port: number): Promise<void> {
  const host = process.env.HOST ?? '127.0.0.1';

  const http = createServer((req, res) => {
    void (async () => {
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, tools: allTools.length, version: SERVER_VERSION }));
        return;
      }
      if (req.url !== '/mcp') {
        res.writeHead(404).end();
        return;
      }

      // Своя пара сервер+транспорт на запрос: без сессий состояние не копится.
      const server = buildServer();
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      res.on('close', () => {
        void transport.close();
        void server.close();
      });

      try {
        const body = await readBody(req);
        await server.connect(transport);
        await transport.handleRequest(req, res, body);
      } catch (error) {
        log(`ошибка запроса: ${error instanceof Error ? error.message : String(error)}`);
        if (!res.headersSent) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              jsonrpc: '2.0',
              error: { code: -32700, message: 'Запрос не разобран' },
              id: null,
            }),
          );
        }
      }
    })();
  });

  await new Promise<void>((resolve) => http.listen(port, host, resolve));
  log(`http://${host}:${port}/mcp, инструментов: ${allTools.length}, версия ${SERVER_VERSION}`);
}

async function main(): Promise<void> {
  const rawPort = process.env.PORT;
  if (rawPort) {
    const port = Number(rawPort);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error(`PORT=«${rawPort}» — не номер порта.`);
    }
    await startHttp(port);
  } else {
    await startStdio();
  }
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void closePool().finally(() => process.exit(0));
  });
}

main().catch((error: unknown) => {
  log(`не запустился: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
