import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  AlertTriangle, Boxes, Copy, Loader2, Pencil, Plus, Rocket, Trash2,
} from 'lucide-react';
import {
  ozonCatalogApi, type EnumOzonSyncStatus, type OzonPrint,
} from '../../api/ozonCatalog';
import { getErrorMessage } from '../../utils/get-error-message';
import { usePersistentState } from '../../hooks/usePersistentState';
import { TSHIRT_SIZE_LABELS } from '../../constants';
import { TemplateSettings } from './TemplateSettings';
import { PrintEditor } from './PrintEditor';
import { EditPrintModal } from './EditPrintModal';
import {
  duplicateDraft, emptyPrintDraft, draftToPayload, draftErrors, GENDER_LABELS,
  type PrintDefaults, type PrintDraft,
} from './printDraft';

/**
 * Вкладка «Создание»: новые карточки футболок для Ozon — по одной и списком —
 * плюс уже заведённые принты с ходом публикации.
 */

type Mode = 'single' | 'bulk';

const SYNC_STATUS: Record<EnumOzonSyncStatus, { bg: string; text: string; label: string }> = {
  DRAFT: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Черновик' },
  QUEUED: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'В очереди на публикацию' },
  SENT: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Отправлен в Ozon' },
  OK: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Опубликован' },
  ERROR: { bg: 'bg-red-50', text: 'text-red-700', label: 'Ошибка' },
};

/** Принт уже отправлен и ждёт ответа площадки — трогать его нечем. */
function isInFlight(print: OzonPrint): boolean {
  return print.status === 'QUEUED' || print.status === 'SENT';
}

/**
 * Принту есть что отправить, пока хоть один вариант не ушёл в Ozon.
 *
 * Не `status === 'DRAFT'`: цвет, добавленный в уже опубликованную карточку,
 * остаётся черновиком внутри принта, а сам принт помечен OK. По статусу принта
 * такие варианты оказывались неотправляемыми — ровно так белая футболка
 * JDM-1-2 и застряла рядом с опубликованной чёрной.
 *
 * И не во время отправки: у принта в очереди варианты тоже не OK, и кнопка
 * предлагала отправить его второй раз — то есть завести в Ozon дубль импорта
 * поверх ещё не разобранного.
 */
function needsPublish(print: OzonPrint): boolean {
  return (
    !isInFlight(print) &&
    (print.status === 'DRAFT' || print.variants.some((v) => v.status !== 'OK'))
  );
}

/** Всё уехало в Ozon и принято — дальше карточка живёт в «Моих товарах». */
function isSettled(print: OzonPrint): boolean {
  return print.status === 'OK' && print.variants.every((v) => v.status === 'OK');
}

function SyncBadge({ status }: { status: EnumOzonSyncStatus }) {
  const s = SYNC_STATUS[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}

/**
 * Чего не хватает, чтобы отправить карточку.
 *
 * Раньше список висел в атрибуте title у выключенной кнопки: чтобы понять,
 * почему нельзя сохранить, нужно было догадаться навести мышь и подождать
 * подсказку браузера. На телефоне подсказки нет вовсе.
 */
function DraftIssues({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null;
  return (
    <ul className="space-y-1 rounded-lg border border-amber-100 bg-amber-50 p-2.5">
      {errors.map((e) => (
        <li key={e} className="flex gap-1.5 text-xs text-amber-900">
          <span aria-hidden="true">•</span>
          {e}
        </li>
      ))}
    </ul>
  );
}

function PrintCard({ print, onPublish, onRemove, onEdit, publishing }: {
  print: OzonPrint;
  onPublish: () => void;
  onRemove: () => void;
  onEdit: () => void;
  publishing: boolean;
}) {
  const byColor = new Map<string, typeof print.variants>();
  for (const v of print.variants) {
    byColor.set(v.colorLabel, [...(byColor.get(v.colorLabel) ?? []), v]);
  }

  const pending = print.variants.filter((v) => v.status !== 'OK').length;
  const editable = print.status === 'DRAFT' || print.status === 'ERROR';

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-start gap-3">
        {print.mainPhotoUrl && (
          <img src={print.mainPhotoUrl} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0 bg-gray-100" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-semibold text-gray-900 truncate">{print.name}</h4>
            <SyncBadge status={print.status} />
          </div>
          <p className="mt-0.5 text-xs text-gray-500">
            {print.slug} · {GENDER_LABELS[print.gender]} · {print.price.toLocaleString('ru-RU')} ₽
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {editable && (
            <button
              onClick={onEdit}
              aria-label="Изменить"
              title="Изменить название, цену, фото"
              className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-800 hover:bg-gray-100 transition-colors"
            >
              <Pencil size={15} aria-hidden="true" />
            </button>
          )}
          {editable && (
            <button
              onClick={onRemove}
              aria-label="Удалить"
              className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 size={15} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        {[...byColor.entries()].map(([color, variants]) => (
          <div key={color} className="flex items-center gap-2 text-xs">
            <span className="text-gray-500 min-w-0 truncate">{color}:</span>
            <div className="flex flex-wrap gap-1">
              {variants.map((v) => (
                <span
                  key={v.id}
                  title={v.lastError ?? v.offerId}
                  className={`px-1.5 py-0.5 rounded font-medium ${
                    v.status === 'ERROR' ? 'bg-red-50 text-red-700' :
                    v.status === 'OK' ? 'bg-emerald-50 text-emerald-700' :
                    'bg-gray-100 text-gray-600'
                  }`}
                >
                  {TSHIRT_SIZE_LABELS[v.size]}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {print.lastError && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-100 p-2.5">
          <AlertTriangle size={13} className="text-red-500 mt-0.5 flex-shrink-0" aria-hidden="true" />
          <p className="text-xs text-red-700">{print.lastError}</p>
        </div>
      )}

      {/* Кнопка с подписью, а не иконка-ракета в углу: это главное действие
          карточки, и раньше его приходилось угадывать. */}
      {needsPublish(print) && (
        <button
          onClick={onPublish}
          disabled={publishing}
          className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
        >
          {publishing
            ? <Loader2 size={13} className="animate-spin" aria-hidden="true" />
            : <Rocket size={13} aria-hidden="true" />}
          {print.status === 'DRAFT'
            ? 'Отправить в Ozon'
            : `Дослать в Ozon (${pending})`}
        </button>
      )}
    </div>
  );
}

function PrintsList({ accountId }: { accountId: string }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<OzonPrint | null>(null);
  const { data: prints = [], isLoading } = useQuery({
    queryKey: ['ozon-prints', accountId],
    queryFn: () => ozonCatalogApi.listPrints(accountId),
    refetchInterval: (query) =>
      query.state.data?.some((p) => p.status === 'QUEUED' || p.status === 'SENT') ? 5000 : false,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['ozon-prints', accountId] });

  const publish = useMutation({
    mutationFn: (printId: string) => ozonCatalogApi.publish(accountId, [printId]),
    onSuccess: () => { invalidate(); toast.success('Отправлено в Ozon — статус обновится за пару минут'); },
    onError: (e) => toast.error(getErrorMessage(e, 'Не удалось отправить')),
  });

  const unsent = prints.filter(needsPublish);

  const publishAll = useMutation({
    mutationFn: () => ozonCatalogApi.publish(accountId, unsent.map((p) => p.id)),
    onSuccess: () => { invalidate(); toast.success('Отправлено в Ozon'); },
    onError: (e) => toast.error(getErrorMessage(e, 'Не удалось отправить')),
  });

  const remove = useMutation({
    mutationFn: (printId: string) => ozonCatalogApi.removePrint(printId),
    onSuccess: () => { invalidate(); toast.success('Принт удалён'); },
    onError: (e) => toast.error(getErrorMessage(e, 'Не удалось удалить')),
  });

  if (isLoading) return <p className="text-sm text-gray-500">Загрузка…</p>;

  if (prints.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-8 text-center">
        <Boxes size={28} className="mx-auto text-gray-300" aria-hidden="true" />
        <p className="mt-3 text-sm text-gray-500">Принтов пока нет — создайте первый выше.</p>
      </div>
    );
  }

  /*
   * Готовые карточки уходят под сворачиваемую строку.
   *
   * Экран создания отвечает на один вопрос: что ещё не уехало в Ozon. Принт,
   * который уже опубликован целиком, ответа не меняет — он живёт в «Моих
   * товарах», где у него цена, остаток и продажи. Держать его здесь второй
   * копией значит каждый раз листать мимо сделанного к несделанному.
   */
  const settled = prints.filter(isSettled);
  const active = prints.filter((p) => !isSettled(p));

  const card = (p: OzonPrint) => (
    <PrintCard
      key={p.id}
      print={p}
      publishing={publish.isPending && publish.variables === p.id}
      onPublish={() => publish.mutate(p.id)}
      onEdit={() => setEditing(p)}
      onRemove={() => {
        if (confirm(`Удалить принт «${p.name}»? Если он уже был отправлен в Ozon, там карточка останется.`)) {
          remove.mutate(p.id);
        }
      }}
    />
  );

  return (
    <div className="space-y-3">
      {active.length > 0 && (
        <>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-gray-700">
              Ещё не в Ozon ({active.length})
            </h3>
            {unsent.length > 1 && (
              <button
                onClick={() => publishAll.mutate()}
                disabled={publishAll.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                <Rocket size={13} aria-hidden="true" />
                Отправить все ({unsent.length})
              </button>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">{active.map(card)}</div>
        </>
      )}

      {settled.length > 0 && (
        <details className="rounded-2xl border border-gray-200 bg-white">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-gray-700">
            Уже в Ozon ({settled.length})
            <span className="ml-2 text-xs font-normal text-gray-500">
              цена, остаток и продажи — в разделе «Мои товары»
            </span>
          </summary>
          <div className="grid gap-3 border-t border-gray-100 p-4 sm:grid-cols-2">
            {settled.map(card)}
          </div>
        </details>
      )}

      {editing && (
        <EditPrintModal
          print={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); invalidate(); }}
        />
      )}
    </div>
  );
}

/**
 * Кнопки под формой.
 *
 * Главное действие — создать и сразу отправить: черновик, который потом надо
 * найти в списке ниже и нажать там ещё одну кнопку, был лишним шагом ради
 * ничего. Сохранение черновиком осталось второй кнопкой — оно нужно, когда
 * фото ещё не готово или цену уточняют.
 */
function CreateActions({
  errors, busy, busyLabel, onDraft, onPublish, publishLabel, draftLabel,
}: {
  errors: string[];
  busy: boolean;
  busyLabel: string;
  onDraft: () => void;
  onPublish: () => void;
  publishLabel: string;
  draftLabel: string;
}) {
  const blocked = busy || errors.length > 0;
  return (
    <div className="space-y-2">
      <DraftIssues errors={errors} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          onClick={onPublish}
          disabled={blocked}
          className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          {busy
            ? <><Loader2 size={14} className="animate-spin" aria-hidden="true" /> {busyLabel}</>
            : <><Rocket size={14} aria-hidden="true" /> {publishLabel}</>}
        </button>
        <button
          onClick={onDraft}
          disabled={blocked}
          className="py-2.5 px-4 border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 text-gray-700 text-sm font-medium rounded-lg transition-colors"
        >
          {draftLabel}
        </button>
      </div>
    </div>
  );
}

function SingleCreateForm({ accountId, defaults }: { accountId: string; defaults: PrintDefaults }) {
  const qc = useQueryClient();
  // Черновик переживает уход на другую вкладку и обновление страницы: форму
  // заполняют не за секунду, и терять набранное от одного клика нельзя.
  const [draft, setDraft] = usePersistentState<PrintDraft>(
    `ozon-draft-single-${accountId}`,
    emptyPrintDraft,
  );
  // Меняется при каждом успешном сохранении — вместе с key на PrintEditor это
  // пересоздаёт вложенные автодополнения (см. AttributeAutocomplete) вместо
  // синхронизации их локального состояния через эффект.
  const [formVersion, setFormVersion] = useState(0);

  const reset = () => {
    setDraft(emptyPrintDraft());
    setFormVersion((v) => v + 1);
    qc.invalidateQueries({ queryKey: ['ozon-prints', accountId] });
  };

  /*
   * Создание и отправка — два запроса, и падать они могут порознь.
   *
   * Если карточка создалась, а отправка не прошла, показывать «не удалось
   * создать принт» нельзя: человек правит форму и жмёт снова, а в ответ
   * получает «принт уже заведён» — при том что в списке ниже он и правда
   * лежит. Ровно в этот круг здесь уже попадали. Поэтому отказ отправки
   * возвращается как результат, а не как ошибка: форма очищается, а сказать
   * остаётся только «лежит черновиком, отправьте кнопкой».
   */
  const create = useMutation({
    mutationFn: async (publish: boolean) => {
      const print = await ozonCatalogApi.createPrint(accountId, draftToPayload(draft, defaults));
      if (!publish) return { publishError: null as string | null };
      try {
        await ozonCatalogApi.publish(accountId, [print.id]);
        return { publishError: null as string | null };
      } catch (e) {
        return { publishError: getErrorMessage(e, 'Ozon не принял запрос') };
      }
    },
    onSuccess: ({ publishError }) => {
      reset();
      if (publishError) {
        toast.error(
          `Карточка сохранена, но в Ozon не ушла: ${publishError}. Она в списке ниже — отправьте кнопкой.`,
          { duration: 9000 },
        );
      } else {
        toast.success('Карточка создана — статус появится в списке ниже');
      }
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Не удалось создать принт')),
  });

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
      <PrintEditor key={formVersion} draft={draft} onChange={setDraft} accountId={accountId} />
      <CreateActions
        errors={draftErrors(draft, defaults)}
        busy={create.isPending}
        busyLabel="Отправляем…"
        publishLabel="Создать и отправить в Ozon"
        draftLabel="Только сохранить"
        onPublish={() => create.mutate(true)}
        onDraft={() => create.mutate(false)}
      />
    </div>
  );
}

function BulkCreateForm({ accountId, defaults }: { accountId: string; defaults: PrintDefaults }) {
  const qc = useQueryClient();
  // См. SingleCreateForm — здесь потеря дороже: строк в списке бывает десяток.
  const [drafts, setDrafts] = usePersistentState<PrintDraft[]>(
    `ozon-draft-bulk-${accountId}`,
    () => [emptyPrintDraft()],
  );

  // Та же развилка, что в одиночном создании: отказ отправки — это результат,
  // а не ошибка. Плюс список обновляем и при отказе создания: часть принтов
  // могла успеть записаться, и человек должен увидеть, что именно.
  const createBulk = useMutation({
    mutationFn: async (publish: boolean) => {
      const created = await ozonCatalogApi.createPrintsBulk(
        accountId,
        drafts.map((d) => draftToPayload(d, defaults)),
      );
      if (!publish || !created.length) {
        return { count: created.length, publishError: null as string | null };
      }
      try {
        await ozonCatalogApi.publish(accountId, created.map((p) => p.id));
        return { count: created.length, publishError: null as string | null };
      } catch (e) {
        return { count: created.length, publishError: getErrorMessage(e, 'Ozon не принял запрос') };
      }
    },
    onSuccess: ({ count, publishError }) => {
      qc.invalidateQueries({ queryKey: ['ozon-prints', accountId] });
      setDrafts([emptyPrintDraft()]);
      if (publishError) {
        toast.error(
          `Сохранено карточек: ${count}, но в Ozon они не ушли: ${publishError}. Отправьте их кнопкой в списке ниже.`,
          { duration: 9000 },
        );
      } else {
        toast.success(`Создано карточек: ${count}`);
      }
    },
    onError: (e) => {
      qc.invalidateQueries({ queryKey: ['ozon-prints', accountId] });
      toast.error(getErrorMessage(e, 'Не удалось создать принты'));
    },
  });

  const update = (key: string, d: PrintDraft) =>
    setDrafts((prev) => prev.map((p) => (p.key === key ? d : p)));
  const remove = (key: string) => setDrafts((prev) => prev.filter((p) => p.key !== key));
  const duplicate = (key: string) => setDrafts((prev) => {
    const idx = prev.findIndex((p) => p.key === key);
    if (idx === -1) return prev;
    return [...prev.slice(0, idx + 1), duplicateDraft(prev[idx]!), ...prev.slice(idx + 1)];
  });

  // Ошибки собираем с номером строки: в списке из десяти принтов «не указана
  // цена» без номера ничего не говорит.
  const allErrors = drafts.flatMap((d, i) =>
    draftErrors(d, defaults).map((e) => `Принт #${i + 1}: ${e}`),
  );

  return (
    <div className="space-y-3">
      {drafts.map((d, idx) => (
        <div key={d.key} className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">Принт #{idx + 1}</span>
            <div className="flex items-center gap-1">
              <button onClick={() => duplicate(d.key)} aria-label="Дублировать"
                title="Скопировать строку: общие поля останутся, название и фото — чистые"
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
                <Copy size={14} aria-hidden="true" />
              </button>
              {drafts.length > 1 && (
                <button onClick={() => remove(d.key)} aria-label="Удалить строку"
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
          <PrintEditor draft={d} onChange={(next) => update(d.key, next)} accountId={accountId} />
        </div>
      ))}

      <button
        onClick={() => setDrafts((prev) => [...prev, emptyPrintDraft()])}
        className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors"
      >
        <Plus size={14} aria-hidden="true" /> Добавить принт
      </button>

      <CreateActions
        errors={allErrors}
        busy={createBulk.isPending}
        busyLabel="Отправляем…"
        publishLabel={`Создать и отправить в Ozon (${drafts.length})`}
        draftLabel="Только сохранить"
        onPublish={() => createBulk.mutate(true)}
        onDraft={() => createBulk.mutate(false)}
      />
    </div>
  );
}

/** Кабинет выбирается на уровне страницы и приходит сюда готовым. */
export function ProductsTab({ accountId }: { accountId: string }) {
  const [mode, setMode] = usePersistentState<Mode>('ozon-create-mode', 'single');

  /*
   * Шаблон нужен здесь только ради цены по умолчанию, поэтому запрос идёт
   * всегда, а не по раскрытию настроек: форма должна открыться уже с ценой,
   * а не подставлять её задним числом.
   */
  const { data: template } = useQuery({
    queryKey: ['ozon-template', accountId],
    queryFn: () => ozonCatalogApi.getTemplate(accountId),
  });
  // Цена и «цена до скидки» живут только в шаблоне: в форме принта их полей
  // больше нет. Два места под одно значение путали — и норовили разойтись.
  const defaults: PrintDefaults = {
    price: template?.defaultPrice ?? 0,
    oldPrice: template?.defaultOldPrice ?? 0,
  };

  return (
    <div className="space-y-4">
      {/* Шаблон стоит первым. Я его убирал вниз как настройку «задал и забыл»,
          но искать его пошли именно сюда: цена, остаток и габариты меняются от
          партии к партии, и это часть заведения карточек, а не отдельная
          настройка. Свёрнутый он занимает одну строку и показывает главное
          прямо в заголовке. */}
      <TemplateSettings accountId={accountId} />

      <div className="flex gap-2">
        {(['single', 'bulk'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === m ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {m === 'single' ? 'Одна карточка' : 'Списком'}
          </button>
        ))}
      </div>

      {/* Форма пересоздаётся при смене цены по умолчанию: иначе первая
          открытая форма осталась бы с пустым полем до перезагрузки. */}
      {mode === 'single'
        ? <SingleCreateForm accountId={accountId} defaults={defaults} />
        : <BulkCreateForm accountId={accountId} defaults={defaults} />}

      <PrintsList accountId={accountId} />
    </div>
  );
}
