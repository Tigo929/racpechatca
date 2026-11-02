import { ApprovalRenderService } from './approval-render.service';

/**
 * Печать на изделии клиента — предупреждение на листе согласования.
 *
 * Было так: два поля в столбце данных, «Изделие — Клиента» и «Работа —
 * печать на изделии клиента». Написано верно, а работает плохо: лист
 * читают не построчно. Печатник берёт его со стола, смотрит на макет и
 * на размер печати, и две строки мелким шрифтом в углу находит уже
 * после того, как достал из стопки чистую футболку.
 *
 * Цена ошибки здесь другая, чем обычно. Испорченный наш бланк — это
 * бланк, напечатаем заново. Испорченная вещь, которую принёс человек,
 * не заменяется ничем: заказ из неё уже не спасти, и разговор об этом
 * будет не про деньги.
 *
 * Поэтому полоса во всю ширину, на каждой странице — страницы раскладывают
 * по столу поодиночке, и та, где предупреждения нет, снова выглядит как
 * обычный заказ.
 */

type Layers = {
  buildSidePageLayer: (
    input: unknown,
    side: unknown,
    index: number,
    pages: number,
  ) => string;
  buildPrintsPageLayer: (
    input: unknown,
    sides: unknown[],
    boxes: unknown[],
    pages: number,
  ) => string;
};

const service = new ApprovalRenderService(null as never) as unknown as Layers;

const side = {
  side: 'FRONT',
  state: {
    widthMm: 200,
    heightMm: 250,
    printWidthPx: 2400,
    printOriginalName: 'print.png',
  },
};

const sheet = (clientItem: boolean) => ({
  numberOrder: '20261102-017',
  sticker: '0040',
  version: 2,
  shirtColor: 'Чёрная',
  shirtSizeLabel: 'L',
  clientItem,
  comment: null,
  date: new Date('2026-11-02T10:00:00Z'),
  sides: [side],
});

const WARNING = 'ПЕЧАТЬ НА ИЗДЕЛИИ КЛИЕНТА';

describe('лист согласования: изделие клиента', () => {
  it('предупреждение стоит на странице стороны', () => {
    const svg = service.buildSidePageLayer(sheet(true), side, 0, 2);
    expect(svg).toContain(WARNING);
  });

  it('и на странице принта — печатник работает именно с ней', () => {
    const svg = service.buildPrintsPageLayer(
      sheet(true),
      [side],
      [{ left: 90, top: 428, width: 2159, height: 922 }],
      2,
    );
    expect(svg).toContain(WARNING);
  });

  it('у обычного заказа его нет', () => {
    // Полоса на каждом листе перестала бы значить что-либо вовсе.
    const svg = service.buildSidePageLayer(sheet(false), side, 0, 2);
    expect(svg).not.toContain(WARNING);
    expect(svg).toContain('Цвет футболки');
  });

  it('номер заказа не уезжает под полосу', () => {
    /*
      Первая попытка накрыла полосой строку «Заказ №» — то, без чего
      страница становится бесполезной картинкой. Строки данных обязаны
      начинаться ниже полосы.
    */
    const svg = service.buildSidePageLayer(sheet(true), side, 0, 2);
    const banner = svg.match(
      /<rect x="\d+" y="(\d+)" width="\d+" height="(\d+)"[^>]*fill="#fde68a"/,
    );
    expect(banner).toBeTruthy();
    const bannerBottom = Number(banner![1]) + Number(banner![2]);
    const orderRow = svg.match(/<text[^>]*y="(\d+)"[^>]*>Заказ №<\/text>/);
    expect(orderRow).toBeTruthy();
    expect(Number(orderRow![1])).toBeGreaterThan(bannerBottom);
  });

  it('светлая плашка с тёмным текстом, а не наоборот', () => {
    /*
      Лист печатают на обычном принтере, часто чёрно-белом. Тёмная плашка
      со светлым текстом превращается там в серое пятно, из которого слов
      не выбрать, — а это единственное предупреждение на листе.
    */
    const svg = service.buildSidePageLayer(sheet(true), side, 0, 2);
    expect(svg).toContain('fill="#fde68a"');
    expect(svg).toContain('stroke="#b45309"');
    const warningText = svg.slice(svg.indexOf(WARNING) - 200, svg.indexOf(WARNING));
    expect(warningText).not.toContain('fill="#ffffff"');
  });
});
