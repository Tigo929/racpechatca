import { useState } from 'react';
import { Images, LayoutTemplate } from 'lucide-react';
import { CardGeneratorTab } from './CardGeneratorTab';
import { CardTemplatesTab } from './CardTemplatesTab';

type Tab = 'generator' | 'templates';

const TABS: { key: Tab; label: string; icon: typeof Images }[] = [
  { key: 'generator', label: 'Генерация', icon: Images },
  { key: 'templates', label: 'Шаблоны', icon: LayoutTemplate },
];

/**
 * Раздел «Генератор карточек»: сама генерация и настройка шаблонов.
 *
 * Шаблоны отдельной подвкладкой, а не на одном экране с генерацией: их
 * настраивают один раз, а генерацию запускают постоянно, и мешать редкую
 * настройку с ежедневной работой значит удлинять последнюю.
 */
export function CardsSection() {
  const [tab, setTab] = useState<Tab>('generator');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
              tab === key
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Icon size={14} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'generator' ? <CardGeneratorTab /> : <CardTemplatesTab />}
    </div>
  );
}
