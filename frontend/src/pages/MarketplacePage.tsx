import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { marketplaceApi } from '../api/marketplace';
import {
  PLATFORMS, SECTIONS, platformBySlug, sectionBySlug,
} from '../components/marketplace/sections';
import { ConnectionTab } from '../components/marketplace/ConnectionTab';
import { ProductsTab } from '../components/marketplace/ProductsTab';
import { OrdersTab } from '../components/marketplace/OrdersTab';
import { SoonTab } from '../components/marketplace/SoonTab';

/**
 * Раздел «Маркетплейсы»: кабинеты площадок и работа с ними по API.
 *
 * Страница сама почти ничего не решает — она читает площадку и раздел из
 * адреса, берёт их описания из sections.ts и подставляет нужный экран.
 * Новый раздел добавляется строкой в реестре, а не ветвлением здесь.
 *
 * Адрес держит состояние (`/crm/marketplace/ozon/orders`), поэтому на
 * конкретный раздел можно дать ссылку, работает кнопка «назад» и обновление
 * страницы не сбрасывает выбор — при десятке разделов это уже необходимость.
 */

/** Кабинет выбирается один раз на весь раздел, а не отдельно в каждом экране. */
function useSelectedAccount(platformKey: 'OZON' | 'WB' | 'YANDEX') {
  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['marketplace-accounts', platformKey],
    queryFn: () => marketplaceApi.list(platformKey),
  });
  const [selected, setSelected] = useState('');
  const accountId =
    selected || accounts.find((a) => a.isActive)?.id || accounts[0]?.id || '';
  return { accounts, accountId, setSelected, isLoading };
}

export default function MarketplacePage() {
  const params = useParams<{ platform?: string; section?: string }>();
  const platform = platformBySlug(params.platform);
  const section = sectionBySlug(params.section);
  const { accounts, accountId, setSelected } = useSelectedAccount(platform.key);

  const needsAccount = section.key !== 'connection';
  const showAccountPicker = needsAccount && accounts.length > 1;

  return (
    <AppShell title="Маркетплейсы" subtitle={section.subtitle} width="wide">
      <div className="space-y-5">
        {/* Первый уровень — площадка. Неготовые видны, но выключены: так
            понятно, что раздел рассчитан не только на Ozon. */}
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map((p) => (
            p.ready ? (
              <Link
                key={p.key}
                to={`/crm/marketplace/${p.slug}/${section.slug}`}
                className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  platform.key === p.key
                    ? 'bg-gray-900 text-white'
                    : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {p.label}
              </Link>
            ) : (
              <span
                key={p.key}
                className="px-3.5 py-2 rounded-lg text-sm font-medium bg-gray-50 border border-gray-100 text-gray-300 cursor-not-allowed"
              >
                {p.label}
                <span className="ml-1.5 text-[11px]">скоро</span>
              </span>
            )
          ))}
        </div>

        {/* Второй уровень — раздел работы с площадкой. */}
        <div className="flex flex-wrap gap-1.5 border-b border-gray-200 pb-2">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            return (
              <Link
                key={s.key}
                to={`/crm/marketplace/${platform.slug}/${s.slug}`}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  section.key === s.key
                    ? 'bg-amber-50 text-amber-700 font-medium'
                    : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                <Icon size={15} aria-hidden="true" />
                {s.label}
                {!s.ready && <span className="text-[11px] text-gray-400">скоро</span>}
              </Link>
            );
          })}
        </div>

        {showAccountPicker && (
          <label className="block max-w-xs">
            <span className="text-xs font-medium text-gray-600">Кабинет</span>
            <select
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              value={accountId}
              onChange={(e) => setSelected(e.target.value)}
            >
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
            </select>
          </label>
        )}

        {!section.ready ? (
          <SoonTab text={section.soon ?? ''} />
        ) : section.key === 'connection' ? (
          <ConnectionTab marketplace={platform.key} />
        ) : !accountId ? (
          <NoAccount />
        ) : section.key === 'products' ? (
          <ProductsTab accountId={accountId} />
        ) : (
          <OrdersTab accountId={accountId} />
        )}
      </div>
    </AppShell>
  );
}

function NoAccount() {
  return (
    <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-8 text-center">
      <h3 className="text-sm font-semibold text-gray-900">Сначала подключите кабинет</h3>
      <p className="mt-1 text-xs text-gray-500">
        Раздел работает с конкретным кабинетом площадки — заведите его во вкладке «Подключение».
      </p>
    </div>
  );
}
