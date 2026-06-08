/** Параметры трансформации макета на футболке (в координатах макета 240×260). */
export interface DesignTransform {
  x: number;
  y: number;
  /** Масштаб (1 = исходный подогнанный размер) */
  scale: number;
  /** Поворот в градусах */
  rotation: number;
}

/** Данные, которые конструктор передаёт в заявку. */
export interface DesignerSubmitPayload {
  /** PNG-превью собранной футболки (dataURL) */
  previewDataUrl: string;
  /** HEX цвета футболки */
  shirtColor: string;
  /** Название цвета футболки */
  shirtColorName: string;
  /** Параметры макета (если загружен) */
  transform: DesignTransform | null;
  /** Загружен ли макет */
  hasArtwork: boolean;
}

/** Прямоугольная область печати в координатах макета. */
export interface PrintArea {
  x: number;
  y: number;
  width: number;
  height: number;
}
