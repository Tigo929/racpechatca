import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  AlertTriangle, Boxes, Copy, Loader2, Plus, Rocket, Trash2,
} from 'lucide-react';
import {
  ozonCatalogApi, type EnumOzonSyncStatus, type OzonPrint,
} from '../../api/ozonCatalog';
import { getErrorMessage } from '../../utils/get-error-message';
import { TSHIRT_SIZE_LABELS } from '../../constants';
import { TemplateSettings } from './TemplateSettings';
import { PrintEditor } from './PrintEditor';
import { emptyPrintDraft, draftToPayload, draftErrors, GENDER_LABELS, type PrintDraft } from './printDraft';

/**
 * Вкладка «Товары»: создание карточек футболок для Ozon — одиночно и
 * массово — плюс список уже созданных принтов с ходом публикации.
 */

type Mode = 'single' | 'bulk';

const SYNC_STATUS: Record<EnumOzonSyncStatus, { bg: string; text: string; label: string }> = {
  DRAFT: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Черновик' },
  QUEUED: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'В очереди на публикацию' },
  SENT: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Отправлен в Ozon' },
  OK: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Опубликован' },
  ERROR: { bg: 'bg-red-50', text: 'text-red-700', label: 'Ошибка' },
};

function SyncBadge({ status }: { status: EnumOzonSyncStatus }) {
  const s = SYNC_STATUS[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}

function PrintCard({ print, onPublish, onRemove, publishing }: {
  print: OzonPrint;
  onPublish: () => void;
  onRemove: () => void;
  publishing: boolean;
}) {
  const byColor = new Map<string, typeof print.variants>();
  for (const v of print.variants) {
    byColor.set(v.colorLabel, [...(byColor.get(v.colorLabel) ?? []), v]);
  }

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
          {print.status === 'DRAFT' && (
            <button
              onClick={onPublish}
              disabled={publishing}
              aria-label="Опубликовать в Ozon"
              className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
            >
              {publishing ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Rocket size={15} aria-hidden="true" />}
            </button>
          )}
          {(print.status === 'DRAFT' || print.status === 'ERROR') && (
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
    </div>
  );
}

function PrintsList({ accountId }: { accountId: string }) {
  const qc = useQueryClient();
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

  const publishAllDrafts = useMutation({
    mutationFn: () => ozonCatalogApi.publish(accountId, prints.filter((p) => p.status === 'DRAFT').map((p) => p.id)),
    onSuccess: () => { invalidate(); toast.success('Черновики отправлены в Ozon'); },
    onError: (e) => toast.error(getErrorMessage(e, 'Не удалось отправить')),
  });

  const remove = useMutation({
    mutationFn: (printId: string) => ozonCatalogApi.removePrint(printId),
    onSuccess: () => { invalidate(); toast.success('Принт удалён'); },
    onError: (e) => toast.error(getErrorMessage(e, 'Не удалось удалить')),
  });

  const draftCount = prints.filter((p) => p.status === 'DRAFT').length;

  if (isLoading) return <p className="text-sm text-gray-500">Загрузка…</p>;

  if (prints.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-8 text-center">
        <Boxes size={28} className="mx-auto text-gray-300" aria-hidden="true" />
        <p className="mt-3 text-sm text-gray-500">Принтов пока нет — создайте первый выше.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Принты ({prints.length})</h3>
        {draftCount > 0 && (
          <button
            onClick={() => publishAllDrafts.mutate()}
            disabled={publishAllDrafts.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            <Rocket size={13} aria-hidden="true" />
            Опубликовать все черновики ({draftCount})
          </button>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {prints.map((p) => (
          <PrintCard
            key={p.id}
            print={p}
            publishing={publish.isPending && publish.variables === p.id}
            onPublish={() => publish.mutate(p.id)}
            onRemove={() => {
              if (confirm(`Удалить принт «${p.name}»? Если он уже был отправлен в Ozon, там карточка останется.`)) {
                remove.mutate(p.id);
              }
            }}
          />
        ))}
      </div>
    </div>
  );
}

function SingleCreateForm({ accountId }: { accountId: string }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<PrintDraft>(emptyPrintDraft());
  // Меняется при каждом успешном сохранении — вместе с key на PrintEditor это
  // пересоздаёт вложенные автодополнения (см. AttributeAutocomplete) вместо
  // синхронизации их локального состояния через эффект.
  const [formVersion, setFormVersion] = useState(0);

  const create = useMutation({
    mutationFn: () => ozonCatalogApi.createPrint(accountId, draftToPayload(draft)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ozon-prints', accountId] });
      setDraft(emptyPrintDraft());
      setFormVersion((v) => v + 1);
      toast.success('Принт сохранён черновиком — опубликуйте его в списке ниже');
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Не удалось создать принт')),
  });

  const errors = draftErrors(draft);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
      <PrintEditor key={formVersion} draft={draft} onChange={setDraft} accountId={accountId} />
      <button
        onClick={() => create.mutate()}
        disabled={create.isPending || errors.length > 0}
        title={errors.join('; ')}
        className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
      >
        {create.isPending ? 'Сохраняем…' : 'Сохранить черновик'}
      </button>
    </div>
  );
}

function BulkCreateForm({ accountId }: { accountId: string }) {
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<PrintDraft[]>([emptyPrintDraft()]);
  // См. formVersion в SingleCreateForm — та же причина.
  const [batchVersion, setBatchVersion] = useState(0);

  const createBulk = useMutation({
    mutationFn: () => ozonCatalogApi.createPrintsBulk(accountId, drafts.map(draftToPayload)),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['ozon-prints', accountId] });
      setDrafts([emptyPrintDraft()]);
      setBatchVersion((v) => v + 1);
      toast.success(`Сохранено черновиков: ${created.length} — опубликуйте их в списке ниже`);
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Не удалось создать принты')),
  });

  const update = (idx: number, d: PrintDraft) => setDrafts((prev) => prev.map((p, i) => (i === idx ? d : p)));
  const remove = (idx: number) => setDrafts((prev) => prev.filter((_, i) => i !== idx));
  const duplicate = (idx: number) => setDrafts((prev) => [
    ...prev.slice(0, idx + 1),
    { ...prev[idx]!, name: '', slug: '', mainPhotoUrl: '', extraPhotoUrls: '' },
    ...prev.slice(idx + 1),
  ]);

  const allErrors = drafts.map(draftErrors);
  const hasErrors = allErrors.some((e) => e.length > 0);

  return (
    <div className="space-y-3">
      {drafts.map((d, idx) => (
        <div key={`${batchVersion}-${idx}`} className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">Принт #{idx + 1}</span>
            <div className="flex items-center gap-1">
              <button onClick={() => duplicate(idx)} aria-label="Дублировать"
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
                <Copy size={14} aria-hidden="true" />
              </button>
              {drafts.length > 1 && (
                <button onClick={() => remove(idx)} aria-label="Удалить строку"
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
          <PrintEditor draft={d} onChange={(next) => update(idx, next)} accountId={accountId} compact />
        </div>
      ))}

      <button
        onClick={() => setDrafts((prev) => [...prev, emptyPrintDraft()])}
        className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors"
      >
        <Plus size={14} aria-hidden="true" /> Добавить принт
      </button>

      <button
        onClick={() => createBulk.mutate()}
        disabled={createBulk.isPending || hasErrors}
        className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
      >
        {createBulk.isPending ? 'Сохраняем…' : `Сохранить черновики (${drafts.length})`}
      </button>
    </div>
  );
}

/** Кабинет выбирается на уровне страницы и приходит сюда готовым. */
export function ProductsTab({ accountId }: { accountId: string }) {
  const [mode, setMode] = useState<Mode>('single');

  return (
    <div className="space-y-4">
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
            {m === 'single' ? 'Одиночно' : 'Массово'}
          </button>
        ))}
      </div>

      {mode === 'single' ? <SingleCreateForm accountId={accountId} /> : <BulkCreateForm accountId={accountId} />}

      <PrintsList accountId={accountId} />
    </div>
  );
}
