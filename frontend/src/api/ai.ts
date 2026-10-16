import { api } from './client';

/**
 * Вкладка «ИИ»: вопрос уходит агенту, который видит базу CRM и код проектов.
 *
 * История разговора живёт на сервере — здесь только её номер. Иначе
 * браузеру пришлось бы возить с собой ответы инструментов на десятки
 * тысяч знаков и присылать их обратно с каждым вопросом.
 */

export interface AiAnswer {
  session: string;
  answer: string;
  /** Чем агент пользовался, пока отвечал: по этому видно, на чём ответ основан. */
  tools: string[];
  usage: Record<string, number>;
}

export interface AiHealth {
  status?: string;
  model?: string;
  tools?: number;
  servers?: Record<string, string>;
}

export const aiApi = {
  ask: (question: string, session?: string) =>
    api
      .post<AiAnswer>('/ai/ask', { question, session })
      .then((r) => r.data),

  health: () => api.get<AiHealth>('/ai/health').then((r) => r.data),
};
