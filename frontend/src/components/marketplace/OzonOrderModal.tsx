import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { FileImage, PackageCheck } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { OrderDetail } from '../orders/OrderDetail';
import { ozonOrdersApi, type OzonOrder } from '../../api/ozonOrders';
import { parseOzonArticle, stickerCode } from '../../utils/ozon-article';
import { getErrorMessage } from '../../utils/get-error-message';

/**
 * Отправление Ozon как заказ CRM.
 *
 * Оператор нажимает на отправление и попадает в обычную карточку заказа —
 * ту же, что у футболок с Авито: согласование макета, отправка исполнителю,
 * статусы. Разница в том, откуда взялись данные: цвет, размер и принт
 * выведены из артикула, номер заказа и стикера — из самого отправления.
 * Выбирать нечего, и ошибиться не в чем.
 *
 * Пока заказа в CRM нет, окно показывает, что именно будет заведено. Это
 * не формальность: по разбору артикула видно, что система поняла товар
 * правильно, — и если артикул чужой схемы, это заметно до создания заказа,
 * а не после печати.
 */

interface Props {
  accountId: string;
  order: OzonOrder;
  onClose: () => void;
}

export function OzonOrderModal({ accountId, order, onClose }: Props) {
  const qc = useQueryClient();

  const { data: link, isLoading } = useQuery({
    queryKey: ['ozon-crm-order', accountId, order.postingNumber],
    queryFn: () => ozonOrdersApi.crmOrder(accountId, order.postingNumber),
  });

  const createMutation = useMutation({
    mutationFn: () => ozonOrdersApi.createCrmOrder(accountId, order.postingNumber),
    onSuccess: (res) => {
      void qc.invalidateQueries({
        queryKey: ['ozon-crm-order', accountId, order.postingNumber],
      });
      void qc.invalidateQueries({ queryKey: ['orders'] });
      toast.success(res.created ? 'Заказ заведён в CRM' : 'Заказ уже был заведён');
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'Не удалось завести заказ в CRM')),
  });

  const parsed = order.items.map((item) => ({
    item,
    article: parseOzonArticle(item.offerId),
  }));
  const unparsed = parsed.filter((p) => !p.article);
  const sticker = stickerCode(order.postingNumber);

  return (
    <Modal
      open
      onClose={onClose}
      title={`Заказ Ozon ${order.orderNumber || order.postingNumber}`}
      size="xl"
      bodyKey={link?.id ?? order.postingNumber}
    >
      {isLoading ? (
        <p className="text-sm text-gray-500">Загрузка…</p>
      ) : link ? (
        // Заказ уже в CRM — дальше работает обычная карточка со всеми её
        // возможностями. Второй, «маркетплейсной», карточки не появилось.
        <OrderDetail orderId={link.id} onDeleted={onClose} />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-gray-400">Отправление</p>
              <p className="mt-0.5 font-mono text-sm font-medium text-gray-800">
                {order.postingNumber}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Стикер на посылке</p>
              <p className="mt-0.5 text-sm font-medium text-gray-800">
                {sticker ? `…${sticker}` : 'номер короткий — стикера нет'}
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-gray-500">
              Что будет заведено — выведено из артикула
            </p>
            <ul className="mt-2 space-y-2">
              {parsed.map(({ item, article }) => (
                <li
                  key={item.offerId + item.sku}
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    article
                      ? 'border-gray-200 bg-white'
                      : 'border-amber-200 bg-amber-50'
                  }`}
                >
                  <p className="font-mono text-xs text-gray-500">{item.offerId}</p>
                  {article ? (
                    <p className="mt-0.5 text-gray-800">
                      {article.colorLabel} · {article.size} · принт{' '}
                      <span className="font-mono">{article.printSlug}</span>
                      {item.quantity > 1 && ` × ${item.quantity} шт`}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-amber-800">
                      Артикул не по схеме «принт-цвет-размер» — цвет и размер
                      брать неоткуда.
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
            Деньги по такому заказу считает площадка: в CRM он заводится без
            цены, доставки и расчёта с исполнителем — только производство
            и макет.
          </div>

          {unparsed.length > 0 ? (
            <p className="text-sm text-amber-800">
              Заказ не завести: {unparsed.length} из {parsed.length} артикулов
              собраны не по схеме. Подставить цвет и размер наугад нельзя —
              ошибка видна только после печати. Заведите заказ вручную.
            </p>
          ) : (
            <button
              type="button"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
            >
              {createMutation.isPending ? (
                <PackageCheck size={16} aria-hidden="true" />
              ) : (
                <FileImage size={16} aria-hidden="true" />
              )}
              {createMutation.isPending ? 'Заводим…' : 'Завести в CRM и собрать макет'}
            </button>
          )}
        </div>
      )}
    </Modal>
  );
}
