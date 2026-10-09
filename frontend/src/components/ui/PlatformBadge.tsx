import { COMMUNICATION_LABELS } from '../../constants';
import type { EnumCommunication } from '../../types/index';

/**
 * Площадка связи — цветом площадки, а не общим серым.
 *
 * В списке заказы вперемешку: один клиент в Telegram, другой в MAX, третий
 * на Авито. Подпись мелким шрифтом каждый раз приходится читать, хотя сам
 * способ связи узнаётся мгновенно — по цвету и знаку. Внимание уходит
 * на поиск того, что можно увидеть.
 *
 * Поэтому у каждой площадки свой цвет и свой знак. Цвета взяты фирменные,
 * чтобы узнавание работало само: синий Telegram, фиолетовый MAX, зелёный
 * Авито. Знак рисуем простой — буква или самолётик, без копирования
 * логотипа: в строке высотой двадцать пикселей он всё равно не читается,
 * а узнаёт глаз цвет.
 */

interface Style {
  /** Готовые классы Tailwind: собирать их на лету нельзя. */
  chip: string;
  /** Знак площадки. */
  mark: string;
}

const PLATFORM: Record<string, Style> = {
  // Фирменный синий Telegram.
  TELEGRAM: {
    chip: 'bg-sky-100 text-sky-800 ring-1 ring-sky-300/70',
    mark: '✈',
  },
  // MAX — фиолетовый.
  MAX: {
    chip: 'bg-violet-100 text-violet-800 ring-1 ring-violet-300/70',
    mark: 'M',
  },
  // Авито — зелёный.
  AVITO: {
    chip: 'bg-green-100 text-green-800 ring-1 ring-green-300/70',
    mark: 'A',
  },
  // Ozon — синий, как у отметки площадки в списке заказов.
  OZON: {
    chip: 'bg-blue-100 text-blue-800 ring-1 ring-blue-300/70',
    mark: 'O',
  },
};

const NEUTRAL: Style = {
  chip: 'bg-gray-100 text-gray-600 ring-1 ring-gray-200/70',
  mark: '•',
};

export function platformStyle(platform: EnumCommunication): Style {
  return PLATFORM[platform] ?? NEUTRAL;
}

interface Props {
  platform: EnumCommunication;
  size?: 'sm' | 'md';
}

export function PlatformBadge({ platform, size = 'sm' }: Props) {
  const style = platformStyle(platform);
  const label = COMMUNICATION_LABELS[platform] ?? platform;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg font-semibold ${style.chip} ${
        size === 'md' ? 'px-2.5 py-1 text-sm' : 'px-2 py-0.5 text-xs'
      }`}
    >
      <span aria-hidden="true" className="font-bold leading-none">
        {style.mark}
      </span>
      {label}
    </span>
  );
}
