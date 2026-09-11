/**
 * UTM из примечания позиции футболки `ItemTshirt.designNote`.
 *
 * Единственное место, куда до этапа 02 попадали UTM, — строка вида
 *   «Источник: yandex / cpc / holst-msk»
 * которую собирал `buildTshirtNote`: `[source, medium, campaign]
 * .filter(Boolean).join(' / ')`. utm_content и utm_term туда не писались
 * никогда — восстанавливать их неоткуда, остаются null.
 *
 * Формат взят из кода, а не из данных: в боевой базе на 11.09.2026
 * **ни одной** позиции с «Источник:» нет (0 из 116). Парсер оставлен на
 * случай, если такие строки появятся из резервной копии или в другой
 * установке, и потому что этап требует пройти этот источник.
 *
 * Неоднозначность: `filter(Boolean)` выбрасывал пустые метки, и по двум
 * значениям нельзя понять, чего не хватает — medium или campaign.
 * Поэтому три значения раскладываются полностью, одно — только в source
 * (без него остальных не бывает), два — только source, остаток помечен
 * как неоднозначный и не записывается. Угадывать нельзя: «yandex / holst»
 * с campaign в поле medium испортит отчёт по каналам.
 */

export interface DesignNoteUtm {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  /** Метки были, но разложить их по полям однозначно нельзя. */
  ambiguous: boolean;
}

const SOURCE_LINE = /(?:^|\.\s+|\n)Источник:\s*([^\n]+?)(?=\.\s|\.$|\n|$)/;

export function parseDesignNoteUtm(note: string | null | undefined): DesignNoteUtm {
  const empty: DesignNoteUtm = {
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    ambiguous: false,
  };
  if (!note) return empty;
  const m = SOURCE_LINE.exec(note.replace(/\r\n?/g, '\n'));
  if (!m) return empty;
  const parts = m[1]!
    .split(' / ')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (parts.length === 0) return empty;
  if (parts.length >= 3) {
    return {
      utmSource: parts[0]!,
      utmMedium: parts[1]!,
      utmCampaign: parts[2]!,
      ambiguous: parts.length > 3,
    };
  }
  return {
    utmSource: parts[0]!,
    utmMedium: null,
    utmCampaign: null,
    ambiguous: parts.length === 2,
  };
}
