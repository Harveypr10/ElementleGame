import { useEffect, useRef, useState, createContext, useContext } from 'react';
import { useSubscription } from '@/hooks/useSubscription';

declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

interface AdBannerProps {
  className?: string;
}

// Context to track if ads should be shown on current screen
export const AdBannerContext = createContext<boolean>(true);

export function useAdBannerVisibility() {
  return useContext(AdBannerContext);
}

// Hook that returns whether the ad banner is actually visible (combines isPro + screen context)
// Use this to determine if bottom padding is needed
export function useAdBannerActive() {
  const { isPro } = useSubscription();
  const shouldShowOnScreen = useAdBannerVisibility();
  return !isPro && shouldShowOnScreen;
}

export function AdBanner({ className = '' }: AdBannerProps) {
  const adRef = useRef<HTMLModElement>(null);
  const [adLoaded, setAdLoaded] = useState(false);
  const [adError, setAdError] = useState(false);
  const { isPro } = useSubscription();
  const shouldShowBanner = useAdBannerVisibility();

  useEffect(() => {
    if (isPro || !shouldShowBanner) return;
    
    const loadAd = () => {
      try {
        if (typeof window !== 'undefined' && window.adsbygoogle && adRef.current) {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
          setAdLoaded(true);
        }
      } catch (e) {
        console.error('AdSense error:', e);
        setAdError(true);
      }
    };

    if (!document.querySelector('script[src*="adsbygoogle"]')) {
      const script = document.createElement('script');
      script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.onload = loadAd;
      script.onerror = () => setAdError(true);
      document.head.appendChild(script);
    } else {
      loadAd();
    }
  }, [isPro]);

  if (isPro || !shouldShowBanner) return null;

  // In development/test mode, always show the test banner placeholder
  const showTestBanner = !adLoaded || adError;

  return (
    <div 
      id="banner-ad" 
      className={`fixed bottom-0 left-0 right-0 z-[90] ${className}`}
      style={{ minHeight: '50px' }}
      data-testid="ad-banner-container"
    >
      {!showTestBanner && (
        <ins 
          ref={adRef}
          className="adsbygoogle"
          style={{ display: 'block', width: '100%', height: '50px' }}
          data-ad-client="ca-pub-3940256099942544"
          data-ad-slot="6300978111"
          data-ad-format="banner"
          data-full-width-responsive="true"
        />
      )}
      {showTestBanner && (
        <div 
          className="flex items-center justify-center h-[50px] border-t border-gray-300 dark:border-gray-600"
          style={{
            background: 'linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 50%, #f0f0f0 100%)',
          }}
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded bg-blue-500 text-white text-xs font-bold">
              AD
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-700">Test Advertisement</span>
              <span className="text-xs text-gray-500">Go Pro for ad-free experience</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
