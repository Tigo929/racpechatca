import { TSHIRT_SIZE_LABELS } from '../../constants';
import {
  hasConfusablePrints,
  marketplacePrint,
  pluralShirts,
  printScriptTone,
  type PrintScript,
} from '../../utils/marketplace-print';
import type { OrderPhoto } from '../../types/index';

/**
 * Какой макет печатаем — первым делом и крупно.
 *
 * В каталоге два принта с почти одинаковыми кодами: «ПАПА» кириллицей и
 * «papa» латиницей. Это разные макеты, и перепутать их — напечатать не
 * то, что купили: заготовка списана, посылка уехала с чужим принтом.
 *
 * Раньше ответ на этот вопрос приходилось вычитывать из примечания,
 * среди номера заказа, номера отправления, стикера и строки с артикулом.
 * Один взгляд туда не работал: буквы П/P и А/A выглядят одинаково почти
 * в любом шрифте, и различать их глазами нельзя в принципе.
 *
 * Поэтому здесь три вещи сразу, и ни одна не требует чтения:
 *   — код принта крупно;
 *   — алфавит словом: «кириллица» или «латиница»;
 *   — цвет полосы по алфавиту — он отвечает раньше, чем взгляд дойдёт
 *     до букв.
 *
 * Смешанный алфавит внутри кода — красным: так выглядит опечатка в
 * карточке маркетплейса, и по такому артикулу макет не найдётся.
 */

interface Props {
  order: Pick<OrderPhoto, 'tshirtItems'>;
}

export function MarketplacePrintStrip({ order }: Props) {
  const items = order.tshirtItems ?? [];
  const rows = items
    .map((item) => ({ item, print: marketplacePrint(item.marketplaceArticle) }))
    .filter((row): row is { item: (typeof items)[number]; print: NonNullable<ReturnType<typeof marketplacePrint>> } =>
      row.print !== null,
    );

  // Артикула нет или он не по схеме — показывать нечего, и выдумывать
  // подпись макета нельзя: неверная хуже отсутствующей.
  if (rows.length === 0) return null;

  /*
    Сколько футболок в заказе — по тиражу, а не по числу строк: две
    одинаковые футболки приходят одной позицией с количеством 2, и
    «1 позиция» прочиталось бы как «одна футболка».
  */
  const shirts = rows.reduce((sum, row) => sum + (row.item.quantity || 0), 0);
  const slugs = rows.map((row) => row.print.slug);
  const distinct = new Set(slugs);
  const confusable = hasConfusablePrints(slugs);

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {shirts > 1 ? `Макеты · ${shirts} ${pluralShirts(shirts)} в заказе` : 'Макет'}
      </p>

      {/*
        Два макета, названные одним словом в разных алфавитах, — худший
        из случаев: в одной посылке два разных принта, по виду
        одинаковых. Напечатать две одинаковые футболки здесь проще, чем
        правильные, и заметит это покупатель.
      */}
      {confusable && (
        <p className="rounded-xl border-2 border-red-400 bg-red-100 px-4 py-3 text-sm font-bold text-red-900">
          В этом заказе оба макета сразу — и кириллицей, и латиницей.
          Это разные принты. Печатать две одинаковые футболки нельзя.
        </p>
      )}

      {/*
        Разные макеты без путаницы алфавитов — не тревога, но и не
        «как обычно»: заказ с одной футболкой выглядит так же, и разницу
        надо назвать, пока её не прочитали как привычную единицу.
      */}
      {!confusable && distinct.size > 1 && (
        <p className="rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-900">
          В заказе {distinct.size} разных макета — соберите каждый отдельно.
        </p>
      )}

      {rows.map(({ item, print }, index) => (
        <div
          key={item.id}
          className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border-2 px-4 py-3 ${printScriptTone(print.script)}`}
        >
          {/* Номер — только когда позиций несколько: на одиночном заказе
              «#1» это шум, а на заказе из двух им сверяются с листом. */}
          {rows.length > 1 && (
            <span className="text-sm font-bold opacity-60">#{index + 1}</span>
          )}
          <span className="font-mono text-2xl font-bold leading-none tracking-tight">
            {print.slug}
          </span>
          {print.scriptLabel && (
            <span className="rounded-full border border-current/30 bg-white/60 px-2 py-0.5 text-xs font-semibold">
              {print.scriptLabel}
            </span>
          )}
          <span className="text-sm font-medium opacity-80">
            {item.color} · {TSHIRT_SIZE_LABELS[item.size] ?? item.size} · {item.quantity} шт
          </span>
          {print.script === 'mixed' && (
            <span className="w-full text-xs font-semibold">
              В коде артикула буквы двух алфавитов — похоже на опечатку
              в карточке. Проверьте, какой макет имелся в виду.
            </span>
          )}
        </div>
      ))}
      <ScriptHint scripts={rows.map((row) => row.print.script)} />
    </div>
  );
}

/**
 * Подсказка — только там, где есть что перепутать.
 *
 * Объяснять разницу алфавитов на заказе с кодом «JDM-1-1» незачем:
 * лишняя строка на каждой карточке превращается в строку, которую
 * перестают замечать.
 */
function ScriptHint({ scripts }: { scripts: PrintScript[] }) {
  const confusable = scripts.some((s) => s === 'cyrillic' || s === 'latin');
  if (!confusable) return null;
  return (
    <p className="text-[11px] leading-relaxed text-gray-500">
      «ПАПА» кириллицей и «papa» латиницей — разные макеты. Алфавит подписан,
      потому что сами буквы выглядят одинаково.
    </p>
  );
}
