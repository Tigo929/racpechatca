import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve, sep } from 'node:path';

/**
 * Файлы отчётов (этап 16).
 *
 * Лежат в постоянном каталоге сервера, а не в контейнере и не в базе: это
 * производные артефакты по десятки килобайт, которые всегда можно собрать
 * заново, но терять их при каждом обновлении образа глупо.
 *
 * Имя файла пользователь не задаёт никогда. Скачивание принимает только
 * идентификатор отчёта и формат, путь собирает сервер — иначе download
 * превращается в чтение произвольного файла сервера.
 */

export const DEFAULT_REPORTS_DIR = '/app/data/analytics-reports';
export type ReportFormat = 'md' | 'html';

/** Идентификатор отчёта — только uuid: ничего, что могло бы уехать в путь. */
const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function reportsRoot(env: NodeJS.ProcessEnv = process.env): string {
  return env.ANALYTICS_REPORTS_DIR?.trim() || DEFAULT_REPORTS_DIR;
}

export function assertSafeId(id: string): void {
  if (!ID_RE.test(id)) throw new Error('Некорректный идентификатор отчёта');
}

/** Каталог одного отчёта; путь обязан остаться внутри корня хранилища. */
export function reportDir(
  id: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  assertSafeId(id);
  const root = resolve(reportsRoot(env));
  const dir = resolve(join(root, id));
  if (dir !== join(root, id) || !dir.startsWith(root + sep)) {
    throw new Error('Путь отчёта вышел за пределы хранилища');
  }
  return dir;
}

export function fileName(
  format: ReportFormat,
  from: string,
  to: string,
): string {
  return `analytics-report-${from}_${to}.${format}`;
}

export function filePath(
  id: string,
  name: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  // имя приходит из нашей же метаданной строки, но проверяем и его:
  // в путь не должно попасть ничего, кроме простого имени файла
  if (!/^[\w.-]+$/.test(name) || name.includes('..')) {
    throw new Error('Некорректное имя файла отчёта');
  }
  return join(reportDir(id, env), name);
}

/**
 * Запись «всё или ничего»: сначала во временный файл, потом переименование.
 * Недописанный отчёт не должен оказаться доступным как готовый.
 */
export function writeAtomic(target: string, content: string): number {
  const dir = target.slice(0, target.lastIndexOf(sep));
  mkdirSync(dir, { recursive: true });
  const tmp = `${target}.tmp`;
  writeFileSync(tmp, content, 'utf8');
  renameSync(tmp, target);
  return statSync(target).size;
}

export function readReportFile(
  id: string,
  name: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const path = filePath(id, name, env);
  if (!existsSync(path)) throw new Error('Файл отчёта не найден');
  return readFileSync(path, 'utf8');
}

export function removeReportDir(
  id: string,
  env: NodeJS.ProcessEnv = process.env,
): void {
  const dir = reportDir(id, env);
  rmSync(dir, { recursive: true, force: true });
}
