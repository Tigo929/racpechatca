/**
 * PDF превращается в картинку прямо в браузере, до отправки на сервер.
 *
 * Макеты с лоями весят сотни мегабайт, и ждать их загрузку по обычному
 * интернету — минуты. При этом на сервере PDF всё равно превращается
 * в растр: всё, что в нём есть сверх первой страницы (слои, шрифты,
 * цветовые профили, история правок), в лист согласования не попадает
 * никогда.
 *
 * Значит, гнать эти мегабайты по сети незачем. Рисуем страницу здесь и
 * отправляем картинку на пару мегабайт — качество то же, ожидание короче
 * в десятки раз. Серверный разбор PDF остаётся как запасной путь: если
 * браузер не справился, файл уйдёт как есть.
 */

/** Длинная сторона растра. Столько же хранит сервер — больше не нужно. */
export const PDF_RASTER_LONG_SIDE = 4000;

/**
 * До какого размера страницы отдаём PNG.
 *
 * PNG без потерь, и для маленького принта это правильный выбор. Но
 * кодирование большого холста в PNG занимает секунды и даёт файл на
 * десятки мегабайт — ровно то, от чего уходили. WebP с качеством 95
 * для печати неотличим, а кодируется быстрее и весит в разы меньше.
 *
 * Считаем по пикселям, а не по готовому файлу: иначе пришлось бы сначала
 * закодировать PNG, чтобы узнать его вес, и выбросить результат. Именно
 * это и было самым долгим шагом подготовки.
 */
export const PNG_LIMIT_PIXELS = 4_000_000;
export const WEBP_QUALITY = 0.95;

export function isPdfFile(file: File): boolean {
  return (
    file.type === 'application/pdf' || /\.pdf$/i.test(file.name ?? '')
  );
}

/**
 * Во сколько раз масштабировать страницу, чтобы длинная сторона вышла
 * ровно по потолку.
 *
 * Чаще всего это увеличение: страница A4 — 842 точки, а нам нужно 4000
 * пикселей. Вектор от этого не теряет ничего. Уменьшение случается
 * только у огромных страниц — больше 141 см по длинной стороне.
 */
export function rasterScale(
  widthPt: number,
  heightPt: number,
  longSide: number = PDF_RASTER_LONG_SIDE,
): number {
  const longest = Math.max(widthPt, heightPt);
  if (!Number.isFinite(longest) || longest <= 0) return 1;
  return longSide / longest;
}

/** Имя готовой картинки: «макет.pdf» → «макет.png». */
export function rasterizedName(name: string, extension: 'png' | 'webp'): string {
  const base = (name || 'print').replace(/\.pdf$/i, '');
  return `${base}.${extension}`;
}

/**
 * Какой формат отправлять. Решается до кодирования — по размеру холста.
 */
export function pickUploadFormat(pixels: number): 'png' | 'webp' {
  return pixels <= PNG_LIMIT_PIXELS ? 'png' : 'webp';
}

/** Шаги подготовки — их видно на кнопке, пока идёт работа. */
export type PdfStage = 'read' | 'render' | 'encode';

export const PDF_STAGE_LABELS: Record<PdfStage, string> = {
  read: 'Читаем PDF…',
  render: 'Рисуем страницу…',
  encode: 'Готовим картинку…',
};

async function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('пустая картинка'))),
      type,
      quality,
    );
  });
}

/**
 * Первая страница PDF как файл-картинка.
 *
 * Прозрачность сохраняется: холст не заливается белым, и принт ляжет
 * на футболку без прямоугольной подложки — ровно так же, как это делает
 * сервер.
 */
export async function pdfFirstPageToImage(
  file: File,
  options: { longSide?: number; onStage?: (stage: PdfStage) => void } = {},
): Promise<File> {
  const longSide = options.longSide ?? PDF_RASTER_LONG_SIDE;
  const stage = (next: PdfStage) => options.onStage?.(next);
  // Грузим библиотеку только когда она понадобилась: в обычной работе
  // с CRM она не нужна, а весит заметно.
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();

  stage('read');
  const data = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data }).promise;
  try {
    const page = await doc.getPage(1);
    stage('render');
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({
      scale: rasterScale(base.width, base.height, longSide),
    });

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('браузер не дал холст для отрисовки');

    await page.render({
      canvas,
      canvasContext: context,
      viewport,
      // Прозрачный фон: белую подложку сюда подставлять нельзя.
      background: 'rgba(0,0,0,0)',
    }).promise;

    stage('encode');
    /*
     * Кодируем один раз. Раньше сначала получался PNG, и уже по его весу
     * решалось, не пережать ли в WebP — то есть большой холст кодировался
     * дважды, а первый результат выбрасывался. На странице в двадцать
     * мегапикселей это стоило нескольких секунд ожидания на ровном месте.
     */
    const format = pickUploadFormat(canvas.width * canvas.height);
    const blob =
      format === 'png'
        ? await canvasToBlob(canvas, 'image/png')
        : await canvasToBlob(canvas, 'image/webp', WEBP_QUALITY);

    // Освобождаем холст сразу: страница 4000 px — это десятки мегабайт
    // в памяти вкладки, и ждать сборщика мусора незачем.
    canvas.width = 0;
    canvas.height = 0;

    return new File([blob], rasterizedName(file.name, format), {
      type: format === 'png' ? 'image/png' : 'image/webp',
    });
  } finally {
    await doc.destroy().catch(() => undefined);
  }
}
