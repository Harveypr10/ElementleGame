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

export function SpinnerProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const delayTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const animationRef = useRef<{ destroy: () => void } | null>(null);

  const showSpinner = useCallback((delay: number = DEFAULT_DELAY_MS) => {
    setIsLoading(true);
    
    if (delayTimeoutRef.current) {
      clearTimeout(delayTimeoutRef.current);
    }
    
    delayTimeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  }, []);

  const hideSpinner = useCallback(() => {
    if (delayTimeoutRef.current) {
      clearTimeout(delayTimeoutRef.current);
      delayTimeoutRef.current = null;
    }
    
    setIsLoading(false);
    setIsVisible(false);
  }, []);

  useEffect(() => {
    const spinnerElement = document.getElementById('spinner');
    const hamsterElement = document.getElementById('hamster');
    
    if (!spinnerElement || !hamsterElement) return;

    if (isVisible) {
      spinnerElement.style.display = 'flex';
      spinnerElement.setAttribute('aria-hidden', 'false');
      
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
