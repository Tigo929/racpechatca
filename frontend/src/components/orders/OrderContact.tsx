import { Copy, ExternalLink, Phone, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { COMMUNICATION_LABELS } from '../../constants';

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
  try {
    await navigator.clipboard.writeText(text);
    toast.success(ok);
  } catch {
    toast.error('Не удалось скопировать');
  }
}

export function OrderContact({
  platform,
  url,
}: {
  platform: keyof typeof COMMUNICATION_LABELS;
  url: string | null | undefined;
}) {
  const label = COMMUNICATION_LABELS[platform] ?? platform;
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
        className={`${linkBtn} text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100`}
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
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-800">
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
            className={`${linkBtn} text-gray-600 bg-gray-50 border border-gray-200 hover:bg-gray-100`}
          >
            Открыть в MAX <ExternalLink size={12} aria-hidden="true" />
          </a>
        )}
      </div>
    );
  } else if (value.startsWith('http')) {
    action = (
      <a
        href={value}
        target="_blank"
        rel="noopener noreferrer"
        className={`${linkBtn} text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100`}
      >
        Открыть переписку <ExternalLink size={12} aria-hidden="true" />
      </a>
    );
  }

  return (
    <div className="sm:col-span-2">
      <p className="text-xs text-gray-500 mb-1">Связь с клиентом · {label}</p>
      {action}
    </div>
  );
}
