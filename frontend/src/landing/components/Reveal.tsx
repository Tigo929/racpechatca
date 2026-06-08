import { useRef, type ReactNode } from 'react';
import { motion, useInView } from 'motion/react';

interface RevealProps {
  children: ReactNode;
  delay?: number;
  variant?: 'up' | 'fade' | 'scale' | 'left' | 'right';
  className?: string;
  as?: 'div' | 'section' | 'article' | 'li';
  once?: boolean;
}

const VARIANTS = {
  up:    { hidden: { opacity: 0, y: 36 },        visible: { opacity: 1, y: 0 } },
  fade:  { hidden: { opacity: 0 },               visible: { opacity: 1 } },
  scale: { hidden: { opacity: 0, scale: 0.93 },  visible: { opacity: 1, scale: 1 } },
  left:  { hidden: { opacity: 0, x: -36 },       visible: { opacity: 1, x: 0 } },
  right: { hidden: { opacity: 0, x: 36 },        visible: { opacity: 1, x: 0 } },
};

const SPRING = { type: 'spring', stiffness: 70, damping: 18, mass: 0.9 };

export function Reveal({
  children,
  delay = 0,
  variant = 'up',
  className = '',
  as: Tag = 'div',
  once = true,
}: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref as React.RefObject<Element>, {
    once,
    margin: '0px 0px -60px 0px',
  });

  const MotionTag = motion[Tag] as typeof motion.div;

  return (
    <MotionTag
      ref={ref as never}
      className={className}
      variants={VARIANTS[variant]}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
      transition={{ ...SPRING, delay: delay / 1000 }}
    >
      {children}
    </MotionTag>
  );
}
