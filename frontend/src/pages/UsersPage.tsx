import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, Trash2, X, Check, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { authApi } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import type { EnumRole } from '../types';

const inputCls = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent';
const ROLE_LABELS: Record<EnumRole, string> = { ADMIN: 'Администратор', EXECUTOR: 'Исполнитель' };
const ROLE_COLORS: Record<EnumRole, string> = {
  ADMIN: 'bg-indigo-100 text-indigo-800',
  EXECUTOR: 'bg-gray-100 text-gray-600',
};

export function UsersPage() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', role: 'EXECUTOR' as EnumRole });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: authApi.getUsers,
  });

  const createMutation = useMutation({
    mutationFn: () => authApi.createUser(form.username, form.password, form.role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setAdding(false);
      setForm({ username: '', password: '', role: 'EXECUTOR' });
      toast.success('Пользователь создан');
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Ошибка'),
  });

  const deleteMutation = useMutation({
    mutationFn: authApi.deleteUser,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('Удалён'); },
    onError: () => toast.error('Ошибка удаления'),
  });

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Шапка */}
      <header className="bg-indigo-950 border-b border-indigo-900">
        <div className="max-w-lg mx-auto px-4 py-3.5 flex items-center gap-3">
          <Link to="/" className="p-1.5 text-indigo-300 hover:text-white rounded-lg hover:bg-indigo-800 transition-colors">
            <ArrowLeft size={16} />
          </Link>
          <h1 className="text-sm font-bold text-white">Пользователи</h1>
        </div>
      </header>

      <div className="max-w-lg mx-auto py-6 px-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500">{users.length} пользователей</p>
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
            <input
              className={inputCls} placeholder="Логин" value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
            />
            <input
              type="password" className={inputCls} placeholder="Пароль (мин. 4 символа)"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            />
            <select
              className={inputCls} value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value as EnumRole }))}
            >
              <option value="EXECUTOR">Исполнитель</option>
              <option value="ADMIN">Администратор</option>
            </select>
            <div className="flex gap-2">
              <button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !form.username || form.password.length < 4}
                className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 disabled:opacity-50"
              >
                <Check size={13} /> {createMutation.isPending ? 'Создаём...' : 'Создать'}
              </button>
              <button onClick={() => setAdding(false)}
                className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200">
                <X size={13} /> Отмена
              </button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {users.map(u => (
            <div key={u.id}
              className="flex items-center justify-between px-4 py-3 bg-white border border-gray-100 rounded-xl shadow-sm">
              <div>
                <span className="text-sm font-semibold text-gray-900">{u.username}</span>
                {u.id === me?.id && <span className="ml-2 text-xs text-gray-400">(вы)</span>}
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[u.role]}`}>
                  {ROLE_LABELS[u.role]}
                </span>
                {u.id !== me?.id && (
                  <button
                    onClick={() => deleteMutation.mutate(u.id)}
                    disabled={deleteMutation.isPending}
                    className="text-gray-400 hover:text-red-500 p-1 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
