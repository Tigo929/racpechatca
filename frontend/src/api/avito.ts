import type {
  AvitoChat,
  AvitoMessage,
  AvitoMessengerSyncResult,
} from '../types/index';
import { api } from './client';

export interface AvitoChatQuery {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
}

function queryString(query: AvitoChatQuery = {}) {
  const params = new URLSearchParams();
  if (query.limit) params.set('limit', String(query.limit));
  if (query.offset) params.set('offset', String(query.offset));
  if (query.unreadOnly !== undefined) {
    params.set('unreadOnly', String(query.unreadOnly));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const avitoApi = {
  sync: async (limit = 50): Promise<AvitoMessengerSyncResult> => {
    const { data } = await api.post<AvitoMessengerSyncResult>(
      `/avito/messenger/sync?limit=${limit}`,
    );
    return data;
  },

  getChats: async (query: AvitoChatQuery = {}): Promise<AvitoChat[]> => {
    const { data } = await api.get<AvitoChat[]>(
      `/avito/messenger/chats${queryString(query)}`,
    );
    return data;
  },

  getMessages: async (
    chatId: string,
    query: AvitoChatQuery = {},
  ): Promise<AvitoMessage[]> => {
    const { data } = await api.get<AvitoMessage[]>(
      `/avito/messenger/chats/${encodeURIComponent(chatId)}/messages${queryString(query)}`,
    );
    return data;
  },

  sendMessage: async (chatId: string, text: string): Promise<AvitoMessage> => {
    const { data } = await api.post<AvitoMessage>(
      `/avito/messenger/chats/${encodeURIComponent(chatId)}/messages`,
      { text },
    );
    return data;
  },

  markRead: async (chatId: string): Promise<{ ok: boolean }> => {
    const { data } = await api.post<{ ok: boolean }>(
      `/avito/messenger/chats/${encodeURIComponent(chatId)}/read`,
    );
    return data;
  },
};
