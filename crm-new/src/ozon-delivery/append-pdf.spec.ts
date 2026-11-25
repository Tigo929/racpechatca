import { PDFDocument } from 'pdf-lib';
import { appendPdf } from './append-pdf';

async function pdf(sizes: [number, number][]): Promise<Buffer> {
  const d = await PDFDocument.create();
  sizes.forEach((s) => d.addPage(s));
  return Buffer.from(await d.save());
}

describe('этикетка Ozon в «Печать PDF»', () => {
  it('этикетка идёт следующей страницей в своём размере', async () => {
    // Наклейка 58×40 мм и этикетка 75×120 мм.
    const out = await appendPdf(
      await pdf([[164, 113]]),
      await pdf([[213, 340]]),
    );
    const doc = await PDFDocument.load(out);
    expect(doc.getPageCount()).toBe(2);
    expect(doc.getPage(0).getSize()).toEqual({ width: 164, height: 113 });
    expect(doc.getPage(1).getSize()).toEqual({ width: 213, height: 340 });
  });
});
