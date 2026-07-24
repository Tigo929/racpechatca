import {
  BarChart3,
  Bell,
  Camera,
  CheckSquare,
  MessageCircle,
  Settings,
  Shirt,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { EnumRole as Role } from '../../types/index';

/**
 * Единственное место, где описана навигация CRM. Новый модуль — одна строка
 * здесь, и он сам появится в боковом меню, в мобильном меню и в поиске по
 * разделам. Раньше пункты были размазаны по шапке и по страницам, поэтому
 * разделы выглядели и вели себя по-разному.
 */

export type BadgeKey = 'leads' | 'tasks';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Кому пункт виден. Сервер проверяет права отдельно — это только меню. */
  roles: Role[];
  /** Счётчик рядом с пунктом. */
  badge?: BadgeKey;
  /** Показывать в нижней панели на телефоне. */
  primary?: boolean;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

const ALL: Role[] = ['ADMIN', 'EXECUTOR', 'ORDER_MANAGER'];
const ADMIN: Role[] = ['ADMIN'];
// Заказами менеджер по оформлению управляет наравне с админом.
const AD_MGR: Role[] = ['ADMIN', 'ORDER_MANAGER'];
// «Личный кабинет» по деньгам — у тех, кому начисляется зарплата.
const SALARIED: Role[] = ['EXECUTOR', 'ORDER_MANAGER'];

export const NAV_GROUPS: NavGroup[] = [
  {
    // Ежедневная работа — то, что открывают каждый день.
    title: 'Работа',
    items: [
      {
        to: '/crm/photo',
        label: 'Фотопечать',
        icon: Camera,
        roles: ALL,
        primary: true,
      },
      {
        to: '/crm/tshirt',
        label: 'Футболки',
        icon: Shirt,
        roles: AD_MGR,
        primary: true,
      },
      {
        to: '/crm/avito',
        label: 'Avito',
        icon: MessageCircle,
        roles: AD_MGR,
        primary: true,
      },
      {
        to: '/crm/leads',
        label: 'Обращения',
        icon: Bell,
        roles: AD_MGR,
        badge: 'leads',
      },
      {
        to: '/crm/tasks',
        label: 'Задачи',
        icon: CheckSquare,
        roles: ALL,
        badge: 'tasks',
        primary: true,
      },
    ],
  },
  {
    // Управление — «управляющие позиции»: доступны только администратору.
    // Менеджер по оформлению сюда не заходит.
    title: 'Управление',
    items: [
      { to: '/crm/salary', label: 'Зарплата', icon: Wallet, roles: ADMIN },
      { to: '/crm/reports', label: 'Отчёты', icon: BarChart3, roles: ADMIN },
      { to: '/crm/users', label: 'Сотрудники', icon: Users, roles: ADMIN },
      { to: '/crm/settings', label: 'Настройки', icon: Settings, roles: ADMIN },
    ],
  },
  {
    title: 'Личное',
    items: [
      {
        to: '/crm/my-salary',
        label: 'Моя зарплата',
        icon: Wallet,
        roles: SALARIED,
        primary: true,
      },
    ],
  },
];

/** Группы, отфильтрованные по роли: пустые группы не показываем. */
export function navGroupsFor(role: Role | undefined): NavGroup[] {
  if (!role) return [];
  return NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => i.roles.includes(role)),
  })).filter((g) => g.items.length > 0);
}

/**
 * Пункты нижней панели на телефоне. Их максимум четыре — дальше кнопки
 * становятся слишком узкими для пальца, остальное уезжает в «Ещё».
 */
export const MOBILE_BAR_LIMIT = 4;

export function primaryNavFor(role: Role | undefined): NavItem[] {
  return navGroupsFor(role)
    .flatMap((g) => g.items)
    .filter((i) => i.primary)
    .slice(0, MOBILE_BAR_LIMIT);
}
