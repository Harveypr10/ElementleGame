import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';

interface InterstitialAdProps {
  isOpen: boolean;
  onClose: () => void;
}

export function InterstitialAd({ isOpen, onClose }: InterstitialAdProps) {
  const [countdown, setCountdown] = useState(5);
  const [canClose, setCanClose] = useState(false);
  const { isPro } = useSubscription();

  useEffect(() => {
    if (!isOpen || isPro) return;

    setCountdown(5);
    setCanClose(false);

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setCanClose(true);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, isPro]);

  const handleClose = useCallback(() => {
    if (canClose) {
      onClose();
    }
  }, [canClose, onClose]);

  if (isPro) {
    onClose();
    return null;
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center"
          data-testid="interstitial-ad-overlay"
        >
          <div className="absolute top-4 right-4">
            <button
              onClick={handleClose}
              disabled={!canClose}
              className={`w-12 h-12 flex items-center justify-center rounded-full transition-all ${
                canClose 
                  ? 'bg-white/20 hover:bg-white/30 cursor-pointer' 
                  : 'bg-white/10 cursor-not-allowed'
              }`}
              data-testid="button-close-interstitial"
            >
              {canClose ? (
                <X className="h-6 w-6 text-white" />
              ) : (
                <span className="text-white font-bold text-lg">{countdown}</span>
              )}
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center w-full max-w-2xl px-4">
            <div 
              className="w-full h-[300px] bg-gray-800 rounded-lg flex items-center justify-center"
              data-testid="interstitial-ad-container"
            >
              <div className="text-center text-white">
                <p className="text-lg font-semibold mb-2">Advertisement</p>
                <p className="text-sm text-gray-400">
                  Google Interstitial Ad
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Test Ad Unit: ca-pub-3940256099942544/1033173712
                </p>
              </div>
            </div>
          </div>

          <div className="pb-8 text-center">
            {!canClose && (
              <p className="text-gray-400 text-sm">
                Ad closes in {countdown} seconds...
              </p>
            )}
            {canClose && (
              <p className="text-gray-400 text-sm">
                Tap X to continue
              </p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function useInterstitialAd() {
  const [showAd, setShowAd] = useState(false);
  const [onAdClosed, setOnAdClosed] = useState<(() => void) | null>(null);

  const triggerAd = useCallback((callback: () => void) => {
    setOnAdClosed(() => callback);
    setShowAd(true);
  }, []);

  const handleClose = useCallback(() => {
    setShowAd(false);
    if (onAdClosed) {
      onAdClosed();
      setOnAdClosed(null);
    }
  }, [onAdClosed]);

  return {
    showAd,
    triggerAd,
    handleClose,
    InterstitialAdComponent: () => (
      <InterstitialAd isOpen={showAd} onClose={handleClose} />
    ),
  };
}
