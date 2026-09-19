export const deliverySelect = {
  id: true,
  status: true,
  recipient: true,
  createdAt: true,
  sentAt: true,
  errorCode: true,
  finalizedAt: true,
} as const;

export function approvalCaption(
  orderNumber: string | number,
  version: number,
): string {
  return (
    `Здравствуйте! Подготовили макет для заказа №${orderNumber} (версия ${version}) и отправляем его на согласование.\n\n` +
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
