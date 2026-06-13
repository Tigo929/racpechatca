import { useRef, type ReactNode, type MouseEvent } from 'react';
import { motion, useMotionValue, useSpring } from 'motion/react';

interface Props {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  magnetic?: boolean;
  strength?: number;
}

export function RippleButton({ children, className = '', onClick, magnetic = true, strength = 0.3 }: Props) {
  const ref = useRef<HTMLButtonElement>(null);

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 150, damping: 15, mass: 0.5 });
  const sy = useSpring(y, { stiffness: 150, damping: 15, mass: 0.5 });

  const onMove = (e: MouseEvent) => {
    if (!magnetic) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    x.set((e.clientX - r.left - r.width / 2) * strength);
    y.set((e.clientY - r.top - r.height / 2) * strength);
  };

  const onLeave = () => { x.set(0); y.set(0); };

  const onMouseDown = (e: MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const ripple = document.createElement('span');
    const size = Math.max(r.width, r.height) * 2;
    ripple.className = 'ripple-wave';
    ripple.style.cssText = `
      width:${size}px;height:${size}px;
      left:${e.clientX - r.left - size / 2}px;
      top:${e.clientY - r.top - size / 2}px;
    `;
    el.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
  };

  return (
    <motion.button
      ref={ref}
      style={{ x: sx, y: sy }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onMouseDown={onMouseDown}
      onClick={onClick}
      whileTap={{ scale: 0.96 }}
      className={`relative overflow-hidden ${className}`}
    >
      {children}
    </motion.button>
  );
}
