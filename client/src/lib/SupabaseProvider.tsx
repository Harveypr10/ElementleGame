import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { SupabaseClient, createClient } from '@supabase/supabase-js';

const SupabaseContext = createContext<SupabaseClient | null>(null);

export function SupabaseProvider({ children }: { children: ReactNode }) {
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function initSupabase() {
      try {
        const response = await fetch('/api/supabase-config');
        if (!response.ok) {
          throw new Error('Failed to fetch Supabase configuration');
        }
        
        const config = await response.json();
        const client = createClient(config.url, config.anonKey);
        setSupabase(client);
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
    return <div>Loading...</div>;
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
