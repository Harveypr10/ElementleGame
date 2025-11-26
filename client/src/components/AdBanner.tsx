import { useSubscription } from '@/hooks/useSubscription';

// Hook that returns whether an ad banner should be shown (checks Pro status)
// Use this to determine if bottom padding is needed for screens that show ads
export function useAdBannerActive() {
  const { isPro } = useSubscription();
  return !isPro;
}
