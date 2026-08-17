import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  AlertTriangle, Boxes, CheckCircle2, Pencil, Plus, RefreshCw, Trash2,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import {
  marketplaceApi, type CreateAccountDto, type EnumMarketplace,
  type MarketplaceAccount,
} from '../../api/marketplace';
import { getErrorMessage } from '../../utils/get-error-message';

/** Доступы к кабинетам площадки: добавить, проверить связь, поменять ключ. */

const field =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

/** Полоса состояния подключения: главное, что человек хочет видеть сразу. */
function CheckStatus({ account }: { account: MarketplaceAccount }) {
  if (account.lastCheckOk === null) {
    return <p className="text-xs text-gray-500">Связь ещё не проверялась.</p>;
  }

  if (!account.lastCheckOk) {
    return (
      <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-100 p-3">
        <AlertTriangle size={15} className="text-red-500 mt-0.5 flex-shrink-0" aria-hidden="true" />
        <div className="text-xs text-red-700">
          <p className="font-medium">Связи нет</p>
          <p className="mt-0.5">{account.lastCheckError}</p>
          {account.lastCheckAt && (
            <p className="mt-1 text-red-500/80">Проверено {formatDateTime(account.lastCheckAt)}</p>
          )}
        </div>
      </div>
    );
  }

  const info = account.lastCheckInfo;
  return (
    <div className="flex items-start gap-2 rounded-lg bg-emerald-50 border border-emerald-100 p-3">
      <CheckCircle2 size={15} className="text-emerald-600 mt-0.5 flex-shrink-0" aria-hidden="true" />
      <div className="text-xs text-emerald-800">
        <p className="font-medium">Кабинет на связи</p>
        {info?.productTotal !== null && info?.productTotal !== undefined && (
          <p className="mt-0.5">Товаров в кабинете: {info.productTotal.toLocaleString('ru-RU')}</p>
        )}
        {info?.warehouses?.length ? (
          <p className="mt-0.5">Склады: {info.warehouses.map((w) => w.name).join(', ')}</p>
        ) : info?.warehouses === null ? (
          <p className="mt-0.5 text-emerald-700/80">
            Склады недоступны по этому ключу — для карточек товаров это не мешает.
          </p>
        ) : null}
        {account.lastCheckAt && (
          <p className="mt-1 text-emerald-700/80">Проверено {formatDateTime(account.lastCheckAt)}</p>
        )}
      </div>
    </div>
  );
}

function AccountCard({
  account, onEdit,
}: {
  account: MarketplaceAccount;
  onEdit: (a: MarketplaceAccount) => void;
}) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ['marketplace-accounts'] });

  const check = useMutation({
    mutationFn: () => marketplaceApi.check(account.id),
    onSuccess: (updated) => {
      refresh();
      if (updated.lastCheckOk) toast.success('Связь с кабинетом есть');
      else toast.error(updated.lastCheckError ?? 'Связи нет');
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Не удалось проверить')),
  });

  const remove = useMutation({
    mutationFn: () => marketplaceApi.remove(account.id),
    onSuccess: () => {
      refresh();
      toast.success('Кабинет отключён');
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Не удалось удалить')),
  });

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 truncate">{account.title}</h3>
          <p className="mt-0.5 text-xs text-gray-500">
            Client-Id {account.externalId} · ключ {account.apiKeyHint}
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => check.mutate()}
            disabled={check.isPending}
            aria-label="Проверить связь"
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
          >
            <RefreshCw size={16} className={check.isPending ? 'animate-spin' : ''} aria-hidden="true" />
          </button>
          <button
            onClick={() => onEdit(account)}
            aria-label="Изменить доступы"
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <Pencil size={16} aria-hidden="true" />
          </button>
          <button
            onClick={() => {
              if (confirm(`Отключить кабинет «${account.title}»? Ключ будет удалён.`)) {
                remove.mutate();
              }
            }}
            disabled={remove.isPending}
            aria-label="Отключить кабинет"
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      <CheckStatus account={account} />
    </div>
  );
}

/**
 * Форма доступов. При изменении ключ не показываем — пустое поле = «оставить».
 * Компонент монтируется только на время показа (и с key по кабинету), поэтому
 * начальные значения берутся прямо в useState, без синхронизации эффектом.
 */
function AccountForm({
  onClose, marketplace, editing,
}: {
  onClose: () => void;
  marketplace: EnumMarketplace;
  editing: MarketplaceAccount | null;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(editing?.title ?? 'Основной магазин');
  const [externalId, setExternalId] = useState(editing?.externalId ?? '');
  const [apiKey, setApiKey] = useState('');

  const save = useMutation({
    mutationFn: () =>
      editing
        ? marketplaceApi.update(editing.id, {
            title, externalId, ...(apiKey ? { apiKey } : {}),
          })
        : marketplaceApi.create({
            marketplace, title, externalId, apiKey,
          } satisfies CreateAccountDto),
    onSuccess: (account) => {
      qc.invalidateQueries({ queryKey: ['marketplace-accounts'] });
      onClose();
      if (account.lastCheckOk) toast.success('Кабинет подключён — связь есть');
      else {
        toast.error(account.lastCheckError ?? 'Кабинет сохранён, но связи нет', {
          duration: 6000,
        });
      }
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Не удалось сохранить')),
  });

  const canSave =
    title.trim().length >= 2 && externalId.trim().length >= 3 &&
    (editing ? true : apiKey.trim().length >= 8);

  return (
    <Modal open onClose={onClose} title={editing ? 'Доступы кабинета' : 'Подключить кабинет Ozon'}>
      <div className="space-y-4">
        <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 text-xs text-amber-900">
          <p className="font-medium">Где взять доступы</p>
          <p className="mt-1">
            Кабинет продавца Ozon → аватар в правом верхнем углу → «Настройки» →
            «Seller API». Там же виден Client-Id и создаётся Api-Key. Права ключа
            нужны на товары; для заказов и остатков — ещё и на отгрузки.
          </p>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">Название кабинета</span>
          <input
            className={`mt-1 ${field}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Основной магазин"
          />
          <span className="mt-1 block text-xs text-gray-500">
            Внутреннее имя — так кабинет будет подписан в CRM.
          </span>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">Client-Id</span>
          <input
            className={`mt-1 ${field}`}
            value={externalId}
            onChange={(e) => setExternalId(e.target.value)}
            placeholder="123456"
            inputMode="numeric"
            autoComplete="off"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">Api-Key</span>
          <input
            className={`mt-1 ${field}`}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={editing ? 'оставьте пустым, чтобы не менять' : 'вставьте ключ из кабинета'}
            type="password"
            autoComplete="new-password"
          />
          <span className="mt-1 block text-xs text-gray-500">
            Ключ хранится зашифрованным и обратно в браузер не отдаётся — видно
            только последние символы.
          </span>
        </label>

        <button
          onClick={() => save.mutate()}
          disabled={!canSave || save.isPending}
          className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          {save.isPending ? 'Проверяем связь…' : editing ? 'Сохранить и проверить' : 'Подключить и проверить'}
        </button>
      </div>
    </Modal>
  );
}

export function ConnectionTab({ marketplace }: { marketplace: EnumMarketplace }) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MarketplaceAccount | null>(null);

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['marketplace-accounts', marketplace],
    queryFn: () => marketplaceApi.list(marketplace),
  });

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (a: MarketplaceAccount) => { setEditing(a); setFormOpen(true); };

  return (
    <div className="space-y-4">
      {isLoading ? (
        <p className="text-sm text-gray-500">Загрузка…</p>
      ) : accounts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-8 text-center">
          <Boxes size={28} className="mx-auto text-gray-300" aria-hidden="true" />
          <h3 className="mt-3 text-sm font-semibold text-gray-900">
            Кабинет Ozon пока не подключён
          </h3>
          <p className="mt-1 text-xs text-gray-500 max-w-md mx-auto">
            Нужны два значения из кабинета продавца: Client-Id и Api-Key. После
            подключения CRM сразу проверит связь и покажет, сколько товаров видит.
          </p>
          <button
            onClick={openCreate}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <Plus size={15} aria-hidden="true" />
            Подключить кабинет
          </button>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {accounts.map((a) => (
              <AccountCard key={a.id} account={a} onEdit={openEdit} />
            ))}
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors"
          >
            <Plus size={15} aria-hidden="true" />
            Ещё кабинет
          </button>
        </>
      )}

      {/* key заставляет форму пересоздаться при смене кабинета — поля не
          «перетекают» из предыдущего открытия. */}
      {formOpen && (
        <AccountForm
          key={editing?.id ?? 'new'}
          onClose={() => setFormOpen(false)}
          marketplace={marketplace}
          editing={editing}
        />
      )}
    </div>
  );
}
