import type {
  DeletedOrdersQuery,
  DeletedOrdersResponse,
  RestoreOrderResult,
} from '../types/index';
import { api } from './client';

/** Корзина удалённых заказов. Только админ — удаляет и возвращает он же. */
export const deletedOrdersApi = {
  getAll: async (
    query: DeletedOrdersQuery = {},
  ): Promise<DeletedOrdersResponse> => {
    const params = new URLSearchParams();
    if (query.page) params.set('page', String(query.page));
    if (query.limit) params.set('limit', String(query.limit));
    if (query.search) params.set('search', query.search);
    if (query.sourceOrder) params.set('sourceOrder', query.sourceOrder);
    if (query.productCategory) {
      params.set('productCategory', query.productCategory);
    }
    if (query.includeHandled) params.set('includeHandled', 'true');
    const { data } = await api.get<DeletedOrdersResponse>(
      `/order-photo/deleted?${params}`,
    );
    return data;
  },

  /**
   * Вернуть заказ в работу.
   *
   * Ответ может содержать предупреждения (сменился номер, не вернулись
   * выплаченные начисления) — их нужно показать, а не проглотить: иначе
   * расхождение с прежним заказом обнаружится на сверке зарплаты.
   */
  restore: async (id: string): Promise<RestoreOrderResult> => {
    const { data } = await api.post<RestoreOrderResult>(
      `/order-photo/deleted/${id}/restore`,
    );
    return data;
  },
};
