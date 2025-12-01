import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';

declare global {
  interface Window {
    lottie: {
      loadAnimation: (options: {
        container: HTMLElement | null;
        renderer: string;
        loop: boolean;
        autoplay: boolean;
        path: string;
      }) => {
        destroy: () => void;
      };
    };
  }
}

interface SpinnerContextValue {
  isLoading: boolean;
  showSpinner: (delay?: number) => void;
  hideSpinner: () => void;
}

const SpinnerContext = createContext<SpinnerContextValue | undefined>(undefined);

const DEFAULT_DELAY_MS = 150;
const FADE_DURATION_MS = 300;
const MIN_DISPLAY_TIME_MS = 1000;

export function SpinnerProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const delayTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const minDisplayTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fadeOutTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const animationRef = useRef<{ destroy: () => void } | null>(null);
  const showTimeRef = useRef<number>(0);
  const pendingHideRef = useRef<boolean>(false);

  const showSpinner = useCallback((delay: number = DEFAULT_DELAY_MS) => {
    pendingHideRef.current = false;
    setIsLoading(true);
    
    if (delayTimeoutRef.current) {
      clearTimeout(delayTimeoutRef.current);
    }
    if (minDisplayTimeoutRef.current) {
      clearTimeout(minDisplayTimeoutRef.current);
    }
    if (fadeOutTimeoutRef.current) {
      clearTimeout(fadeOutTimeoutRef.current);
    }
    
    delayTimeoutRef.current = setTimeout(() => {
      showTimeRef.current = Date.now();
      setIsVisible(true);
    }, delay);
  }, []);

  const hideSpinner = useCallback(() => {
    if (delayTimeoutRef.current) {
      clearTimeout(delayTimeoutRef.current);
      delayTimeoutRef.current = null;
    }
    
    if (!isVisible) {
      setIsLoading(false);
      return;
    }
    
    const elapsedTime = Date.now() - showTimeRef.current;
    const remainingMinTime = Math.max(0, MIN_DISPLAY_TIME_MS - elapsedTime);
    
    if (remainingMinTime > 0) {
      pendingHideRef.current = true;
      minDisplayTimeoutRef.current = setTimeout(() => {
        if (pendingHideRef.current) {
          performHide();
        }
      }, remainingMinTime);
    } else {
      performHide();
    }
  }, [isVisible]);

  const performHide = useCallback(() => {
    const spinnerElement = document.getElementById('spinner');
    if (spinnerElement) {
      spinnerElement.classList.remove('fade-in');
      spinnerElement.classList.add('fade-out');
    }
    
    fadeOutTimeoutRef.current = setTimeout(() => {
      setIsLoading(false);
      setIsVisible(false);
      pendingHideRef.current = false;
    }, FADE_DURATION_MS);
  }, []);

  useEffect(() => {
    const spinnerElement = document.getElementById('spinner');
    const hamsterElement = document.getElementById('hamster');
    
    if (!spinnerElement || !hamsterElement) return;

    if (isVisible) {
      spinnerElement.style.display = 'flex';
      spinnerElement.setAttribute('aria-hidden', 'false');
      spinnerElement.classList.remove('fade-out');
      
      requestAnimationFrame(() => {
        spinnerElement.classList.add('fade-in');
      });
      
      if (!animationRef.current && window.lottie) {
        try {
          animationRef.current = window.lottie.loadAnimation({
            container: hamsterElement,
            renderer: 'svg',
            loop: true,
            autoplay: true,
            path: '/assets/hamster.json'
          });
        } catch (error) {
          console.error('[SpinnerProvider] Failed to load Lottie animation:', error);
        }
      }
    } else {
      spinnerElement.style.display = 'none';
      spinnerElement.setAttribute('aria-hidden', 'true');
      spinnerElement.classList.remove('fade-in', 'fade-out');
      
      if (animationRef.current) {
        animationRef.current.destroy();
        animationRef.current = null;
      }
      
      if (hamsterElement) {
        hamsterElement.innerHTML = '';
      }
    }
  }, [isVisible]);

  useEffect(() => {
    return () => {
      if (delayTimeoutRef.current) {
        clearTimeout(delayTimeoutRef.current);
      }
      if (minDisplayTimeoutRef.current) {
        clearTimeout(minDisplayTimeoutRef.current);
      }
      if (fadeOutTimeoutRef.current) {
        clearTimeout(fadeOutTimeoutRef.current);
      }
      if (animationRef.current) {
        animationRef.current.destroy();
      }
    };
  }, []);

  return (
    <SpinnerContext.Provider value={{ isLoading, showSpinner, hideSpinner }}>
      {children}
    </SpinnerContext.Provider>
  );
}

export function useSpinner() {
  const context = useContext(SpinnerContext);
  if (!context) {
    throw new Error('useSpinner must be used within a SpinnerProvider');
  }
  return context;
}
