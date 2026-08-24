/**
 * Требования площадки к главному фото карточки.
 *
 * Собраны в одном месте намеренно: ТЗ запрещает размазывать их по коду.
 * Ozon меняет правила без предупреждения, и когда это случится, править
 * придётся ровно эту таблицу, а не редактор и не рендер.
 *
 * Значения проверены 24.08.2026 по требованиям для категории «Одежда»:
 * минимум 900 × 1200, соотношение 3:4, до 10 МБ, форматы JPG/PNG/WebP.
 * Верхняя граница 4320 × 7680 — общая для всех категорий.
 */
export interface MarketplaceImagePreset {
  id: string;
  marketplace: 'ozon';
  name: string;
  outputFormat: 'png';
  aspectRatio: { width: number; height: number };
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
  maxFileSizeBytes: number;
  /**
   * Допуск по соотношению сторон. Ровных 3:4 у реального шаблона почти не
   * бывает: пара пикселей туда-сюда набегает при подготовке макета, и
   * заваливать из-за них всю пачку было бы вредительством.
   */
  aspectTolerance: number;
  active: boolean;
}

export const OZON_MAIN_IMAGE_PRESET: MarketplaceImagePreset = {
  id: 'ozon-main-image',
  marketplace: 'ozon',
  name: 'Ozon — главное фото (одежда)',
  outputFormat: 'png',
  aspectRatio: { width: 3, height: 4 },
  minWidth: 900,
  minHeight: 1200,
  maxWidth: 4320,
  maxHeight: 7680,
  maxFileSizeBytes: 10 * 1024 * 1024,
  aspectTolerance: 0.02,
  active: true,
};

export interface ValidationInput {
  width: number;
  height: number;
  format: string | undefined;
  fileSizeBytes: number;
}

export interface ValidationResult {
  ok: boolean;
  /** Человеческие формулировки: их читает менеджер, а не разработчик. */
  problems: string[];
  checked: {
    width: number;
    height: number;
    format: string | null;
    fileSizeBytes: number;
    aspect: number;
  };
}

/**
 * Проверка готового файла перед тем, как считать карточку готовой.
 *
 * Проверяем именно файл, а не намерения: размеры, соотношение, формат и вес
 * берутся из того, что реально записано на диск. Карточка, не прошедшая
 * проверку, готовой не считается — иначе в пачке появятся файлы, которые
 * Ozon отклонит уже после выгрузки.
 */
export function validateAgainstPreset(
  input: ValidationInput,
  preset: MarketplaceImagePreset = OZON_MAIN_IMAGE_PRESET,
): ValidationResult {
  const problems: string[] = [];
  const aspect = input.height > 0 ? input.width / input.height : 0;
  const expected = preset.aspectRatio.width / preset.aspectRatio.height;

  if (input.width < preset.minWidth || input.height < preset.minHeight) {
    problems.push(
      `Размер ${input.width} × ${input.height} px меньше минимального ${preset.minWidth} × ${preset.minHeight} — возьмите шаблон крупнее`,
    );
  }
  if (input.width > preset.maxWidth || input.height > preset.maxHeight) {
    problems.push(
      `Размер ${input.width} × ${input.height} px больше допустимого ${preset.maxWidth} × ${preset.maxHeight}`,
    );
  }
  if (Math.abs(aspect - expected) > preset.aspectTolerance) {
    problems.push(
      `Соотношение сторон ${aspect.toFixed(2)} вместо ${preset.aspectRatio.width}:${preset.aspectRatio.height} — подготовьте шаблон в нужной пропорции`,
    );
  }
  if (input.format !== preset.outputFormat) {
    problems.push(
      `Формат ${input.format ?? 'неизвестен'} вместо ${preset.outputFormat.toUpperCase()}`,
    );
  }
  if (input.fileSizeBytes > preset.maxFileSizeBytes) {
    problems.push(
      `Файл ${(input.fileSizeBytes / 1024 / 1024).toFixed(1)} МБ больше допустимых ${Math.round(preset.maxFileSizeBytes / 1024 / 1024)} МБ`,
    );
  }

  return {
    ok: problems.length === 0,
    problems,
    checked: {
      width: input.width,
      height: input.height,
      format: input.format ?? null,
      fileSizeBytes: input.fileSizeBytes,
      aspect: Number(aspect.toFixed(4)),
    },
  };
}
