import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { ArrowLeft, Package, Boxes } from 'lucide-react';
import { stockApi } from '../api/stock';
import type { EnumTshirtSize, TshirtStock } from '../types/index';
import { getErrorMessage } from '../utils/get-error-message';

const SIZES: EnumTshirtSize[] = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
const SIZE_LABELS: Record<string, string> = { XXXL: '3XL' };
const COLORS = [
  { name: 'Белый', dot: '#FFFFFF', ring: '#E2E8F0' },
  { name: 'Чёрный', dot: '#111827', ring: '#111827' },
];

const key = (size: string, color: string) => `${size}|${color}`;

/** Одна ячейка остатка: ввод + сохранение по уходу с поля. */
function StockCell({
  size,
  color,
  value,
  onSave,
  saving,
}: {
  size: EnumTshirtSize;
  color: string;
  value: number;
  onSave: (size: EnumTshirtSize, color: string, quantity: number) => void;
  saving: boolean;
}) {
  const [draft, setDraft] = useState(String(value));
  // Синхронизируем поле, когда сервер вернул новое значение (паттерн React).
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setDraft(String(value));
  }

  const commit = () => {
    const q = Math.max(0, Math.floor(Number(draft) || 0));
    if (q !== value) onSave(size, color, q);
    else setDraft(String(value));
  };

  const empty = value === 0;
  return (
    <input
      type="number"
      min={0}
      value={draft}
      disabled={saving}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      className={`w-24 text-center rounded-lg border px-3 py-2 text-base font-semibold tabular-nums transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 ${
        empty ? 'border-red-200 bg-red-50 text-red-600' : 'border-gray-200 text-gray-900'
      }`}
    />
  );
}

export default function StockPage() {
  const qc = useQueryClient();
  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ['stock'],
    queryFn: stockApi.list,
  });

  const [savingKey, setSavingKey] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: stockApi.setQuantity,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['stock'] });
      toast.success('Остаток сохранён');
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Не удалось сохранить остаток')),
    onSettled: () => setSavingKey(null),
  });

  const byKey = new Map<string, TshirtStock>();
  for (const r of rows) byKey.set(key(r.size, r.color), r);

  const qtyOf = (size: string, color: string) => byKey.get(key(size, color))?.quantity ?? 0;
  const total = rows.reduce((s, r) => s + r.quantity, 0);

  const save = (size: EnumTshirtSize, color: string, quantity: number) => {
    setSavingKey(key(size, color));
    mutation.mutate({ size, color, quantity });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10" style={{ background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)' }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <Link to="/crm" className="p-2 -ml-2 text-indigo-300 hover:text-white rounded-lg hover:bg-indigo-800 transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <Boxes size={18} className="text-amber-400" />
          <h1 className="text-base font-bold text-white">Склад футболок</h1>
          <span className="ml-auto text-xs text-indigo-200">Всего на складе: <b className="text-white tabular-nums">{total}</b> шт</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        {isLoading ? (
          <div className="flex justify-center py-20 text-gray-400">Загрузка…</div>
        ) : error ? (
          <div className="flex justify-center py-20 text-red-500">Ошибка загрузки склада</div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
              <Package size={16} className="text-gray-400" />
              <p className="text-sm text-gray-500">Укажите наличие по размеру и цвету. При отправке заказа остаток уменьшается автоматически.</p>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-5 py-3 text-left">Размер</th>
                  {COLORS.map((c) => (
                    <th key={c.name} className="px-5 py-3 text-center">
                      <span className="inline-flex items-center gap-2">
                        <span className="w-3.5 h-3.5 rounded-full border" style={{ background: c.dot, borderColor: c.ring }} />
                        {c.name}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {SIZES.map((size) => (
                  <tr key={size} className="hover:bg-gray-50/60">
                    <td className="px-5 py-3 font-bold text-gray-800">{SIZE_LABELS[size] ?? size}</td>
                    {COLORS.map((c) => (
                      <td key={c.name} className="px-5 py-3 text-center">
                        <StockCell
                          size={size}
                          color={c.name}
                          value={qtyOf(size, c.name)}
                          onSave={save}
                          saving={savingKey === key(size, c.name)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}
        <p className="text-xs text-gray-400 mt-3 text-center">
          Красным выделены позиции с нулевым остатком — их нельзя будет отправить.
        </p>
      </main>
    </div>
  );
}
