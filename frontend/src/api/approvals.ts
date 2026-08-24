import type {
  CreateApprovalDto,
  EnumApprovalSide,
  MockupTemplate,
  PrintApproval,
  UpdateApprovalDto,
} from '../types/index';
import { api } from './client';

export const approvalsApi = {
  list: async (orderId: string): Promise<PrintApproval[]> => {
    const { data } = await api.get<PrintApproval[]>('/approvals', {
      params: { orderId },
    });
    return data;
  },

  get: async (id: string): Promise<PrintApproval> => {
    const { data } = await api.get<PrintApproval>(`/approvals/${id}`);
    return data;
  },

  create: async (dto: CreateApprovalDto): Promise<PrintApproval> => {
    const { data } = await api.post<PrintApproval>('/approvals', dto);
    return data;
  },

  update: async (id: string, dto: UpdateApprovalDto): Promise<PrintApproval> => {
    const { data } = await api.patch<PrintApproval>(`/approvals/${id}`, dto);
    return data;
  },

  remove: async (id: string): Promise<void> => {
    await api.delete(`/approvals/${id}`);
  },

  uploadPrint: async (
    id: string,
    side: EnumApprovalSide,
    file: File,
  ): Promise<PrintApproval> => {
    const form = new FormData();
    form.append('file', file);
    const { data } = await api.post<PrintApproval>(
      `/approvals/${id}/print/${side}`,
      form,
    );
    return data;
  },

  removePrint: async (
    id: string,
    side: EnumApprovalSide,
  ): Promise<PrintApproval> => {
    const { data } = await api.delete<PrintApproval>(
      `/approvals/${id}/print/${side}`,
    );
    return data;
  },

  /**
   * Файл принта. Именно запросом, а не адресом в <img src>: картинки браузер
   * тянет без заголовка Authorization, и защищённый эндпоинт ответил бы 401.
   */
  fetchPrint: async (id: string, side: EnumApprovalSide): Promise<Blob> => {
    const { data } = await api.get(`/approvals/${id}/print/${side}`, {
      responseType: 'blob',
    });
    return data as Blob;
  },

  /** Предпросмотр листа: рисуется на сервере и никуда не сохраняется. */
  preview: async (id: string): Promise<Blob> => {
    const { data } = await api.post(`/approvals/${id}/preview`, null, {
      responseType: 'blob',
    });
    return data as Blob;
  },

  finalize: async (id: string): Promise<PrintApproval> => {
    const { data } = await api.post<PrintApproval>(`/approvals/${id}/finalize`);
    return data;
  },

  /** Готовый файл вместе с именем из заголовка Content-Disposition. */
  download: async (id: string): Promise<{ blob: Blob; filename: string }> => {
    const response = await api.get(`/approvals/${id}/file`, {
      responseType: 'blob',
    });
    const disposition = String(response.headers['content-disposition'] ?? '');
    const match = /filename\*=UTF-8''([^;]+)/.exec(disposition);
    return {
      blob: response.data as Blob,
      filename: match ? decodeURIComponent(match[1]) : 'Согласование.png',
    };
  },
};

export const mockupsApi = {
  list: async (): Promise<MockupTemplate[]> => {
    const { data } = await api.get<MockupTemplate[]>('/mockup-templates');
    return data;
  },

  update: async (
    id: string,
    dto: Partial<MockupTemplate>,
  ): Promise<MockupTemplate> => {
    const { data } = await api.patch<MockupTemplate>(
      `/mockup-templates/${id}`,
      dto,
    );
    return data;
  },

  uploadImage: async (id: string, file: File): Promise<MockupTemplate> => {
    const form = new FormData();
    form.append('file', file);
    const { data } = await api.post<MockupTemplate>(
      `/mockup-templates/${id}/image`,
      form,
    );
    return data;
  },

  /** Фотография шаблона — запросом с токеном, как и принт. */
  fetchImage: async (id: string): Promise<Blob> => {
    const { data } = await api.get(`/mockup-templates/${id}/image`, {
      responseType: 'blob',
    });
    return data as Blob;
  },
};
