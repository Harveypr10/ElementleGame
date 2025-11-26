import { useEffect, useRef, useState } from 'react';
import { useSubscription } from '@/hooks/useSubscription';

declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

interface AdBannerProps {
  className?: string;
}

export function AdBanner({ className = '' }: AdBannerProps) {
  const adRef = useRef<HTMLModElement>(null);
  const [adLoaded, setAdLoaded] = useState(false);
  const [adError, setAdError] = useState(false);
  const { isPro } = useSubscription();

  useEffect(() => {
    if (isPro) return;
    
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

  if (isPro) return null;

  return (
    <div 
      id="banner-ad" 
      className={`fixed bottom-0 left-0 right-0 z-[90] bg-gray-100 dark:bg-gray-900 ${className}`}
      style={{ minHeight: '50px' }}
      data-testid="ad-banner-container"
    >
      <ins 
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'block', width: '100%', height: '50px' }}
        data-ad-client="ca-pub-3940256099942544"
        data-ad-slot="6300978111"
        data-ad-format="banner"
        data-full-width-responsive="true"
      />
      {(!adLoaded || adError) && (
        <div className="flex items-center justify-center h-[50px] bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span>Advertisement</span>
            <span className="text-xs text-gray-400">• Ad-free with Pro</span>
          </div>
        </div>
      )}
    </div>
  );
}
