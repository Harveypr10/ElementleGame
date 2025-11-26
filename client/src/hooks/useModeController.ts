import { useState, useEffect, useRef, useCallback } from 'react';
import { useMotionValue, animate } from 'framer-motion';
import { useGameMode } from '@/contexts/GameModeContext';
import { useAuth } from '@/hooks/useAuth';

export function useModeController(onGuestRestriction?: () => void) {
  const { gameMode, setGameMode } = useGameMode();
  const { isAuthenticated } = useAuth();
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const swipeStartX = useRef<number>(0);
  
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
    // Prevent guests from accessing Local mode
    if (mode === 'local' && !isAuthenticated) {
      if (onGuestRestriction) {
        onGuestRestriction();
      }
      // Snap back to global
      if (!isDesktop && containerWidth > 0) {
        animate(x, 0, {
          type: 'spring',
          stiffness: 300,
          damping: 30,
          mass: 1,
        });
      }
      return;
    }

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
  }, [containerWidth, setGameMode, x, isDesktop, isAuthenticated, onGuestRestriction]);

  useEffect(() => {
    if (!isDesktop && containerWidth > 0) {
      const targetX = gameMode === 'global' ? 0 : -containerWidth;
      x.set(targetX);
    }
  }, [gameMode, containerWidth, x, isDesktop]);

  const handleSwipeStart = useCallback(() => {
    if (isDesktop || containerWidth === 0) return;
    // Capture the current X position when swipe starts
    swipeStartX.current = x.get();
  }, [x, isDesktop, containerWidth]);

  const handleSwiping = useCallback((deltaX: number) => {
    if (isDesktop || containerWidth === 0) return;
    
    // Apply deltaX directly to the starting position for smooth 1:1 tracking
    const newX = Math.min(0, Math.max(-containerWidth, swipeStartX.current + deltaX));
    x.set(newX);
  }, [x, containerWidth, isDesktop]);

  const handleSwiped = useCallback((velocity: number, direction: 'Left' | 'Right') => {
    if (isDesktop || containerWidth === 0) return;
    
    const currentX = x.get();
    const threshold = containerWidth / 2;
    const velocityThreshold = 0.5; // Minimum velocity to trigger momentum-based snap
    
    // If high velocity, use direction for snap decision
    if (Math.abs(velocity) > velocityThreshold) {
      if (direction === 'Left') {
        snapTo('local');
      } else {
        snapTo('global');
      }
    } else {
      // Otherwise use position threshold
      if (Math.abs(currentX) < threshold) {
        snapTo('global');
      } else {
        snapTo('local');
      }
    }
  }, [containerWidth, snapTo, x, isDesktop]);

  return {
    containerRef,
    x,
    gameMode,
    snapTo,
    handleSwipeStart,
    handleSwiping,
    handleSwiped,
    isDesktop,
  };
}
