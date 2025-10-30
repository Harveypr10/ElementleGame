import { useState, useEffect, useRef, useCallback } from 'react';
import { useMotionValue, animate } from 'framer-motion';
import { useGameMode } from '@/contexts/GameModeContext';

export function useModeController() {
  const { gameMode, setGameMode } = useGameMode();
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  
  const x = useMotionValue(0);

  useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };

    updateWidth();
    
    const resizeObserver = new ResizeObserver(updateWidth);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const snapTo = useCallback((mode: 'global' | 'local') => {
    if (isDesktop) {
      setGameMode(mode);
      return;
    }

    const targetX = mode === 'global' ? 0 : -containerWidth;
    
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    if (prefersReducedMotion) {
      x.set(targetX);
    } else {
      animate(x, targetX, {
        type: 'spring',
        stiffness: 300,
        damping: 30,
        mass: 1,
      });
    }
    
    setGameMode(mode);
  }, [containerWidth, setGameMode, x, isDesktop]);

  useEffect(() => {
    if (!isDesktop && containerWidth > 0) {
      const targetX = gameMode === 'global' ? 0 : -containerWidth;
      x.set(targetX);
    }
  }, [gameMode, containerWidth, x, isDesktop]);

  const handleSwiping = useCallback((deltaX: number) => {
    if (isDesktop || containerWidth === 0) return;
    
    const currentX = x.get();
    const newX = Math.min(0, Math.max(-containerWidth, currentX - deltaX));
    x.set(newX);
  }, [x, containerWidth, isDesktop]);

  const handleSwiped = useCallback(() => {
    if (isDesktop || containerWidth === 0) return;
    
    const currentX = x.get();
    const threshold = containerWidth / 2;
    
    if (Math.abs(currentX) < threshold) {
      snapTo('global');
    } else {
      snapTo('local');
    }
  }, [containerWidth, snapTo, x, isDesktop]);

  return {
    containerRef,
    x,
    gameMode,
    snapTo,
    handleSwiping,
    handleSwiped,
    isDesktop,
  };
}
