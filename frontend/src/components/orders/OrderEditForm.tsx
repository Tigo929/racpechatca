import { canvasProductionApi } from '../../api/canvasProduction';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, X } from 'lucide-react';
import type { UpdateOrderDto } from '../../types/index';
import { computePrepayment } from '../../utils/prepayment';
import { partnerSettingsApi } from '../../api/partnerSettings';
import { SOURCE_ORDER_LABELS, SOURCE_ORDER_OPTIONS } from '../../constants';

interface Props {
  form: UpdateOrderDto;
  onChange: (form: UpdateOrderDto) => void;
  onSave: () => void;
  onCancel: () => void;
  isPending: boolean;
  /** Дизайн — отдельная сумма у футболок и холстов. */
  productCategory: 'PHOTO' | 'TSHIRT' | 'CANVAS';
  /** Текущая сумма заказа — чтобы сразу показать остаток от внесённой предоплаты. */
  orderTotal: number;
  /**
   * Заказ с маркетплейса: только у такого есть номер площадки. У обычного
   * заказа поле не показывается — принести туда чужой номер нельзя.
   */
  marketplacePrint?: boolean;
}

const inputCls = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent';
const labelCls = 'text-xs text-gray-500 mb-1';

export function OrderEditForm({ form, onChange, onSave, onCancel, isPending, productCategory, orderTotal, marketplacePrint = false }: Props) {
  const set = (patch: Partial<UpdateOrderDto>) => onChange({ ...form, ...patch });
  // Цена доставки Яндекс ПВЗ из настроек — та же, что подставляется при
  // оформлении новой заявки. Нужна, чтобы при смене способа на «Яндекс ПВЗ»
  // стоимость подтянулась сама, а не осталась 0.
  const { data: settings } = useQuery({
    queryKey: ['partner-settings'],
    queryFn: partnerSettingsApi.get,
    staleTime: 60_000,
  });

  // При смене способа получения применяем его тариф; старую сумму не переносим.
  const { data: canvasPricing } = useQuery({ queryKey: ['canvas-production-pricing'], queryFn: canvasProductionApi.pricing, enabled: productCategory === 'CANVAS' });
  const changeDelivery = (method: UpdateOrderDto['deliveryMethod']) => {
    set({ deliveryMethod: method, deliveryCost: method === 'YANDEX_PVZ' ? (settings?.deliveryPriceYandexPvz ?? 0) : method === 'PRODUCTION_MSK' ? (canvasPricing?.delivery.price ?? 0) : 0 });
  };
  // «Нужен дизайн» — включён, если у заказа уже есть сумма дизайна. Выключение
  // обнуляет сумму, чтобы дизайн ушёл из чека.
  const [designEnabled, setDesignEnabled] = useState((form.designDevelopmentCost ?? 0) > 0);
  // Предоплата зафиксирована реальной суммой? Если да — остаток считаем от неё,
  // а не от «50% суммы», и он не «уезжает» при правках заказа.
  const prepaidRecorded = form.prepaidAmount !== null && form.prepaidAmount !== undefined;
  const prepay = computePrepayment(orderTotal, form.prepaidAmount);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className={labelCls}>Платформа общения</p>
          <select className={inputCls} value={form.communicationPlatform}
            onChange={e => set({ communicationPlatform: e.target.value as UpdateOrderDto['communicationPlatform'] })}>
            <option value="AVITO">Авито</option>
            <option value="TELEGRAM">Telegram</option>
            <option value="MAX">MAX</option>
            <option value="OZON">Ozon</option>
          </select>
        </div>
        {/* Источник заказа. Значение, которое поставил сервер (заявка сайта) или
            история (происхождение не доказано), остаётся в списке: иначе правка
            соседнего поля молча переписала бы происхождение на «Авито». */}
        <div>
          <p className={labelCls}>Источник заказа</p>
          <select className={inputCls} value={form.sourceOrder ?? 'AVITO'} aria-label="Источник заказа"
            onChange={e => set({ sourceOrder: e.target.value as UpdateOrderDto['sourceOrder'] })}>
            {[...SOURCE_ORDER_OPTIONS, ...(form.sourceOrder && !SOURCE_ORDER_OPTIONS.includes(form.sourceOrder as (typeof SOURCE_ORDER_OPTIONS)[number]) ? [form.sourceOrder] : [])].map(value => (
              <option key={value} value={value}>{SOURCE_ORDER_LABELS[value] ?? value}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Номер заказа на площадке. Правится здесь, потому что в момент
          оформления его иногда не знают, а опечатка в номере делает заказ
          ненаходимым со стороны кабинета. Пустое поле возвращает заказу
          внутренний номер. */}
      {marketplacePrint && (
        <div>
          <p className={labelCls}>Номер заказа на площадке</p>
          <input
            className={inputCls}
            aria-label="Номер заказа на площадке"
            placeholder="например 0123-4567-8901"
            value={form.marketplaceOrderNumber ?? ''}
            onChange={e => set({ marketplaceOrderNumber: e.target.value })}
          />
        </div>
      )}

      <div>
        <p className={labelCls}>
          {form.communicationPlatform === 'TELEGRAM' ? 'Username в Telegram' : 'Ссылка на переписку'}
        </p>
        <input
          className={inputCls}
          placeholder={form.communicationPlatform === 'TELEGRAM' ? '@username' : 'https://www.avito.ru/...'}
          value={form.urlCommunication ?? ''}
          onChange={e => set({ urlCommunication: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className={labelCls}>Способ доставки</p>
          <select className={inputCls} value={form.deliveryMethod} aria-label="Способ доставки"
            onChange={e => changeDelivery(e.target.value as UpdateOrderDto['deliveryMethod'])}>
            <option value="PICKUP">Самовывоз</option>
            {productCategory === 'CANVAS' && <option value="PRODUCTION_MSK">Доставка производства (Москва)</option>}
            <option value="YANDEX_PVZ">Яндекс ПВЗ</option>
            <option value="OZON_PVZ">Ozon ПВЗ</option>
            <option value="OZON_SELLER">Ozon Продавец</option>
            <option value="WB_SELLER">WB Продавец</option>
          </select>
        </div>
        <div>
          <p className={labelCls}>Стоимость доставки, ₽</p>
          <input type="number" min={0} readOnly={form.deliveryMethod === 'PICKUP'} className={inputCls} value={form.deliveryCost}
            onChange={e => set({ deliveryCost: Number(e.target.value) })} />
        </div>
      </div>

      {/* Дизайн — только футболки. Кнопка «Нужен дизайн» раскрывает сумму;
          её можно менять и добавлять к уже созданному заказу. */}
      {(productCategory === 'TSHIRT' || productCategory === 'CANVAS') && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 space-y-2">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={designEnabled}
              onChange={e => {
                const on = e.target.checked;
                setDesignEnabled(on);
                // Выключили — сумма дизайна уходит из чека; включили — база под ввод.
                set({ designDevelopmentCost: on ? (form.designDevelopmentCost ?? 0) : 0 });
              }}
              className="w-4 h-4 accent-amber-600"
            />
            <span className="text-sm font-medium text-gray-800">Нужен дизайн</span>
          </label>
          {designEnabled && (
            <div>
              <p className={labelCls}>Стоимость разработки дизайна, ₽</p>
              <input
                type="number"
                min={0}
                className={inputCls}
                placeholder="1000"
                value={form.designDevelopmentCost ?? 0}
                onChange={e => set({ designDevelopmentCost: Number(e.target.value) })}
              />
              <p className="text-xs text-gray-500 mt-1">
                Входит в чек клиента отдельной суммой. От неё считается премия менеджера по оформлению.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Срочность и плата за неё. Плата входит в чек клиента, но не в базу
          зарплаты — ни исполнителю, ни менеджеру. */}
      <div className="rounded-xl border border-red-200 bg-red-50/50 p-3 space-y-2">
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={form.isUrgent ?? false}
            onChange={e => {
              const on = e.target.checked;
              // Сняли срочность — снимается и плата за неё.
              set({ isUrgent: on, urgencyFee: on ? (form.urgencyFee ?? 0) : 0 });
            }}
            className="w-4 h-4 accent-red-600"
          />
          <span className="text-sm font-medium text-gray-800">Срочный заказ</span>
        </label>
        {form.isUrgent && (
          <div>
            <p className={labelCls}>Стоимость срочности, ₽</p>
            <input
              type="number"
              min={0}
              className={inputCls}
              placeholder="500"
              value={form.urgencyFee ?? 0}
              onChange={e => set({ urgencyFee: Number(e.target.value) })}
            />
          </div>
        )}
      </div>

      {/* Скидка клиенту. Отдельной суммой, а не правкой цены позиции: иначе
          через месяц не понять, был ли заказ дешёвым сам по себе или его
          продали со скидкой. Уменьшает чек и базу зарплаты исполнителя. */}
      <div>
        <p className={labelCls}>Скидка клиенту, ₽</p>
        <input
          type="number"
          min={0}
          className={inputCls}
          placeholder="0"
          aria-label="Скидка клиенту"
          value={form.discountAmount ?? 0}
          onChange={e => set({ discountAmount: Math.max(0, Number(e.target.value) || 0) })}
        />
        <p className="mt-1 text-xs text-gray-400">
          Доставку и срочность не уменьшает; больше суммы товара с дизайном
          сервер не примет.
        </p>
      </div>

      {/* Предоплата. Записываем реальную внесённую сумму один раз; дальше
          остаток считается как «сумма заказа − предоплата» и не пересчитывается
          на 50% при каждой правке. Работает для всех категорий одинаково. */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 space-y-2">
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={prepaidRecorded}
            onChange={e => {
              // Включили — фиксируем текущий ориентир (50% суммы) как стартовое
              // значение, которое можно поправить. Выключили — вернулись к «50%».
              set({ prepaidAmount: e.target.checked ? prepay.prepaid : null });
            }}
            className="w-4 h-4 accent-emerald-600"
          />
          <span className="text-sm font-medium text-gray-800">Клиент внёс предоплату</span>
        </label>
        {prepaidRecorded ? (
          <div>
            <p className={labelCls}>Внесённая предоплата, ₽</p>
            <input
              type="number"
              min={0}
              className={inputCls}
              value={form.prepaidAmount ?? 0}
              onChange={e => set({ prepaidAmount: Math.max(0, Number(e.target.value)) })}
            />
            <p className="text-xs mt-1 font-medium">
              {prepay.balanceDue < 0 ? (
                <span className="text-red-600">
                  Переплата к возврату: {Math.abs(prepay.balanceDue).toLocaleString('ru-RU')} ₽
                </span>
              ) : prepay.balanceDue === 0 ? (
                <span className="text-emerald-700">Заказ оплачен полностью</span>
              ) : (
                <span className="text-gray-600">
                  Останется доплатить: {prepay.balanceDue.toLocaleString('ru-RU')} ₽
                  <span className="text-gray-400"> (сумма заказа {orderTotal.toLocaleString('ru-RU')} ₽)</span>
                </span>
              )}
            </p>
          </div>
        ) : (
          <p className="text-xs text-gray-500">
            Пока не отмечено — остаток считается как 50% от суммы заказа
            ({prepay.prepaid.toLocaleString('ru-RU')} ₽).
          </p>
        )}
      </div>

      <div>
        <p className={labelCls}>Примечание</p>
        <textarea rows={2} className={inputCls + ' resize-none'} value={form.note ?? ''}
          onChange={e => set({ note: e.target.value })} />
      </div>

      <div className="flex gap-2">
        <button onClick={onCancel}
          className="flex items-center gap-1 px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
          <X size={13} /> Отмена
        </button>
        <button onClick={onSave} disabled={isPending}
          className="flex items-center gap-1 px-4 py-2 text-sm text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-60">
          <Check size={13} /> {isPending ? 'Сохранение...' : 'Сохранить'}
        </button>
      </div>
    </div>
  );
}
