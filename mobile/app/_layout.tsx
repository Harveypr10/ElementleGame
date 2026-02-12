import React, { Suspense } from 'react';
import { View, ActivityIndicator, StyleSheet, Linking, Platform, AppState, AppStateStatus } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as Sentry from '@sentry/react-native';

// Initialize Sentry at module level (before any component renders)
Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN || '__SENTRY_DSN_PLACEHOLDER__',
    debug: __DEV__,
    enabled: !__DEV__,
});
import { styled } from 'nativewind';
import { ThemedView } from '../components/ThemedView';
import { WebContainer } from '../components/WebContainer';
import * as ExpoSplashScreen from 'expo-splash-screen';

// Import global CSS for NativeWind web support
import '../global.css';

const StyledView = styled(View);
import { useEffect, useState, useCallback, useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../lib/auth';
import { OptionsProvider } from '../lib/options';
import { StreakSaverProvider } from '../contexts/StreakSaverContext';
import { ToastProvider } from '../contexts/ToastContext';
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
import { initializeAds } from '../lib/AdManager';
import { initializeRevenueCat } from '../lib/RevenueCat';
import { SplashScreen } from '../components/SplashScreen';
// Lazy-loaded to avoid adding to _layout.tsx's initial module graph,
// which has fragile pre-existing require cycles through guestMigration → auth
const SubscriptionLifecycleManager = React.lazy(
    () => import('../components/subscription/SubscriptionLifecycleManager').then(
        m => ({ default: m.SubscriptionLifecycleManager })
    )
);
import { hasCompletedAgeVerification } from '../lib/ageVerification';
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
    const { session, loading, profileLoading, hasCompletedFirstLogin, isGuest, user } = useAuth();
    const segments = useSegments();
    const router = useRouter();

    // 1. Minimum Splash Time State
    const [isSplashMinTimeMet, setSplashMinTimeMet] = useState(false);

    // 1b. Age Verification State
    const [hasAgeVerification, setHasAgeVerification] = useState<boolean | null>(null);

    // 1c. Puzzle Readiness State (checked concurrently during splash)
    const [userPuzzleReady, setUserPuzzleReady] = useState(false);

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

    // [FIX] HARD Watchdog: Runs independently — if we're still on splash after 8s,
    // something went wrong (network hang, auth timeout, etc.). Force navigate.
    const splashRef = useRef(true); // Tracks showSplash in a ref for timeout closure
    // NOTE: sync effect is placed after showSplash definition below
    useEffect(() => {
        if (Platform.OS === 'web') return;
        const watchdog = setTimeout(() => {
            if (splashRef.current) {
                console.warn('[NavGuard] HARD WATCHDOG: Splash stuck for 8s — forcing to onboarding');
                router.replace('/(auth)/onboarding');
            }
        }, 8000);
        return () => clearTimeout(watchdog);
    }, []); // Empty deps = runs ONCE on mount, independent of any state

    // [FIX] AppState listener: refresh session if backgrounded >1 hour
    useEffect(() => {
        if (Platform.OS === 'web') return;
        const subscription = AppState.addEventListener('change', async (nextState: AppStateStatus) => {
            if (nextState === 'active') {
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

    // Check age verification on mount AND when segments change
    // (re-check after user completes age verification and navigates)
    // [WEB FIX] On web, skip async check - no age-gated ads needed
    useEffect(() => {
        if (Platform.OS === 'web') {
            setHasAgeVerification(true); // Web doesn't need age verification for ads
            return;
        }
        hasCompletedAgeVerification().then(setHasAgeVerification);
    }, [segments]);

    // [WEB] Magic Link & Recovery token handler
    // When user clicks a Supabase magic link / recovery link, they land on elementle.tech
    // in Safari. This detects the auth tokens and either:
    // 1. Redirects to the native app via custom scheme (if installed)
    // 2. Falls back to verifying the token on web (signs them in on web)
    useEffect(() => {
        if (Platform.OS !== 'web' || typeof window === 'undefined') return;

        const search = window.location.search;
        const hash = window.location.hash;
        const searchParams = new URLSearchParams(search);
        const hashParams = hash ? new URLSearchParams(hash.substring(1)) : new URLSearchParams();

        const tokenHash = searchParams.get('token_hash');
        const type = searchParams.get('type') || hashParams.get('type');
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        // --- Magic Link (type=magiclink or type=email) ---
        if (tokenHash && (type === 'magiclink' || type === 'email')) {
            console.log('[Web] Magic link detected — attempting app redirect');
            // Try to open the native app first
            const appUrl = `elementle://?token_hash=${encodeURIComponent(tokenHash)}&type=${encodeURIComponent(type)}`;
            window.location.href = appUrl;

            // If still on this page after 2s, verify on web instead
            setTimeout(async () => {
                console.log('[Web] App redirect may have failed — verifying on web');
                try {
                    const { error } = await supabase.auth.verifyOtp({
                        token_hash: tokenHash,
                        type: type === 'email' ? 'email' : 'magiclink',
                    });
                    if (error) {
                        console.error('[Web] Magic link verification error:', error);
                    } else {
                        console.log('[Web] Magic link verified — user signed in on web');
                        // Clean URL
                        window.history.replaceState({}, '', '/');
                    }
                } catch (e) {
                    console.error('[Web] Error verifying magic link:', e);
                }
            }, 2000);
            return;
        }

        // --- Recovery / Password Reset ---
        if (accessToken && refreshToken && type === 'recovery') {
            console.log('[Web] Recovery link detected — attempting app redirect');
            const appUrl = `elementle://reset-password#access_token=${encodeURIComponent(accessToken)}&refresh_token=${encodeURIComponent(refreshToken)}&type=recovery`;
            window.location.href = appUrl;

            // If still on this page after 2s, process on web
            setTimeout(async () => {
                console.log('[Web] App redirect may have failed — setting session on web');
                try {
                    const { error } = await supabase.auth.setSession({
                        access_token: accessToken,
                        refresh_token: refreshToken,
                    });
                    if (error) {
                        console.error('[Web] Recovery session error:', error);
                    } else {
                        console.log('[Web] Recovery session set — redirecting to set-new-password');
                        router.replace({
                            pathname: '/(auth)/set-new-password',
                            params: { mode: 'reset' },
                        });
                    }
                } catch (e) {
                    console.error('[Web] Error processing recovery link:', e);
                }
            }, 2000);
            return;
        }
    }, []);

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

    // Initialize ads AFTER age verification is confirmed (deferred init)
    useEffect(() => {
        if (hasAgeVerification === true) {
            initializeAds().catch(console.error);
        }
    }, [hasAgeVerification]);

    // 2. Sync Logic
    const { isConnected } = useNetwork();
    useEffect(() => {
        if (isConnected && user?.id) {
            console.log('[NavGuard] Online & User present: Triggering Sync');
            syncPendingGames(user.id);
        }
    }, [isConnected, user?.id]);

    // 2b. Deep Link Handler for Password Reset & Magic Links
    useEffect(() => {
        const handleDeepLink = async (event: { url: string }) => {
            const { url } = event;
            console.log('[NavGuard] Deep link received:', url);

            try {
                // Parse the URL — Supabase puts tokens in the fragment (#) or query (?)
                const urlObj = new URL(url);
                const searchParams = new URLSearchParams(urlObj.search);
                const hashParams = urlObj.hash ? new URLSearchParams(urlObj.hash.substring(1)) : new URLSearchParams();

                // --- Password Reset / Recovery ---
                const isResetPath = url.includes('reset-password');
                const accessToken = hashParams.get('access_token');
                const refreshToken = hashParams.get('refresh_token');
                const hashType = hashParams.get('type');
                const isRecovery = hashType === 'recovery' || (isResetPath && accessToken);

                if (isRecovery && accessToken && refreshToken) {
                    console.log('[NavGuard] Recovery link — setting session from tokens');
                    const { error } = await supabase.auth.setSession({
                        access_token: accessToken,
                        refresh_token: refreshToken,
                    });
                    if (error) {
                        console.error('[NavGuard] Session set error:', error);
                    }
                    router.replace({
                        pathname: '/(auth)/set-new-password',
                        params: { mode: 'reset' },
                    });
                    return;
                }

                // Path-only reset link (no tokens yet — user will get redirected)
                if (isResetPath) {
                    router.replace({
                        pathname: '/(auth)/set-new-password',
                        params: { mode: 'reset' },
                    });
                    return;
                }

                // --- Magic Link (email login) ---
                const tokenHash = searchParams.get('token_hash');
                const type = searchParams.get('type');
                const isMagicLink = tokenHash && (type === 'magiclink' || type === 'email');

                if (isMagicLink) {
                    console.log('[NavGuard] Magic link — verifying OTP');
                    const { error } = await supabase.auth.verifyOtp({
                        token_hash: tokenHash,
                        type: type === 'email' ? 'email' : 'magiclink',
                    });
                    if (error) {
                        console.error('[NavGuard] Magic link verification error:', error);
                    } else {
                        console.log('[NavGuard] Magic link verified — user signed in');
                    }
                    // Auth state change listener will handle navigation
                    return;
                }
            } catch (e) {
                console.error('[NavGuard] Deep link processing error:', e);
            }
        };

        // Listen for deep links while app is open
        const subscription = Linking.addEventListener('url', handleDeepLink);

        // Check if app was opened with a deep link (cold start)
        Linking.getInitialURL().then((url) => {
            if (url && (
                url.includes('reset-password') ||
                url.includes('token_hash') ||
                url.includes('access_token')
            )) {
                console.log('[NavGuard] App opened with auth deep link:', url);
                handleDeepLink({ url });
            }
        });

        return () => {
            subscription.remove();
        };
    }, [router]);

    // 2. Logic to determine if splash should show
    // [WEB FIX] On web, don't wait for auth loading (can hang indefinitely)
    const showSplash = Platform.OS === 'web'
        ? (!isSplashMinTimeMet || hasAgeVerification === null)
        : (loading || !isSplashMinTimeMet || hasAgeVerification === null);

    // Sync splashRef for the watchdog timeout closure
    useEffect(() => {
        splashRef.current = showSplash;
    }, [showSplash]);

    // 3. Navigation Side Effects
    useEffect(() => {
        if (showSplash) return; // Wait until ready
        if (profileLoading) return; // [FIX] Wait for profile data after sign-in (no splash, login screen stays)

        const inAuthGroup = segments.includes('(auth)') || segments.includes('login');
        const inTabsGroup = segments[0] === '(tabs)';
        const inAgeVerification = segments.includes('age-verification');
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

        const inGameFlow = segments[0] === 'game' || segments[0] === 'game-result';
        const inRootIndex = segments.length === 0 || segments[0] === 'index';
        const inPublicPages = segments.includes('privacy') || segments.includes('support') || segments.includes('terms');

        console.log('[NavGuard] Session:', !!session, 'Guest:', isGuest, 'Segments:', segments);

        // NOTE: Age verification is NOT a global gate anymore
        // It's checked when: (1) guest clicks Play, (2) new account creation

        // Guests should NOT access tabs/home
        if (isGuest && inTabsGroup) {
            console.log('[NavGuard] Guest tried to access tabs -> Redirecting to onboarding');
            router.replace('/(auth)/onboarding');
            return;
        }

        if (!session && !isGuest && !inAuthGroup && !inGameFlow && !inPublicPages) {
            if (!inRootIndex) {
                console.log('[NavGuard] Unauthorized access -> Redirecting to onboarding');
                router.replace('/(auth)/onboarding');
            }
        } else if (session) {
            const completedFirstLogin = hasCompletedFirstLogin();

            if (!completedFirstLogin && !inAuthGroup) {
                console.log('[NavGuard] User needs to complete profile setup');
                router.replace('/(auth)/personalise');
            } else if (inAuthGroup && completedFirstLogin && !inPersonaliseFlow && !inAgeVerification) {
                console.log('[NavGuard] Redirecting authenticated user to app');
                router.replace('/(tabs)');
            }
        }
    }, [session, isGuest, showSplash, profileLoading, segments, hasCompletedFirstLogin, hasAgeVerification]);

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

    // Clear React Query cache when user changes (prevents stale data between accounts)
    useEffect(() => {
        console.log('[Layout] User changed, clearing query cache:', user?.id ?? 'signed-out');
        queryClient.clear();
    }, [user?.id]);

    return (
        <>
            <NetworkProvider>
                <ConversionPromptProvider>
                    <GuessCacheProvider>
                        <StreakSaverProvider>
                            <OptionsProvider>
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
                                                <Stack.Screen name="index" options={{ headerShown: false }} />
                                                <Stack.Screen
                                                    name="settings"
                                                    options={{
                                                        headerShown: false,
                                                        presentation: 'card'
                                                    }}
                                                />
                                            </Stack>
                                        </NavigationGuard>
                                    </ThemedView>
                                </WebContainer>
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
