import { approvalRecipient } from 'src/approval/approval-delivery-state';
import { clientIdentity } from './client-identity';

/**
 * Контакт клиента из заказа — для таблицы ClientContact.
 *
 * Отдельной карточки клиента у заказа нет: имя, телефон и почта заявки
 * с сайта лежат строками в примечании («Имя: …», «Телефон: …»), способ
 * связи — в urlCommunication, ник — в clientTelegram. Здесь всё это
 * собирается в одну запись.
 *
 * Опознание — то же, что у правила отзывов (client-identity.ts): ник,
 * номер MAX, диалог Авито. Где его нет, пробуем телефон и почту из
 * примечания — у заявок с сайта они почти всегда есть.
 *
 * Покупателей Ozon и Wildberries без Telegram не берём: ссылка на чат
 * своя у каждого отправления, а писать им мимо площадки она не даёт.
 */

export interface ContactSourceOrder {
  communicationPlatform?: string | null;
  urlCommunication?: string | null;
  clientTelegram?: string | null;
  note?: string | null;
  sourceOrder?: string | null;
}

export interface ExtractedContact {
  identityKey: string;
  name: string | null;
  phone: string | null;
  telegram: string | null;
  maxContact: string | null;
  email: string | null;
  contactUrl: string | null;
  channel: string | null;
}

/** «Имя: Анна» → «Анна». Берётся первая такая строка. */
function noteField(note: string, label: string): string | null {
  const re = new RegExp(`^\\s*${label}\\s*:\\s*(.+?)\\s*$`, 'im');
  const value = re.exec(note)?.[1]?.trim();
  return value ? value.slice(0, 200) : null;
}

/** +7XXXXXXXXXX или null, если цифр на номер не хватает. */
export function normalizePhone(
  value: string | null | undefined,
): string | null {
  const digits = (value ?? '').replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 12) return null;
  return `+7${digits.slice(-10)}`;
}

function normalizeEmail(value: string | null | undefined): string | null {
  const email = (value ?? '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

const MARKETPLACES = new Set(['OZON', 'WB']);

export function extractContact(
  order: ContactSourceOrder,
): ExtractedContact | null {
  const note = order.note ?? '';
  const url = (order.urlCommunication ?? '').trim() || null;
  const platform = order.communicationPlatform ?? null;

  const name = noteField(note, 'Имя');
  const phone = normalizePhone(noteField(note, 'Телефон'));
  const email = normalizeEmail(noteField(note, 'Email'));

  const nick =
    approvalRecipient(order.clientTelegram ?? null) ??
    (platform === 'TELEGRAM' ? approvalRecipient(url) : null) ??
    approvalRecipient(noteField(note, 'Telegram'));
  const telegram = nick ? nick.replace(/^@/, '') : null;

  const maxContact =
    platform === 'MAX'
      ? (noteField(note, 'MAX') ?? url)
      : noteField(note, 'MAX');

  const identityKey =
    clientIdentity(order) ??
    (telegram ? `tg:${telegram.toLowerCase()}` : null) ??
    (phone ? `phone:${phone.slice(1)}` : null) ??
    (email ? `email:${email}` : null);
  if (!identityKey) return null;

  // Маркетплейсный покупатель без ника — только чат площадки, см. выше.
  if (
    MARKETPLACES.has(order.sourceOrder ?? '') &&
    !telegram &&
    !phone &&
    !email
  ) {
    return null;
  }

  return {
    identityKey,
    name,
    phone:
      phone ??
      (identityKey.startsWith('max:') ? `+${identityKey.slice(4)}` : null),
    telegram,
    maxContact,
    email,
    contactUrl: url,
    channel: platform,
  };
}

/** Статусы, по которым заказ можно считать покупкой, а не разговором. */
export const PURCHASED_STATUSES: ReadonlySet<string> = new Set([
  'SENT',
  'PAID',
  'READY_FOR_REVIEW',
  'COMPLETED',
  'DONE',
]);

export interface ContactOrderRow {
  status: string;
  productCategory: string;
  totalOrder: number;
  orderCreatedAt: Date;
  deleted: boolean;
}

export interface ContactStats {
  /** Все обращения, включая удалённые заявки. */
  ordersCount: number;
  /** Доведённые до отправки/оплаты. */
  purchasesCount: number;
  /** Сумма купленного, ₽. */
  purchasedTotal: number;
  /** Что брал: PHOTO, CANVAS, TSHIRT. */
  categories: string[];
  deletedCount: number;
}

export function contactStats(rows: readonly ContactOrderRow[]): ContactStats {
  const purchased = rows.filter(
    (r) => !r.deleted && PURCHASED_STATUSES.has(r.status),
  );
  return {
    ordersCount: rows.length,
    purchasesCount: purchased.length,
    purchasedTotal: purchased.reduce((sum, r) => sum + (r.totalOrder || 0), 0),
    categories: [...new Set(rows.map((r) => r.productCategory))].sort(),
    deletedCount: rows.filter((r) => r.deleted).length,
  };
}

/** Можно ли слать этому человеку рекламу (акции, скидки). */
export function canSendPromo(contact: {
  marketingConsent: boolean;
  unsubscribedAt: Date | null;
}): boolean {
  return contact.marketingConsent && !contact.unsubscribedAt;
}
