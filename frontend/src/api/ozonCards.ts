import type {
  CardRect,
  ImageCardBatch,
  ImageCardBatchSettings,
  CardTransform,
  ImageCardGenerated,
  ImageCardSource,
  ImageCardTemplate,
} from '../types/index';
import { api } from './client';

const BASE = '/marketplace/ozon/card-templates';

export const ozonCardsApi = {
  listTemplates: async (): Promise<ImageCardTemplate[]> => {
    const { data } = await api.get<ImageCardTemplate[]>(BASE);
    return data;
  },

  createTemplate: async (dto: {
    title: string;
    shirtColor: string;
  }): Promise<ImageCardTemplate> => {
    const { data } = await api.post<ImageCardTemplate>(BASE, dto);
    return data;
  },

  updateTemplate: async (
    id: string,
    dto: {
      title?: string;
      shirtColor?: string;
      placementArea?: CardRect;
      active?: boolean;
    },
  ): Promise<ImageCardTemplate> => {
    const { data } = await api.patch<ImageCardTemplate>(`${BASE}/${id}`, dto);
    return data;
  },

  uploadTemplateImage: async (
    id: string,
    file: File,
  ): Promise<ImageCardTemplate> => {
    const form = new FormData();
    form.append('file', file);
    const { data } = await api.post<ImageCardTemplate>(`${BASE}/${id}/image`, form);
    return data;
  },

  removeTemplate: async (id: string): Promise<void> => {
    await api.delete(`${BASE}/${id}`);
  },

  /**
   * Картинка шаблона. Запросом, а не адресом в <img src>: картинки браузер
   * тянет без заголовка Authorization, и защищённый эндпоинт ответил бы 401.
   */
  fetchTemplateImage: async (id: string): Promise<Blob> => {
    const { data } = await api.get(`${BASE}/${id}/image`, { responseType: 'blob' });
    return data as Blob;
  },
};

const BATCHES = '/marketplace/ozon/card-batches';

export const ozonBatchesApi = {
  /** Что умеет сервер: без Poppler PDF принимать бессмысленно. */
  capabilities: async (): Promise<{ pdf: boolean }> => {
    const { data } = await api.get<{ pdf: boolean }>(`${BATCHES}/capabilities`);
    return data;
  },

  list: async (): Promise<ImageCardBatch[]> => {
    const { data } = await api.get<ImageCardBatch[]>(BATCHES);
    return data;
  },

  get: async (id: string): Promise<ImageCardBatch> => {
    const { data } = await api.get<ImageCardBatch>(`${BATCHES}/${id}`);
    return data;
  },

  create: async (dto: ImageCardBatchSettings & { title?: string }): Promise<ImageCardBatch> => {
    const { data } = await api.post<ImageCardBatch>(BATCHES, dto);
    return data;
  },

  update: async (
    id: string,
    dto: ImageCardBatchSettings & { title?: string },
  ): Promise<ImageCardBatch> => {
    const { data } = await api.patch<ImageCardBatch>(`${BATCHES}/${id}`, dto);
    return data;
  },

  remove: async (id: string): Promise<void> => {
    await api.delete(`${BATCHES}/${id}`);
  },

  /** Один файл на запрос: пачка целиком не влезает в лимит nginx. */
  addSource: async (batchId: string, file: File): Promise<ImageCardSource> => {
    const form = new FormData();
    form.append('file', file);
    const { data } = await api.post<ImageCardSource>(`${BATCHES}/${batchId}/sources`, form);
    return data;
  },

  retrySource: async (sourceId: string): Promise<ImageCardSource> => {
    const { data } = await api.post<ImageCardSource>(`${BATCHES}/sources/${sourceId}/retry`);
    return data;
  },

  removeSource: async (sourceId: string): Promise<void> => {
    await api.delete(`${BATCHES}/sources/${sourceId}`);
  },

  /** Поставить карточки в работу. Отрисовка идёт фоном. */
  generate: async (
    batchId: string,
  ): Promise<{ created: number; sources: number; templates: number; expected: number }> => {
    const { data } = await api.post(`${BATCHES}/${batchId}/generate`);
    return data as {
      created: number;
      sources: number;
      templates: number;
      expected: number;
    };
  },

  /** Собрать финальные PNG. includeReview захватывает спорные карточки. */
  finalize: async (
    batchId: string,
    includeReview: boolean,
  ): Promise<{ queued: number }> => {
    const { data } = await api.post(`${BATCHES}/${batchId}/finalize`, {
      includeReview,
    });
    return data as { queued: number };
  },

  /** Готовые карточки одним архивом. */
  download: async (batchId: string): Promise<{ blob: Blob; filename: string }> => {
    const response = await api.get(`${BATCHES}/${batchId}/download`, {
      responseType: 'blob',
    });
    const disposition = String(response.headers['content-disposition'] ?? '');
    const match = /filename\*=UTF-8''([^;]+)/.exec(disposition);
    return {
      blob: response.data as Blob,
      filename: match ? decodeURIComponent(match[1]) : 'ozon-cards.zip',
    };
  },

  /** Массовое действие над отмеченными карточками. */
  bulkCards: async (
    batchId: string,
    ids: string[],
    action: 'APPROVE' | 'SKIP' | 'UNSKIP' | 'CENTER' | 'REGENERATE',
  ): Promise<{ changed: number }> => {
    const { data } = await api.post(`${BATCHES}/${batchId}/cards/bulk`, {
      ids,
      action,
    });
    return data as { changed: number };
  },

  listCards: async (batchId: string): Promise<ImageCardGenerated[]> => {
    const { data } = await api.get<ImageCardGenerated[]>(`${BATCHES}/${batchId}/cards`);
    return data;
  },

  updateCard: async (
    cardId: string,
    dto: {
      status?: 'GENERATED' | 'REVIEW_REQUIRED' | 'APPROVED' | 'SKIPPED';
      transform?: Partial<CardTransform>;
      removeWhiteBackground?: boolean;
    },
  ): Promise<ImageCardGenerated> => {
    const { data } = await api.patch<ImageCardGenerated>(
      `${BATCHES}/cards/${cardId}`,
      dto,
    );
    return data;
  },

  regenerateCard: async (cardId: string): Promise<ImageCardGenerated> => {
    const { data } = await api.post<ImageCardGenerated>(
      `${BATCHES}/cards/${cardId}/regenerate`,
    );
    return data;
  },

  fetchCardPreview: async (cardId: string): Promise<Blob> => {
    const { data } = await api.get(`${BATCHES}/cards/${cardId}/preview`, {
      responseType: 'blob',
    });
    return data as Blob;
  },

  /** Шаблон, которым собрана карточка, — подложка ручного редактора. */
  fetchCardTemplate: async (cardId: string): Promise<Blob> => {
    const { data } = await api.get(`${BATCHES}/cards/${cardId}/template`, {
      responseType: 'blob',
    });
    return data as Blob;
  },

  fetchRaster: async (sourceId: string): Promise<Blob> => {
    const { data } = await api.get(`${BATCHES}/sources/${sourceId}/raster`, {
      responseType: 'blob',
    });
    return data as Blob;
  },
};
