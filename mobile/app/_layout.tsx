import { View, ActivityIndicator } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../lib/auth';
import { OptionsProvider } from '../lib/options';
import { StreakSaverProvider } from '../contexts/StreakSaverContext';
import { ToastProvider } from '../contexts/ToastContext';
import { ConversionPromptProvider } from '../contexts/ConversionPromptContext';
import { GuessCacheProvider } from '../contexts/GuessCacheContext';
import { useFonts, Nunito_400Regular, Nunito_500Medium, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold } from '@expo-google-fonts/nunito';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ConversionPromptModal } from '../components/ConversionPromptModal';
import '../lib/typography'; // Global Font Patch

/* 
  Initialize TanStack Query Client
  Configuration:
  - aggressive caching (staleTime: 5 mins) to minimize Supabase hits
  - retry: 1 for faster failure feedback
*/
const queryClient = new QueryClient({
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
    const { session, loading, hasCompletedFirstLogin, isGuest } = useAuth();
    const segments = useSegments();
    const router = useRouter();

    useEffect(() => {
        if (loading) return;

        const inAuthGroup = segments[0] === '(auth)';
        const inPersonaliseFlow = segments.includes('personalise') || segments.includes('generating-questions');

        console.log('[NavGuard] Session:', !!session, 'Guest:', isGuest, 'Segments:', segments);

        if (!session && !isGuest && !inAuthGroup) {
            // Not signed in, not guest, and not in auth group -> Redirect to onboarding
            setTimeout(() => {
                router.replace('/(auth)/onboarding');
            }, 0);
        } else if (session) {
            // User is authenticated
            const completedFirstLogin = hasCompletedFirstLogin();

            // Only redirect to personalise if NOT already in auth group
            if (!completedFirstLogin && !inAuthGroup) {
                console.log('[NavGuard] User needs to complete profile setup');
                setTimeout(() => {
                    router.replace('/(auth)/personalise');
                }, 0);
            } else if (inAuthGroup && completedFirstLogin && !inPersonaliseFlow) {
                // User is in auth screens but has completed setup, redirect to app
                console.log('[NavGuard] Redirecting authenticated user to app');
                router.replace('/(tabs)');
            }
        }
    }, [session, isGuest, loading, segments, hasCompletedFirstLogin]);

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' }}>
                <ActivityIndicator size="large" color="#3b82f6" />
            </View>
        );
    }

    return <>{children}</>;
}

export default function Layout() {
    let [fontsLoaded] = useFonts({
        Nunito_400Regular,
        Nunito_500Medium,
        Nunito_600SemiBold,
        Nunito_700Bold,
        Nunito_800ExtraBold,
    });

    if (!fontsLoaded) {
        return null;
    }

    return (
        <ErrorBoundary>
            <ToastProvider>
                <SafeAreaProvider>
                    <QueryClientProvider client={queryClient}>
                        <AuthProvider>
                            <ConversionPromptProvider>
                                <GuessCacheProvider>
                                    <StreakSaverProvider>
                                        <OptionsProvider>
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
                                                </Stack>
                                            </NavigationGuard>
                                            <ConversionPromptModal />
                                        </OptionsProvider>
                                    </StreakSaverProvider>
                                </GuessCacheProvider>
                            </ConversionPromptProvider>
                        </AuthProvider>
                    </QueryClientProvider>
                </SafeAreaProvider>
            </ToastProvider>
        </ErrorBoundary>
    );
}
