import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from './supabaseClient';

const SupabaseContext = createContext<SupabaseClient | null>(null);

export function SupabaseProvider({ children }: { children: ReactNode }) {
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function initSupabase() {
      try {
        // Use the unified singleton client
        const client = await getSupabaseClient();
        setSupabase(client);
        
        // Check if we have a magic link hash in the URL
        const hash = window.location.hash;
        if (hash && hash.includes('access_token')) {
          console.log('[SupabaseProvider] Detected magic link tokens in URL hash');
          
          // The Supabase client with detectSessionInUrl should automatically handle this,
          // but we explicitly call getSession to ensure it's consumed
          const { data, error: sessionError } = await client.auth.getSession();
          
          if (sessionError) {
            console.error('[SupabaseProvider] Error consuming magic link session:', sessionError);
          } else if (data.session) {
            console.log('[SupabaseProvider] Successfully consumed magic link session for user:', data.session.user.email);
            // Clear the hash from the URL to clean up
            window.history.replaceState(null, '', window.location.pathname);
          } else {
            console.warn('[SupabaseProvider] No session after magic link - trying to set session manually');
            // Try to manually extract and set the session from the hash
            const params = new URLSearchParams(hash.substring(1));
            const accessToken = params.get('access_token');
            const refreshToken = params.get('refresh_token');
            
            if (accessToken && refreshToken) {
              const { data: sessionData, error: setError } = await client.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });
              
              if (setError) {
                console.error('[SupabaseProvider] Error setting session manually:', setError);
              } else if (sessionData.session) {
                console.log('[SupabaseProvider] Successfully set session manually for user:', sessionData.session.user.email);
                // Clear the hash from the URL
                window.history.replaceState(null, '', window.location.pathname);
              }
            }
          }
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Supabase initialization error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setLoading(false);
      }
    }

    initSupabase();
  }, []);

  if (loading) {
    return (
      <div 
        className="fixed inset-0"
        style={{ backgroundColor: '#7DAAE8' }} 
      />
    );
  }

  if (error || !supabase) {
    return <div>Error initializing app: {error || 'Supabase client not available'}</div>;
  }

  return (
    <SupabaseContext.Provider value={supabase}>
      {children}
    </SupabaseContext.Provider>
  );
}

export function useSupabase() {
  const context = useContext(SupabaseContext);
  if (!context) {
    throw new Error('useSupabase must be used within SupabaseProvider');
  }
  return context;
}
