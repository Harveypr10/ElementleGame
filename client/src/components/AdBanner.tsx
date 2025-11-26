import { useEffect, useRef, useState } from 'react';
import { useSubscription } from '@/hooks/useSubscription';

declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

const ADSENSE_CLIENT_ID = 'ca-pub-3940256099942544';
const ADSENSE_SLOT_ID = '6300978111';

export function useAdBannerActive() {
  const { isGold, isLoading } = useSubscription();
  if (isLoading) return false;
  return !isGold;
}

export function AdBanner() {
  const adRef = useRef<HTMLModElement>(null);
  const [adLoaded, setAdLoaded] = useState(false);
  const [adError, setAdError] = useState(false);
  const { isGold, isLoading: subscriptionLoading } = useSubscription();

  useEffect(() => {
    if (subscriptionLoading || isGold) return;
    
    const loadAd = () => {
      try {
        if (typeof window !== 'undefined' && adRef.current) {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
          
          setTimeout(() => {
            if (adRef.current) {
              const iframe = adRef.current.querySelector('iframe');
              if (iframe) {
                setAdLoaded(true);
              } else {
                setAdError(true);
              }
            }
          }, 2000);
        }
      } catch (e) {
        console.error('AdSense error:', e);
        setAdError(true);
      }
    };

    const timer = setTimeout(() => {
      const existingScript = document.querySelector('script[src*="adsbygoogle"]');
      if (!existingScript) {
        const script = document.createElement('script');
        script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`;
        script.async = true;
        script.crossOrigin = 'anonymous';
        script.setAttribute('data-adtest', 'on');
        script.onload = loadAd;
        script.onerror = () => setAdError(true);
        document.head.appendChild(script);
      } else {
        loadAd();
      }
    }, 100);
    
    return () => clearTimeout(timer);
  }, [isGold, subscriptionLoading]);

  if (subscriptionLoading) return null;
  if (isGold) return null;

  return (
    <div 
      id="banner-ad"
      className="fixed bottom-0 left-0 right-0 z-[90]"
      style={{ minHeight: '50px' }}
      data-testid="ad-banner"
    >
      <ins 
        ref={adRef}
        className="adsbygoogle"
        style={{ 
          display: adLoaded && !adError ? 'block' : 'none', 
          width: '100%', 
          height: '50px' 
        }}
        data-ad-client={ADSENSE_CLIENT_ID}
        data-ad-slot={ADSENSE_SLOT_ID}
        data-ad-format="banner"
        data-full-width-responsive="true"
        data-adtest="on"
      />
      {(!adLoaded || adError) && (
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
              <span className="text-xs text-gray-500">Go Pro (Gold) for ad-free experience</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
