import { useState, useEffect, useCallback } from 'react';
import { useSupabase } from '@/lib/SupabaseProvider';
import type { User } from '@supabase/supabase-js';
import { clearUserCache } from '@/lib/localCache';
import { queryClient } from '@/lib/queryClient';

export function useAuth() {
  const supabase = useSupabase();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setUser(session?.user ?? null);
        setIsLoading(false);

        // Debug: log the current user ID
        if (session?.user) {
          console.log("Current logged-in user ID:", session.user.id);
        } else {
          console.log("No active user session");
        }
      })
      .catch((error) => {
        console.warn("Failed to get initial session:", error);
        setIsLoading(false);
        setUser(null);
      });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log("[useAuth] Auth state changed:", _event);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });
    
    // Handle visibility change to refresh session when tab resumes focus
    // This helps restore sessions that may have expired while tab was inactive
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        console.log("[useAuth] Tab visible - checking session...");
        try {
          // First try to get the current session
          const { data: { session }, error } = await supabase.auth.getSession();
          
          if (error) {
            console.warn("[useAuth] Error getting session on visibility change:", error);
            return;
          }
          
          if (session) {
            // Session exists and is valid - only refresh if token is close to expiry
            // Check if token expires within next 5 minutes
            const expiresAt = session.expires_at;
            const fiveMinutesFromNow = Math.floor(Date.now() / 1000) + 300;
            
            if (expiresAt && expiresAt < fiveMinutesFromNow) {
              // Token expires soon - refresh it
              console.log("[useAuth] Token expiring soon, refreshing...");
              const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
              if (refreshError) {
                console.warn("[useAuth] Error refreshing session:", refreshError);
                // Don't set user to null on refresh error - keep existing session
                // The onAuthStateChange will handle actual sign-outs
              } else if (refreshData.session) {
                console.log("[useAuth] Session refreshed successfully");
                setUser(refreshData.session.user);
              }
            } else {
              // Token is still valid - no need to refresh
              console.log("[useAuth] Session still valid, no refresh needed");
            }
          } else {
            // No session found - but don't immediately set null
            // Check localStorage for session tokens before declaring signed out
            const hasLocalTokens = Object.keys(localStorage).some(key => 
              key.startsWith('sb-') && key.includes('-auth-token')
            );
            
            if (!hasLocalTokens) {
              console.log("[useAuth] No session found on visibility change");
              setUser(null);
            } else {
              console.log("[useAuth] No session but local tokens exist - waiting for auth state change");
            }
          }
        } catch (err) {
          console.warn("[useAuth] Error in visibility change handler:", err);
          // Don't set user to null on errors - keep existing state
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [supabase]);
  
  // Check if user has completed first login (from user_metadata)
  const hasCompletedFirstLogin = useCallback((): boolean => {
    if (!user) return false;
    return user.user_metadata?.first_login_completed === true;
  }, [user]);
  
  // Detect signup method from session AMR (Authentication Methods Reference)
  const detectSignupMethod = useCallback(async (): Promise<{ signupMethod: string; passwordCreated: boolean }> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Check the AMR claim to see what auth methods were used
        const amr = (session as any).user?.amr || [];
        const hasPasswordAuth = amr.some((method: any) => method.method === 'password');
        const hasOtpAuth = amr.some((method: any) => method.method === 'otp');
        
        // Also check identities for OAuth providers
        const identities = session.user?.identities || [];
        const hasGoogleIdentity = identities.some((id: any) => id.provider === 'google');
        const hasAppleIdentity = identities.some((id: any) => id.provider === 'apple');
        
        if (hasGoogleIdentity) {
          return { signupMethod: 'google', passwordCreated: hasPasswordAuth };
        } else if (hasAppleIdentity) {
          return { signupMethod: 'apple', passwordCreated: hasPasswordAuth };
        } else if (hasPasswordAuth) {
          return { signupMethod: 'password', passwordCreated: true };
        } else if (hasOtpAuth) {
          return { signupMethod: 'magic_link', passwordCreated: false };
        }
      }
      return { signupMethod: 'magic_link', passwordCreated: false };
    } catch (error) {
      console.error('Error detecting signup method:', error);
      return { signupMethod: 'magic_link', passwordCreated: false };
    }
  }, [supabase]);
  
  // Mark first login as completed (stores in user_metadata and updates profile)
  const markFirstLoginCompleted = useCallback(async (): Promise<boolean> => {
    try {
      // Detect and record signup method
      const { signupMethod, passwordCreated } = await detectSignupMethod();
      console.log('[useAuth] Detected signup method:', signupMethod, 'passwordCreated:', passwordCreated);
      
      // Update user metadata
      const { error } = await supabase.auth.updateUser({
        data: { first_login_completed: true }
      });
      if (error) {
        console.error("Failed to mark first login completed:", error);
        return false;
      }
      
      // Update profile with signup method (only if not already set)
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await fetch('/api/auth/profile/signup-method', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ signupMethod, passwordCreated }),
          });
        }
      } catch (profileError) {
        console.error("Failed to update profile signup method:", profileError);
        // Don't fail the overall operation if profile update fails
      }
      
      // Refresh the user to get updated metadata
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setUser(data.user);
      }
      return true;
    } catch (error) {
      console.error("Error marking first login completed:", error);
      return false;
    }
  }, [supabase, detectSignupMethod]);

  const signUp = async (email: string, password: string, firstName: string, lastName: string) => {
    // Clear any guest game data before signing up to prevent conflicts
    clearUserCache();
    // Also clear React Query cache to ensure fresh data fetch
    queryClient.clear();
    
    // Call server-side signup endpoint which creates both auth user and profile
    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, firstName, lastName }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Signup failed');
    }

    const { user } = await response.json();

    // Now sign in with the created credentials
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return data;
  };

  const signIn = async (email: string, password: string) => {
    // Clear any guest game data before signing in to prevent conflicts
    clearUserCache();
    // Also clear React Query cache to ensure fresh data fetch
    queryClient.clear();
    
    const { data, error} = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    signUp,
    signIn,
    signOut,
    hasCompletedFirstLogin,
    markFirstLoginCompleted,
  };
}
