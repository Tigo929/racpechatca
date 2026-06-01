interface Props {
  label: string;
  value: React.ReactNode;
  className?: string;
}

export function InfoRow({ label, value, className = '' }: Props) {
  return (
    <div className={className}>
      <p className="text-xs text-gray-400">{label}</p>
      {typeof value === 'string' ? (
        <p className="text-sm font-medium text-gray-800 mt-0.5">{value}</p>
      ) : (
        <div className="mt-0.5">{value}</div>
      )}
    </div>
  );
}
