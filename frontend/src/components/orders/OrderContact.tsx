import { Copy, ExternalLink, Phone, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { copyToClipboard } from '../../utils/clipboard';
import { PlatformBadge, platformStyle } from '../ui/PlatformBadge';
import type { EnumCommunication } from '../../types/index';

/**
 * Контакт клиента в карточке заказа — с действием под способ связи.
 *
 * Telegram: ник кликабелен, ведёт прямо в чат (боту нужно ответить руками).
 * MAX: показываем телефон и даём «Скопировать номер» — менеджер создаёт по нему
 * контакт в MAX, потом копирует приветственное сообщение (кнопка рядом) и шлёт.
 * Прочие площадки: ссылка на переписку.
 */

/** «79991234567» → «+7 999 123-45-67». */
function formatRuPhone(digits: string): string {
  const d = (digits ?? '').replace(/\D/g, '');
  if (d.length !== 11) return digits;
  return `+${d[0]} ${d.slice(1, 4)} ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9)}`;
}

async function copy(text: string, ok: string) {
  // Общий способ копирования: с запасным путём для iPhone.
  if (await copyToClipboard(text)) {
    toast.success(ok);
    return;
  }
  toast.error('Не удалось скопировать');
}

export function OrderContact({
  platform,
  url,
}: {
  platform: EnumCommunication;
  url: string | null | undefined;
}) {
  const value = (url ?? '').trim();

  const linkBtn =
    'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors';

  let action: React.ReactNode = value ? (
    <span className="text-sm text-gray-700 break-all">{value}</span>
  ) : (
    <span className="text-sm text-gray-400">контакт не указан</span>
  );

  if (platform === 'TELEGRAM' && value) {
    const username = value
      .replace(/^https?:\/\/t\.me\//i, '')
      .replace(/^@+/, '');
    action = (
      <a
        href={value.startsWith('http') ? value : `https://t.me/${username}`}
        target="_blank"
        rel="noopener noreferrer"
        // Цвет Telegram: кнопка узнаётся раньше, чем прочитана подпись.
        className={`${linkBtn} text-sky-800 bg-sky-100 ring-1 ring-sky-300/70 hover:bg-sky-200`}
      >
        <Send size={13} aria-hidden="true" />@{username}
        <ExternalLink size={12} aria-hidden="true" />
      </a>
    );
  } else if (platform === 'MAX' && value) {
    // Из ссылки max.ru/79991234567 достаём цифры телефона.
    const digits = value.replace(/\D/g, '');
    const phone = formatRuPhone(digits);
    action = (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-violet-100 px-2.5 py-1 text-sm font-semibold text-violet-800 ring-1 ring-violet-300/70">
          <Phone size={13} aria-hidden="true" />
          {phone}
        </span>
        <button
          type="button"
          onClick={() => copy(phone, 'Номер скопирован')}
          className={`${linkBtn} text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100`}
        >
          <Copy size={13} aria-hidden="true" /> Скопировать номер
        </button>
        {value.startsWith('http') && (
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className={`${linkBtn} text-violet-800 bg-violet-100 ring-1 ring-violet-300/70 hover:bg-violet-200`}
          >
            Открыть в MAX <ExternalLink size={12} aria-hidden="true" />
          </a>
        )}
      </div>
    );
  } else if (platform === 'OZON' && !value.startsWith('http')) {
    // Номер отправления вместо ссылки: чата с покупателем на Ozon нет,
    // а по этому номеру заказ находят в кабинете — поэтому его дают
    // скопировать, как телефон у MAX.
    action = (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-sm font-medium text-gray-800">{value}</span>
        <button
          type="button"
          onClick={() => copy(value, 'Номер отправления скопирован')}
          className={`${linkBtn} text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100`}
        >
          <Copy size={13} aria-hidden="true" /> Скопировать номер
        </button>
      </div>
    );
  } else if (value.startsWith('http')) {
    // Прочие площадки (Авито, Ozon): ссылка красится цветом своей площадки.
    const style = platformStyle(platform);
    action = (
      <a
        href={value}
        target="_blank"
        rel="noopener noreferrer"
        className={`${linkBtn} ${style.chip} hover:brightness-95`}
      >
        Открыть переписку <ExternalLink size={12} aria-hidden="true" />
      </a>
    );
  }

  return (
    <div className="sm:col-span-2 lg:col-span-3">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-xs text-gray-500">Связь с клиентом</span>
        <PlatformBadge platform={platform} />
      </div>
      {action}
    </div>
  );
}
