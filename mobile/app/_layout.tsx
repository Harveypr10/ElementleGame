import React, { Suspense } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform, AppState, AppStateStatus, LogBox } from 'react-native';

// Suppress known simulator-only errors that don't affect production
LogBox.ignoreLogs([
    'Cannot find native module \'ExpoPushTokenManager\'',  // Push notifications unavailable in simulator
    'Consent flow error',                                   // AdMob not configured for dev/simulator
    'Failed to read publisher\'s account configuration',    // Same AdMob issue, alternate message
]);
import { Stack, useRouter, useSegments } from 'expo-router';
import * as Sentry from '@sentry/react-native';
import * as NotificationService from '../lib/NotificationService';
import { useNotificationData } from '../hooks/useNotificationData';

// Initialize Sentry at module level (before any component renders)
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
if (!SENTRY_DSN) {
    console.warn('[Sentry] EXPO_PUBLIC_SENTRY_DSN is not set — Sentry is disabled');
}
Sentry.init({
    dsn: SENTRY_DSN,
    debug: __DEV__,
    enabled: !__DEV__ && !!SENTRY_DSN,

    // Performance: disabled to save transaction quota
    tracesSampleRate: 0.0,

    // Session Replay: only capture on error (50 free replays/month)
    replaysSessionSampleRate: 0.0,
    replaysOnErrorSampleRate: 1.0,

    // Filter common non-fatal noise to preserve error quota
    ignoreErrors: [
        'Network request failed',
        'Failed to fetch',
        'NetworkError',
        'AbortError',
        'Timeout',
        'TypeError: cancelled',
        'TypeError: network request failed',
        'Cannot find native module',
    ],
});
import { styled } from 'nativewind';
import { ThemedView } from '../components/ThemedView';
import { WebContainer } from '../components/WebContainer';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';

// Import global CSS for NativeWind web support
import '../global.css';

const StyledView = styled(View);
import { useEffect, useState, useCallback, useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../lib/auth';
import { OptionsProvider, useOptions } from '../lib/options';
import { StreakSaverProvider } from '../contexts/StreakSaverContext';
import { ToastProvider, useToast } from '../contexts/ToastContext';
import { ConversionPromptProvider } from '../contexts/ConversionPromptContext';
import { AppReadinessProvider } from '../contexts/AppReadinessContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { GuessCacheProvider } from '../contexts/GuessCacheContext';
import { NetworkProvider, useNetwork } from '../contexts/NetworkContext';
import { syncPendingGames } from '../lib/sync';
import { useFonts, Nunito_400Regular, Nunito_500Medium, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold } from '@expo-google-fonts/nunito';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ConversionPromptModal } from '../components/ConversionPromptModal';

import { initializeRevenueCat } from '../lib/RevenueCat';
import { SplashScreen } from '../components/SplashScreen';
import { StreakCelebrationProvider } from '../contexts/StreakCelebrationContext';
import { LeagueProvider, useLeague } from '../contexts/LeagueContext';
// Lazy-loaded to avoid adding to _layout.tsx's initial module graph,
// which has fragile pre-existing require cycles through guestMigration → auth
const SubscriptionLifecycleManager = React.lazy(
    () => import('../components/subscription/SubscriptionLifecycleManager').then(
        m => ({ default: m.SubscriptionLifecycleManager })
    )
);

import { Asset } from 'expo-asset';
import '../lib/typography'; // Global Font Patch

// [FONT FIX] Prevent native splash from auto-hiding before fonts load
ExpoSplashScreen.preventAutoHideAsync();

/* 
  Initialize TanStack Query Client
  Configuration:
  - aggressive caching (staleTime: 5 mins) to minimize Supabase hits
  - retry: 1 for faster failure feedback
  Exported so guestMigration can invalidate queries after migration
*/
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            retry: 1,
        },
    },
});

/*
  Navigation Guard Component
  Handles redirection based on auth state and "First Login Setup"
*/
function NavigationGuard({ children }: { children: React.ReactNode }) {
    const { session, authPhase, hasCompletedFirstLogin, isGuest, user, pendingPuzzleDate, pendingPuzzleMode, consumePendingPuzzle, setDeferredPuzzle, deferredPuzzle, pendingLeagueCode, consumePendingLeagueCode } = useAuth();
    const { setPendingJoinCode, setPendingLeagueInviteRegion, setPendingLeagueInviteUser } = useLeague();
    const segments = useSegments();
    const router = useRouter();
    const { toast } = useToast();
    const {
        reminderEnabled, reminderTime,
        streakReminderEnabled, streakReminderTime,
    } = useOptions();
    const { hydrate: hydrateNotifs } = useNotificationData();
    // 1. Minimum Splash Time State
    const [isSplashMinTimeMet, setSplashMinTimeMet] = useState(false);

    // Latch: once splash is dismissed, it NEVER shows again in this session.
    // Prevents re-flash when authPhase temporarily leaves 'ready' during sign-in pipeline.
    const splashDismissedRef = useRef(false);



    // 1c. Puzzle Readiness State (checked concurrently during splash)
    const [userPuzzleReady, setUserPuzzleReady] = useState(false);

    // [FIX] Dedup ref: tracks the last puzzle date we stored/toasted for,
    // preventing double popups when BOTH expo-router URL resolution AND
    // Linking.addEventListener fire for the same warm-start deep link.
    const lastDeferredPuzzleDateRef = useRef<string | null>(null);

    // [FIX] Clear the dedup ref when the deferred puzzle is consumed (e.g. by the
    // "Game Shared" button on the Home screen). This ensures the NEXT deep link
    // won't be falsely flagged as a duplicate of the previous one.
    useEffect(() => {
        if (!deferredPuzzle) {
            lastDeferredPuzzleDateRef.current = null;
        }
    }, [deferredPuzzle]);

    // [FIX] Router mount guard: tracks whether router is ready for navigation.
    // Prevents "Attempted to navigate before mounting" crash on force-quit + deep link.
    const routerMountedRef = useRef(false);
    useEffect(() => {
        // Router is ready once this effect runs (component is mounted)
        routerMountedRef.current = true;
    }, []);

    // Reset splash when session is lost (sign-out) so re-auth gets a fresh splash
    const prevSessionRef = useRef(session);
    useEffect(() => {
        if (prevSessionRef.current && !session) {
            console.log('[NavGuard] Session lost (sign-out) — resetting splash for fresh reload');
            splashDismissedRef.current = false;
            setSplashMinTimeMet(false);
            // Restart the minimum splash timer
            const delay = Platform.OS === 'web' ? 2000 : 3000;
            const timer = setTimeout(() => setSplashMinTimeMet(true), delay);
            prevSessionRef.current = session;
            return () => clearTimeout(timer);
        }
        prevSessionRef.current = session;
    }, [session]);

    // Track when app was last active (for 1h background refresh)
    const lastActiveRef = useRef(Date.now());

    useEffect(() => {
        // [WEB FIX] 2 second splash on web (user preference), 3s on mobile
        const delay = Platform.OS === 'web' ? 2000 : 3000;
        const timer = setTimeout(() => {
            setSplashMinTimeMet(true);
        }, delay);
        return () => clearTimeout(timer);
    }, []);

    // Hard watchdog is now in auth.tsx (setAuthPhase('ready') on timeout)

    // [FIX] AppState listener: refresh session if backgrounded >1 hour
    useEffect(() => {
        if (Platform.OS === 'web') return;
        const subscription = AppState.addEventListener('change', async (nextState: AppStateStatus) => {
            if (nextState === 'active') {
                // Clear notification badge on app foreground
                NotificationService.clearBadge().catch(err =>
                    console.warn('[NavGuard] Failed to clear notification badge:', err)
                );

                // Re-hydrate + re-schedule notifications to keep rolling horizon fresh
                if (reminderEnabled || streakReminderEnabled) {
                    hydrateNotifs().then(freshData => {
                        if (freshData) {
                            NotificationService.scheduleAll({
                                reminderEnabled,
                                reminderTime: reminderTime || '09:00',
                                streakReminderEnabled,
                                streakReminderTime: streakReminderTime || '20:00',
                            }, freshData).catch(err =>
                                console.warn('[NavGuard] Failed to re-schedule notifications:', err)
                            );
                        }
                    }).catch(err =>
                        console.warn('[NavGuard] Failed to hydrate notification data:', err)
                    );
                }
                const elapsed = Date.now() - lastActiveRef.current;
                const ONE_HOUR = 60 * 60 * 1000;
                if (elapsed > ONE_HOUR) {
                    console.log(`[NavGuard] App resumed after ${Math.round(elapsed / 60000)}min — refreshing session`);
                    try {
                        const { error } = await supabase.auth.refreshSession();
                        if (error) {
                            console.warn('[NavGuard] Session refresh failed:', error.message);
                        } else {
                            console.log('[NavGuard] Session refreshed after long background');
                        }
                        // Invalidate all cached queries to refetch fresh data
                        queryClient.invalidateQueries();
                    } catch (e) {
                        console.error('[NavGuard] Error refreshing session on resume:', e);
                    }
                }
            } else if (nextState === 'background' || nextState === 'inactive') {
                lastActiveRef.current = Date.now();
            }
        });
        return () => subscription.remove();
    }, []);


    // [Notification Deep Link] Handle notification tap → navigate to the correct screen
    useEffect(() => {
        if (Platform.OS === 'web') return;

        let Notifications: typeof import('expo-notifications') | null = null;
        try {
            Notifications = require('expo-notifications');
        } catch (e) {
            return; // Native module not available
        }

        // Guard: the JS module may load but underlying native module can be missing
        // (e.g. Expo Go / iOS simulator without dev client build)
        if (!Notifications?.addNotificationResponseReceivedListener) {
            console.warn('[NavGuard] expo-notifications native module not available — skipping listener');
            return;
        }

        const subscription = Notifications.addNotificationResponseReceivedListener(response => {
            const screen = response.notification.request.content.data?.screen as string | undefined;
            console.log('[NavGuard] Notification tapped, screen:', screen);
            if (screen && screen !== 'home') {
                // Deep link to specific game screen (e.g. /game/REGION/today, /game/USER/next)
                setTimeout(() => {
                    router.push(screen as any);
                }, 500); // Small delay to let the app finish foregrounding
            }
            // 'home' or missing screen → app just opens to wherever it was (home by default)
        });

        return () => subscription.remove();
    }, [router]);


    // Deep link handling is now centralized in auth.tsx (AuthProvider)
    // Web: detectSessionInUrl: true auto-processes tokens
    // Native: checkNativeDeepLink + warm-start Linking listener in auth.tsx

    // Check puzzle readiness during splash period (no extra delay, runs in parallel)
    useEffect(() => {
        if (!user?.id) return;

        const checkReadiness = async () => {
            try {
                // 1. Try cache first
                const cached = await AsyncStorage.getItem('puzzle_readiness_cache');
                if (cached) {
                    const parsed = JSON.parse(cached);
                    const today = new Date().toISOString().split('T')[0];
                    if (parsed.date === today && parsed.userReady) {
                        setUserPuzzleReady(true);
                        return;
                    }
                }

                // 2. Quick network check
                const today = new Date().toISOString().split('T')[0];
                const { data } = await supabase
                    .from('questions_allocated_user')
                    .select('id, question_id')
                    .eq('user_id', user.id)
                    .eq('puzzle_date', today)
                    .maybeSingle();

                if (data?.question_id != null) {
                    setUserPuzzleReady(true);
                    await AsyncStorage.setItem('puzzle_readiness_cache', JSON.stringify({ date: today, userReady: true }));
                }
            } catch (e) {
                console.warn('[NavGuard] Puzzle readiness check failed:', e);
            }
        };

        checkReadiness();
    }, [user?.id]);

    // Ad initialization is now handled by useAdsConsent hook
    // (triggered in Home Screen and onboarding after UMP consent)

    // 2. Sync Logic
    const { isConnected } = useNetwork();
    useEffect(() => {
        if (isConnected && user?.id) {
            console.log('[NavGuard] Online & User present: Triggering Sync');
            syncPendingGames(user.id);
        }
    }, [isConnected, user?.id]);


    // Logic to determine if splash should show
    // authPhase !== 'ready' replaces the old loading + profileLoading checks
    const authNotReady = authPhase !== 'ready';

    // HARDENED LATCH: Once dismissed, splash NEVER re-appears — no matter what authPhase does.
    // This prevents all sign-in flows from briefly re-showing splash.
    if (splashDismissedRef.current) {
        // Already dismissed — skip all evaluation
    } else {
        const shouldShowSplash = Platform.OS === 'web'
            ? (!isSplashMinTimeMet)
            : (authNotReady || !isSplashMinTimeMet);

        if (!shouldShowSplash) {
            splashDismissedRef.current = true;
        }
    }
    const showSplash = !splashDismissedRef.current;

    // 3. Navigation Side Effects
    useEffect(() => {
        if (showSplash) return; // Wait until splash is done
        if (authPhase !== 'ready') return; // Wait for auth pipeline to complete

        const inAuthGroup = segments.includes('(auth)') || segments.includes('login');
        const inTabsGroup = segments[0] === '(tabs)';

        const inPersonaliseFlow =
            segments.includes('personalise') ||
            segments.includes('generating-questions') ||
            segments.includes('category-selection') ||
            segments.includes('subscription') ||
            segments.includes('manage-subscription') ||
            segments.includes('subscription-flow') ||
            segments.includes('onboarding') ||
            segments.includes('set-new-password') ||
            segments.includes('password-reset') ||
            segments.includes('reset-password');

        const inGameFlow = segments[0] === 'game' || segments[0] === 'game-result' || segments[0] === 'play';
        const inRootIndex = segments.length === 0 || segments[0] === 'index';
        const inPublicPages = segments.includes('privacy') || segments.includes('support') || segments.includes('terms');
        const inSetNewPassword = segments.includes('set-new-password');

        console.log('[NavGuard] Session:', !!session, 'Guest:', isGuest, 'Phase:', authPhase, 'Segments:', segments);

        // NOTE: Age verification is NOT a global gate anymore
        // It's checked when: (1) guest clicks Play, (2) new account creation

        // ============================================================
        // SAFE NAVIGATION HELPER
        // Wraps router.replace in try-catch to prevent crash when
        // Root Layout hasn't mounted yet (force-quit + deep link).
        // Falls back to a delayed retry if the first attempt fails.
        // ============================================================
        const safeReplace = (route: string) => {
            try {
                if (!routerMountedRef.current) {
                    console.warn('[NavGuard] Router not mounted yet — deferring navigation to:', route);
                    setTimeout(() => {
                        try { router.replace(route as any); } catch (e) {
                            console.error('[NavGuard] Deferred navigation also failed:', e);
                        }
                    }, 500);
                    return;
                }
                router.replace(route as any);
            } catch (e) {
                console.warn('[NavGuard] Navigation failed (router not ready) — retrying:', route, e);
                setTimeout(() => {
                    try { router.replace(route as any); } catch (e2) {
                        console.error('[NavGuard] Retry navigation failed:', e2);
                    }
                }, 500);
            }
        };

        // ============================================================
        // STEP 0: Consume any pending puzzle deep link IMMEDIATELY
        // regardless of auth state or current route (including game routes
        // that expo-router may have auto-resolved from the deep link URL).
        // Store as deferred — home screen will navigate after proper checks.
        // ============================================================
        if (pendingPuzzleDate) {
            const pending = consumePendingPuzzle();
            if (pending) {
                // [FIX] Dedup: skip if we already stored this exact puzzle
                const isDuplicate = lastDeferredPuzzleDateRef.current === `${pending.mode}/${pending.date}`;
                if (isDuplicate) {
                    console.log(`[NavGuard] Skipping duplicate pending puzzle (already deferred): ${pending.mode}/${pending.date}`);
                } else {
                    console.log(`[NavGuard] Consuming pending puzzle deep link (auth state: session=${!!session}, guest=${isGuest}, segments=${segments}): ${pending.mode}/${pending.date}`);
                    setDeferredPuzzle(pending);
                    lastDeferredPuzzleDateRef.current = `${pending.mode}/${pending.date}`;
                }

                if (session && hasCompletedFirstLogin()) {
                    // Signed in: always route to home (even if expo-router put us on a game screen)
                    safeReplace('/(tabs)');
                    return;
                } else if (!session || isGuest) {
                    // Not signed in: redirect to onboarding (puzzle stored for after sign-in)
                    if (!inAuthGroup) {
                        safeReplace('/(auth)/onboarding');
                    }
                    // Show toast only if not a duplicate
                    if (!isDuplicate) {
                        setTimeout(() => {
                            toast({
                                title: 'Puzzle shared with you!',
                                description: 'Click Login to either sign-up or sign-in. You will then be able to play the puzzle shared with you',
                                variant: 'share',
                                position: 'bottom',
                                duration: 5000,
                            });
                        }, 500);
                    }
                    return;
                }
            }
        }

        // ============================================================
        // STEP 0.5: Consume any pending league join code
        // Similar to puzzle deep links — store and route appropriately.
        // ============================================================
        if (pendingLeagueCode) {
            const code = consumePendingLeagueCode();
            if (code) {
                console.log(`[NavGuard] Consuming pending league join code: ${code}`);
                setPendingJoinCode(code);

                // Set both mode invitation flags — home screen will clear per-mode when clicked
                setPendingLeagueInviteRegion(true);
                setPendingLeagueInviteUser(true);

                if (session && hasCompletedFirstLogin()) {
                    // Signed in: go to home — deferred join will show invitation on Leagues button
                    safeReplace('/(tabs)');
                    return;
                } else if (!session || isGuest) {
                    // Not signed in: skip onboarding, go straight to login with league banner
                    // Always navigate (even if already in auth group, e.g. on onboarding)
                    safeReplace('/(auth)/login?intent=signup&fromLeague=1');
                    // No toast needed — login screen shows the league invitation banner
                    return;
                }
            }
        }

        // Guests should NOT access tabs/home
        if (isGuest && inTabsGroup) {
            console.log('[NavGuard] Guest tried to access tabs -> Redirecting to onboarding');
            safeReplace('/(auth)/onboarding');
            return;
        }

        if (!session && !isGuest && !inAuthGroup && !inPublicPages) {
            // [FIX] Only intercept /play routes (deep links) — NOT /game routes.
            // The /game/MODE/DATE route is used for guest play (onboarding → ad → game).
            // Intercepting it here was breaking guest play by treating it as a deep link.
            // Deep links use /play/DATE — they're handled by pendingPuzzleDate (STEP 0)
            // AND this fallback for any that slip through.
            const isDeepLinkRoute = segments[0] === 'play';

            if (isDeepLinkRoute) {
                // Expo-router auto-resolved a deep link URL to /play/DATE
                const segs = segments as string[];
                const gameId = segs[1];
                const gameMode = 'REGION'; // mode is a query param, not available in segments

                // [FIX] Validate that gameId is an actual date (YYYY-MM-DD), not a route
                // parameter placeholder like "[date]". After STEP 0 consumes the pending
                // puzzle, NavGuard can re-run while segments still show the placeholder.
                const isValidDate = gameId && /^\d{4}-\d{2}-\d{2}$/.test(gameId);
                if (!isValidDate) {
                    // Date is a placeholder (e.g. "[date]") — expo-router resolved the
                    // URL before the Linking handler could set the pending puzzle refs.
                    // Just redirect; STEP 0 will handle the pending puzzle on the next
                    // render once pendingPuzzleDate state has propagated.
                    console.log(`[NavGuard] Unauthenticated play route with placeholder date — deferring to STEP 0`);
                    if (!inAuthGroup) {
                        safeReplace('/(auth)/onboarding');
                    }
                    return;
                }

                const puzzleKey = gameId ? `${gameMode}/${gameId}` : null;
                const isDuplicateGame = puzzleKey ? lastDeferredPuzzleDateRef.current === puzzleKey : true;

                if (puzzleKey && !isDuplicateGame) {
                    console.log(`[NavGuard] Unauthenticated on play route — storing deferred puzzle: ${puzzleKey}`);
                    setDeferredPuzzle({ mode: gameMode, date: gameId! });
                    lastDeferredPuzzleDateRef.current = puzzleKey;
                } else if (puzzleKey) {
                    console.log(`[NavGuard] Skipping duplicate play route deferred puzzle: ${puzzleKey}`);
                }

                safeReplace('/(auth)/onboarding');

                // Show toast only if this is the first encounter with this puzzle
                if (puzzleKey && !isDuplicateGame) {
                    setTimeout(() => {
                        toast({
                            title: 'Puzzle shared with you!',
                            description: 'Click Login to either sign-up or sign-in. You will then be able to play the puzzle shared with you',
                            variant: 'share',
                            position: 'bottom',
                            duration: 5000,
                        });
                    }, 500);
                }
            } else if (!inRootIndex && !inGameFlow) {
                // [FIX] Skip redirect when segments contain "+not-found" or "[...unmatched]" —
                // this is a transient state caused by expo-router resolving a deep link URL
                // (e.g. /league/join/CODE) to a non-existent route (or our catch-all).
                // The warm-start deep link handler is still propagating the pending
                // code/puzzle state. If we redirect now, we lose the deep link context.
                // Instead, wait for the next NavGuard cycle when pendingLeagueCode/pendingPuzzleDate
                // state has propagated and the session has had time to recover.
                const isDeepLinkTransient = segments.includes('+not-found' as never) || segments.includes('[...unmatched]' as never);
                if (isDeepLinkTransient) {
                    console.log('[NavGuard] Deep link transient state — deferring redirect to let auth recover');
                    return;
                }
                // Redirect unknown routes to onboarding, but let /game routes through
                // for guest play (onboarding → age verification → ad → game)
                console.log('[NavGuard] Unauthorized access -> Redirecting to onboarding');
                safeReplace('/(auth)/onboarding');
            }
        } else if (session) {
            const completedFirstLogin = hasCompletedFirstLogin();

            if (!completedFirstLogin && !inAuthGroup) {
                console.log('[NavGuard] User needs to complete profile setup');
                safeReplace('/(auth)/personalise');
            } else if (completedFirstLogin) {
                if (inAuthGroup && !inPersonaliseFlow) {
                    console.log('[NavGuard] Redirecting authenticated user to app');
                    safeReplace('/(tabs)');
                } else if (inGameFlow && (segments[0] === 'play')) {
                    // [FIX] Authenticated user landed on /play route (deep link).
                    // Extract puzzle info and redirect to home where deferred
                    // puzzle handling will navigate to the game after startup checks.
                    const segs = segments as string[];
                    const playDate = segs[1];
                    // [FIX] Validate playDate is a real date, not a placeholder like "[date]"
                    const isValidPlayDate = playDate && /^\d{4}-\d{2}-\d{2}$/.test(playDate);
                    if (isValidPlayDate) {
                        const puzzleKey = `REGION/${playDate}`;
                        if (lastDeferredPuzzleDateRef.current !== puzzleKey) {
                            console.log(`[NavGuard] Authenticated user on play route — storing deferred puzzle: ${puzzleKey}`);
                            setDeferredPuzzle({ mode: 'REGION', date: playDate });
                            lastDeferredPuzzleDateRef.current = puzzleKey;
                        }
                    } else {
                        // Date is a placeholder (e.g. "[date]") — expo-router resolved
                        // the URL before the Linking handler set the refs. Don't consume
                        // here; STEP 0 will handle it once pendingPuzzleDate state propagates.
                        console.log(`[NavGuard] Authenticated play route with placeholder date — deferring to STEP 0`);
                    }
                    safeReplace('/(tabs)');
                }
            }
        }
    }, [session, isGuest, showSplash, authPhase, segments, hasCompletedFirstLogin, pendingPuzzleDate, pendingLeagueCode]);

    // 4. Wrap children in Readiness Context so screens know when to trigger modals
    return (
        <View style={{ flex: 1, backgroundColor: '#7DAAE8' }}>
            <AppReadinessProvider isReady={!showSplash} userPuzzleReady={userPuzzleReady}>
                {/* Always render children (Navigator) so router can work */}
                {children}
            </AppReadinessProvider>

            {/* Overlay Splash Screen */}
            {showSplash && (
                <View style={{ ...StyleSheet.absoluteFillObject, zIndex: 99999 }}>
                    <SplashScreen onComplete={() => { }} />
                </View>
            )}
        </View>
    );
}

/**
 * [FIX] UserScopedProviders
 * Wraps all user-data-dependent providers.
 * Uses queryClient.clear() on user change to prevent stale data
 * WITHOUT remounting the entire tree (which caused splash re-flash).
 */
function UserScopedProviders() {
    const { user } = useAuth();

    // NOTE: No query cache clearing needed here.
    // All query hooks already include user?.id in their keys (e.g. ['userStats', user?.id, mode]),
    // so data is automatically isolated between users. Clearing/removing queries here was causing
    // the "ghost login" bug by destroying freshly-registered query observers (useEffect fires
    // AFTER render, killing queries that components just started).
    useEffect(() => {
        console.log('[Layout] User context updated:', user?.id ?? 'signed-out');
    }, [user?.id]);

    return (
        <>
            <NetworkProvider>
                <ConversionPromptProvider>
                    <GuessCacheProvider>
                        <StreakSaverProvider>
                            <OptionsProvider>
                                <StreakCelebrationProvider>
                                    <LeagueProvider>
                                        <WebContainer>
                                            <ThemedView className="flex-1">
                                                <NavigationGuard>
                                                    <Stack screenOptions={{ headerShown: false }}>
                                                        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                                                        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                                                        <Stack.Screen name="game" options={{ headerShown: false }} />
                                                        <Stack.Screen
                                                            name="archive"
                                                            options={{
                                                                headerShown: false,
                                                                presentation: 'card'
                                                            }}
                                                        />
                                                        <Stack.Screen
                                                            name="stats"
                                                            options={{
                                                                headerShown: false,
                                                                presentation: 'card'
                                                            }}
                                                        />
                                                        <Stack.Screen
                                                            name="league"
                                                            options={{
                                                                headerShown: false,
                                                                presentation: 'card'
                                                            }}
                                                        />
                                                        <Stack.Screen name="index" options={{ headerShown: false }} />

                                                    </Stack>
                                                </NavigationGuard>
                                            </ThemedView>
                                        </WebContainer>
                                    </LeagueProvider>
                                </StreakCelebrationProvider>
                                <ConversionPromptModal />
                                <Suspense fallback={null}>
                                    <SubscriptionLifecycleManager />
                                </Suspense>
                            </OptionsProvider>
                        </StreakSaverProvider>
                    </GuessCacheProvider>
                </ConversionPromptProvider>
            </NetworkProvider>
        </>
    );
}

function Layout() {
    const [adsInitialized, setAdsInitialized] = useState(false);
    let [fontsLoaded] = useFonts({
        Nunito_400Regular,
        Nunito_500Medium,
        Nunito_600SemiBold,
        Nunito_700Bold,
        Nunito_800ExtraBold,
    });

    // Initialize RevenueCat on mount (doesn't depend on age)
    useEffect(() => {
        initializeRevenueCat();
    }, []);

    // [WEB PERF] Preload critical assets during startup
    useEffect(() => {
        const preloadAssets = async () => {
            try {
                await Promise.all([
                    Asset.fromModule(require('../assets/Welcome-Hamster-Cutout.png')).downloadAsync(),

                    Asset.fromModule(require('../assets/splash-icon.png')).downloadAsync(),
                    Asset.fromModule(require('../assets/icon.png')).downloadAsync(),
                ]);
                console.log('[Layout] Critical assets preloaded');
            } catch (e) {
                console.warn('[Layout] Asset preloading failed:', e);
            }
        };
        preloadAssets();
    }, []);

    // Ad initialization is deferred - it happens in NavigationGuard
    // after age verification is complete. This is because we need
    // age data to determine which SDK (AdMob/AppLovin) to use.

    // Global Splash Screen State
    const [isSplashComplete, setSplashComplete] = useState(false);
    const [isReady, setIsReady] = useState(false);

    // Check readiness (Fonts + AdMob + Auth loaded)
    // We access Auth loading state here by NOT rendering AuthProvider yet? 
    // Wait, AuthProvider is inside. We can't access useAuth() here.
    // Solution: We keep the Splash logic simple here (Fonts/AdMob) AND 
    // we make NavigationGuard handle the "Auth Loading" by showing Splash too?
    // OR we just wait for Fonts/AdMob here.

    // Better approach:
    // Render the App, but overlay Splash until everything is ready.
    // However, AuthProvider needs to mount to check auth.
    // So we must render children.

    // Let's modify NavigationGuard to show SplashScreen while loading.

    // [FONT FIX] Hide native splash once fonts are loaded
    // Uses direct useEffect instead of onLayout to avoid race conditions in Release builds
    useEffect(() => {
        if (fontsLoaded) {
            ExpoSplashScreen.hideAsync().catch(console.warn);
        }
    }, [fontsLoaded]);

    // [SAFETY] Force-hide splash after 3 seconds to prevent indefinite hang
    useEffect(() => {
        const safetyTimer = setTimeout(() => {
            console.warn('[Layout] Safety timeout: force-hiding splash screen after 3s');
            ExpoSplashScreen.hideAsync().catch(console.warn);
        }, 3000);
        return () => clearTimeout(safetyTimer);
    }, []);

    if (!fontsLoaded) {
        return (
            <View style={{ flex: 1, backgroundColor: '#7DAAE8' }}>
                <SplashScreen onComplete={() => { }} />
            </View>
        );
    }

    return (
        <ErrorBoundary>
            <StatusBar style="dark" backgroundColor="transparent" translucent />
            <ToastProvider>
                <SafeAreaProvider>
                    <QueryClientProvider client={queryClient}>
                        <AuthProvider>
                            <UserScopedProviders />
                        </AuthProvider>
                    </QueryClientProvider>
                </SafeAreaProvider>
            </ToastProvider>
        </ErrorBoundary>
    );
}

export default Sentry.wrap(Layout);
