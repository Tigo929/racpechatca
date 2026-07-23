import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LogOut, Menu, MoreHorizontal, Printer, RefreshCw, X } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { ordersApi } from '../../api/orders';
import { tasksApi } from '../../api/tasks';
import {
  navGroupsFor, primaryNavFor, type BadgeKey, type NavItem,
} from './navigation';

interface Props {
  /** Заголовок страницы — показывается в верхней полосе. */
  title: string;
  /** Мелкая строка под заголовком: сводка, количество, подсказка. */
  subtitle?: ReactNode;
  /** Кнопки действий справа в верхней полосе. */
  actions?: ReactNode;
  /** Обновить данные текущей страницы. */
  onRefresh?: () => void;
  /** Ширина контента: списки шире, справочники уже. */
  width?: 'wide' | 'narrow';
  children: ReactNode;
}

const SIDEBAR_W = 232;

/**
 * Общая оболочка CRM: слева разделы, сверху заголовок и действия.
 *
 * Раньше навигация жила иконками без подписей в правом углу шапки, а каждая
 * служебная страница рисовала свою собственную полоску со стрелкой «назад».
 * Из-за этого разделы выглядели по-разному, а места для новых модулей уже
 * не оставалось. Здесь список разделов один на всё приложение и приходит
 * из navigation.ts.
 */
export function AppShell({
  title, subtitle, actions, onRefresh, width = 'wide', children,
}: Props) {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isAdmin = user?.role === 'ADMIN';
  const groups = navGroupsFor(user?.role);
  const primary = primaryNavFor(user?.role);

  // Счётчик обращений: считаем всю входящую воронку, а не текущий раздел,
  // иначе новое обращение можно не заметить, находясь в другом продукте.
  const { data: leadStats } = useQuery({
    queryKey: ['orders', 'stats', 'leads-badge'],
    queryFn: () => ordersApi.getStats({}),
    enabled: isAdmin,
    staleTime: 30_000,
  });
  const { data: taskCount } = useQuery({
    queryKey: ['tasks', 'count'],
    queryFn: tasksApi.count,
    enabled: !!user,
    staleTime: 30_000,
  });

  const badges: Record<BadgeKey, number> = {
    leads: leadStats?.leadCount ?? 0,
    tasks: taskCount?.open ?? 0,
  };
  // Просроченные задачи подсвечиваем красным — это уже не «есть дела»,
  // а «сроки горят», и разница должна быть видна из любого раздела.
  const tasksOverdue = (taskCount?.overdue ?? 0) > 0;

  // Переход между разделами закрывает мобильное меню.
  useEffect(() => setDrawerOpen(false), [pathname]);

  const maxW = width === 'narrow' ? 'max-w-3xl' : 'max-w-7xl';

  return (
    <div className="min-h-screen" style={{ background: 'var(--brand-bg)' }}>
      <Sidebar
        groups={groups}
        badges={badges}
        tasksOverdue={tasksOverdue}
        pathname={pathname}
        user={user}
        onLogout={logout}
      />

      {drawerOpen && (
        <MobileDrawer
          groups={groups}
          badges={badges}
          tasksOverdue={tasksOverdue}
          pathname={pathname}
          user={user}
          onLogout={logout}
          onClose={() => setDrawerOpen(false)}
        />
      )}

      <div className="lg:pl-[232px]">
        <header
          className="sticky top-0 z-20 border-b border-indigo-900/40"
          style={{ background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)' }}
        >
          <div className={`${maxW} mx-auto px-4 sm:px-6 py-3 flex items-center gap-3`}>
            <button
              onClick={() => setDrawerOpen(true)}
              aria-label="Открыть меню"
              className="lg:hidden p-2 -ml-2 text-indigo-200 hover:text-white rounded-lg hover:bg-indigo-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <Menu size={20} aria-hidden="true" />
            </button>

            <div className="min-w-0 flex-1">
              <h1 className="text-base font-bold text-white leading-tight truncate">
                {title}
              </h1>
              {subtitle && (
                <p className="text-xs mt-0.5 truncate" style={{ color: '#A5B4FC' }}>
                  {subtitle}
                </p>
              )}
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              {onRefresh && (
                <button
                  onClick={onRefresh}
                  aria-label="Обновить данные"
                  className="p-2 text-indigo-300 hover:text-white rounded-lg hover:bg-indigo-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                >
                  <RefreshCw size={16} aria-hidden="true" />
                </button>
              )}
              {actions}
            </div>
          </div>
        </header>

        {/* Отступ снизу — чтобы нижняя панель не накрывала последнюю строку */}
        <main className={`${maxW} mx-auto px-4 sm:px-6 py-5 pb-24 lg:pb-8`}>
          {children}
        </main>
      </div>

      <MobileBar
        items={primary}
        badges={badges}
        tasksOverdue={tasksOverdue}
        pathname={pathname}
        onMore={() => setDrawerOpen(true)}
      />
    </div>
  );
}

/* ---------- части оболочки ---------- */

interface NavProps {
  groups: ReturnType<typeof navGroupsFor>;
  badges: Record<BadgeKey, number>;
  tasksOverdue: boolean;
  pathname: string;
  user: { username: string; role: string } | null;
  onLogout: () => void;
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-4 py-4">
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', boxShadow: '0 2px 8px rgba(217,119,6,0.5)' }}
      >
        <Printer size={17} className="text-white" aria-hidden="true" />
      </div>
      <span className="text-sm font-bold text-white tracking-tight">
        Распечатка <span style={{ color: '#FCD34D' }}>PRO</span>
      </span>
    </div>
  );
}

function NavList({ groups, badges, tasksOverdue, pathname }: Omit<NavProps, 'user' | 'onLogout'>) {
  return (
    <nav className="flex-1 overflow-y-auto px-2 pb-4 space-y-5">
      {groups.map((group) => (
        <div key={group.title}>
          <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#6366F1' }}>
            {group.title}
          </p>
          <div className="space-y-0.5">
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                item={item}
                active={pathname === item.to}
                badge={item.badge ? badges[item.badge] : 0}
                danger={item.badge === 'tasks' && tasksOverdue}
              />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

function NavLink({ item, active, badge, danger }: {
  item: NavItem; active: boolean; badge: number; danger: boolean;
}) {
  return (
    <Link
      to={item.to}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
        active
          ? 'bg-amber-500/15 text-amber-300'
          : 'text-indigo-200 hover:text-white hover:bg-indigo-800/60'
      }`}
    >
      <item.icon size={16} aria-hidden="true" className="flex-shrink-0" />
      <span className="truncate">{item.label}</span>
      {badge > 0 && (
        <span
          className={`ml-auto px-1.5 py-0.5 rounded-full text-[11px] font-bold tabular-nums ${
            danger ? 'bg-red-500 text-white' : 'bg-amber-400 text-amber-950'
          }`}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}

function UserBlock({ user, onLogout }: { user: NavProps['user']; onLogout: () => void }) {
  return (
    <div className="border-t border-indigo-800/60 px-3 py-3 flex items-center gap-2">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white truncate">{user?.username}</p>
        <p className="text-xs" style={{ color: '#A5B4FC' }}>
          {user?.role === 'ADMIN'
            ? 'Администратор'
            : user?.role === 'ORDER_MANAGER'
              ? 'Менеджер по оформлению'
              : 'Исполнитель'}
        </p>
      </div>
      <button
        onClick={onLogout}
        aria-label="Выйти из системы"
        className="p-2 text-indigo-300 hover:text-red-400 rounded-lg hover:bg-indigo-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
      >
        <LogOut size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

function Sidebar(props: NavProps) {
  return (
    <aside
      className="hidden lg:flex fixed inset-y-0 left-0 z-30 flex-col border-r border-indigo-900/50"
      style={{ width: SIDEBAR_W, background: 'linear-gradient(180deg, #1E1B4B 0%, #262263 100%)' }}
    >
      <Brand />
      <NavList {...props} />
      <UserBlock user={props.user} onLogout={props.onLogout} />
    </aside>
  );
}

function MobileDrawer({ onClose, ...props }: NavProps & { onClose: () => void }) {
  return (
    <div className="lg:hidden fixed inset-0 z-50 flex">
      <button
        aria-label="Закрыть меню"
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
      />
      <div
        className="relative flex flex-col w-72 max-w-[85vw] h-full shadow-2xl"
        style={{ background: 'linear-gradient(180deg, #1E1B4B 0%, #262263 100%)' }}
      >
        <div className="flex items-center justify-between pr-2">
          <Brand />
          <button
            onClick={onClose}
            aria-label="Закрыть меню"
            className="p-2 text-indigo-300 hover:text-white rounded-lg hover:bg-indigo-800 transition-colors"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <NavList {...props} />
        <UserBlock user={props.user} onLogout={props.onLogout} />
      </div>
    </div>
  );
}

function MobileBar({ items, badges, tasksOverdue, pathname, onMore }: {
  items: NavItem[];
  badges: Record<BadgeKey, number>;
  tasksOverdue: boolean;
  pathname: string;
  onMore: () => void;
}) {
  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-indigo-900/50 flex"
      style={{
        background: 'linear-gradient(180deg, #262263 0%, #1E1B4B 100%)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {items.map((item) => {
        const active = pathname === item.to;
        const badge = item.badge ? badges[item.badge] : 0;
        const danger = item.badge === 'tasks' && tasksOverdue;
        return (
          <Link
            key={item.to}
            to={item.to}
            aria-current={active ? 'page' : undefined}
            className={`relative flex-1 flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors ${
              active ? 'text-amber-300' : 'text-indigo-300'
            }`}
          >
            <item.icon size={19} aria-hidden="true" />
            <span className="truncate max-w-full px-1">{item.label}</span>
            {badge > 0 && (
              <span
                className={`absolute top-1 right-[22%] min-w-[16px] px-1 rounded-full text-[10px] font-bold leading-4 tabular-nums ${
                  danger ? 'bg-red-500 text-white' : 'bg-amber-400 text-amber-950'
                }`}
              >
                {badge}
              </span>
            )}
          </Link>
        );
      })}
      <button
        onClick={onMore}
        aria-label="Все разделы"
        className="flex-1 flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-indigo-300"
      >
        <MoreHorizontal size={19} aria-hidden="true" />
        <span>Ещё</span>
      </button>
    </nav>
  );
}
