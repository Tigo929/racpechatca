import { useRef, useEffect, useState } from 'react';
import { useInView } from 'motion/react';

interface Props {
  value: string;
  className?: string;
}

function parseValue(raw: string): { prefix: string; num: number | null; suffix: string } {
  const m = raw.match(/^([^\d]*)(\d[\d\s,.]*)(.*)$/);
  if (!m) return { prefix: '', num: null, suffix: raw };
  const num = parseInt(m[2].replace(/[\s,.]/g, ''), 10);
  return { prefix: m[1], num: isNaN(num) ? null : num, suffix: m[3] };
}

export function AnimatedCounter({ value, className }: Props) {
  const { prefix, num, suffix } = parseValue(value);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref as React.RefObject<Element>, { once: true, margin: '0px 0px -40px 0px' });
  const [displayed, setDisplayed] = useState(num !== null ? 0 : null);

  useEffect(() => {
    if (!inView || num === null) return;
    const duration = 1400;
    const start = performance.now();
    const raf = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayed(Math.round(eased * num));
      if (t < 1) requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
  }, [inView, num]);

  if (num === null) return <span className={className}>{value}</span>;

  return (
    <span ref={ref} className={className}>
      {prefix}{displayed?.toLocaleString('ru-RU')}{suffix}
    </span>
  );
}
