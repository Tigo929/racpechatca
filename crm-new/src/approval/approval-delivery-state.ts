/**
 * Каналы, которыми уходит лист согласования.
 *
 * Telegram пишет userbot: он забирает задание из таблицы отправок. Чат Ozon
 * CRM ведёт сама — ключи от кабинета у неё, и отправка происходит прямо в
 * запросе, которым нажали кнопку. Очередь при этом одна на оба канала:
 * «отправить ровно один раз» — правило общее, и раздваивать его нельзя.
 *
 * В Авито и MAX переписку ведёт человек: отправить лист оттуда CRM нечем.
 */
export const CHANNEL_BY_PLATFORM = {
  TELEGRAM: 'TELEGRAM',
  OZON: 'OZON',
} as const;

/**
 * Умеет ли CRM сама отправить макет клиенту этим способом связи.
 *
 * Читается дважды: кнопкой «Отправить клиенту» и допуском заказа в
 * производство. Второй спрашивает ровно об этом — требовать отметку об
 * отправке можно только там, где отправляет система; в остальных каналах
 * подтверждения у неё нет и быть не может.
 */
export function crmSendsApproval(platform: string | null | undefined): boolean {
  return Boolean(platform && platform in CHANNEL_BY_PLATFORM);
}

export const deliverySelect = {
  id: true,
  channel: true,
  status: true,
  recipient: true,
  createdAt: true,
  sentAt: true,
  errorCode: true,
  finalizedAt: true,
} as const;

/**
 * Подпись к листу согласования. Текст один на оба канала — покупатель не
 * должен получать разное письмо в зависимости от того, где он купил.
 *
 * В Telegram номер заказа набран моноширинным: такой текст копируется одним
 * нажатием. Номер клиент называет в ответе, а мы ищем по нему заказ —
 * выделять его пальцем в середине строки неудобно, особенно на телефоне.
 * Разметку разбирает Telethon (greeter/approval_delivery.py). Экранировать
 * здесь нечего: весь текст наш, а в номере заказа бывают только цифры
 * и дефис — ни одного знака, который markdown считает своим.
 *
 * Чат Ozon разметки не понимает и показал бы обратные кавычки как есть,
 * поэтому там номер идёт обычным текстом.
 */
export function approvalCaption(
  orderNumber: string | number,
  version: number,
  channel: 'TELEGRAM' | 'OZON' = 'TELEGRAM',
): string {
  const number =
    channel === 'TELEGRAM' ? `\`${orderNumber}\`` : String(orderNumber);
  return (
    `Здравствуйте! Подготовили макет для заказа №${number} (версия ${version}) и отправляем его на согласование.\n\n` +
    'Пожалуйста, проверьте изображение, расположение и размер принта, а также цвет и размер изделия.\n\n' +
    'Если всё верно, ответьте «Макет согласован». Если нужны изменения, напишите, что следует скорректировать.\n\n' +
    'Передадим заказ в печать после вашего подтверждения.'
  );
}

/** Accept only a private username, never an invite, post, phone or channel URL. */
export function approvalRecipient(value: string | null): string | null {
  const raw = (value ?? '').trim();
  const match =
    /^(?:(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me)\/|@)?([a-zA-Z][a-zA-Z0-9_]{3,31})\/?$/.exec(
      raw,
    );
  if (
    !match ||
    /^(joinchat|share|addstickers|proxy|socks|login|iv)$/i.test(match[1])
  )
    return null;
  return match[1];
}
