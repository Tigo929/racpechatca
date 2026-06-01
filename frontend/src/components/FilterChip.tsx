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
      className={`
        rounded-full font-medium transition-colors
        ${small ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'}
        ${active
          ? 'bg-amber-600 text-white'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }
      `}
    >
      {children}
    </button>
  );
}
