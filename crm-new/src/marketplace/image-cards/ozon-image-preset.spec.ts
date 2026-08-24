import {
  OZON_MAIN_IMAGE_PRESET,
  validateAgainstPreset,
} from './ozon-image-preset';

/**
 * Проверка готового файла по требованиям площадки.
 *
 * Смысл проверки в том, чтобы карточка не считалась готовой, если Ozon её
 * всё равно отклонит. Ошибка здесь стоит дорого: отказ придёт уже после
 * выгрузки сотни карточек, и разбираться придётся с каждой.
 */
const good = {
  width: 1200,
  height: 1600,
  format: 'png',
  fileSizeBytes: 2 * 1024 * 1024,
};

describe('требования Ozon к главному фото', () => {
  it('нормальный файл проходит', () => {
    const result = validateAgainstPreset(good);
    expect(result.ok).toBe(true);
    expect(result.problems).toEqual([]);
    expect(result.checked.aspect).toBeCloseTo(0.75);
  });

  it('слишком маленький файл не проходит и объясняет почему', () => {
    const result = validateAgainstPreset({ ...good, width: 600, height: 800 });
    expect(result.ok).toBe(false);
    expect(result.problems.join(' ')).toContain('900 × 1200');
  });

  it('минимально допустимый размер проходит', () => {
    const result = validateAgainstPreset({ ...good, width: 900, height: 1200 });
    expect(result.ok).toBe(true);
  });

  it('квадрат не проходит: Ozon ждёт вертикальные 3:4', () => {
    const result = validateAgainstPreset({
      ...good,
      width: 1600,
      height: 1600,
    });
    expect(result.ok).toBe(false);
    expect(result.problems.join(' ')).toContain('3:4');
  });

  it('пара пикселей мимо 3:4 не заваливает пачку', () => {
    // 1202 × 1600 — соотношение 0.751 при ожидаемых 0.75.
    const result = validateAgainstPreset({
      ...good,
      width: 1202,
      height: 1600,
    });
    expect(result.ok).toBe(true);
  });

  it('не тот формат не проходит', () => {
    const result = validateAgainstPreset({ ...good, format: 'jpeg' });
    expect(result.ok).toBe(false);
    expect(result.problems.join(' ')).toContain('PNG');
  });

  it('файл тяжелее десяти мегабайт не проходит', () => {
    const result = validateAgainstPreset({
      ...good,
      fileSizeBytes: 11 * 1024 * 1024,
    });
    expect(result.ok).toBe(false);
    expect(result.problems.join(' ')).toContain('МБ');
  });

  it('ровно десять мегабайт ещё проходят', () => {
    const result = validateAgainstPreset({
      ...good,
      fileSizeBytes: OZON_MAIN_IMAGE_PRESET.maxFileSizeBytes,
    });
    expect(result.ok).toBe(true);
  });

  it('несколько нарушений перечисляются все сразу', () => {
    const result = validateAgainstPreset({
      width: 400,
      height: 400,
      format: 'webp',
      fileSizeBytes: 20 * 1024 * 1024,
    });
    expect(result.ok).toBe(false);
    expect(result.problems.length).toBeGreaterThanOrEqual(4);
  });

  it('нулевая высота не роняет проверку делением на ноль', () => {
    const result = validateAgainstPreset({ ...good, width: 0, height: 0 });
    expect(result.ok).toBe(false);
    expect(result.checked.aspect).toBe(0);
  });
});
