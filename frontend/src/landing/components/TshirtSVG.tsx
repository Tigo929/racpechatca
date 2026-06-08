interface TshirtSVGProps {
  /** Цвет ткани */
  color?: string;
  /** Цвет принта/контента на груди */
  ink?: string;
  /** Содержимое области принта (текст/иконка) */
  printLabel?: string;
  className?: string;
  /** Показать пунктирную область печати */
  showPrintArea?: boolean;
}

/**
 * Векторная футболка для превью и конструктора. Без растровых картинок —
 * не грузит сеть, не даёт CLS, цвета анимируются через CSS (.shirt-fill).
 */
export function TshirtSVG({
  color = '#FFFFFF',
  ink = '#1E1B4B',
  printLabel,
  className = '',
  showPrintArea = false,
}: TshirtSVGProps) {
  return (
    <svg
      viewBox="0 0 240 260"
      className={className}
      role="img"
      aria-label="Превью футболки с принтом"
    >
      <defs>
        <filter id="tsh-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="8" stdDeviation="10" floodColor="#1E1B4B" floodOpacity="0.18" />
        </filter>
      </defs>
      {/* Силуэт футболки */}
      <path
        className="shirt-fill"
        filter="url(#tsh-shadow)"
        fill={color}
        stroke="rgba(15,23,42,0.12)"
        strokeWidth="1.5"
        d="M82 26 L52 44 L30 78 L48 98 L66 86 L66 232 Q66 240 74 240 L166 240 Q174 240 174 232 L174 86 L192 98 L210 78 L188 44 L158 26 Q140 46 120 46 Q100 46 82 26 Z"
      />
      {/* Воротник */}
      <path
        fill="none"
        stroke="rgba(15,23,42,0.16)"
        strokeWidth="2"
        d="M84 28 Q120 56 156 28"
      />
      {/* Область печати */}
      {showPrintArea && (
        <rect
          x="86" y="92" width="68" height="86" rx="6"
          fill="none"
          stroke={ink}
          strokeOpacity="0.45"
          strokeWidth="1.5"
          strokeDasharray="5 5"
        />
      )}
      {printLabel && (
        <text
          className="shirt-ink"
          x="120" y="140"
          textAnchor="middle"
          fontSize="18"
          fontWeight="700"
          fill={ink}
          fontFamily="Inter, sans-serif"
        >
          {printLabel}
        </text>
      )}
    </svg>
  );
}
