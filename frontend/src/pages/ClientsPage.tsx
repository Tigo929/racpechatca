import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Download, Megaphone, Pencil, UserRound } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { Modal } from '../components/ui/Modal';
import { clientContactsApi, type ClientContact } from '../api/clientContacts';
import { COMMUNICATION_LABELS, SOURCE_ORDER_LABELS } from '../constants';
import { getErrorMessage } from '../utils/get-error-message';

/**
 * Клиенты — все, кто к нам обращался, включая удалённые заявки.
 *
 * Контакт пишется сам из заказа и не исчезает, когда заказ удаляют: это
 * тот, кто уже интересовался, и к празднику ему есть что предложить.
 *
 * Слать акции можно только тем, кто согласился (закон «О рекламе», ст. 18).
 * Поэтому согласие — отдельная отметка с источником, и выгрузка «для
 * рассылки» берёт только согласившихся.
 */

const inputCls =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:border-transparent';

const CATEGORY_WORDS: Record<string, string> = {
  PHOTO: 'фото',
  CANVAS: 'холст',
  TSHIRT: 'футболки',
};

function day(value: string | null): string {
  return value ? new Date(value).toLocaleDateString('ru-RU') : '—';
}

function clientsWord(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'клиент';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'клиента';
  return 'клиентов';
}

function ConsentBadge({ c }: { c: ClientContact }) {
  if (c.unsubscribedAt) {
    return <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Отписался</span>;
  }
  if (c.canSendPromo) {
    return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">Можно слать акции</span>;
  }
  return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">Нет согласия на рекламу</span>;
}

function Contacts({ c }: { c: ClientContact }) {
  const links: { href: string | null; text: string }[] = [];
  if (c.phone) links.push({ href: `tel:${c.phone}`, text: c.phone });
  if (c.telegram) links.push({ href: `https://t.me/${c.telegram}`, text: `@${c.telegram}` });
  if (c.maxContact && !c.maxContact.startsWith('http')) links.push({ href: null, text: `MAX ${c.maxContact}` });
  if (c.email) links.push({ href: `mailto:${c.email}`, text: c.email });
  if (c.contactUrl && /^https?:\/\//.test(c.contactUrl)) {
    links.push({
      href: c.contactUrl,
      text: `переписка${c.channel ? ` (${COMMUNICATION_LABELS[c.channel as keyof typeof COMMUNICATION_LABELS] ?? c.channel})` : ''}`,
    });
  }
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
      {links.map((l) =>
        l.href ? (
          <a key={l.text} href={l.href} target="_blank" rel="noreferrer" className="text-amber-700 hover:underline">
            {l.text}
          </a>
        ) : (
          <span key={l.text} className="text-gray-700">{l.text}</span>
        ),
      )}
    </div>
  );
}

function EditModal({ contact, onClose }: { contact: ClientContact; onClose: () => void }) {
  const qc = useQueryClient();
  const [consent, setConsent] = useState(contact.marketingConsent && !contact.unsubscribedAt);
  const [source, setSource] = useState(contact.marketingConsentSource ?? '');
  const [unsubscribed, setUnsubscribed] = useState(Boolean(contact.unsubscribedAt));
  const [note, setNote] = useState(contact.ownerNote ?? '');
  const [name, setName] = useState(contact.name ?? '');

  const save = useMutation({
    mutationFn: () =>
      clientContactsApi.update(contact.id, {
        name,
        ownerNote: note,
        ...(consent !== (contact.marketingConsent && !contact.unsubscribedAt) || source !== (contact.marketingConsentSource ?? '')
          ? { marketingConsent: consent, marketingConsentSource: source }
          : {}),
        ...(unsubscribed !== Boolean(contact.unsubscribedAt) ? { unsubscribed } : {}),
      }),
    onSuccess: () => {
      toast.success('Сохранено');
      void qc.invalidateQueries({ queryKey: ['client-contacts'] });
      onClose();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <Modal open onClose={onClose} title={contact.name || 'Клиент без имени'}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!save.isPending) save.mutate();
        }}
      >
        <div>
          <label htmlFor="client-name" className="mb-1 block text-sm font-medium text-gray-700">Имя</label>
          <input id="client-name" autoFocus className={inputCls} value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
        </div>

        <div className="space-y-2 rounded-lg bg-gray-50 p-3">
          <label className="flex items-start gap-2 text-sm text-gray-800">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-gray-300"
              checked={consent}
              onChange={(e) => {
                setConsent(e.target.checked);
                if (e.target.checked) setUnsubscribed(false);
              }}
            />
            <span>
              <b>Согласился получать акции и скидки</b>
              <span className="block text-xs text-gray-500">
                Ставьте, только если человек сам сказал «да» — например, ответил в переписке.
                Рекламу без согласия слать нельзя: за это штрафует ФАС.
              </span>
            </span>
          </label>
          {consent && (
            <input
              className={inputCls}
              value={source}
              onChange={(e) => setSource(e.target.value)}
              maxLength={200}
              placeholder="Где согласился: «написал в Telegram 21.11», «на сайте»…"
            />
          )}
          <label className="flex items-center gap-2 text-sm text-gray-800">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300"
              checked={unsubscribed}
              onChange={(e) => {
                setUnsubscribed(e.target.checked);
                if (e.target.checked) setConsent(false);
              }}
            />
            Попросил больше не писать
          </label>
        </div>

        <div>
          <label htmlFor="client-note" className="mb-1 block text-sm font-medium text-gray-700">Пометка</label>
          <textarea
            id="client-note"
            rows={2}
            className={inputCls}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={1000}
            placeholder="Например: постоянный, любит холсты, день рождения в марте"
          />
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="min-h-11 flex-1 rounded-lg bg-gray-100 px-4 text-sm font-medium text-gray-700 hover:bg-gray-200">
            Отмена
          </button>
          <button type="submit" disabled={save.isPending} className="min-h-11 flex-1 rounded-lg bg-amber-500 px-4 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50">
            {save.isPending ? 'Сохраняю…' : 'Сохранить'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

async function download(all: boolean) {
  try {
    const blob = await clientContactsApi.exportCsv(all);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = all ? 'клиенты-все.csv' : 'клиенты-для-рассылки.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (e) {
    toast.error(getErrorMessage(e, 'Не удалось скачать список'));
  }
}

export function ClientsPage() {
  const [search, setSearch] = useState('');
  const [promoOnly, setPromoOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<ClientContact | null>(null);

  const query = useQuery({
    queryKey: ['client-contacts', search.trim(), promoOnly, page],
    queryFn: () => clientContactsApi.list({ search: search.trim(), promoOnly, page }),
    placeholderData: keepPreviousData,
  });

  const data = query.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <AppShell
      title="Клиенты"
      subtitle={
        data
          ? `${data.total} ${clientsWord(data.total)} · можно слать акции: ${data.promoCount}`
          : 'Загружаю…'
      }
      onRefresh={() => void query.refetch()}
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-500">
          Все, кто к нам обращался, — и те, чью заявку удалили. Список пополняется
          сам из заказов. Акции можно слать только тем, у кого зелёная отметка.
        </p>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Имя, телефон, ник, почта или номер заказа"
            className={inputCls + ' lg:max-w-sm'}
          />
          <label className="inline-flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={promoOnly}
              onChange={(e) => {
                setPromoOnly(e.target.checked);
                setPage(1);
              }}
              className="h-4 w-4 rounded border-gray-300"
            />
            Только кому можно слать акции
          </label>
          <div className="flex gap-2 lg:ml-auto">
            <button
              type="button"
              onClick={() => void download(false)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              <Megaphone size={14} aria-hidden="true" /> Для рассылки
            </button>
            <button
              type="button"
              onClick={() => void download(true)}
              title="Все контакты — для учёта, не для рекламы"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-gray-100 px-3 text-sm font-medium text-gray-700 hover:bg-gray-200"
            >
              <Download size={14} aria-hidden="true" /> Все
            </button>
          </div>
        </div>

        {data && data.items.length === 0 && (
          <div className="rounded-lg border border-dashed border-gray-200 p-8 text-center text-sm text-gray-400">
            <UserRound size={20} className="mx-auto mb-2" aria-hidden="true" />
            {search || promoOnly ? 'Никого не нашлось.' : 'Список заполнится в течение пары минут после запуска.'}
          </div>
        )}

        <div className="space-y-2">
          {data?.items.map((c) => (
            <div key={c.id} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-gray-800">{c.name || 'Без имени'}</span>
                    <ConsentBadge c={c} />
                  </div>
                  <Contacts c={c} />
                  <div className="text-xs text-gray-500">
                    Обращений {c.stats.ordersCount}
                    {c.stats.purchasesCount > 0 &&
                      ` · купил ${c.stats.purchasesCount} на ${c.stats.purchasedTotal.toLocaleString('ru-RU')} ₽`}
                    {c.stats.deletedCount > 0 && ` · удалено ${c.stats.deletedCount}`}
                    {c.stats.categories.length > 0 &&
                      ` · ${c.stats.categories.map((k) => CATEGORY_WORDS[k] ?? k).join(', ')}`}
                    {` · первый ${day(c.firstOrderAt)}, последний ${day(c.lastOrderAt)}`}
                    {c.lastSource && ` · ${SOURCE_ORDER_LABELS[c.lastSource] ?? c.lastSource}`}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {c.orders.slice(0, 8).map((o) => (
                      <span
                        key={o.orderId}
                        title={o.deleted ? 'Заказ удалён' : undefined}
                        className={`rounded px-1.5 py-0.5 font-mono text-[11px] ${o.deleted ? 'bg-gray-100 text-gray-400 line-through' : 'bg-indigo-50 text-indigo-700'}`}
                      >
                        {o.numberOrder}
                      </span>
                    ))}
                    {c.orders.length > 8 && <span className="text-[11px] text-gray-400">ещё {c.orders.length - 8}</span>}
                  </div>
                  {c.ownerNote && <div className="text-sm text-gray-600 whitespace-pre-wrap">📝 {c.ownerNote}</div>}
                  {c.canSendPromo && c.marketingConsentSource && (
                    <div className="text-xs text-emerald-700">
                      Согласие: {c.marketingConsentSource}, {day(c.marketingConsentAt)}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setEditing(c)}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-gray-100 px-3 text-sm font-medium text-gray-700 hover:bg-gray-200"
                >
                  <Pencil size={14} aria-hidden="true" /> Изменить
                </button>
              </div>
            </div>
          ))}
        </div>

        {pages > 1 && (
          <div className="flex items-center justify-center gap-3 text-sm">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="min-h-11 rounded-lg bg-gray-100 px-4 disabled:opacity-40">
              Назад
            </button>
            <span className="text-gray-500">{page} из {pages}</span>
            <button type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="min-h-11 rounded-lg bg-gray-100 px-4 disabled:opacity-40">
              Дальше
            </button>
          </div>
        )}
      </div>

      {editing && <EditModal key={editing.id} contact={editing} onClose={() => setEditing(null)} />}
    </AppShell>
  );
}
