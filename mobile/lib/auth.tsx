import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Linking, Platform } from 'react-native';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { migrateGuestDataToUser } from './guestMigration';
import { logInRevenueCat, logOutRevenueCat } from './RevenueCat';

// Lazy accessor to break circular dependency:
// auth.tsx -> guestMigration.ts -> _layout.tsx -> auth.tsx
// Using deferred require() ensures _layout's queryClient is initialized by call time.
const getQueryClient = () => require('../app/_layout').queryClient;

// ============================================================
// Auth Orchestrator — State Machine
// ============================================================
// Phases:
//   initializing    → getSession + checkDeepLink running
//   processing_link → Deep link token being verified
//   fetching_profile→ Profile being loaded/created
//   merging_data    → Guest data being migrated
//   ready           → All done, safe to navigate
// ============================================================

export type AuthPhase =
    | 'initializing'
    | 'processing_link'
    | 'fetching_profile'
    | 'merging_data'
    | 'ready';

type AuthContextType = {
    session: Session | null;
    user: User | null;
    isGuest: boolean;
    isAuthenticated: boolean;
    authPhase: AuthPhase;
    signInWithEmail: (email: string, password: string) => Promise<{ error: any }>;
    signUpWithEmail: (email: string, password: string) => Promise<{ error: any }>;
    signOut: () => Promise<void>;
    hasCompletedFirstLogin: () => boolean;
    markFirstLoginCompleted: () => Promise<void>;
    markSigningIn: () => void;
};

const AuthContext = createContext<AuthContextType>({
    session: null,
    user: null,
    isGuest: false,
    isAuthenticated: false,
    authPhase: 'initializing',
    signInWithEmail: async () => ({ error: null }),
    signUpWithEmail: async () => ({ error: null }),
    signOut: async () => { },
    hasCompletedFirstLogin: () => false,
    markFirstLoginCompleted: async () => { },
    markSigningIn: () => { },
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

// Helper: wrap a promise with a timeout
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error(`[Auth] ${label} timed out after ${ms}ms`)), ms)
        ),
    ]);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [isGuest, setIsGuest] = useState(false);
    const [authPhase, setAuthPhase] = useState<AuthPhase>('initializing');
    const appStateRef = useRef(AppState.currentState);

    // Track safety timeout attempts for social auth hang recovery
    const safetyAttemptRef = useRef(0);

    // Track whether initAuth has completed to prevent onAuthStateChange
    // from racing ahead during the initial setup
    const initCompleteRef = useRef(false);

    // Track deliberate sign-in to suppress authPhase transitions in onAuthStateChange.
    // When true, the pipeline runs silently without setting intermediate phases
    // (fetching_profile, merging_data) that would cause the splash to re-appear.
    const signingInRef = useRef(false);

    // ============================================================
    // AppState lifecycle: refresh Supabase connection on foreground resume
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
                            // Don't force sign-out — Supabase auto-refresh will handle recovery.
                            // Forcing sign-out here races with OAuth handoff (Google/Apple)
                            // and kills the session before the sign-in callback completes.
                            console.warn('[Auth] Session refresh failed on resume (non-fatal):', refreshError.message);
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

    // ============================================================
    // [PROFILE GATE] Verify profile data is loaded with retry + fallback creation.
    // ============================================================
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
                    getQueryClient().setQueryData(['user_profile', userId], data);
                    return true;
                }

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
                getQueryClient().setQueryData(['user_profile', userId], newProfile);
            }
            return true;
        } catch (e) {
            console.error('[Auth] Fallback profile creation error:', e);
            return true; // Never hang
        }
    };

    // ============================================================
    // [GUEST MIGRATION] Run guest data migration for any sign-in method
    // ============================================================
    const runGuestMigration = async (userId: string): Promise<void> => {
        try {
            console.log('[Auth] Checking for guest data to migrate:', userId);
            const migrationResult = await migrateGuestDataToUser(userId);
            if (migrationResult.success && migrationResult.migratedGames > 0) {
                console.log(`[Auth] Guest migration successful: ${migrationResult.migratedGames} games migrated`);
            }
        } catch (e) {
            // Never block auth on migration failure
            console.error('[Auth] Guest migration error (non-blocking):', e);
        }
    };

    // ============================================================
    // Full post-sign-in pipeline: profile → migration → RevenueCat
    // Called from both initAuth and onAuthStateChange
    // ============================================================
    const runPostSignInPipeline = async (
        sessionUser: User,
        options?: { skipRevenueCat?: boolean }
    ): Promise<void> => {
        // Phase: fetching_profile
        setAuthPhase('fetching_profile');
        try {
            await logInRevenueCat(sessionUser.id);
        } catch (e) {
            console.error('[Auth] RevenueCat login error (non-blocking):', e);
        }

        await syncOAuthProfile(sessionUser);
        await ensureProfileReady(sessionUser.id, sessionUser.user_metadata);

        // Phase: merging_data
        setAuthPhase('merging_data');
        await runGuestMigration(sessionUser.id);
    };

    // ============================================================
    // NATIVE DEEP LINK HANDLER
    // Only runs on native. Web uses detectSessionInUrl: true.
    // Returns true if a deep link was detected and needs processing.
    // ============================================================
    const checkNativeDeepLink = async (): Promise<{ handled: boolean }> => {
        if (Platform.OS === 'web') return { handled: false };

        try {
            const url = await Linking.getInitialURL();
            if (!url) return { handled: false };

            console.log('[Auth] Native deep link detected:', url);
            const urlObj = new URL(url);
            const searchParams = new URLSearchParams(urlObj.search);
            const hashParams = urlObj.hash
                ? new URLSearchParams(urlObj.hash.substring(1))
                : new URLSearchParams();

            // --- Magic Link ---
            const tokenHash = searchParams.get('token_hash');
            const type = searchParams.get('type');
            const isMagicLink = tokenHash && (type === 'magiclink' || type === 'email');

            if (isMagicLink) {
                console.log('[Auth] Magic link — verifying OTP');
                setAuthPhase('processing_link');
                const { error } = await supabase.auth.verifyOtp({
                    token_hash: tokenHash,
                    type: type === 'email' ? 'email' : 'magiclink',
                });
                if (error) {
                    console.error('[Auth] Magic link verification error:', error);
                }
                // Session will be set by onAuthStateChange
                return { handled: true };
            }

            // --- Hash-based auth tokens (e.g. from OAuth redirect) ---
            const accessToken = hashParams.get('access_token');
            const refreshToken = hashParams.get('refresh_token');
            if (accessToken && refreshToken) {
                console.log('[Auth] Auth tokens in deep link — setting session');
                setAuthPhase('processing_link');
                const { error } = await supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken,
                });
                if (error) {
                    console.error('[Auth] Session set error from deep link:', error);
                }
                return { handled: true };
            }
        } catch (e) {
            console.error('[Auth] Deep link processing error:', e);
        }

        return { handled: false };
    };

    // ============================================================
    // MAIN INITIALIZATION — runs once on mount
    // ============================================================
    useEffect(() => {
        const initAuth = async () => {
            try {
                // Step 1: Check for deep link tokens FIRST (native only)
                // This must happen BEFORE getSession to prevent stale-session
                // premature routing — the deep link may set a NEW session.
                const { handled: linkHandled } = await checkNativeDeepLink();

                if (linkHandled) {
                    // Deep link was processed — onAuthStateChange will handle the rest
                    initCompleteRef.current = true;
                    // Don't set phase to 'ready' yet — let onAuthStateChange do it
                    return;
                }

                // Step 2: No deep link — get existing session
                let existingSession: Session | null = null;
                try {
                    const { data: { session: s } } = await withTimeout(
                        supabase.auth.getSession(),
                        5000,
                        'getSession'
                    );
                    existingSession = s;
                } catch (e) {
                    console.warn('[Auth] getSession timed out or failed:', e);
                }

                // Step 3: Evaluate existing session
                if (existingSession) {
                    setSession(existingSession);
                    setUser(existingSession.user);
                    setIsGuest(false);

                    // Run full post-sign-in pipeline
                    await runPostSignInPipeline(existingSession.user);
                } else {
                    // No session — check if previously in guest mode
                    const storedGuest = await AsyncStorage.getItem('is_guest');
                    if (storedGuest === 'true') {
                        setIsGuest(true);
                    }
                }
            } catch (e) {
                console.error('[Auth] Initialization error:', e);
            } finally {
                initCompleteRef.current = true;
                setAuthPhase('ready');
            }
        };

        initAuth();

        // ============================================================
        // onAuthStateChange listener
        // ============================================================
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
            // ⚠️ CRITICAL: This callback MUST NOT await any supabase.from() calls!
            // Supabase's setSession() holds an internal auth lock while awaiting
            // _notifyAllSubscribers → this callback. If we do supabase.from() here,
            // it calls getSession() which needs the same lock → DEADLOCK.
            // All heavy async work is deferred via setTimeout to run after the
            // lock is released.
            console.log('[Auth] State change:', event, newSession?.user?.id);

            setSession(newSession);
            setUser(newSession?.user ?? null);

            if (newSession && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
                setIsGuest(false);
                AsyncStorage.removeItem('is_guest'); // fire-and-forget, no await needed

                // Wait for initAuth to complete before running the pipeline
                // to avoid running it twice on startup
                if (!initCompleteRef.current) {
                    console.log('[Auth] onAuthStateChange fired before initAuth complete — deferring');
                    return;
                }

                // If this is a deliberate sign-in (user clicked login),
                // run the pipeline SILENTLY without setting intermediate authPhase values.
                // This prevents the splash screen from re-appearing.
                const isDeliberateSignIn = signingInRef.current;
                if (isDeliberateSignIn) {
                    console.log('[Auth] Deliberate sign-in detected — running pipeline silently (no phase transitions)');
                    signingInRef.current = false;
                }

                // Defer pipeline to next tick so the auth lock is released first.
                // This prevents the deadlock described above.
                setTimeout(async () => {
                    try {
                        if (isDeliberateSignIn) {
                            // Silent pipeline: do the same work but don't change authPhase
                            try { await logInRevenueCat(newSession.user.id); } catch (e) { console.error('[Auth] RevenueCat login error:', e); }
                            await syncOAuthProfile(newSession.user);
                            await ensureProfileReady(newSession.user.id, newSession.user.user_metadata);
                            await runGuestMigration(newSession.user.id);
                        } else {
                            await runPostSignInPipeline(newSession.user);
                        }
                    } catch (e) {
                        console.error('[Auth] Post-sign-in pipeline error:', e);
                    } finally {
                        // Force all mounted queries to refetch with the new user's session
                        getQueryClient().invalidateQueries();
                        setAuthPhase('ready');
                    }
                }, 0);
                return;
            }

            if (event === 'SIGNED_OUT') {
                // Defer logout work to avoid lock contention
                setTimeout(async () => {
                    console.log('[Auth] Logging out from RevenueCat...');
                    try {
                        await logOutRevenueCat();
                    } catch (e) {
                        console.warn('[Auth] RevenueCat logout failed (likely network):', e);
                    }
                    setAuthPhase('ready');
                }, 0);
                return;
            }

            // For other events (USER_UPDATED, PASSWORD_RECOVERY, etc.)
            if (initCompleteRef.current) {
                setAuthPhase('ready');
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    // ============================================================
    // SAFETY TIMEOUT — prevents social auth hangs
    // If authPhase hasn't reached 'ready' within 5s, attempt recovery.
    // First attempt: try refreshing the session. If still stuck after
    // another 5s, force authPhase to 'ready' unconditionally.
    // ============================================================
    useEffect(() => {
        if (authPhase === 'ready') {
            safetyAttemptRef.current = 0; // Reset on success
            return;
        }

        const timeout = setTimeout(async () => {

            safetyAttemptRef.current += 1;
            const attempt = safetyAttemptRef.current;

            if (attempt === 1) {
                console.warn('[Auth] SAFETY TIMEOUT (attempt 1): authPhase stuck — trying session refresh');
                try {
                    const { data: { session: s } } = await supabase.auth.getSession();
                    if (s) {
                        setSession(s);
                        setUser(s.user);
                        setIsGuest(false);
                        initCompleteRef.current = true;
                        await runPostSignInPipeline(s.user);
                        setAuthPhase('ready');
                    } else {
                        // No session at all — just force ready
                        initCompleteRef.current = true;
                        setAuthPhase('ready');
                    }
                } catch (e) {
                    console.error('[Auth] Safety timeout session refresh failed:', e);
                    initCompleteRef.current = true;
                    setAuthPhase('ready');
                }
            } else {
                console.warn(`[Auth] SAFETY TIMEOUT (attempt ${attempt}): forcing authPhase to ready`);
                initCompleteRef.current = true;
                setAuthPhase('ready');
            }
        }, 5000);

        return () => clearTimeout(timeout);
    }, [authPhase]);

    // ============================================================
    // WARM-START DEEP LINK HANDLER (native only)
    // Handles deep links received while the app is already running
    // ============================================================
    useEffect(() => {
        if (Platform.OS === 'web') return; // Web handled by detectSessionInUrl

        const handleDeepLink = async (event: { url: string }) => {
            const { url } = event;
            console.log('[Auth] Warm-start deep link:', url);

            try {
                const urlObj = new URL(url);
                const searchParams = new URLSearchParams(urlObj.search);
                const hashParams = urlObj.hash
                    ? new URLSearchParams(urlObj.hash.substring(1))
                    : new URLSearchParams();

                // --- Magic Link ---
                const tokenHash = searchParams.get('token_hash');
                const type = searchParams.get('type');
                const isMagicLink = tokenHash && (type === 'magiclink' || type === 'email');

                if (isMagicLink) {
                    console.log('[Auth] Warm-start magic link — verifying OTP');
                    setAuthPhase('processing_link');
                    const { error } = await supabase.auth.verifyOtp({
                        token_hash: tokenHash,
                        type: type === 'email' ? 'email' : 'magiclink',
                    });
                    if (error) {
                        console.error('[Auth] Magic link verification error:', error);
                    }
                    // onAuthStateChange will set phase to ready
                    return;
                }

                // --- Hash-based auth tokens (e.g. from OAuth redirect) ---
                const accessToken = hashParams.get('access_token');
                const refreshToken = hashParams.get('refresh_token');
                if (accessToken && refreshToken) {
                    console.log('[Auth] Warm-start auth tokens — setting session');
                    setAuthPhase('processing_link');
                    const { error } = await supabase.auth.setSession({
                        access_token: accessToken,
                        refresh_token: refreshToken,
                    });
                    if (error) {
                        console.error('[Auth] Session set error:', error);
                    }
                    setAuthPhase('ready');
                    return;
                }
            } catch (e) {
                console.error('[Auth] Warm-start deep link error:', e);
            }
        };

        const subscription = Linking.addEventListener('url', handleDeepLink);
        return () => subscription.remove();
    }, []);

    // ============================================================
    // Sign-in methods
    // Note: Guest migration is now handled in the pipeline (onAuthStateChange)
    // so we no longer call migrateGuestDataToUser here.
    // ============================================================
    const signInWithEmail = async (email: string, password: string) => {
        // Mark as deliberate sign-in to suppress splash re-flash
        signingInRef.current = true;

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            signingInRef.current = false; // Reset on failure
        }

        // onAuthStateChange SIGNED_IN will trigger the full pipeline
        // (ensureProfileReady + runGuestMigration + RevenueCat)
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

                // onAuthStateChange SIGNED_IN will trigger the full pipeline
                // (ensureProfileReady + runGuestMigration + RevenueCat)
            }

            return { data, error: null };
        } catch (error: any) {
            return { error };
        }
    };

    // ============================================================
    // Sign out
    // ============================================================

    // Clears cached data only — does NOT touch auth state (session/user/isGuest).
    // Auth state transitions are driven by onAuthStateChange events.
    const clearUserCaches = async () => {
        console.log('[Auth] Clearing user caches...');
        try {
            // Query cache is invalidated by onAuthStateChange SIGNED_IN handler
            // (not here — clearing here breaks observers and prevents refetch)

            const keysToRemove = [
                'cached_first_name',
                'cached_game_status_region',
                'cached_game_status_user',
                'cached_subscription_status',
                'puzzle_readiness_cache',
                'is_guest',
            ];
            await AsyncStorage.multiRemove(keysToRemove);

            const allKeys = await AsyncStorage.getAllKeys();
            const puzzleCacheKeys = allKeys.filter(k => k.startsWith('puzzle_data_'));
            if (puzzleCacheKeys.length > 0) {
                await AsyncStorage.multiRemove(puzzleCacheKeys);
            }

            console.log('[Auth] All caches cleared successfully');
        } catch (e) {
            console.error('[Auth] Error clearing caches:', e);
        }
    };

    const signOut = async () => {
        console.log('[Auth] Signing out...');
        // Sign out FIRST — onAuthStateChange SIGNED_OUT handles state reset naturally
        try {
            await supabase.auth.signOut();
        } catch (error) {
            console.log('[Auth] Supabase signOut completed with note:', error);
        }
        // Clear caches AFTER sign-out so observers aren't destroyed mid-transition
        await clearUserCaches();
    };



    const hasCompletedFirstLogin = () => {
        if (isGuest) return true;
        return !!user?.user_metadata?.first_login_completed;
    };

    const markFirstLoginCompleted = async () => {
        if (isGuest) return;
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

    // Expose markSigningIn so login.tsx can flag social auth flows
    const markSigningIn = () => {
        signingInRef.current = true;
    };

    return (
        <AuthContext.Provider
            value={{
                session,
                user,
                isGuest,
                isAuthenticated: !!user && !isGuest,
                authPhase,
                signInWithEmail,
                signUpWithEmail,
                signOut,
                hasCompletedFirstLogin,
                markFirstLoginCompleted,
                markSigningIn
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
