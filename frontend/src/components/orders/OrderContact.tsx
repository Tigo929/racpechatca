import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, ExternalLink, Phone, Send, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { ordersApi } from '../../api/orders';
import { copyToClipboard } from '../../utils/clipboard';
import { PlatformBadge, platformStyle } from '../ui/PlatformBadge';
import type { EnumCommunication, OrderPhoto } from '../../types/index';

/**
 * Контакт клиента в карточке заказа — с действием под способ связи.
 *
 * Telegram: ник кликабелен, ведёт прямо в чат (боту нужно ответить руками).
 * MAX: ссылка на переписку — как у Авито. У заказов, заведённых до этого,
 * в контакте лежит собранная из телефона ссылка `max.ru/<номер>`: для них
 * показываем номер и даём его скопировать, потому что сама ссылка ведёт
 * на профиль по номеру, а не в диалог.
 * Прочие площадки: ссылка на переписку.
 *
 * Второй канал: Telegram покупателя с площадки.
 *
 * Заказ с маркетплейса начинается в чате кабинета, и этот чат остаётся
 * главным — там заказ, там переписку видит площадка. Но чат кабинета умеет
 * мало, поэтому в разговоре мы просим написать нам в Telegram. Написал —
 * ник записывается здесь же, одним нажатием, и дальше у заказа два открытых
 * канала: кабинет и личка. Туда же уходит автоматическая просьба об отзыве
 * после выкупа.
 *
 * Канал связи заказа при этом не подменяется: по нему считается, откуда
 * заказ и куда звать за отзывом.
 */

/**
 * Номер из старого контакта MAX.
 *
 * До перехода на ссылки контакт собирался из телефона по шаблону:
 * `https://max.ru/79991234567`. Такие заказы остались, и номер в них —
 * единственное, по чему менеджер находит человека в MAX. Поэтому у них
 * сохраняем прежний вид: номер и кнопка «скопировать».
 *
 * Ссылку на диалог (в адресе которого номера нет) это не затрагивает:
 * вернётся null, и контакт покажется обычной ссылкой.
 */
function legacyMaxPhone(value: string): string | null {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'))) {
    return `7${digits.slice(1)}`;
  }
  if (digits.length === 10) return `7${digits}`;
  return null;
}

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

/** Почему автоматическая просьба об отзыве не ушла — словами. */
const AUTO_REVIEW_PROBLEM: Record<string, string | undefined> = {
  not_found: 'такого ника в Telegram нет — проверьте запись',
  privacy: 'клиент не принимает сообщения от незнакомых',
  blocked: 'клиент заблокировал наш аккаунт',
  error: 'Telegram отказал — просьбу придётся отправить руками',
};

const linkBtn =
  'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors';

export function OrderContact({
  orderId,
  platform,
  url,
  clientTelegram,
  reviewRequestStatus,
}: {
  orderId?: string;
  platform: EnumCommunication;
  url: string | null | undefined;
  clientTelegram?: string | null;
  reviewRequestStatus?: string | null;
}) {
  const value = (url ?? '').trim();

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
  } else if (platform === 'MAX' && value && !legacyMaxPhone(value)) {
    // Ссылка на переписку — открываем, как у Авито. Номера в ней нет,
    // и показывать нечего, кроме самой кнопки.
    action = (
      <a
        href={value}
        target="_blank"
        rel="noopener noreferrer"
        className={`${linkBtn} text-violet-800 bg-violet-100 ring-1 ring-violet-300/70 hover:bg-violet-200`}
      >
        Открыть переписку в MAX <ExternalLink size={12} aria-hidden="true" />
      </a>
    );
  } else if (platform === 'MAX' && value) {
    // Старый контакт: в ссылке лежит номер. Он и есть то, по чему
    // менеджер находит человека в MAX, — показываем и даём скопировать.
    const phone = formatRuPhone(legacyMaxPhone(value) ?? '');
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
    // Номер отправления вместо ссылки на чат: прямой ссылки у заказа нет,
    // но по этому номеру переписка находится в кабинете — поэтому номер
    // дают скопировать и сразу открывают список чатов.
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
        <a
          href="https://seller.ozon.ru/app/messenger"
          target="_blank"
          rel="noopener noreferrer"
          className={`${linkBtn} ${platformStyle(platform).chip} hover:brightness-95`}
        >
          Чаты Ozon <ExternalLink size={12} aria-hidden="true" />
        </a>
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
      {/*
          Telegram покупателя — рядом, а не вместо.

          Показываем только там, где он имеет смысл: у заказа, который уже
          ведётся в Telegram, второй такой же канал не нужен.
      */}
      {orderId && platform !== 'TELEGRAM' && (
        <ClientTelegramRow
          orderId={orderId}
          clientTelegram={clientTelegram}
          reviewRequestStatus={reviewRequestStatus}
        />
      )}
    </div>
  );
}

/** Строка второго канала: открыть личку или записать её. */
function ClientTelegramRow({
  orderId,
  clientTelegram,
  reviewRequestStatus,
}: {
  orderId: string;
  clientTelegram?: string | null;
  reviewRequestStatus?: string | null;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const save = useMutation({
    mutationFn: (value: string) => ordersApi.setClientTelegram(orderId, value),
    onSuccess: (updated: OrderPhoto) => {
      qc.setQueryData(['order', orderId], updated);
      qc.invalidateQueries({ queryKey: ['orders'] });
      setEditing(false);
      setDraft('');
      toast.success(
        updated.clientTelegram
          ? 'Telegram клиента записан'
          : 'Telegram клиента убран',
      );
    },
    onError: (error: unknown) => {
      // Сервер объясняет, что именно не подошло («это приглашение в чат,
      // а не аккаунт»). Своего текста здесь не придумываем.
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Не удалось записать Telegram клиента';
      toast.error(message);
    },
  });

  const username = (clientTelegram ?? '').replace(/^@+/, '');
  const problem = AUTO_REVIEW_PROBLEM[reviewRequestStatus ?? ''];

  if (editing) {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save.mutate(draft);
            if (e.key === 'Escape') setEditing(false);
          }}
          placeholder="@username или ссылка t.me/…"
          aria-label="Telegram клиента"
          className="w-56 rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        />
        <button
          type="button"
          onClick={() => save.mutate(draft)}
          disabled={save.isPending}
          className={`${linkBtn} text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50`}
        >
          <Check size={13} aria-hidden="true" /> Записать
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          aria-label="Отменить"
          className="p-1.5 text-gray-400 hover:text-gray-600"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>
    );
  }

  if (!username) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft('');
          setEditing(true);
        }}
        className={`${linkBtn} mt-2 text-sky-800 bg-sky-50 border border-sky-200 hover:bg-sky-100`}
      >
        <Send size={13} aria-hidden="true" /> Клиент написал в Telegram
      </button>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <a
        href={`https://t.me/${username}`}
        target="_blank"
        rel="noopener noreferrer"
        className={`${linkBtn} text-sky-800 bg-sky-100 ring-1 ring-sky-300/70 hover:bg-sky-200`}
      >
        <Send size={13} aria-hidden="true" />@{username}
        <ExternalLink size={12} aria-hidden="true" />
      </a>
      <button
        type="button"
        onClick={() => {
          setDraft(`@${username}`);
          setEditing(true);
        }}
        className="text-xs text-gray-500 underline underline-offset-2 hover:text-gray-700"
      >
        изменить
      </button>
      {/* Просьба об отзыве уходит в эту личку сама. Если не ушла — здесь
          же и сказано почему: иначе владелец узнаёт об этом только из
          напоминания в рабочем чате. */}
      {problem && (
        <span className="text-xs text-amber-700">
          просьба об отзыве не ушла: {problem}
        </span>
      )}
      {reviewRequestStatus === 'sent' && (
        <span className="text-xs text-gray-400">просьба об отзыве отправлена</span>
      )}
    </div>
  );
}
