interface Props {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  small?: boolean;
}

export function FilterChip({ children, active, onClick, small }: Props) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`
        rounded-lg font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1
        ${small ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-xs'}
        ${active
          ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
          : 'bg-white text-gray-500 hover:text-gray-800 hover:bg-gray-50 border border-gray-200'
        }
      `}
    >
      {children}
    </button>
  );
}
