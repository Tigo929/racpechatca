import { Fragment, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Archive, ArchiveRestore, TrendingUp } from 'lucide-react';
import { Modal } from '../ui/Modal';
import {
  colorCodeOf, ozonProductCatalogApi, sizeOf, type OzonCatalogProduct,
} from '../../api/ozonProductCatalog';
import { getErrorMessage } from '../../utils/get-error-message';
import { UnitEconomicsPanel } from './UnitEconomicsPanel';

/**
 * Карточка товара: сверху правка того, что меняется каждый день (цена,
 * остаток), снизу — цифры, по которым видно, стоит ли этот товар держать:
 * спрос, выручка, комиссия площадки и что остаётся продавцу.
 */

const field =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500';

const money = (v: number) => `${Math.round(v).toLocaleString('ru-RU')} ₽`;

function Stat({ label, value, hint, tone }: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'good' | 'bad' | 'plain';
}) {
  const color =
    tone === 'good' ? 'text-emerald-700' : tone === 'bad' ? 'text-red-600' : 'text-gray-900';
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50/60 p-3">
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className={`mt-0.5 text-base font-semibold tabular-nums ${color}`}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-gray-400">{hint}</p>}
    </div>
  );
}

/** Порядок как на бирке, а не по алфавиту: S раньше XL. */
const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL'];

function sizeRank(offerId: string): number {
  const i = SIZE_ORDER.indexOf((sizeOf(offerId) ?? '').toUpperCase());
  return i === -1 ? SIZE_ORDER.length : i;
}

function groupSizesByColor(
  items: OzonCatalogProduct[],
): [string, OzonCatalogProduct[]][] {
  const map = new Map<string, OzonCatalogProduct[]>();
  for (const p of [...items].sort((a, b) => sizeRank(a.offerId) - sizeRank(b.offerId))) {
    const color = colorCodeOf(p.offerId) ?? 'без цвета';
    map.set(color, [...(map.get(color) ?? []), p]);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

export function ProductDetailModal({
  product, accountId, onClose, siblings = [], onSelect, onBack,
}: {
  product: OzonCatalogProduct;
  accountId: string;
  onClose: () => void;
  /** Размеры той же карточки — чтобы ходить между ними, не закрывая окно. */
  siblings?: OzonCatalogProduct[];
  onSelect?: (product: OzonCatalogProduct) => void;
  /** Возврат к карточке группы. Пусто — окно просто закрывается. */
  onBack?: () => void;
}) {
  const qc = useQueryClient();
  const siblingColors = new Set(
    siblings.map((p) => colorCodeOf(p.offerId) ?? 'без цвета'),
  ).size;
  const [price, setPrice] = useState(String(product.price));
  const [oldPrice, setOldPrice] = useState(String(product.oldPrice || ''));
  const [stock, setStock] = useState(String(product.stockPresent));

  const invalidate = () => qc.invalidateQueries({ queryKey: ['ozon-catalog', accountId] });

  const { data: warehouses = [] } = useQuery({
    queryKey: ['ozon-warehouses', accountId],
    queryFn: () => ozonProductCatalogApi.warehouses(accountId),
    staleTime: 300_000,
  });

  const savePrice = useMutation({
    mutationFn: () =>
      ozonProductCatalogApi.updatePrices(accountId, [{
        offerId: product.offerId,
        price: Number(price),
        oldPrice: oldPrice ? Number(oldPrice) : undefined,
      }]),
    onSuccess: (res) => {
      const r = res[0];
      if (r?.updated) { invalidate(); toast.success('Цена обновлена'); }
      else toast.error(r?.error ?? 'Ozon не принял цену');
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Не удалось обновить цену')),
  });

  const saveStock = useMutation({
    mutationFn: () => {
      const wh = warehouses[0];
      if (!wh) throw new Error('У кабинета нет складов — остаток проставить некуда');
      return ozonProductCatalogApi.updateStocks(accountId, wh.id, [
        { offerId: product.offerId, stock: Number(stock) },
      ]);
    },
    onSuccess: (res) => {
      const r = res[0];
      if (r?.updated) { invalidate(); toast.success('Остаток обновлён'); }
      else toast.error(r?.error ?? 'Ozon не принял остаток');
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Не удалось обновить остаток')),
  });

  const toggleArchive = useMutation({
    mutationFn: () =>
      ozonProductCatalogApi.setArchived(accountId, [product.productId], !product.archived),
    onSuccess: () => {
      invalidate();
      toast.success(product.archived ? 'Товар возвращён из архива' : 'Товар отправлен в архив');
      onClose();
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Не удалось изменить статус')),
  });

  /*
   * Описание, габариты и атрибуты Ozon держит вне списка товаров, поэтому
   * грузим их только здесь — при открытии конкретной карточки. Грузить их
   * для всего каталога значило бы делать под сотню лишних запросов ради
   * списка, в котором эти поля всё равно не показываются.
   */
  const { data: card, isLoading: cardLoading } = useQuery({
    queryKey: ['ozon-product-card', accountId, product.offerId],
    queryFn: () => ozonProductCatalogApi.card(accountId, product.offerId),
    staleTime: 300_000,
  });

  /*
   * Правка текстов. Ozon обновляет карточку импортом, который заменяет её
   * целиком, поэтому сервер сначала читает карточку, накладывает правки и
   * отправляет полный набор — иначе правка названия унесла бы с собой все
   * характеристики. Здесь остаётся только показать статус задачи: площадка
   * принимает изменения не мгновенно и может их отклонить.
   */
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(product.name);
  const [descDraft, setDescDraft] = useState('');
  const [taskId, setTaskId] = useState<number | null>(null);

  const { data: importState } = useQuery({
    queryKey: ['ozon-import', accountId, taskId],
    queryFn: () => ozonProductCatalogApi.importStatus(accountId, taskId!),
    enabled: taskId !== null,
    // Ozon обрабатывает импорт несколько секунд — переспрашиваем, пока идёт.
    refetchInterval: (q) =>
      q.state.data && q.state.data.status !== 'pending' ? false : 3000,
  });

  const saveText = useMutation({
    mutationFn: () =>
      ozonProductCatalogApi.updateCardText(accountId, {
        offerId: product.offerId,
        name: nameDraft.trim() !== product.name ? nameDraft.trim() : undefined,
        description: descDraft.trim() || undefined,
      }),
    onSuccess: (res) => {
      setTaskId(res.taskId);
      setEditing(false);
      toast.success('Отправлено в Ozon — ждём ответа площадки');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  // Деньги считает UnitEconomicsPanel ниже — там полная раскладка с
  // логистикой, эквайрингом, возвратами и налогом. Дублировать грубую оценку
  // здесь значило бы показать две разные цифры про одно и то же.
  const commission = product.commissionPercent
    ? (product.price * product.commissionPercent) / 100
    : null;

  const size = sizeOf(product.offerId);

  return (
    <Modal open onClose={onClose} title={product.name || product.offerId} size="lg">
      <div className="space-y-5">
        {/* Переходы между размерами прямо здесь: раньше приходилось закрывать
            окно, снова открывать группу и искать нужный размер — три действия
            там, где нужно одно. */}
        {(onBack || siblings.length > 1) && (
          <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 pb-3">
            {onBack && (
              <button
                onClick={onBack}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-100"
              >
                ← К карточке
              </button>
            )}
            {siblings.length > 1 && onSelect && (
              /* Размеры разложены по цветам и по порядку бирки. Плоский ряд
                 «M M L XL XXL XXL» ничего не говорил: в родовой группе
                 размеры повторяются у каждого цвета. */
              <div className="space-y-1">
                {groupSizesByColor(siblings).map(([color, list]) => (
                  <div key={color} className="flex flex-wrap items-center gap-1">
                    {siblingColors > 1 && (
                      <span className="w-14 flex-shrink-0 text-[11px] text-gray-500">
                        {color}
                      </span>
                    )}
                    {list.map((p) => {
                      const active = p.offerId === product.offerId;
                      return (
                        <button
                          key={p.offerId}
                          onClick={() => onSelect(p)}
                          title={p.offerId}
                          className={`min-h-[28px] rounded-lg px-2.5 text-xs font-semibold transition-colors ${
                            active
                              ? 'bg-amber-600 text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-amber-50 hover:text-amber-700'
                          }`}
                        >
                          {sizeOf(p.offerId) ?? p.offerId}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex items-start gap-4">
          {product.primaryImage && (
            <img
              src={product.primaryImage}
              alt=""
              className="w-24 h-24 rounded-lg object-cover border border-gray-200 bg-gray-50 flex-shrink-0"
            />
          )}
          <div className="min-w-0 space-y-1">
            <p className="font-mono text-sm text-gray-700">{product.offerId}</p>
            <p className="text-xs text-gray-500">
              {size && <>Размер {size} · </>}SKU {product.sku ?? '—'} · id {product.productId}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${
                product.archived ? 'bg-gray-100 text-gray-500'
                  : product.statusName === 'Продается' ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-amber-50 text-amber-700'
              }`}>
                {product.archived ? 'В архиве' : product.statusName || 'Статус неизвестен'}
              </span>
              {product.moderateStatus && product.moderateStatus !== 'approved' && (
                <span className="px-2 py-0.5 rounded-md text-xs bg-amber-50 text-amber-700">
                  модерация: {product.moderateStatus}
                </span>
              )}
              {!product.hasStock && !product.archived && (
                <span className="px-2 py-0.5 rounded-md text-xs bg-red-50 text-red-700">нет остатка</span>
              )}
            </div>
            {product.statusDescription && (
              <p className="text-xs text-gray-500 pt-1">{product.statusDescription}</p>
            )}
            {/* Родовая группа и штрихкоды — то, чего в карточке не хватало:
                по группе Ozon переключает цвета покупателю, по штрихкодам
                товар принимают на складе. */}
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 pt-2 text-xs">
              <dt className="text-gray-500">Родовая группа</dt>
              <dd className="text-gray-800">
                {product.modelId
                  ? `${product.modelId}${product.modelCount ? ` · товаров в группе: ${product.modelCount}` : ''}`
                  : 'товар не объединён с другими цветами'}
              </dd>
              <dt className="text-gray-500">Штрихкоды</dt>
              <dd className="font-mono text-[11px] text-gray-800">
                {product.barcodes.length ? product.barcodes.join(', ') : '—'}
              </dd>
              <dt className="text-gray-500">Габариты</dt>
              <dd className="text-gray-800">
                {cardLoading
                  ? 'загружаем…'
                  : card && card.depth && card.width && card.height
                    ? `${card.depth}×${card.width}×${card.height} ${card.dimensionUnit ?? ''}${
                        card.weight ? `, ${card.weight} ${card.weightUnit ?? ''}` : ''
                      }`
                    : '—'}
              </dd>
            </dl>
          </div>
        </div>

        {/* Тексты карточки — то, по чему Ozon её ищет. Правка идёт импортом,
            поэтому меняются они здесь, а результат приходит от площадки
            отдельно: она может отклонить изменение с причиной. */}
        <div className="rounded-lg border border-gray-200 p-3">
          {editing ? (
            <div className="space-y-2">
              <label className="block">
                <span className="text-xs font-medium text-gray-600">
                  Название — главное поле для поиска Ozon
                </span>
                <input
                  className={`mt-1 ${field}`}
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-600">Описание</span>
                <textarea
                  rows={5}
                  className={`mt-1 ${field}`}
                  value={descDraft}
                  placeholder={card?.description ?? 'Описание товара'}
                  onChange={(e) => setDescDraft(e.target.value)}
                />
                <span className="mt-1 block text-[11px] text-gray-400">
                  Пусто — описание останется прежним.
                </span>
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => saveText.mutate()}
                  disabled={saveText.isPending}
                  className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  {saveText.isPending ? 'Отправляем…' : 'Отправить в Ozon'}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700"
                >
                  Отмена
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-gray-600">
                Название и описание — по ним товар находят в поиске
              </span>
              <button
                onClick={() => {
                  setNameDraft(product.name);
                  setDescDraft('');
                  setEditing(true);
                }}
                className="text-xs font-semibold text-amber-700 hover:text-amber-900"
              >
                Редактировать
              </button>
            </div>
          )}

          {importState && (
            <p className="mt-2 text-xs">
              {importState.status === 'pending' && (
                <span className="text-gray-500">Ozon обрабатывает изменение…</span>
              )}
              {importState.status === 'imported' && (
                <span className="text-emerald-700">Ozon принял изменение.</span>
              )}
              {importState.errors.length > 0 && (
                <span className="text-red-600">
                  Ozon отклонил: {importState.errors.join('; ')}
                </span>
              )}
            </p>
          )}
        </div>

        {/* Описание и атрибуты — то, что раньше можно было посмотреть
            только в кабинете Ozon. */}
        {card && (card.description || card.attributes.length > 0) && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-3">
            {card.description && (
              <div>
                <p className="text-xs font-semibold text-gray-700">Описание</p>
                <p className="mt-1 max-h-40 overflow-y-auto whitespace-pre-line text-xs leading-relaxed text-gray-600">
                  {card.description}
                </p>
              </div>
            )}
            {card.attributes.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-700">Характеристики</p>
                <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
                  {card.attributes.slice(0, 12).map((a) => (
                    <Fragment key={a.name}>
                      <dt className="text-gray-500">{a.name}</dt>
                      <dd className="text-gray-800">{a.values.join(', ')}</dd>
                    </Fragment>
                  ))}
                </dl>
                {card.attributes.length > 12 && (
                  <p className="mt-1 text-[11px] text-gray-400">
                    и ещё {card.attributes.length - 12} — остальные видны в кабинете
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Цена и остаток — то, что правят чаще всего */}
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Цена, ₽</span>
            <input type="number" min={1} className={`mt-1 ${field}`} value={price}
              onChange={(e) => setPrice(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Цена до скидки, ₽</span>
            <input type="number" min={0} className={`mt-1 ${field}`} value={oldPrice}
              onChange={(e) => setOldPrice(e.target.value)} />
            <span className="mt-1 block text-[11px] text-gray-400">
              Ozon примет, только если она выше актуальной.
            </span>
          </label>
          <div className="flex items-end">
            <button
              onClick={() => savePrice.mutate()}
              disabled={savePrice.isPending || !Number(price)}
              className="w-full py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {savePrice.isPending ? 'Сохраняем…' : 'Сохранить цену'}
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Остаток, шт.</span>
            <input type="number" min={0} className={`mt-1 ${field}`} value={stock}
              onChange={(e) => setStock(e.target.value)} />
            {product.stockReserved > 0 && (
              <span className="mt-1 block text-[11px] text-gray-400">
                В резерве под заказы: {product.stockReserved}
              </span>
            )}
          </label>
          <div className="flex items-end">
            <button
              onClick={() => saveStock.mutate()}
              disabled={saveStock.isPending || warehouses.length === 0}
              className="w-full py-2 border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 text-gray-700 text-sm font-semibold rounded-lg transition-colors"
            >
              {saveStock.isPending ? 'Сохраняем…' : 'Сохранить остаток'}
            </button>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => toggleArchive.mutate()}
              disabled={toggleArchive.isPending}
              className="w-full flex items-center justify-center gap-1.5 py-2 border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 text-gray-600 text-sm rounded-lg transition-colors"
            >
              {product.archived
                ? <><ArchiveRestore size={14} aria-hidden="true" /> Вернуть из архива</>
                : <><Archive size={14} aria-hidden="true" /> В архив</>}
            </button>
          </div>
        </div>

        {/* Аналитика — ради чего карточка и открывается */}
        <div className="pt-4 border-t border-gray-100 space-y-3">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
            <TrendingUp size={15} className="text-amber-500" aria-hidden="true" />
            Спрос и деньги
          </h3>

          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
            <Stat
              label="Заказали за 30 дней"
              value={`${product.orderedUnits30d} шт.`}
              tone={product.orderedUnits30d > 0 ? 'good' : 'plain'}
              hint={product.orderedUnits30d === 0 ? 'спроса не было' : undefined}
            />
            <Stat label="Выручка за 30 дней" value={money(product.revenue30d)} />
            <Stat label="Остаток" value={`${product.stockPresent} шт.`}
              tone={product.stockPresent === 0 ? 'bad' : 'plain'} />
            <Stat
              label="Комиссия Ozon"
              value={product.commissionPercent !== null ? `${product.commissionPercent}%` : '—'}
              hint={commission !== null ? money(commission) : undefined}
            />
          </div>

          <div className="grid gap-3 grid-cols-2 sm:grid-cols-2">
            <Stat
              label="Оборачиваемость"
              value={
                product.orderedUnits30d > 0
                  ? `${Math.round((product.stockPresent / product.orderedUnits30d) * 30)} дн.`
                  : '—'
              }
              hint={product.orderedUnits30d > 0 ? 'на сколько хватит остатка' : 'нет продаж'}
            />
            <Stat
              label="Выручка на единицу"
              value={
                product.orderedUnits30d > 0
                  ? money(product.revenue30d / product.orderedUnits30d)
                  : '—'
              }
              hint="средняя цена продажи за 30 дней"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-gray-100">
          <UnitEconomicsPanel
            accountId={accountId}
            offerId={product.offerId}
            price={product.price}
          />
        </div>
      </div>
    </Modal>
  );
}
