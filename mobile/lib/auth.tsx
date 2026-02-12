import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { migrateGuestDataToUser } from './guestMigration';
import { logInRevenueCat, logOutRevenueCat } from './RevenueCat';
import { queryClient } from '../app/_layout';

type AuthContextType = {
    session: Session | null;
    user: User | null;
    isGuest: boolean;
    isAuthenticated: boolean;
    loading: boolean;
    profileLoading: boolean; // True while profile data is being fetched after sign-in
    signInWithEmail: (email: string, password: string) => Promise<{ error: any }>;
    signUpWithEmail: (email: string, password: string) => Promise<{ error: any }>;
    signOut: () => Promise<void>;
    hasCompletedFirstLogin: () => boolean;
    markFirstLoginCompleted: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
    session: null,
    user: null,
    isGuest: false,
    isAuthenticated: false,
    loading: true,
    profileLoading: false,
    signInWithEmail: async () => ({ error: null }),
    signUpWithEmail: async () => ({ error: null }),
    signOut: async () => { },
    hasCompletedFirstLogin: () => false,
    markFirstLoginCompleted: async () => { },
});

// Helper function to sync OAuth provider linkage to database
async function syncOAuthProfile(user: User) {
    try {
        const googleIdentity = user.identities?.find(i => i.provider === 'google');
        const appleIdentity = user.identities?.find(i => i.provider === 'apple');

        const updates: any = {};
        if (googleIdentity) {
            updates.google_linked = true;
        }
        if (appleIdentity) {
            updates.apple_linked = true;
        }

        if (Object.keys(updates).length > 0) {
            console.log('[Auth] Syncing OAuth profile:', updates);
            const { error } = await supabase
                .from('user_profiles')
                .update(updates)
                .eq('id', user.id);

            if (error) {
                console.error('[Auth] Error syncing OAuth profile:', error);
            } else {
                console.log('[Auth] OAuth profile synced successfully');
            }
        }
    } catch (error) {
        console.error('[Auth] Error in syncOAuthProfile:', error);
    }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [isGuest, setIsGuest] = useState(false);
    const [loading, setLoading] = useState(true);
    const [profileLoading, setProfileLoading] = useState(false);
    const appStateRef = useRef(AppState.currentState);

    // ============================================================
    // AppState lifecycle: refresh Supabase connection on foreground resume
    // Fixes iOS production issue where backgrounding the app for 30+ min
    // causes the Supabase socket/session to go stale, hanging all requests.
    // ============================================================
    useEffect(() => {
        const subscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
            if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
                console.log('[Auth] App resumed to foreground — refreshing connection');
                supabase.auth.startAutoRefresh();

                // Validate session is still alive with a lightweight call
                try {
                    const { error } = await supabase.auth.getUser();
                    if (error) {
                        console.warn('[Auth] Session stale on resume, attempting refresh...', error.message);
                        const { error: refreshError } = await supabase.auth.refreshSession();
                        if (refreshError) {
                            console.error('[Auth] Session refresh permanently failed — signing out:', refreshError.message);
                            // Permanent failure: force full sign-out to redirect user to login
                            await signOutAndClearCaches();
                        } else {
                            console.log('[Auth] Session refreshed successfully after resume');
                        }
                    } else {
                        console.log('[Auth] Session validated successfully on resume');
                    }
                } catch (e) {
                    console.error('[Auth] Failed to validate session on resume:', e);
                }
            } else if (nextAppState.match(/inactive|background/)) {
                console.log('[Auth] App entering background — stopping auto refresh');
                supabase.auth.stopAutoRefresh();
            }
            appStateRef.current = nextAppState;
        });

        return () => subscription.remove();
    }, []);

    // [PROFILE GATE] Verify profile data is loaded with retry + fallback creation.
    // Social login (Apple/Google) can fire SIGNED_IN before the DB trigger
    // creates the user_profiles row. This polls up to 3 times with 1s delays,
    // then creates a minimal row as a fallback if needed.
    const ensureProfileReady = async (userId: string, userMeta?: Record<string, any>): Promise<boolean> => {
        const MAX_RETRIES = 3;
        const RETRY_DELAY_MS = 1000;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                const { data, error } = await supabase
                    .from('user_profiles')
                    .select('*')
                    .eq('id', userId)
                    .maybeSingle();

                if (error) {
                    console.warn(`[Auth] Profile check attempt ${attempt}/${MAX_RETRIES} failed:`, error.message);
                    if (attempt < MAX_RETRIES) {
                        await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
                        continue;
                    }
                    return true; // Don't block — proceed and let NavigationGuard handle
                }

                if (data) {
                    console.log(`[Auth] Profile confirmed for user on attempt ${attempt}:`, userId);
                    // Prime React Query cache with the profile data
                    queryClient.setQueryData(['user_profile', userId], data);
                    return true;
                }

                // No data yet — retry if attempts remain
                if (attempt < MAX_RETRIES) {
                    console.log(`[Auth] No profile yet (attempt ${attempt}/${MAX_RETRIES}) — retrying in ${RETRY_DELAY_MS}ms...`);
                    await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
                }
            } catch (e) {
                console.error(`[Auth] Profile readiness check error (attempt ${attempt}):`, e);
                if (attempt < MAX_RETRIES) {
                    await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
                }
            }
        }

        // After all retries, profile still doesn't exist — create a minimal one
        console.log('[Auth] Profile not found after retries — creating minimal profile');
        try {
            const fullName = userMeta?.full_name || userMeta?.name || 'Player';
            const email = userMeta?.email || 'unknown@elementle.tech';
            const nameParts = fullName.split(' ');
            const { data: newProfile, error: insertError } = await supabase
                .from('user_profiles')
                .upsert({
                    id: userId,
                    email,
                    first_name: nameParts[0] || 'Player',
                    last_name: nameParts.slice(1).join(' ') || null,
                } as any)
                .select('*')
                .single();

            if (insertError) {
                console.error('[Auth] Fallback profile creation failed:', insertError);
                return true; // Don't hang
            }

            console.log('[Auth] Minimal profile created successfully for:', userId);
            if (newProfile) {
                queryClient.setQueryData(['user_profile', userId], newProfile);
            }
            return true;
        } catch (e) {
            console.error('[Auth] Fallback profile creation error:', e);
            return true; // Never hang
        }
    };

    useEffect(() => {
        const initAuth = async () => {
            try {
                // Check active sessions
                const { data: { session } } = await supabase.auth.getSession();

                if (session) {
                    setSession(session);
                    setUser(session.user);
                    setIsGuest(false);

                    // [FIX] Wait for profile before marking as loaded
                    await ensureProfileReady(session.user.id, session.user.user_metadata);
                } else {
                    // Check if previously in guest mode
                    const storedGuest = await AsyncStorage.getItem('is_guest');
                    if (storedGuest === 'true') {
                        setIsGuest(true);
                    }
                }
            } catch (e) {
                console.error("Auth initialization error:", e);
            } finally {
                setLoading(false);
            }
        };

        initAuth();

        // Listen for changes on auth state
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('[Auth] State change:', event, session?.user?.id);
            setSession(session);
            setUser(session?.user ?? null);

            if (session) {
                setIsGuest(false);
                await AsyncStorage.removeItem('is_guest');

                // CRITICAL: Link RevenueCat identity with Supabase user ID
                if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                    // [FIX] Use profileLoading (not loading) to gate NavigationGuard
                    // routing WITHOUT triggering the splash overlay
                    setProfileLoading(true);
                    try {
                        console.log('[Auth] Linking RevenueCat identity...');
                        await logInRevenueCat(session.user.id);

                        // Sync OAuth provider linkage to database
                        await syncOAuthProfile(session.user);

                        // [FIX] Wait for profile data before declaring auth ready
                        await ensureProfileReady(session.user.id, session.user.user_metadata);
                    } catch (e) {
                        console.error('[Auth] Error during sign-in setup:', e);
                    } finally {
                        setProfileLoading(false);
                    }
                    return; // profileLoading handled above
                }
            } else if (event === 'SIGNED_OUT') {
                // Log out from RevenueCat when signing out
                console.log('[Auth] Logging out from RevenueCat...');
                try {
                    await logOutRevenueCat();
                } catch (e) {
                    // [FIX] Gracefully handle network errors on sign-out
                    console.warn('[Auth] RevenueCat logout failed (likely network):', e);
                }
            }
            // If session is null, we don't automatically set guest to false/true 
            // because signOut logic handles that explicitly.
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    const signInWithEmail = async (email: string, password: string) => {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (!error && data.user) {
            // Always check for guest data to migrate on login
            // The migration function handles checking if there is data and avoiding duplicates
            try {
                console.log('[Auth] Checking for guest data to migrate (login):', data.user.id);
                const migrationResult = await migrateGuestDataToUser(data.user.id);
                if (migrationResult.success && migrationResult.migratedGames > 0) {
                    console.log(`[Auth] Guest migration successful: ${migrationResult.migratedGames} games migrated`);
                }
            } catch (migrationError) {
                console.error('[Auth] Error during guest migration (login):', migrationError);
            }
        }

        return { error };
    };

    const signUpWithEmail = async (email: string, password: string) => {
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
            });

            if (error) {
                return { error };
            }

            // Mark password_created in user_profiles since user created account with password
            if (data.session && data.user) {
                try {
                    console.log('[Auth] Marking password_created=true for user:', data.user.id);
                    const { error: updateError } = await supabase
                        .from('user_profiles')
                        .update({
                            password_created: true,
                            signup_method: 'password'
                        })
                        .eq('id', data.user.id);

                    if (updateError) {
                        console.error('[Auth] Error setting password_created:', updateError);
                    } else {
                        console.log('[Auth] Successfully marked password_created=true');
                    }
                } catch (err) {
                    console.error('[Auth] Error updating password_created:', err);
                }

                // Migrate guest data if converting from guest mode
                try {
                    console.log('[Auth] Starting guest data migration for user:', data.user.id);
                    const migrationResult = await migrateGuestDataToUser(data.user.id);
                    if (migrationResult.success) {
                        console.log(`[Auth] Guest migration successful: ${migrationResult.migratedGames} games migrated`);
                    } else {
                        console.error('[Auth] Guest migration failed:', migrationResult.error);
                    }
                } catch (migrationError) {
                    console.error('[Auth] Error during guest migration:', migrationError);
                }
            }

            return { data, error: null };
        } catch (error: any) {
            return { error };
        }
    };



    // Internal helper: clear all caches and local state ("Nuke & Pave")
    const signOutAndClearCaches = async () => {
        console.log('[Auth] Clearing all caches and local state...');
        try {
            // 1. Clear React Query caches to prevent stale data leaking between accounts
            queryClient.removeQueries();

            // 2. Clear AsyncStorage caches (game status, puzzle data, profile)
            const keysToRemove = [
                'cached_first_name',
                'cached_game_status_region',
                'cached_game_status_user',
                'cached_subscription_status',
                'puzzle_readiness_cache',
                'is_guest',
            ];
            await AsyncStorage.multiRemove(keysToRemove);

            // Also clear any puzzle data caches (keyed dynamically)
            const allKeys = await AsyncStorage.getAllKeys();
            const puzzleCacheKeys = allKeys.filter(k => k.startsWith('puzzle_data_'));
            if (puzzleCacheKeys.length > 0) {
                await AsyncStorage.multiRemove(puzzleCacheKeys);
            }

            console.log('[Auth] All caches cleared successfully');
        } catch (e) {
            console.error('[Auth] Error clearing caches:', e);
        }

        // 3. Reset auth state
        setSession(null);
        setUser(null);
        setIsGuest(false);
    };

    const signOut = async () => {
        console.log('[Auth] Signing out...');

        // Clear all caches BEFORE signing out of Supabase
        await signOutAndClearCaches();

        try {
            // Remove explicit RevenueCat logout here - the onAuthStateChange listener handles it
            // This prevents a "double logout" error where the second call fails because user is already anonymous
            await supabase.auth.signOut();
        } catch (error) {
            // Ignore iOS BrowserEngineKit errors usually caused by terminating empty auth sessions
            console.log('[Auth] Supabase signOut completed with note:', error);
        }
    };

    const hasCompletedFirstLogin = () => {
        if (isGuest) return true; // Guests don't need first login setup
        return !!user?.user_metadata?.first_login_completed;
    };

    const markFirstLoginCompleted = async () => {
        if (isGuest) return; // No-op for guests
        if (!user) return;
        const { data, error } = await supabase.auth.updateUser({
            data: { first_login_completed: true }
        });

        if (error) {
            console.error('Error updating first login metadata:', error);
        } else {
            setUser(data.user);
        }
    };

    return (
        <AuthContext.Provider
            value={{
                session,
                user,
                isGuest,
                isAuthenticated: !!user && !isGuest,
                loading,
                profileLoading,
                signInWithEmail,
                signUpWithEmail,
                signOut,
                hasCompletedFirstLogin,
                markFirstLoginCompleted
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
