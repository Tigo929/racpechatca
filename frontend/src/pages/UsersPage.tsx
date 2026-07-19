import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, Trash2, X, Check, ArrowLeft, Pencil, ToggleLeft, ToggleRight, Send, Layers, PackageCheck, AlarmClock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { usersApi } from '../api/users';
import { useAuth } from '../context/useAuth';
import type { AppUser, EnumRole } from '../types/index';
import { getErrorMessage } from '../utils/get-error-message';

const inputCls =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:border-transparent';

const ROLE_LABELS: Record<EnumRole, string> = {
  ADMIN: 'Администратор',
  EXECUTOR: 'Исполнитель',
};
const ROLE_COLORS: Record<EnumRole, string> = {
  ADMIN: 'bg-indigo-100 text-indigo-800',
  EXECUTOR: 'bg-gray-100 text-gray-600',
};

function bpToPercent(bp: number): string {
  return (bp / 100).toFixed(2);
}

/** Цвет бейджа загрузки: чем больше активных заказов, тем «горячее». */
function loadBadgeColor(count: number): string {
  if (count === 0) return 'bg-gray-100 text-gray-400 border-gray-200';
  if (count <= 3) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (count <= 6) return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-red-50 text-red-700 border-red-200';
}

function percentToBp(pct: string): number {
  return Math.round(parseFloat(pct) * 100);
}

interface RateEditorProps {
  user: AppUser;
  onClose: () => void;
}

function RateEditor({ user, onClose }: RateEditorProps) {
  const qc = useQueryClient();
  const [rate, setRate] = useState(
    user.rateBasisPoints === null ? '' : bpToPercent(user.rateBasisPoints),
  );

  const mutation = useMutation({
    mutationFn: (rateBasisPoints: number) =>
      usersApi.update(user.id, { rateBasisPoints }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('Ставка обновлена');
      onClose();
    },
    onError: (error: unknown) => toast.error(getErrorMessage(error, 'Ошибка')),
  });

  const bp = percentToBp(rate);
  const valid = !isNaN(bp) && bp >= 0 && bp <= 10000;

  return (
    <div className="flex items-center gap-2 mt-2">
      <div className="relative flex-1">
        <input
          type="number"
          min="0"
          max="100"
          step="0.01"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          className="w-full rounded-lg border border-amber-300 px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 pr-7"
          placeholder="30.00"
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
      </div>
      <button
        onClick={() => mutation.mutate(bp)}
        disabled={mutation.isPending || !valid}
        className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
      >
        <Check size={13} /> {mutation.isPending ? '…' : 'Сохранить'}
      </button>
      <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600">
        <X size={14} />
      </button>
    </div>
  );
}

interface TelegramEditorProps {
  user: AppUser;
  onClose: () => void;
}

function TelegramEditor({ user, onClose }: TelegramEditorProps) {
  const qc = useQueryClient();
  const [username, setUsername] = useState(user.telegramUsername ?? '');

  const mutation = useMutation({
    mutationFn: (telegramUsername: string | null) =>
      usersApi.update(user.id, { telegramUsername }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('Telegram-юзернейм сохранён');
      onClose();
    },
    onError: (error: unknown) => toast.error(getErrorMessage(error, 'Ошибка')),
  });

  return (
    <div className="flex flex-col gap-2 mt-2">
      <p className="text-xs text-gray-500">
        Юзернейм в Telegram — бот тегнёт его в общей группе при назначении заказа.
        Исполнитель должен состоять в группе.
      </p>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">@</span>
          <input
            type="text"
            value={username.replace(/^@/, '')}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-lg border border-sky-300 pl-6 pr-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            placeholder="username"
          />
        </div>
        <button
          onClick={() => mutation.mutate(username.trim() || null)}
          disabled={mutation.isPending}
          className="flex items-center gap-1 px-3 py-1.5 bg-sky-600 text-white text-sm rounded-lg hover:bg-sky-700 disabled:opacity-50"
        >
          <Check size={13} /> {mutation.isPending ? '…' : 'Сохранить'}
        </button>
        {user.telegramUsername && (
          <button
            onClick={() => mutation.mutate(null)}
            disabled={mutation.isPending}
            className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 text-sm rounded-lg hover:bg-red-100 disabled:opacity-50"
            title="Отвязать Telegram"
          >
            <X size={13} />
          </button>
        )}
        <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

export function UsersPage() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editingRateId, setEditingRateId] = useState<string | null>(null);
  const [editingTelegramId, setEditingTelegramId] = useState<string | null>(null);
  const [form, setForm] = useState({ username: '', password: '', role: 'EXECUTOR' as EnumRole });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.getAll,
  });

  const createMutation = useMutation({
    mutationFn: () => usersApi.create(form.username, form.password, form.role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setAdding(false);
      setForm({ username: '', password: '', role: 'EXECUTOR' });
      toast.success('Пользователь создан');
    },
    onError: (error: unknown) => toast.error(getErrorMessage(error, 'Ошибка')),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      usersApi.update(id, { isActive }),
    onSuccess: (_, { isActive }) => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success(isActive ? 'Пользователь активирован' : 'Пользователь деактивирован');
    },
    onError: () => toast.error('Ошибка'),
  });

  const deleteMutation = useMutation({
    mutationFn: usersApi.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('Удалён');
    },
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, 'Ошибка удаления')),
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-indigo-950 border-b border-indigo-900">
        <div className="max-w-2xl mx-auto px-4 py-3.5 flex items-center gap-3">
          <Link
            to="/crm"
            className="p-1.5 text-indigo-300 hover:text-white rounded-lg hover:bg-indigo-800 transition-colors"
          >
            <ArrowLeft size={16} />
          </Link>
          <h1 className="text-sm font-bold text-white">Пользователи</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto py-6 px-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500">
            {users.length} пользователей
            {(() => {
              const executors = (users as AppUser[]).filter((u) => u.role === 'EXECUTOR');
              const totalInWork = executors.reduce((s, u) => s + (u.activeOrdersCount ?? 0), 0);
              return totalInWork > 0 ? (
                <> · <span className="font-medium text-gray-700">{totalInWork} заказов в работе</span></>
              ) : null;
            })()}
          </p>
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <Plus size={14} /> Добавить
          </button>
        </div>

        {adding && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mb-4 space-y-3">
            <p className="text-xs font-semibold text-amber-700">Новый пользователь</p>
            <div>
              <label htmlFor="new-user-username" className="block text-xs font-medium text-amber-700 mb-1">Логин</label>
              <input
                id="new-user-username"
                name="username"
                autoComplete="off"
                spellCheck={false}
                className={inputCls}
                placeholder="Логин…"
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
              />
            </div>
            <div>
              <label htmlFor="new-user-password" className="block text-xs font-medium text-amber-700 mb-1">Пароль</label>
              <input
                id="new-user-password"
                name="password"
                type="password"
                autoComplete="new-password"
                className={inputCls}
                placeholder="Мин. 4 символа"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              />
            </div>
            <div>
              <label htmlFor="new-user-role" className="block text-xs font-medium text-amber-700 mb-1">Роль</label>
              <select
                id="new-user-role"
                name="role"
                className={inputCls}
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as EnumRole }))}
              >
                <option value="EXECUTOR">Исполнитель</option>
                <option value="ADMIN">Администратор</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !form.username || form.password.length < 4}
                className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                <Check size={13} aria-hidden="true" /> {createMutation.isPending ? 'Создаём…' : 'Создать'}
              </button>
              <button
                onClick={() => setAdding(false)}
                className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200"
              >
                <X size={13} /> Отмена
              </button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {(users as AppUser[]).map((u) => (
            <div
              key={u.id}
              className={`bg-white border rounded-xl shadow-sm px-4 py-3 ${
                u.isActive === false ? 'opacity-60 border-red-100' : 'border-gray-100'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                {/* Left: name + role */}
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-semibold text-gray-900 truncate">{u.username}</span>
                  {u.id === me?.id && <span className="text-xs text-gray-400 shrink-0">(вы)</span>}
                  {u.isActive === false && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-600 font-medium shrink-0">неактивен</span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${ROLE_COLORS[u.role]}`}>
                    {ROLE_LABELS[u.role]}
                  </span>
                </div>

                {/* Right: rate badge + actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {u.role === 'EXECUTOR' && (
                    <>
                      <span
                        className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${loadBadgeColor(u.activeOrdersCount ?? 0)}`}
                        title="Заказов сейчас в работе — считаются до статуса «Готов»"
                      >
                        <Layers size={10} />
                        {(u.activeOrdersCount ?? 0) === 0 ? 'свободен' : `${u.activeOrdersCount} в работе`}
                      </span>
                      {(u.readyOrdersCount ?? 0) > 0 && (
                        <span
                          className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium bg-sky-50 text-sky-700 border-sky-200"
                          title="Готовые заказы — работа сдана, ждут выдачи или отправки"
                        >
                          <PackageCheck size={10} />
                          {u.readyOrdersCount} готово
                        </span>
                      )}
                      {(u.stalledOrdersCount ?? 0) > 0 && (
                        <span
                          className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium bg-red-50 text-red-700 border-red-200"
                          title="Заказы в работе, статус которых не менялся более 3 дней"
                        >
                          <AlarmClock size={10} />
                          {u.stalledOrdersCount} зависло
                        </span>
                      )}
                      <button
                        onClick={() => setEditingRateId(editingRateId === u.id ? null : u.id)}
                        className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors font-mono"
                        title="Изменить ставку"
                      >
                        {u.rateBasisPoints === null
                          ? 'Ставка не назначена'
                          : `${bpToPercent(u.rateBasisPoints)}%`}
                        <Pencil size={10} />
                      </button>
                      <button
                        onClick={() => setEditingTelegramId(editingTelegramId === u.id ? null : u.id)}
                        className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition-colors ${
                          u.telegramUsername
                            ? 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100'
                            : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'
                        }`}
                        title={u.telegramUsername ? `Telegram: @${u.telegramUsername}` : 'Привязать Telegram'}
                      >
                        <Send size={10} />
                        {u.telegramUsername ? `@${u.telegramUsername}` : 'TG не привязан'}
                      </button>
                    </>
                  )}

                  {u.id !== me?.id && (
                    <>
                      <button
                        onClick={() =>
                          toggleActiveMutation.mutate({ id: u.id, isActive: !u.isActive })
                        }
                        disabled={toggleActiveMutation.isPending}
                        title={u.isActive ? 'Деактивировать' : 'Активировать'}
                        className="text-gray-400 hover:text-indigo-500 p-1 transition-colors"
                      >
                        {u.isActive ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Удалить пользователя ${u.username}?`))
                            deleteMutation.mutate(u.id);
                        }}
                        disabled={deleteMutation.isPending}
                        className="text-gray-400 hover:text-red-500 p-1 transition-colors"
                        title="Удалить"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Rate editor (inline) */}
              {editingRateId === u.id && (
                <RateEditor user={u} onClose={() => setEditingRateId(null)} />
              )}

              {/* Telegram Chat ID editor (inline) */}
              {editingTelegramId === u.id && (
                <TelegramEditor user={u} onClose={() => setEditingTelegramId(null)} />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
