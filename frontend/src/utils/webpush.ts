import { pushApi } from '../api/push';

/**
 * Подписка браузера на Web Push — уведомления о заявке, когда вкладка CRM
 * закрыта. Service worker и ключи отдаёт бэкенд под order-photo-push (см.
 * api/push.ts), поэтому работает на обоих доменах без правок сервера.
 */

const SW_URL = '/order-photo-push/sw.js';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export function pushSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window !== 'undefined' &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Регистрирует SW и подписывает браузер, отправляя подписку на сервер.
 * Возвращает true при успехе. Ошибки пробрасывает наверх — вызывающий решит,
 * критично это или нет (уведомления в открытой вкладке работают и без пуша).
 */
export async function enableWebPush(): Promise<boolean> {
  if (!pushSupported()) return false;
  const registration = await navigator.serviceWorker.register(SW_URL);
  await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    const key = await pushApi.vapidKey();
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true, // требование браузеров: пуш обязан что-то показать
      // Приводим к BufferSource: в новых типах Uint8Array параметризован
      // ArrayBufferLike, а applicationServerKey ждёт BufferSource.
      applicationServerKey: urlBase64ToUint8Array(key) as unknown as BufferSource,
    });
  }
  await pushApi.subscribe(subscription.toJSON());
  return true;
}
