/**
 * Движок дизайнера принта.
 *
 * Держит SVG внутри переданного контейнера: белого фона нет — печать под DTF,
 * поэтому вне букв и в счётчиках прозрачно. Каждая буква — <clipPath> по
 * контуру шаблона; внутри неё <image> с фото, которое можно двигать и
 * масштабировать. Экспорт — тот же SVG, растеризованный в PNG нужного размера
 * с прозрачным фоном.
 *
 * Логика вынесена из React намеренно: измерение bbox контуров и
 * перетаскивание удобнее делать императивно над реальными SVG-узлами, а не
 * перерисовкой через состояние на каждый пиксель движения.
 */
const SVGNS = 'http://www.w3.org/2000/svg';

interface Slot {
  d: string;
  bb: { x: number; y: number; width: number; height: number };
  image: SVGImageElement;
  natW: number;
  natH: number;
  src: string | null;
  tx: number;
  ty: number;
  scale: number;
}

export class PrintDesignerEngine {
  private svg: SVGSVGElement;
  private slots: Slot[] = [];
  private active = 0;
  private selPath: SVGPathElement;
  private vb: [number, number];
  private onSelect?: (i: number) => void;

  constructor(
    host: HTMLElement,
    template: { viewBox: [number, number]; paths: string[] },
    opts: { onSelect?: (i: number) => void } = {},
  ) {
    this.vb = template.viewBox;
    this.onSelect = opts.onSelect;
    host.innerHTML = '';

    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${this.vb[0]} ${this.vb[1]}`);
    svg.style.width = '100%';
    svg.style.height = 'auto';
    svg.style.display = 'block';
    svg.style.touchAction = 'none';
    this.svg = svg;

    const defs = document.createElementNS(SVGNS, 'defs');
    svg.appendChild(defs);

    // Измеряем контуры, чтобы разложить фото слева-направо.
    const measured = template.paths.map((d) => {
      const p = document.createElementNS(SVGNS, 'path');
      p.setAttribute('d', d);
      svg.appendChild(p);
      return { d, el: p };
    });
    host.appendChild(svg);
    const withBox = measured.map((m) => ({ d: m.d, bb: m.el.getBBox() }));
    measured.forEach((m) => svg.removeChild(m.el));
    withBox.sort((a, b) => a.bb.x - b.bb.x);

    withBox.forEach((m, i) => {
      const clip = document.createElementNS(SVGNS, 'clipPath');
      clip.id = `pd-clip-${i}`;
      const cp = document.createElementNS(SVGNS, 'path');
      cp.setAttribute('d', m.d);
      clip.appendChild(cp);
      defs.appendChild(clip);

      const g = document.createElementNS(SVGNS, 'g');
      g.setAttribute('clip-path', `url(#pd-clip-${i})`);
      const image = document.createElementNS(SVGNS, 'image');
      image.setAttribute('preserveAspectRatio', 'none');
      g.appendChild(image);
      svg.appendChild(g);

      // Тонкая белая обводка буквы — только в редакторе, в экспорт не идёт.
      const out = document.createElementNS(SVGNS, 'path');
      out.setAttribute('d', m.d);
      out.setAttribute('class', 'pd-outline');
      out.setAttribute('fill', 'none');
      out.setAttribute('stroke', '#ffffff');
      out.setAttribute('stroke-width', '1');
      out.setAttribute('vector-effect', 'non-scaling-stroke');
      svg.appendChild(out);

      // Прозрачная область-«ловушка» формой буквы — по ней тащим фото.
      const hit = document.createElementNS(SVGNS, 'path');
      hit.setAttribute('d', m.d);
      hit.setAttribute('class', 'pd-hit');
      hit.setAttribute('fill', '#000');
      hit.setAttribute('fill-opacity', '0');
      (hit as unknown as HTMLElement).dataset.i = String(i);
      svg.appendChild(hit);

      this.slots.push({
        d: m.d,
        bb: m.bb,
        image,
        natW: 1,
        natH: 1,
        src: null,
        tx: 0,
        ty: 0,
        scale: 1,
      });
    });

    const sel = document.createElementNS(SVGNS, 'path');
    sel.setAttribute('class', 'pd-sel');
    sel.setAttribute('fill', 'none');
    sel.setAttribute('stroke', '#f59e0b');
    sel.setAttribute('stroke-width', '2');
    sel.setAttribute('vector-effect', 'non-scaling-stroke');
    svg.appendChild(sel);
    this.selPath = sel;

    this.attach();
    if (this.slots.length) this.setActive(0);
  }

  get slotCount() {
    return this.slots.length;
  }

  private toSvgPoint(evt: PointerEvent | WheelEvent) {
    const pt = this.svg.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    const ctm = this.svg.getScreenCTM();
    return ctm ? pt.matrixTransform(ctm.inverse()) : ({ x: 0, y: 0 } as DOMPoint);
  }

  private attach() {
    let dragging: number | null = null;
    let last: DOMPoint | null = null;
    this.svg.addEventListener('pointerdown', (e) => {
      const target = e.target as Element;
      const hit = target.closest('.pd-hit') as HTMLElement | null;
      if (!hit) return;
      const i = Number(hit.dataset.i);
      this.setActive(i);
      dragging = i;
      last = this.toSvgPoint(e);
      this.svg.setPointerCapture(e.pointerId);
    });
    this.svg.addEventListener('pointermove', (e) => {
      if (dragging == null || !last) return;
      const p = this.toSvgPoint(e);
      const s = this.slots[dragging];
      s.tx += p.x - last.x;
      s.ty += p.y - last.y;
      last = p;
      this.applyTransform(s);
    });
    const stop = () => {
      dragging = null;
      last = null;
    };
    this.svg.addEventListener('pointerup', stop);
    this.svg.addEventListener('pointercancel', stop);
    this.svg.addEventListener(
      'wheel',
      (e) => {
        const target = e.target as Element;
        const hit = target.closest('.pd-hit') as HTMLElement | null;
        const i = hit ? Number(hit.dataset.i) : this.active;
        if (i == null || !this.slots[i]) return;
        e.preventDefault();
        const s = this.slots[i];
        const p = this.toSvgPoint(e);
        const k = e.deltaY < 0 ? 1.06 : 1 / 1.06;
        // Зум вокруг курсора: точка под курсором остаётся на месте.
        s.tx = p.x - (p.x - s.tx) * k;
        s.ty = p.y - (p.y - s.ty) * k;
        s.scale *= k;
        this.applyTransform(s);
      },
      { passive: false },
    );
  }

  private fitCover(s: Slot) {
    const scale = Math.max(s.bb.width / s.natW, s.bb.height / s.natH);
    s.scale = scale;
    s.tx = s.bb.x + (s.bb.width - s.natW * scale) / 2;
    s.ty = s.bb.y + (s.bb.height - s.natH * scale) / 2;
  }

  private applyTransform(s: Slot) {
    s.image.setAttribute('width', String(s.natW));
    s.image.setAttribute('height', String(s.natH));
    s.image.setAttribute(
      'transform',
      `translate(${s.tx} ${s.ty}) scale(${s.scale})`,
    );
  }

  setImage(i: number, src: string) {
    const s = this.slots[i];
    if (!s) return;
    const im = new Image();
    im.onload = () => {
      s.natW = im.naturalWidth;
      s.natH = im.naturalHeight;
      s.src = src;
      s.image.setAttributeNS('http://www.w3.org/1999/xlink', 'href', src);
      s.image.setAttribute('href', src);
      this.fitCover(s);
      this.applyTransform(s);
    };
    im.src = src;
  }

  hasImage(i: number) {
    return !!this.slots[i]?.src;
  }

  setActive(i: number) {
    if (!this.slots[i]) return;
    this.active = i;
    this.selPath.setAttribute('d', this.slots[i].d);
    this.onSelect?.(i);
  }

  /** Растеризует макет в прозрачный PNG нужного масштаба. */
  toBlob(scale: number): Promise<Blob> {
    const W = Math.round(this.vb[0] * scale);
    const H = Math.round(this.vb[1] * scale);
    const clone = this.svg.cloneNode(true) as SVGSVGElement;
    // Вспомогательные элементы в файл не идут — только чистый принт.
    clone
      .querySelectorAll('.pd-outline,.pd-sel,.pd-hit')
      .forEach((n) => n.remove());
    clone.setAttribute('width', String(W));
    clone.setAttribute('height', String(H));
    const xml = new XMLSerializer().serializeToString(clone);
    const url =
      'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = W;
        c.height = H;
        const ctx = c.getContext('2d');
        if (!ctx) return reject(new Error('no 2d context'));
        ctx.drawImage(img, 0, 0, W, H);
        c.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
          'image/png',
        );
      };
      img.onerror = () => reject(new Error('svg render failed'));
      img.src = url;
    });
  }

  destroy() {
    this.svg.remove();
  }
}
