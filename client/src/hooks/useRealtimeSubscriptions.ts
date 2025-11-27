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

  const refreshGlobalData = useCallback(() => {
    console.log('[Realtime] Refreshing global data');
    // Invalidate all puzzle-related queries (including any today-specific variants)
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey[0];
        if (typeof key !== 'string') return false;
        return key.startsWith('/api/puzzles') || 
               key === '/api/game-attempts/user' ||
               key === '/api/stats' ||
               key === '/api/stats/percentile';
      }
    });
  }, [queryClient]);

  const refreshLocalData = useCallback(() => {
    console.log('[Realtime] Refreshing local data');
    // Invalidate all user-specific puzzle-related queries
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey[0];
        if (typeof key !== 'string') return false;
        return key.startsWith('/api/user/puzzles') || 
               key === '/api/user/game-attempts/user' ||
               key === '/api/user/stats' ||
               key === '/api/user/stats/percentile';
      }
    });
  }, [queryClient]);

  const refreshProfile = useCallback(() => {
    console.log('[Realtime] Refreshing profile data');
    queryClient.invalidateQueries({ queryKey: ['/api/auth/profile'] });
    queryClient.invalidateQueries({ queryKey: ['/api/user/settings'] });
    queryClient.invalidateQueries({ queryKey: ['/api/user/preferences'] });
  }, [queryClient]);

  const refreshCategories = useCallback(() => {
    console.log('[Realtime] Refreshing category preferences');
    queryClient.invalidateQueries({ queryKey: ['/api/user/categories'] });
    queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
  }, [queryClient]);

  const refreshAllData = useCallback(() => {
    refreshGlobalData();
    refreshLocalData();
    refreshProfile();
    refreshCategories();
  }, [refreshGlobalData, refreshLocalData, refreshProfile, refreshCategories]);

  useEffect(() => {
    // Helper to cleanup channel
    const cleanupChannel = () => {
      if (channelRef.current) {
        console.log('[Realtime] Cleaning up existing channel');
        supabase.removeChannel(channelRef.current).catch((error) => {
          console.warn('[Realtime] Error removing channel:', error);
        });
        channelRef.current = null;
      }
    };

    // Skip if not authenticated or no userId
    if (!isAuthenticated || !userId) {
      cleanupChannel();
      currentUserIdRef.current = null;
      currentRegionRef.current = null;
      return;
    }

    // Check if we need to recreate the channel (user or region changed)
    const needsRecreate = 
      userId !== currentUserIdRef.current || 
      region !== currentRegionRef.current;

    if (!needsRecreate && channelRef.current) {
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

    // User allocations - refresh both local AND global data (for "Play today's question" button)
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
        refreshLocalData();
        refreshGlobalData();
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
        refreshGlobalData();
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
        refreshProfile();
        refreshGlobalData();
        refreshLocalData();
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
        refreshCategories();
        refreshLocalData();
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
        refreshProfile();
      }
    );

    // Subscribe with status callback for error handling
    channel.subscribe((status, error) => {
      console.log('[Realtime] Subscription status:', status);
      
      if (status === 'SUBSCRIBED') {
        channelRef.current = channel;
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('[Realtime] Subscription failed with status:', status, error);
        supabase.removeChannel(channel).catch((e) => {
          console.warn('[Realtime] Error cleaning up failed channel:', e);
        });
      }
    });

    // Cleanup on unmount or when dependencies change
    return cleanupChannel;
  }, [
    isAuthenticated, 
    userId, 
    region, 
    supabase, 
    refreshGlobalData, 
    refreshLocalData, 
    refreshProfile, 
    refreshCategories
  ]);

  return {
    refreshAllData,
    refreshGlobalData,
    refreshLocalData,
    refreshProfile,
    refreshCategories,
  };
}
