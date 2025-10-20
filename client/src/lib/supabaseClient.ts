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
    supabaseInstance = createClient(config.url, config.anonKey);
    return supabaseInstance;
  })();

  return initPromise;
}
