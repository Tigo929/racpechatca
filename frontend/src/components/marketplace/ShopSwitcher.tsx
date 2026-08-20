import { Check, ChevronDown, Store, UserRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { MarketplaceAccount } from '../../api/marketplace';

/**
 * Активный магазин: чьи данные сейчас на экране.
 *
 * У владельца сервиса кабинетов несколько продавцов, и раздел показывает
 * товары ровно одного из них. Раньше выбор был безымянным списком, который
 * появлялся только при двух кабинетах и не говорил, чей магазин открыт —
 * то есть можно было править чужие товары, думая, что свои.
 *
 * Поэтому здесь всегда видно и название магазина, и владельца, а чужой
 * помечен явно. Своих кабинетов у продавца может быть несколько, и тогда
 * переключатель тоже нужен — он не только про «несколько продавцов».
 */
export function ShopSwitcher({
  accounts, accountId, onSelect, showOwners,
}: {
  accounts: MarketplaceAccount[];
  accountId: string;
  onSelect: (id: string) => void;
  /** Показывать владельцев — только админу: продавец видит лишь свои. */
  showOwners: boolean;
}) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const outside = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, []);

  const current = accounts.find((a) => a.id === accountId);
  if (accounts.length === 0) return null;

  // Один кабинет — выбирать не из чего, но чей он, знать всё равно полезно.
  if (accounts.length === 1) {
    return (
      <div className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm">
        <Store size={15} className="text-gray-400" aria-hidden="true" />
        <span className="font-medium text-gray-900">{current?.title}</span>
        {showOwners && <OwnerTag account={current} />}
      </div>
    );
  }

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
      >
        <Store size={15} className="text-gray-400" aria-hidden="true" />
        <span className="text-xs text-gray-500">Магазин</span>
        <span className="font-medium text-gray-900">{current?.title ?? 'не выбран'}</span>
        {showOwners && <OwnerTag account={current} />}
        <ChevronDown size={15} className="text-gray-400" aria-hidden="true" />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 min-w-[280px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          {accounts.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => { onSelect(a.id); setOpen(false); }}
              className={`flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-sm hover:bg-amber-50 ${
                a.id === accountId ? 'bg-amber-50/60' : ''
              }`}
            >
              <span className="min-w-0">
                <span className="block truncate font-medium text-gray-900">{a.title}</span>
                <span className="block truncate text-[11px] text-gray-500">
                  {showOwners ? ownerLabel(a) : `Client-Id ${a.externalId}`}
                  {!a.isActive && ' · отключён'}
                </span>
              </span>
              {a.id === accountId && (
                <Check size={15} className="flex-shrink-0 text-amber-600" aria-hidden="true" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Чей магазин. Свой не подписываем — подпись нужна там, где легко ошибиться. */
function OwnerTag({ account }: { account?: MarketplaceAccount }) {
  if (!account?.owner) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-cyan-100 px-1.5 py-0.5 text-[11px] font-medium text-cyan-800">
      <UserRound size={11} aria-hidden="true" />
      {account.owner.username}
    </span>
  );
}

function ownerLabel(a: MarketplaceAccount): string {
  return a.owner ? `Продавец: ${a.owner.username}` : 'Ваш магазин';
}
