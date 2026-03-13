import React, { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { OnboardingScreen } from '../../components/OnboardingScreen';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { useInterstitialAd } from '../../hooks/useInterstitialAd';
import { useAdsConsent } from '../../hooks/useAdsConsent';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

export default function OnboardingPage() {
    const router = useRouter();
    const { signOut } = useAuth();
    const { showAd, isLoaded, isClosed } = useInterstitialAd();
    const { triggerConsentFlow } = useAdsConsent();
    const [eventTitle, setEventTitle] = useState('Loading...');
    const [puzzleDate, setPuzzleDate] = useState('');
    const [loading, setLoading] = useState(true);
    const [waitingForAd, setWaitingForAd] = useState(false);

    // ... (useEffect hooks remain same)

    const handleDevReset = async () => {
        try {
            await signOut();
            await AsyncStorage.clear();
            Alert.alert(
                "Data Nuked",
                "Please close and restart the app to test as a fresh user."
            );
        } catch (e) {
            console.error('Nuke failed', e);
        }
    };

    // Watch for Ad Closure to navigate
    // Safety timeout ensures user isn't trapped if CLOSED event never fires
    useEffect(() => {
        if (waitingForAd && isClosed) {
            const targetDate = puzzleDate || 'today';
            router.replace({
                pathname: `/game/REGION/${targetDate}`,
                params: { skipIntro: 'true' }
            });
            setWaitingForAd(false);
        }

        // Safety timeout: if ad was shown but CLOSED event never fires, navigate anyway
        if (waitingForAd && !isClosed) {
            const safetyTimer = setTimeout(() => {
                console.warn('[Onboarding] Ad safety timeout — navigating to game');
                const targetDate = puzzleDate || 'today';
                router.replace({
                    pathname: `/game/REGION/${targetDate}`,
                    params: { skipIntro: 'true' }
                });
                setWaitingForAd(false);
            }, 30000); // 30s — generous to allow full ad playback
            return () => clearTimeout(safetyTimer);
        }
    }, [waitingForAd, isClosed, puzzleDate]);

    useEffect(() => {
        fetchTodaysPuzzle();
    }, []);

    const fetchTodaysPuzzle = async () => {
        // ... existing implementation ..
        try {
            const today = new Date().toISOString().split('T')[0];

            // Try fetch today's
            let { data: allocation, error } = await supabase
                .from('questions_allocated_region')
                .select('question_id, puzzle_date')
                .eq('region', 'GLOBAL')
                .eq('puzzle_date', today)
                .maybeSingle();

            if (!allocation) {
                // FALLBACK: Get most recent puzzle
                const { data: recent, error: recentError } = await supabase
                    .from('questions_allocated_region')
                    .select('question_id, puzzle_date')
                    .eq('region', 'GLOBAL')
                    .order('puzzle_date', { ascending: false })
                    .limit(1)
                    .single();

                if (recent) {
                    allocation = recent;
                    console.log(`[Onboarding] Today (${today}) missing. Falling back to: ${recent.puzzle_date}`);
                }
            }

            if (allocation && allocation.question_id) {
                setPuzzleDate(allocation.puzzle_date);

                const { data: master, error: masterError } = await supabase
                    .from('questions_master_region')
                    .select('event_title')
                    .eq('id', allocation.question_id)
                    .single();

                if (masterError) throw masterError;

                if (master && master.event_title) {
                    setEventTitle(master.event_title);
                    return;
                }
            }

            // Fallback if absolutely no puzzle found
            setEventTitle('Today\'s Historical Event');
            setPuzzleDate(today); // Default to today even if missing
        } catch (error) {
            console.error('Error fetching puzzle:', error);
            setEventTitle('Today\'s Historical Event');
        } finally {
            setLoading(false);
        }
    };

    const handlePlay = async () => {
        // Trigger UMP/ATT consent flow before playing as guest
        // Timeout after 3s so slow network doesn't block the user from playing
        try {
            const timeout = new Promise<void>((resolve) => setTimeout(resolve, 3000));
            await Promise.race([triggerConsentFlow(), timeout]);
        } catch (err) {
            console.warn('[Onboarding] Consent flow failed/timed out, proceeding:', err);
        }

        // Show interstitial if loaded, otherwise proceed directly
        if (isLoaded) {
            setWaitingForAd(true);
            showAd();
        } else {
            const targetDate = puzzleDate || 'today';
            router.replace({
                pathname: `/game/REGION/${targetDate}`,
                params: { skipIntro: 'true' }
            });
        }
    };

    const handleCreateAccount = () => {
        router.push({ pathname: '/(auth)/login', params: { intent: 'signup' } });
    };

    const handleLoginLink = () => {
        router.push({ pathname: '/(auth)/login', params: { intent: 'login' } });
    };

    const handleSubscribe = () => {
        // Navigate to new subscription flow
        router.push('/(auth)/subscription-flow');
    };

    if (loading) {
        return null;
    }

    // Prevent flash of onboarding screen when ad closes by rendering empty view/loading state
    if (waitingForAd) {
        return <React.Fragment />;
    }

    return (
        <OnboardingScreen
            eventTitle={eventTitle}
            puzzleDateCanonical={puzzleDate}
            onPlay={handlePlay}
            onCreateAccount={handleCreateAccount}
            onLoginLink={handleLoginLink}
            onSubscribe={handleSubscribe}
            onDevReset={handleDevReset}
        />
    );
}
