import { useState, useEffect, useCallback } from 'react';
import { useSupabase } from '@/lib/SupabaseProvider';
import type { User } from '@supabase/supabase-js';

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
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);
  
  // Check if user has completed first login (from user_metadata)
  const hasCompletedFirstLogin = useCallback((): boolean => {
    if (!user) return false;
    return user.user_metadata?.first_login_completed === true;
  }, [user]);
  
  // Mark first login as completed (stores in user_metadata)
  const markFirstLoginCompleted = useCallback(async (): Promise<boolean> => {
    try {
      const { error } = await supabase.auth.updateUser({
        data: { first_login_completed: true }
      });
      if (error) {
        console.error("Failed to mark first login completed:", error);
        return false;
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
  }, [supabase]);

  const signUp = async (email: string, password: string, firstName: string, lastName: string) => {
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
