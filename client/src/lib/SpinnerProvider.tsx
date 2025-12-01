import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo, ReactNode } from 'react';

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
const MIN_DISPLAY_TIME_MS = 1500;

export function SpinnerProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const delayTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const minDisplayTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fadeOutTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const animationRef = useRef<{ destroy: () => void } | null>(null);
  const showTimeRef = useRef<number>(0);
  const hideRequestedRef = useRef<boolean>(false);
  const isVisibleRef = useRef<boolean>(false);

  const performHide = useCallback(() => {
    const spinnerElement = document.getElementById('spinner');
    if (spinnerElement) {
      spinnerElement.classList.remove('fade-in');
      spinnerElement.classList.add('fade-out');
    }
    
    fadeOutTimeoutRef.current = setTimeout(() => {
      setIsLoading(false);
      setIsVisible(false);
      isVisibleRef.current = false;
      hideRequestedRef.current = false;
    }, FADE_DURATION_MS);
  }, []);

  const checkAndHide = useCallback(() => {
    if (!hideRequestedRef.current || !isVisibleRef.current) return;
    
    const elapsedTime = Date.now() - showTimeRef.current;
    if (elapsedTime >= MIN_DISPLAY_TIME_MS) {
      performHide();
    } else {
      const remainingTime = MIN_DISPLAY_TIME_MS - elapsedTime;
      minDisplayTimeoutRef.current = setTimeout(() => {
        if (hideRequestedRef.current && isVisibleRef.current) {
          performHide();
        }
      }, remainingTime);
    }
  }, [performHide]);

  const showSpinner = useCallback((delay: number = DEFAULT_DELAY_MS) => {
    hideRequestedRef.current = false;
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
      isVisibleRef.current = true;
    }, delay);
  }, []);

  const hideSpinner = useCallback(() => {
    if (delayTimeoutRef.current) {
      clearTimeout(delayTimeoutRef.current);
      delayTimeoutRef.current = null;
    }
    
    if (!isVisibleRef.current) {
      setIsLoading(false);
      return;
    }
    
    hideRequestedRef.current = true;
    checkAndHide();
  }, [checkAndHide]);

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

interface SpinnerTimeoutOptions {
  retryDelayMs?: number;
  timeoutMs?: number;
  onRetry?: () => void;
  onTimeout?: () => void;
  onFadeOutComplete?: () => void;
}

const DEFAULT_RETRY_DELAY_MS = 4000;
const DEFAULT_TIMEOUT_MS = 8000;

export function useSpinnerWithTimeout(options: SpinnerTimeoutOptions = {}) {
  const { showSpinner, hideSpinner } = useSpinner();
  const {
    retryDelayMs = DEFAULT_RETRY_DELAY_MS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    onRetry,
    onTimeout,
    onFadeOutComplete,
  } = options;
  
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const failTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fadeOutCompleteTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const spinnerVisibleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasRetriedRef = useRef(false);
  const isActiveRef = useRef(false);
  const spinnerVisibleTimeRef = useRef<number>(0);
  const wasSpinnerShownRef = useRef(false);
  
  const clearTimeouts = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    if (failTimeoutRef.current) {
      clearTimeout(failTimeoutRef.current);
      failTimeoutRef.current = null;
    }
    if (fadeOutCompleteTimeoutRef.current) {
      clearTimeout(fadeOutCompleteTimeoutRef.current);
      fadeOutCompleteTimeoutRef.current = null;
    }
    if (spinnerVisibleTimeoutRef.current) {
      clearTimeout(spinnerVisibleTimeoutRef.current);
      spinnerVisibleTimeoutRef.current = null;
    }
  }, []);
  
  const start = useCallback((delay?: number) => {
    if (isActiveRef.current) return;
    
    isActiveRef.current = true;
    hasRetriedRef.current = false;
    wasSpinnerShownRef.current = false;
    spinnerVisibleTimeRef.current = 0;
    clearTimeouts();
    
    showSpinner(delay ?? 0);
    
    const showDelay = delay ?? DEFAULT_DELAY_MS;
    spinnerVisibleTimeoutRef.current = setTimeout(() => {
      wasSpinnerShownRef.current = true;
      spinnerVisibleTimeRef.current = Date.now();
    }, showDelay);
    
    if (onRetry) {
      retryTimeoutRef.current = setTimeout(() => {
        if (isActiveRef.current && !hasRetriedRef.current) {
          hasRetriedRef.current = true;
          console.log('[SpinnerWithTimeout] Triggering retry after', retryDelayMs, 'ms');
          onRetry();
        }
      }, retryDelayMs);
    }
    
    if (onTimeout) {
      failTimeoutRef.current = setTimeout(() => {
        if (isActiveRef.current) {
          console.log('[SpinnerWithTimeout] Triggering timeout after', timeoutMs, 'ms');
          isActiveRef.current = false;
          clearTimeouts();
          hideSpinner();
          onTimeout();
        }
      }, timeoutMs);
    }
  }, [showSpinner, hideSpinner, clearTimeouts, onRetry, onTimeout, retryDelayMs, timeoutMs]);
  
  const complete = useCallback(() => {
    if (!isActiveRef.current) return;
    
    isActiveRef.current = false;
    clearTimeouts();
    hideSpinner();
    console.log('[SpinnerWithTimeout] Completed successfully');
    
    if (onFadeOutComplete) {
      if (!wasSpinnerShownRef.current) {
        console.log('[SpinnerWithTimeout] Spinner never became visible - triggering callback immediately');
        onFadeOutComplete();
      } else {
        const elapsedTime = Date.now() - spinnerVisibleTimeRef.current;
        const remainingMinDisplayTime = Math.max(0, MIN_DISPLAY_TIME_MS - elapsedTime);
        const totalWaitTime = remainingMinDisplayTime + FADE_DURATION_MS;
        
        fadeOutCompleteTimeoutRef.current = setTimeout(() => {
          console.log('[SpinnerWithTimeout] Fade out complete - triggering callback');
          onFadeOutComplete();
        }, totalWaitTime);
      }
    }
  }, [hideSpinner, clearTimeouts, onFadeOutComplete]);
  
  const cancel = useCallback(() => {
    isActiveRef.current = false;
    clearTimeouts();
    hideSpinner();
  }, [hideSpinner, clearTimeouts]);
  
  useEffect(() => {
    return () => {
      clearTimeouts();
      if (isActiveRef.current) {
        hideSpinner();
      }
    };
  }, [clearTimeouts, hideSpinner]);
  
  return {
    start,
    complete,
    cancel,
    isActive: isActiveRef.current,
  };
}
