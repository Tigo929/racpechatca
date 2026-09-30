/**
 * Самопроверка: прогнать каждый инструмент по настоящей базе и посмотреть,
 * что он ответит.
 *
 * Нужна потому, что типы TypeScript ничего не знают про SQL: опечатка в имени
 * колонки, неверный каст перечисления, деление на ноль в редкой ветке —
 * всё это компилируется и падает только на живых данных. Инструмент, который
 * падает у владельца при первом вопросе, хуже отсутствующего: он выглядит
 * работающим.
 *
 * Запускается вручную (`node dist/smoke.js`), только читает и печатает первые
 * строки каждого ответа — по ним видно и то, что запрос прошёл, и то, что
 * числа осмысленные. Ни одного числа наружу, кроме того, что уже в CRM.
 */

import { closePool } from './db.js';
import { allTools } from './tools/registry.js';

/** Аргументы для инструментов, которым без них нечего искать. */
const ARGS: Record<string, Record<string, unknown>> = {
  order_find: { query: '2026' },
};

async function main(): Promise<void> {
  let failed = 0;
  const lines: string[] = [];

  for (const tool of allTools) {
    const started = Date.now();
    try {
      const text = await tool.run(ARGS[tool.name] ?? {});
      const ms = Date.now() - started;
      const preview = text.split('\n').slice(0, 3).join(' | ').slice(0, 160);
      lines.push(`OK   ${tool.name} (${ms} мс): ${preview}`);
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      lines.push(`FAIL ${tool.name}: ${message}`);
    }
  }

  process.stdout.write(`${lines.join('\n')}\n`);
  process.stdout.write(
    `\nИтог: ${allTools.length - failed} из ${allTools.length} инструментов ответили.\n`,
  );
  await closePool();
  if (failed > 0) process.exitCode = 1;
}

await main();
