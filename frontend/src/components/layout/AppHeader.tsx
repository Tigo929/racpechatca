import { Link, useLocation } from 'react-router-dom';
import {
  Printer, RefreshCw, LogOut, Users, Camera, Shirt, Wallet, Boxes,
  BarChart3, Bell, Plus,
} from 'lucide-react';
import { useAuth } from '../../context/useAuth';

interface Props {
  /** Обновить текущий список — кнопка рядом с разделами. */
  onRefresh?: () => void;
  /** Создать заявку — показываем только там, где это уместно. */
  onCreate?: () => void;
  /** Сколько обращений ждёт разбора — бейдж на разделе. */
  leadCount?: number;
}

/**
 * Общая шапка со списком разделов. Раньше навигация была продублирована
 * внутри каждой страницы, из-за чего разделы выглядели по-разному.
 * Продукт здесь — самостоятельный раздел, а не фильтр внутри общего списка.
 */
export function AppHeader({ onRefresh, onCreate, leadCount = 0 }: Props) {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const { pathname } = useLocation();

  const sections = [
    { to: '/crm/photo', label: 'Фотопечать', icon: Camera, show: true },
    { to: '/crm/tshirt', label: 'Футболки', icon: Shirt, show: true },
    { to: '/crm/leads', label: 'Обращения', icon: Bell, show: isAdmin, badge: leadCount },
  ].filter((s) => s.show);

  const tools = [
    { to: '/crm/stock', label: 'Склад', icon: Boxes },
    { to: '/crm/salary', label: 'Зарплата', icon: Wallet },
    { to: '/crm/reports', label: 'Отчёты', icon: BarChart3 },
    { to: '/crm/users', label: 'Пользователи', icon: Users },
  ];

  return (
    <header
      className="sticky top-0 z-20"
      style={{
        background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)',
        boxShadow: '0 1px 0 rgba(255,255,255,0.06), 0 4px 24px rgba(30,27,75,0.4)',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', boxShadow: '0 2px 8px rgba(217,119,6,0.5)' }}
          >
            <Printer size={17} className="text-white" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-white leading-none tracking-tight">
              Распечатка <span style={{ color: '#FCD34D' }}>PRO</span>
            </h1>
            <p className="text-xs mt-0.5 truncate" style={{ color: '#A5B4FC' }}>
              {user?.username} · {isAdmin ? 'Администратор' : 'Исполнитель'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {onRefresh && (
            <button
              onClick={onRefresh}
              aria-label="Обновить список"
              className="p-2 text-indigo-300 hover:text-white rounded-lg hover:bg-indigo-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <RefreshCw size={15} aria-hidden="true" />
            </button>
          )}
          {isAdmin && tools.map((t) => (
            <Link
              key={t.to}
              to={t.to}
              aria-label={t.label}
              title={t.label}
              className="p-2 text-indigo-300 hover:text-amber-400 rounded-lg hover:bg-indigo-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <t.icon size={15} aria-hidden="true" />
            </Link>
          ))}
          {isAdmin && onCreate && (
            <button
              onClick={onCreate}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <Plus size={15} aria-hidden="true" />
              <span className="hidden sm:inline">Новая заявка</span>
            </button>
          )}
          <button
            onClick={logout}
            aria-label="Выйти из системы"
            className="p-2 text-indigo-300 hover:text-red-400 rounded-lg hover:bg-indigo-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <LogOut size={15} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Разделы: продукт — самостоятельное место, а не фильтр */}
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-1 overflow-x-auto">
        {sections.map((s) => {
          const active = pathname === s.to;
          return (
            <Link
              key={s.to}
              to={s.to}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                active
                  ? 'bg-[var(--brand-bg)] text-indigo-900'
                  : 'text-indigo-200 hover:text-white hover:bg-indigo-800/60'
              }`}
            >
              <s.icon size={15} aria-hidden="true" />
              {s.label}
              {!!s.badge && s.badge > 0 && (
                <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[11px] font-bold tabular-nums ${
                  active ? 'bg-amber-500 text-white' : 'bg-amber-400 text-amber-950'
                }`}>
                  {s.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
