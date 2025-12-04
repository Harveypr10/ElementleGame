import { useState, useCallback } from 'react';
import { apiRequest } from '@/lib/queryClient';
import type { UserBadgeWithDetails } from '@shared/schema';

interface BadgeCheckResult {
  newBadge: UserBadgeWithDetails | null;
  error: string | null;
}

export function useBadgeChecker() {
  const [pendingBadge, setPendingBadge] = useState<UserBadgeWithDetails | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const checkElementleBadge = useCallback(async (
    guessCount: number,
    gameType: 'USER' | 'REGION'
  ): Promise<BadgeCheckResult> => {
    if (guessCount !== 1 && guessCount !== 2) {
      return { newBadge: null, error: null };
    }

    setIsChecking(true);
    try {
      const endpoint = gameType === 'USER' 
        ? '/api/user/badges/check-elementle'
        : '/api/badges/check-elementle';
      
      const response = await apiRequest('POST', endpoint, {
        guessCount
      });

      if (!response.ok) {
        const errorData = await response.json();
        return { newBadge: null, error: errorData.error || 'Failed to check badge' };
      }

      const data = await response.json();
      if (data.awarded && data.badge) {
        setPendingBadge(data.badge);
        return { newBadge: data.badge, error: null };
      }

      return { newBadge: null, error: null };
    } catch (error) {
      console.error('[useBadgeChecker] Error checking elementle badge:', error);
      return { newBadge: null, error: 'Network error' };
    } finally {
      setIsChecking(false);
    }
  }, []);

  const checkStreakBadge = useCallback(async (
    currentStreak: number,
    gameType: 'USER' | 'REGION'
  ): Promise<BadgeCheckResult> => {
    if (currentStreak < 7) {
      return { newBadge: null, error: null };
    }

    setIsChecking(true);
    try {
      const endpoint = gameType === 'USER' 
        ? '/api/user/badges/check-streak'
        : '/api/badges/check-streak';
      
      const response = await apiRequest('POST', endpoint, {
        streak: currentStreak
      });

      if (!response.ok) {
        const errorData = await response.json();
        return { newBadge: null, error: errorData.error || 'Failed to check badge' };
      }

      const data = await response.json();
      if (data.awarded && data.badge) {
        setPendingBadge(data.badge);
        return { newBadge: data.badge, error: null };
      }

      return { newBadge: null, error: null };
    } catch (error) {
      console.error('[useBadgeChecker] Error checking streak badge:', error);
      return { newBadge: null, error: 'Network error' };
    } finally {
      setIsChecking(false);
    }
  }, []);

  const checkPercentileBadge = useCallback(async (
    gameType: 'USER' | 'REGION'
  ): Promise<BadgeCheckResult> => {
    setIsChecking(true);
    try {
      const endpoint = gameType === 'USER'
        ? '/api/user/badges/check-percentile'
        : '/api/badges/check-percentile';
      
      const response = await apiRequest('POST', endpoint);

      if (!response.ok) {
        const errorData = await response.json();
        return { newBadge: null, error: errorData.error || 'Failed to check percentile badge' };
      }

      const data = await response.json();
      if (data.awarded && data.badge) {
        setPendingBadge(data.badge);
        return { newBadge: data.badge, error: null };
      }

      return { newBadge: null, error: null };
    } catch (error) {
      console.error('[useBadgeChecker] Error checking percentile badge:', error);
      return { newBadge: null, error: 'Network error' };
    } finally {
      setIsChecking(false);
    }
  }, []);

  const checkAllBadgesOnGameComplete = useCallback(async (
    won: boolean,
    guessCount: number,
    currentStreak: number,
    gameType: 'USER' | 'REGION'
  ): Promise<UserBadgeWithDetails | null> => {
    if (!won) return null;

    const elementleResult = await checkElementleBadge(guessCount, gameType);
    if (elementleResult.newBadge) {
      return elementleResult.newBadge;
    }

    const streakResult = await checkStreakBadge(currentStreak, gameType);
    if (streakResult.newBadge) {
      return streakResult.newBadge;
    }

    const percentileResult = await checkPercentileBadge(gameType);
    if (percentileResult.newBadge) {
      return percentileResult.newBadge;
    }

    return null;
  }, [checkElementleBadge, checkStreakBadge, checkPercentileBadge]);

  const dismissBadge = useCallback(() => {
    setPendingBadge(null);
  }, []);

  return {
    pendingBadge,
    isChecking,
    checkElementleBadge,
    checkStreakBadge,
    checkPercentileBadge,
    checkAllBadgesOnGameComplete,
    dismissBadge
  };
}
