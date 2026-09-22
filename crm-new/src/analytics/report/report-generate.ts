import { buildReportModel } from './report-build';
import {
  collectReport,
  lastCompleteDay,
  type CollectDeps,
  type CollectOptions,
} from './report-collect';
import { renderMarkdown } from './report-markdown';
import { renderPrintableHtml } from './report-html';
import type { ReportModel } from './report-contract';

/**
 * Одна точка сборки отчёта (этапы 15 и 16).
 *
 * И командная строка, и кнопка в панели обязаны получать один и тот же файл
 * за один и тот же период — иначе появятся два источника правды, чего весь
 * проект избегает. Поэтому оба пути зовут эту функцию, а не повторяют цепочку
 * collect → build → render у себя.
 */

export interface GeneratedReport {
  model: ReportModel;
  markdown: string;
  html: string;
  /** Границы периода, за который отчёт фактически собран. */
  from: string;
  to: string;
}

export async function generateReport(
  deps: CollectDeps,
  options: CollectOptions = {},
): Promise<GeneratedReport> {
  const input = await collectReport(deps, options);
  const model = buildReportModel(input);
  const markdown = renderMarkdown(model);
  return {
    model,
    markdown,
    html: renderPrintableHtml(model, markdown),
    from: input.current.period.from,
    to: input.current.period.to,
  };
}

export { lastCompleteDay };
