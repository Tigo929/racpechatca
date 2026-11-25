import { PDFDocument } from 'pdf-lib';

/** Дописать страницы второго PDF в конец первого. */
export async function appendPdf(
  first: Buffer,
  second: Buffer,
): Promise<Buffer> {
  const doc = await PDFDocument.load(first);
  const extra = await PDFDocument.load(second);
  const pages = await doc.copyPages(extra, extra.getPageIndices());
  pages.forEach((p) => doc.addPage(p));
  return Buffer.from(await doc.save());
}
