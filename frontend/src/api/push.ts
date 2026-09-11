import { api } from './client';

/**
 * Web Push API. Пути под order-photo-push — этот префикс уходит на бэкенд CRM
 * на обоих доменах (и на sslip, и на raspechatkaa.ru), в отличие от статики.
 */
export const pushApi = {
  vapidKey: async (): Promise<string> => {
    const { data } = await api.get<{ key: string }>(
      '/order-photo-push/vapid-public-key',
    );
    return data.key;
  },
  subscribe: async (subscription: unknown): Promise<void> => {
    await api.post('/order-photo-push/subscribe', subscription);
  },
  unsubscribe: async (endpoint: string): Promise<void> => {
    await api.post('/order-photo-push/unsubscribe', { endpoint });
  },
};
