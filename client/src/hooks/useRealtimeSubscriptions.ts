import { useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSupabase } from '@/lib/SupabaseProvider';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UseRealtimeSubscriptionsOptions {
  userId: string | null | undefined;
  region: string;
  isAuthenticated: boolean;
}

export function useRealtimeSubscriptions({ userId, region, isAuthenticated }: UseRealtimeSubscriptionsOptions) {
  const supabase = useSupabase();
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const currentRegionRef = useRef<string | null>(null);
  const currentUserIdRef = useRef<string | null>(null);
  const isSubscribedRef = useRef(false);
  
  // Store queryClient in a ref to avoid dependency issues
  const queryClientRef = useRef(queryClient);
  queryClientRef.current = queryClient;

  // Invalidation functions - use refs to keep them stable
  const invalidateGlobalData = useCallback(() => {
    console.log('[Realtime] Invalidating global data');
    queryClientRef.current.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey[0];
        if (typeof key !== 'string') return false;
        return key.startsWith('/api/puzzles') || 
               key === '/api/game-attempts/user' ||
               key === '/api/stats' ||
               key === '/api/stats/percentile';
      }
    });
  }, []);

  const invalidateLocalData = useCallback(() => {
    console.log('[Realtime] Invalidating local data');
    queryClientRef.current.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey[0];
        if (typeof key !== 'string') return false;
        return key.startsWith('/api/user/puzzles') || 
               key === '/api/user/game-attempts/user' ||
               key === '/api/user/stats' ||
               key === '/api/user/stats/percentile';
      }
    });
  }, []);

  const invalidateProfile = useCallback(() => {
    console.log('[Realtime] Invalidating profile data');
    queryClientRef.current.invalidateQueries({ queryKey: ['/api/auth/profile'] });
    queryClientRef.current.invalidateQueries({ queryKey: ['/api/user/settings'] });
    queryClientRef.current.invalidateQueries({ queryKey: ['/api/user/preferences'] });
  }, []);

  const invalidateCategories = useCallback(() => {
    console.log('[Realtime] Invalidating category preferences');
    queryClientRef.current.invalidateQueries({ queryKey: ['/api/user/categories'] });
    queryClientRef.current.invalidateQueries({ queryKey: ['/api/categories'] });
  }, []);

  useEffect(() => {
    // Helper to cleanup channel
    const cleanupChannel = () => {
      if (channelRef.current) {
        console.log('[Realtime] Cleaning up existing channel');
        supabase.removeChannel(channelRef.current).catch((error) => {
          console.warn('[Realtime] Error removing channel:', error);
        });
        channelRef.current = null;
        isSubscribedRef.current = false;
      }
    };

    // Skip if not authenticated or no userId
    if (!isAuthenticated || !userId) {
      cleanupChannel();
      currentUserIdRef.current = null;
      currentRegionRef.current = null;
      return;
    }

    // Check if we already have an active subscription for this user/region
    if (
      isSubscribedRef.current &&
      channelRef.current && 
      userId === currentUserIdRef.current && 
      region === currentRegionRef.current
    ) {
      // No changes needed, channel is already set up
      return;
    }

    // Cleanup existing channel before creating a new one
    cleanupChannel();
    
    currentUserIdRef.current = userId;
    currentRegionRef.current = region;

    console.log('[Realtime] Setting up subscriptions for user:', userId, 'region:', region);

    const channelName = `elementle-realtime-${userId}-${Date.now()}`;
    const channel = supabase.channel(channelName);

    // User allocations - refresh both local AND global data
    channel.on(
      'postgres_changes',
      { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'questions_allocated_user', 
        filter: `user_id=eq.${userId}` 
      },
      (payload) => {
        console.log('[Realtime] User allocation INSERT:', payload);
        invalidateLocalData();
        invalidateGlobalData();
      }
    );

    // Region allocations
    channel.on(
      'postgres_changes',
      { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'questions_allocated_region', 
        filter: `region=eq.${region}` 
      },
      (payload) => {
        console.log('[Realtime] Region allocation INSERT:', payload);
        invalidateGlobalData();
      }
    );

    // Location allocations - refresh profile and both data sources
    channel.on(
      'postgres_changes',
      { 
        event: '*', 
        schema: 'public', 
        table: 'location_allocation', 
        filter: `user_id=eq.${userId}` 
      },
      (payload) => {
        console.log('[Realtime] Location allocation change:', payload);
        invalidateProfile();
        invalidateGlobalData();
        invalidateLocalData();
      }
    );

    // Category preferences - refresh categories and local data
    channel.on(
      'postgres_changes',
      { 
        event: '*', 
        schema: 'public', 
        table: 'user_category_preferences', 
        filter: `user_id=eq.${userId}` 
      },
      (payload) => {
        console.log('[Realtime] Category preferences change:', payload);
        invalidateCategories();
        invalidateLocalData();
      }
    );

    // Profile updates
    channel.on(
      'postgres_changes',
      { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'user_profiles', 
        filter: `user_id=eq.${userId}` 
      },
      (payload) => {
        console.log('[Realtime] Profile update:', payload);
        invalidateProfile();
      }
    );

    // Subscribe with status callback for error handling
    channel.subscribe((status, error) => {
      console.log('[Realtime] Subscription status:', status);
      
      if (status === 'SUBSCRIBED') {
        channelRef.current = channel;
        isSubscribedRef.current = true;
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('[Realtime] Subscription failed with status:', status, error);
        isSubscribedRef.current = false;
        supabase.removeChannel(channel).catch((e) => {
          console.warn('[Realtime] Error cleaning up failed channel:', e);
        });
      }
    });

    // Cleanup on unmount or when dependencies change
    return cleanupChannel;
    // Note: invalidate* functions are stable (empty deps + using refs) so not included in deps array
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, userId, region, supabase]);

  // Return manual refresh functions for use by components if needed
  return {
    refreshGlobalData: invalidateGlobalData,
    refreshLocalData: invalidateLocalData,
    refreshProfile: invalidateProfile,
    refreshCategories: invalidateCategories,
    refreshAllData: useCallback(() => {
      invalidateGlobalData();
      invalidateLocalData();
      invalidateProfile();
      invalidateCategories();
    }, [invalidateGlobalData, invalidateLocalData, invalidateProfile, invalidateCategories]),
  };
}
