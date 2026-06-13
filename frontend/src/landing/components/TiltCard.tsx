import { useRef, type ReactNode, type MouseEvent } from 'react';
import { motion, useMotionValue, useSpring, useTransform, type MotionValue } from 'motion/react';

interface Props {
  children: ReactNode;
  className?: string;
  maxTilt?: number;
}

export function TiltCard({ children, className = '', maxTilt = 12 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [maxTilt, -maxTilt]), { stiffness: 200, damping: 20 });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-maxTilt, maxTilt]), { stiffness: 200, damping: 20 });
  const glowX = useTransform(x, [-0.5, 0.5], [0, 100]);
  const glowY = useTransform(y, [-0.5, 0.5], [0, 100]);

  const onMove = (e: MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    x.set((e.clientX - r.left) / r.width - 0.5);
    y.set((e.clientY - r.top) / r.height - 0.5);
  };

  const onLeave = () => { x.set(0); y.set(0); };

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      whileHover={{ y: -8, boxShadow: '0 28px 56px -20px rgba(30,27,75,0.28)' }}
      transition={{ type: 'spring', stiffness: 200, damping: 22 }}
      style={{
        rotateX,
        rotateY,
        transformPerspective: 800,
      }}
      className={`relative ${className}`}
    >
      {children}
      {/* Световой блик */}
      <GlowOverlay glowX={glowX} glowY={glowY} />
    </motion.div>
  );
}

function GlowOverlay({
  glowX,
  glowY,
}: {
  glowX: MotionValue<number>;
  glowY: MotionValue<number>;
}) {
  const bg = useTransform(
    () =>
      `radial-gradient(circle at ${glowX.get()}% ${glowY.get()}%, rgba(255,255,255,0.13) 0%, transparent 65%)`,
  );
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute inset-0 rounded-2xl"
      style={{ background: bg }}
    />
  );
}
