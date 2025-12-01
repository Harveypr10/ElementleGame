import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { getSupabaseClient } from '@/lib/supabaseClient';

interface CategoryRestrictionState {
  isChecking: boolean;
  isRestricted: boolean;
  restrictionDays: number | null;
  lastChangedAt: string | null;
  restrictionMessage: string | null;
}

export function useCategoryRestriction() {
  const { isAuthenticated } = useAuth();
  const { profile } = useProfile();
  const [state, setState] = useState<CategoryRestrictionState>({
    isChecking: true,
    isRestricted: false,
    restrictionDays: null,
    lastChangedAt: null,
    restrictionMessage: null,
  });

  const checkRestriction = useCallback(async () => {
    if (!isAuthenticated || !profile) {
      setState({
        isChecking: false,
        isRestricted: false,
        restrictionDays: null,
        lastChangedAt: null,
        restrictionMessage: null,
      });
      return;
    }

    setState(prev => ({ ...prev, isChecking: true }));

    try {
      const supabase = await getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        console.log('[useCategoryRestriction] No session for restriction check');
        setState(prev => ({ ...prev, isChecking: false }));
        return;
      }

      const response = await fetch('/api/settings/category-restriction-days', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        console.warn('[useCategoryRestriction] Failed to fetch restriction settings');
        setState(prev => ({ ...prev, isChecking: false }));
        return;
      }

      const { days } = await response.json();
      
      if (days === 0) {
        const lca = profile.categoriesLastChangedAt;
        setState({
          isChecking: false,
          isRestricted: false,
          restrictionDays: 0,
          lastChangedAt: lca ? (typeof lca === 'string' ? lca : String(lca)) : null,
          restrictionMessage: null,
        });
        return;
      }

      const lastChanged = profile.categoriesLastChangedAt;
      if (!lastChanged) {
        setState({
          isChecking: false,
          isRestricted: false,
          restrictionDays: days,
          lastChangedAt: null,
          restrictionMessage: null,
        });
        return;
      }

      const lastChangedStr = typeof lastChanged === 'string' ? lastChanged : String(lastChanged);
      const lastChangedDate = new Date(lastChangedStr);
      const allowedAfter = new Date(lastChangedDate);
      allowedAfter.setDate(allowedAfter.getDate() + days);

      const isRestricted = new Date() < allowedAfter;
      const message = isRestricted 
        ? `You can update your categories once every ${days} days and Hammie will regenerate your questions.`
        : null;

      setState({
        isChecking: false,
        isRestricted,
        restrictionDays: days,
        lastChangedAt: lastChangedStr,
        restrictionMessage: message,
      });

      console.log('[useCategoryRestriction] Restriction check complete:', { isRestricted, days, lastChanged });
    } catch (error) {
      console.error('[useCategoryRestriction] Error checking restriction:', error);
      setState(prev => ({ ...prev, isChecking: false }));
    }
  }, [isAuthenticated, profile]);

  useEffect(() => {
    checkRestriction();
  }, [checkRestriction]);

  return {
    ...state,
    recheckRestriction: checkRestriction,
  };
}
