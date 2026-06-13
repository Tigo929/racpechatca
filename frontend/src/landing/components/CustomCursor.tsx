import { useCallback, useEffect, useRef } from 'react';
import { motion, useMotionValue, useSpring } from 'motion/react';

export function CustomCursor() {
  const cursorX = useMotionValue(-100);
  const cursorY = useMotionValue(-100);
  const dotX = useMotionValue(-100);
  const dotY = useMotionValue(-100);

  // Кольцо — с инерцией
  const springX = useSpring(cursorX, { stiffness: 80, damping: 20, mass: 0.6 });
  const springY = useSpring(cursorY, { stiffness: 80, damping: 20, mass: 0.6 });

  // Точка — почти мгновенно
  const dotSpringX = useSpring(dotX, { stiffness: 600, damping: 35 });
  const dotSpringY = useSpring(dotY, { stiffness: 600, damping: 35 });

  // Состояние hover над кликабельным
  const ringSize = useMotionValue(52);
  const ringBg = useMotionValue('rgba(217,119,6,0)');
  const ringBorder = useMotionValue('rgba(217,119,6,0.55)');
  const dotSize = useMotionValue(12);
  const dotBg = useMotionValue('#D97706');

  const sprRingSize = useSpring(ringSize, { stiffness: 220, damping: 22 });
  const sprDotSize  = useSpring(dotSize,  { stiffness: 220, damping: 22 });

  const isHoveringRef = useRef(false);

  const setHover = useCallback((on: boolean) => {
    if (isHoveringRef.current === on) return;
    isHoveringRef.current = on;
    if (on) {
      // Кольцо схлопывается и заполняется — «нажми»
      ringSize.set(28);
      ringBg.set('rgba(217,119,6,0.18)');
      ringBorder.set('rgba(217,119,6,0.9)');
      dotSize.set(6);
      dotBg.set('#fff');
    } else {
      ringSize.set(52);
      ringBg.set('rgba(217,119,6,0)');
      ringBorder.set('rgba(217,119,6,0.55)');
      dotSize.set(12);
      dotBg.set('#D97706');
    }
  }, [dotBg, dotSize, ringBg, ringBorder, ringSize]);

  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return;

    const onMove = (e: MouseEvent) => {
      cursorX.set(e.clientX);
      cursorY.set(e.clientY);
      dotX.set(e.clientX);
      dotY.set(e.clientY);

      // Проверяем элемент под курсором
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const clickable = el?.closest('button, a, [role="button"], input, textarea, select, label');
      setHover(!!clickable);
    };

    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [cursorX, cursorY, dotX, dotY, setHover]);

  return (
    <>
      {/* Кольцо с инерцией */}
      <motion.div
        className="cursor-ring"
        style={{
          x: springX,
          y: springY,
          translateX: '-50%',
          translateY: '-50%',
          width: sprRingSize,
          height: sprRingSize,
          background: ringBg,
          borderColor: ringBorder,
        }}
      />
      {/* Точка */}
      <motion.div
        className="cursor-dot"
        style={{
          x: dotSpringX,
          y: dotSpringY,
          translateX: '-50%',
          translateY: '-50%',
          width: sprDotSize,
          height: sprDotSize,
          backgroundColor: dotBg,
        }}
      />
    </>
  );
}
