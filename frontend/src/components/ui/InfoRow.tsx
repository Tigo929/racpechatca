import { Pencil } from 'lucide-react';

interface Props {
  label: string;
  value: React.ReactNode;
  className?: string;
  /**
   * Открыть правку прямо отсюда.
   *
   * Кнопка «Изменить» живёт в шапке карточки, а поля вроде способа доставки
   * и её стоимости — внизу, за списком позиций. Доскроллив до них, человек
   * видит значения и не видит, чем их поправить: путь наверх и обратно он
   * должен угадать. Поэтому строка, которую можно править, сама и открывает
   * правку.
   */
  onEdit?: () => void;
}

export function InfoRow({ label, value, className = '', onEdit }: Props) {
  const body =
    typeof value === 'string' ? (
      <p className="text-sm font-medium text-gray-800 mt-0.5">{value}</p>
    ) : (
      <div className="mt-0.5">{value}</div>
    );

  if (!onEdit) {
    return (
      <div className={className}>
        <p className="text-xs text-gray-400">{label}</p>
        {body}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onEdit}
      title={`Изменить: ${label}`}
      className={`group -mx-2 -my-1 rounded-lg px-2 py-1 text-left transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${className}`}
    >
      <p className="flex items-center gap-1 text-xs text-gray-400">
        {label}
        <Pencil
          size={10}
          aria-hidden="true"
          className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        />
      </p>
      {body}
    </button>
  );
}
