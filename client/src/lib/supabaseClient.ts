import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;
let initPromise: Promise<SupabaseClient> | null = null;

export async function getSupabaseClient(): Promise<SupabaseClient> {
  // Return existing instance if already initialized
  if (supabaseInstance) {
    return supabaseInstance;
  }

  // Return the same promise if initialization is in progress
  if (initPromise) {
    return initPromise;
  }

  // Start initialization and memoize the promise
  initPromise = (async () => {
    const response = await fetch('/api/supabase-config');
    if (!response.ok) {
      throw new Error('Failed to fetch Supabase configuration');
    }

    const config = await response.json();
    supabaseInstance = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true, // Critical for consuming magic link tokens from URL fragment
      },
    });

    // 🔑 TEMP: log the current session's access token for testing
    try {
      const { data: { session }, error } = await supabaseInstance.auth.getSession();
      if (error) {
        console.warn('Error fetching session:', error.message);
      } else if (session?.access_token) {
        console.log('User access token:', session.access_token);
      } else {
        console.log('No active session found');
      }
    } catch (e) {
      console.warn('Failed to get session:', e);
    }

    return supabaseInstance;
  })();

  return initPromise;
}
