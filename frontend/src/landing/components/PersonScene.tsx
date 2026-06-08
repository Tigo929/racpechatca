interface PersonSceneProps {
  /** Цвет футболки на человеке */
  color?: string;
  /** Цвет принта на груди */
  ink?: string;
  className?: string;
}

/**
 * Заглушка галереи с фокусом на человеке (не на товаре): силуэт человека
 * в футболке с принтом. Векторная — не грузит сеть и не даёт CLS.
 * Заменяется реальной фотографией через поле `src` в portfolio.ts.
 */
export function PersonScene({ color = '#312E81', ink = '#FFFFFF', className = '' }: PersonSceneProps) {
  return (
    <svg viewBox="0 0 240 240" className={className} role="img" aria-label="Человек в футболке с принтом">
      <defs>
        <linearGradient id="ps-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#EEF2FF" />
          <stop offset="100%" stopColor="#F4F2EC" />
        </linearGradient>
      </defs>
      <rect width="240" height="240" fill="url(#ps-bg)" />
      {/* Голова */}
      <circle cx="120" cy="70" r="30" fill="#CBB89D" />
      {/* Волосы */}
      <path d="M90 66 Q92 38 120 38 Q148 38 150 66 Q150 52 120 50 Q90 52 90 66 Z" fill="#3A2E2A" />
      {/* Плечи + футболка */}
      <path
        d="M64 240 L66 150 Q66 120 96 110 L120 122 L144 110 Q174 120 174 150 L176 240 Z"
        fill={color}
        stroke="rgba(15,23,42,0.10)"
        strokeWidth="1.5"
      />
      {/* Шея */}
      <path d="M104 104 L120 122 L136 104 Z" fill="#BBA88E" />
      {/* Принт на груди */}
      <rect x="100" y="140" width="40" height="46" rx="5" fill={ink} opacity="0.92" />
      <rect x="108" y="150" width="24" height="4" rx="2" fill={color} opacity="0.7" />
      <rect x="108" y="160" width="18" height="4" rx="2" fill={color} opacity="0.5" />
    </svg>
  );
}
