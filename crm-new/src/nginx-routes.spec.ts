import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Каждый контроллер должен быть проксирован nginx-ом.
 *
 * Панель и API живут на одном домене: nginx решает по префиксу пути, отдать
 * запрос бэкенду или вернуть index.html. Префикса нет в конфиге — фронт
 * молча получает HTML вместо JSON, и фича выглядит сломанной без единой
 * ошибки в логах. Именно так «scenarios» не работал в проде с 24.07.2026:
 * контроллер был, строки в nginx не было.
 *
 * Тест сравнивает два списка напрямую, поэтому забыть правку конфига при
 * добавлении контроллера больше нельзя — сборка упадёт здесь.
 */

const SRC = join(__dirname);
const FRONTEND = join(__dirname, '..', '..', 'frontend');
const NGINX_CONF = join(FRONTEND, 'nginx.conf');
const VITE_CONF = join(FRONTEND, 'vite.config.ts');

/** Первый сегмент пути: 'partner/orders' проксируется правилом 'partner'. */
function rootSegment(route: string): string {
  return route.split('/')[0] ?? '';
}

function collectControllerRoutes(dir: string): string[] {
  const routes: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      routes.push(...collectControllerRoutes(full));
      continue;
    }
    if (!entry.endsWith('.ts') || entry.endsWith('.spec.ts')) continue;
    const source = readFileSync(full, 'utf8');
    for (const match of source.matchAll(/@Controller\(\s*'([^']*)'\s*\)/g)) {
      const route = match[1];
      // @Controller() без аргумента — корневой маршрут, префикса не имеет.
      if (route) routes.push(route);
    }
  }
  return routes;
}

/** Префиксы из location ~ ^/(a|b|c) в конфиге nginx. */
function nginxPrefixes(): string[] {
  const conf = readFileSync(NGINX_CONF, 'utf8');
  const match = conf.match(/location\s+~\s+\^\/\(([^)]+)\)/);
  if (!match)
    throw new Error('В nginx.conf не найден location с префиксами API');
  return match[1].split('|').map((p) => p.trim());
}

describe('маршруты API проксируются nginx', () => {
  it('каждый контроллер имеет префикс в nginx.conf', () => {
    const prefixes = nginxPrefixes();
    const missing = collectControllerRoutes(SRC)
      .map(rootSegment)
      .filter(
        (segment) => !prefixes.some((prefix) => segment.startsWith(prefix)),
      );

    expect([...new Set(missing)]).toEqual([]);
  });

  it('в nginx.conf нет префиксов без контроллера', () => {
    // Правило, которое проксирует несуществующий маршрут, — мусор: оно
    // отнимает путь у SPA и маскирует опечатки. Так здесь жил 'stock',
    // которого нет ни в бэкенде, ни во фронте.
    const segments = new Set(collectControllerRoutes(SRC).map(rootSegment));
    const stale = nginxPrefixes().filter(
      (prefix) => ![...segments].some((segment) => segment.startsWith(prefix)),
    );

    expect(stale).toEqual([]);
  });
});

/** Префиксы из `proxy:` в vite.config.ts — строки вида '/order-photo'. */
function vitePrefixes(): string[] {
  const conf = readFileSync(VITE_CONF, 'utf8');
  const proxy = conf.slice(conf.indexOf('proxy:'));
  if (!proxy) throw new Error('В vite.config.ts не найден блок proxy');
  return [...proxy.matchAll(/'\/([a-z0-9-]+)'/g)].map((m) => m[1]);
}

/**
 * То же самое, но для локальной разработки.
 *
 * У дев-сервера свой список префиксов, и он про nginx ничего не знает.
 * Забыть его так же легко, а последствия те же: запрос уходит в SPA-фолбэк,
 * фронт получает HTML вместо JSON, и раздел выглядит пустым — без ошибки в
 * логах. Так и случилось с «Согласованием»: маршруты добавили в nginx.conf,
 * а в vite.config.ts нет, и в дев-режиме раздел был пуст.
 */
describe('маршруты API проксируются дев-сервером Vite', () => {
  it('каждый контроллер имеет префикс в vite.config.ts', () => {
    const prefixes = vitePrefixes();
    const missing = collectControllerRoutes(SRC)
      .map(rootSegment)
      .filter(
        (segment) => !prefixes.some((prefix) => segment.startsWith(prefix)),
      );

    expect([...new Set(missing)]).toEqual([]);
  });
});
