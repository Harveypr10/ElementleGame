import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from './supabaseClient';
import { isPwaContext, markPwaInstalled } from './pwaContext';

interface SupabaseContextValue {
  client: SupabaseClient;
  isPasswordRecovery: boolean;
  clearPasswordRecovery: () => void;
}

const SupabaseContext = createContext<SupabaseContextValue | null>(null);

export function SupabaseProvider({ children }: { children: ReactNode }) {
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  
  const clearPasswordRecovery = useCallback(() => {
    setIsPasswordRecovery(false);
    // Clean up the URL
    window.history.replaceState(null, '', window.location.pathname);
  }, []);

  useEffect(() => {
    // Mark PWA as installed when running in PWA context
    if (isPwaContext()) {
      console.log('[SupabaseProvider] Running in PWA context - marking as installed');
      markPwaInstalled();
    }

    async function initSupabase() {
      try {
        // Use the unified singleton client
        const client = await getSupabaseClient();
        setSupabase(client);
        
        const hash = window.location.hash;
        const searchParams = new URLSearchParams(window.location.search);
        
        // Check for token_hash in URL query params (PKCE flow)
        let tokenHash = searchParams.get('token_hash');
        let type = searchParams.get('type');
        
        if (tokenHash && type) {
          console.log('[SupabaseProvider] Verifying token_hash, type:', type);
          
          const { data, error: verifyError } = await client.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as 'email' | 'magiclink' | 'signup' | 'recovery' | 'invite' | 'email_change',
          });
          
          if (verifyError) {
            console.error('[SupabaseProvider] Error verifying token_hash:', verifyError);
          } else if (data.session) {
            console.log('[SupabaseProvider] Successfully verified token_hash for user:', data.session.user.email);
            
            // Check if this is a password recovery flow
            if (type === 'recovery') {
              console.log('[SupabaseProvider] Password recovery flow detected - showing reset screen');
              setIsPasswordRecovery(true);
              // Don't clear URL yet - let the password reset screen handle it
            } else {
              // Clear the query params from the URL
              window.history.replaceState(null, '', window.location.pathname);
            }
          }
        }
        // Check for access_token in hash (implicit flow - for backwards compatibility)
        else if (hash && hash.includes('access_token')) {
          console.log('[SupabaseProvider] Detected access_token in URL hash');
          
          // Parse tokens from hash
          const hashParams = new URLSearchParams(hash.substring(1));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          
          // First try getSession - detectSessionInUrl should handle this
          const { data, error: sessionError } = await client.auth.getSession();
          
          if (sessionError) {
            console.error('[SupabaseProvider] Error getting session:', sessionError);
          } else if (data.session) {
            console.log('[SupabaseProvider] Successfully got session for user:', data.session.user.email);
            window.history.replaceState(null, '', window.location.pathname);
          } else if (accessToken && refreshToken) {
            // Fallback: manually set the session
            console.log('[SupabaseProvider] No session from getSession - trying manual setSession');
            
            const { data: sessionData, error: setError } = await client.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            
            if (setError) {
              console.error('[SupabaseProvider] Error setting session manually:', setError);
            } else if (sessionData.session) {
              console.log('[SupabaseProvider] Successfully set session manually for user:', sessionData.session.user.email);
              window.history.replaceState(null, '', window.location.pathname);
            }
          }
        }
        // Also check hash for token_hash (some email templates put it there)
        else if (hash && hash.includes('token_hash')) {
          console.log('[SupabaseProvider] Detected token_hash in URL hash');
          
          const hashParams = new URLSearchParams(hash.substring(1));
          const hashTokenHash = hashParams.get('token_hash');
          const hashType = hashParams.get('type');
          
          if (hashTokenHash && hashType) {
            const { data, error: verifyError } = await client.auth.verifyOtp({
              token_hash: hashTokenHash,
              type: hashType as 'email' | 'magiclink' | 'signup' | 'recovery' | 'invite' | 'email_change',
            });
            
            if (verifyError) {
              console.error('[SupabaseProvider] Error verifying token_hash from hash:', verifyError);
            } else if (data.session) {
              console.log('[SupabaseProvider] Successfully verified token_hash from hash for user:', data.session.user.email);
              
              // Check if this is a password recovery flow
              if (hashType === 'recovery') {
                console.log('[SupabaseProvider] Password recovery flow detected from hash - showing reset screen');
                setIsPasswordRecovery(true);
              } else {
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

  const contextValue: SupabaseContextValue = {
    client: supabase,
    isPasswordRecovery,
    clearPasswordRecovery,
  };

  return (
    <SupabaseContext.Provider value={contextValue}>
      {children}
    </SupabaseContext.Provider>
  );
}

export function useSupabase() {
  const context = useContext(SupabaseContext);
  if (!context) {
    throw new Error('useSupabase must be used within SupabaseProvider');
  }
  return context.client;
}

export function usePasswordRecovery() {
  const context = useContext(SupabaseContext);
  if (!context) {
    throw new Error('usePasswordRecovery must be used within SupabaseProvider');
  }
  return {
    isPasswordRecovery: context.isPasswordRecovery,
    clearPasswordRecovery: context.clearPasswordRecovery,
  };
}
