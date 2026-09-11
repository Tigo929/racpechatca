import { parseDesignNoteUtm } from './designnote-utm';

/**
 * Формат — из buildTshirtNote: «Крой: оверсайз. Готовый принт: X.
 * Источник: a / b / c». В боевой базе таких строк нет (0 из 116 позиций
 * на 11.09.2026); тесты держат парсер честным на случай их появления.
 */
describe('UTM из designNote футболки', () => {
  it('три метки раскладываются по полям', () => {
    expect(
      parseDesignNoteUtm('Крой: оверсайз. Готовый принт: ONLY YOU. Источник: yandex / cpc / holst-msk'),
    ).toEqual({ utmSource: 'yandex', utmMedium: 'cpc', utmCampaign: 'holst-msk', ambiguous: false });
  });

  it('одна метка — только source', () => {
    expect(parseDesignNoteUtm('Принт: макет клиента. Источник: avito')).toEqual({
      utmSource: 'avito',
      utmMedium: null,
      utmCampaign: null,
      ambiguous: false,
    });
  });

  it('две метки — source и пометка о неоднозначности, остальное не угадываем', () => {
    expect(parseDesignNoteUtm('Источник: yandex / holst-msk')).toEqual({
      utmSource: 'yandex',
      utmMedium: null,
      utmCampaign: null,
      ambiguous: true,
    });
  });

  it('без строки «Источник» — всё null', () => {
    expect(parseDesignNoteUtm('Крой: оверсайз. Принт: макет клиента')).toEqual({
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      ambiguous: false,
    });
    expect(parseDesignNoteUtm(null).utmSource).toBeNull();
  });

  it('строка в середине примечания, с точкой после', () => {
    const r = parseDesignNoteUtm('Крой: оверсайз. Источник: tg / post / sept. Ещё что-то.');
    expect(r).toEqual({ utmSource: 'tg', utmMedium: 'post', utmCampaign: 'sept', ambiguous: false });
  });

  it('utm_content и utm_term никогда не восстанавливаются', () => {
    const r = parseDesignNoteUtm('Источник: a / b / c / d / e') as Record<string, unknown>;
    expect('utmContent' in r).toBe(false);
    expect('utmTerm' in r).toBe(false);
    expect(r.ambiguous).toBe(true);
  });
});
