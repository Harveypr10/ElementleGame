import { View, ActivityIndicator, StyleSheet, Linking } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { styled } from 'nativewind';
import { ThemedView } from '../components/ThemedView';

const StyledView = styled(View);
import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../lib/auth';
import { OptionsProvider } from '../lib/options';
import { StreakSaverProvider } from '../contexts/StreakSaverContext';
import { ToastProvider } from '../contexts/ToastContext';
import { ConversionPromptProvider } from '../contexts/ConversionPromptContext';
import { AppReadinessProvider } from '../contexts/AppReadinessContext';
import { GuessCacheProvider } from '../contexts/GuessCacheContext';
import { NetworkProvider, useNetwork } from '../contexts/NetworkContext';
import { syncPendingGames } from '../lib/sync';
import { useFonts, Nunito_400Regular, Nunito_500Medium, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold } from '@expo-google-fonts/nunito';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ConversionPromptModal } from '../components/ConversionPromptModal';
import { initializeAds } from '../lib/AdManager';
import { initializeRevenueCat } from '../lib/RevenueCat';
import { SplashScreen } from '../components/SplashScreen';
import { hasCompletedAgeVerification } from '../lib/ageVerification';
import '../lib/typography'; // Global Font Patch

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
    const { session, loading, hasCompletedFirstLogin, isGuest, user } = useAuth();
    const segments = useSegments();
    const router = useRouter();

    // 1. Minimum Splash Time State
    const [isSplashMinTimeMet, setSplashMinTimeMet] = useState(false);

    // 1b. Age Verification State
    const [hasAgeVerification, setHasAgeVerification] = useState<boolean | null>(null);

    useEffect(() => {
        const timer = setTimeout(() => {
            setSplashMinTimeMet(true);
        }, 3000);
        return () => clearTimeout(timer);
    }, []);

    // Check age verification on mount AND when segments change
    // (re-check after user completes age verification and navigates)
    useEffect(() => {
        hasCompletedAgeVerification().then(setHasAgeVerification);
    }, [segments]);

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

    // 2b. Deep Link Handler for Password Reset
    useEffect(() => {
        const handleDeepLink = async (event: { url: string }) => {
            const { url } = event;
            console.log('[NavGuard] Deep link received:', url);

            if (url.includes('reset-password')) {
                console.log('[NavGuard] Password reset deep link detected');

                // The URL contains a hash fragment with access_token
                // Supabase will automatically detect and set the session
                // We just need to wait a moment and then navigate to the password screen

                // Give Supabase time to process the token from the URL
                setTimeout(() => {
                    router.push({
                        pathname: '/(auth)/set-new-password',
                        params: { mode: 'reset' }
                    });
                }, 500);
            }
        };

        // Listen for deep links while app is open
        const subscription = Linking.addEventListener('url', handleDeepLink);

        // Check if app was opened with a deep link
        Linking.getInitialURL().then((url) => {
            if (url && url.includes('reset-password')) {
                console.log('[NavGuard] App opened with password reset link:', url);
                handleDeepLink({ url });
            }
        });

        return () => {
            subscription.remove();
        };
    }, [router]);

    // 2. Logic to determine if splash should show
    const showSplash = loading || !isSplashMinTimeMet || hasAgeVerification === null;

    // 3. Navigation Side Effects
    useEffect(() => {
        if (showSplash) return; // Wait until ready

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
            segments.includes('password-reset');

        const inGameFlow = segments[0] === 'game' || segments[0] === 'game-result';
        const inRootIndex = segments.length === 0 || segments[0] === 'index';

        console.log('[NavGuard] Session:', !!session, 'Guest:', isGuest, 'Segments:', segments);

        // NOTE: Age verification is NOT a global gate anymore
        // It's checked when: (1) guest clicks Play, (2) new account creation

        // Guests should NOT access tabs/home
        if (isGuest && inTabsGroup) {
            console.log('[NavGuard] Guest tried to access tabs -> Redirecting to onboarding');
            router.replace('/(auth)/onboarding');
            return;
        }

        if (!session && !isGuest && !inAuthGroup && !inGameFlow) {
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
    }, [session, isGuest, showSplash, segments, hasCompletedFirstLogin, hasAgeVerification]);

    // 4. Wrap children in Readiness Context so screens know when to trigger modals
    return (
        <View style={{ flex: 1 }}>
            <AppReadinessProvider isReady={!showSplash}>
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

export default function Layout() {
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

    if (!fontsLoaded) {
        // Show Splash while system dependencies load
        return <SplashScreen onComplete={() => { }} />;
    }

    return (
        <ErrorBoundary>
            <ToastProvider>
                <SafeAreaProvider>
                    <QueryClientProvider client={queryClient}>
                        <AuthProvider>
                            <NetworkProvider>
                                <ConversionPromptProvider>
                                    <GuessCacheProvider>
                                        <StreakSaverProvider>
                                            <OptionsProvider>
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
                                                <ConversionPromptModal />
                                            </OptionsProvider>
                                        </StreakSaverProvider>
                                    </GuessCacheProvider>
                                </ConversionPromptProvider>
                            </NetworkProvider>
                        </AuthProvider>
                    </QueryClientProvider>
                </SafeAreaProvider>
            </ToastProvider>
        </ErrorBoundary>
    );
}


