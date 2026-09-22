import type { ReportModel } from './report-contract';

/**
 * Печатная версия отчёта (этап 15).
 *
 * PDF собирается не в контейнере: headless-браузер весит сотни мегабайт и
 * тянет за собой обновления безопасности, а сервер у нас об одном ядре.
 * Поэтому CLI кладёт рядом с markdown самодостаточный HTML, который браузер
 * печатает в PDF одним действием — тот же текст, те же числа, тот же порядок
 * разделов. Источник один: строка markdown, из которой этот HTML и собран,
 * поэтому разойтись форматы не могут.
 */

const ESCAPE: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
};

function escapeHtml(text: string): string {
  return text.replace(/[&<>]/g, (c) => ESCAPE[c]);
}

function inline(text: string): string {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|\s)_([^_]+)_(?=\s|$|[.,;:])/g, '$1<em>$2</em>');
}

/** Разбор markdown, который печатает наш же рендер: заголовки, таблицы, блоки кода, списки. */
export function markdownToHtml(markdown: string): string {
  const lines = markdown.split('\n');
  const html: string[] = [];
  let i = 0;

  const isTableRow = (line: string) => /^\|.*\|$/.test(line.trim());
  const isSeparator = (line: string) =>
    /^\|[\s:-]+\|$/.test(line.trim().replace(/\s/g, ''));

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('```')) {
      const block: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith('```')) {
        block.push(lines[i]);
        i += 1;
      }
      i += 1;
      html.push(`<pre><code>${escapeHtml(block.join('\n'))}</code></pre>`);
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      i += 1;
      continue;
    }

    if (isTableRow(line)) {
      const rows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i])) {
        if (!isSeparator(lines[i])) {
          rows.push(
            lines[i]
              .trim()
              .slice(1, -1)
              .split('|')
              .map((c) => c.trim()),
          );
        }
        i += 1;
      }
      const [head, ...body] = rows;
      html.push(
        '<table><thead><tr>' +
          head.map((c) => `<th>${inline(c)}</th>`).join('') +
          '</tr></thead><tbody>' +
          body
            .map(
              (r) =>
                '<tr>' +
                r.map((c) => `<td>${inline(c)}</td>`).join('') +
                '</tr>',
            )
            .join('') +
          '</tbody></table>',
      );
      continue;
    }

    if (line.startsWith('- ')) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith('- ')) {
        items.push(`<li>${inline(lines[i].slice(2))}</li>`);
        i += 1;
      }
      html.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    if (line.trim() === '') {
      i += 1;
      continue;
    }

    html.push(`<p>${inline(line)}</p>`);
    i += 1;
  }

  return html.join('\n');
}

export function renderPrintableHtml(
  model: ReportModel,
  markdown: string,
): string {
  const period = `${model.input.current.period.from}..${model.input.current.period.to}`;
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>Аналитический отчёт «Распечатка» — ${escapeHtml(period)}</title>
<style>
  :root { color-scheme: light; }
  body { font-family: "Segoe UI", Roboto, Arial, sans-serif; font-size: 12px;
         line-height: 1.5; color: #1a1a1a; background: #fff; margin: 0 auto;
         max-width: 900px; padding: 24px; }
  h1 { font-size: 20px; margin: 28px 0 8px; border-bottom: 2px solid #1a1a1a; padding-bottom: 4px; }
  h2 { font-size: 16px; margin: 20px 0 6px; }
  h3 { font-size: 13px; margin: 14px 0 4px; }
  table { border-collapse: collapse; width: 100%; margin: 8px 0 14px; font-size: 11px; }
  th, td { border: 1px solid #d0d0d0; padding: 4px 6px; text-align: left; }
  th { background: #f2f2f2; }
  td:nth-child(n+2) { font-variant-numeric: tabular-nums; }
  pre { background: #f7f7f7; border: 1px solid #e0e0e0; padding: 8px 10px;
        overflow-x: auto; font-size: 11px; white-space: pre-wrap; }
  code { font-family: "Cascadia Mono", Consolas, monospace; }
  ul { margin: 6px 0 12px 18px; padding: 0; }
  p { margin: 6px 0; }
  @media print {
    body { max-width: none; padding: 0 8mm; }
    h1 { page-break-before: auto; page-break-after: avoid; }
    table, pre { page-break-inside: avoid; }
  }
</style>
</head>
<body>
${markdownToHtml(markdown)}
</body>
</html>
`;
}
