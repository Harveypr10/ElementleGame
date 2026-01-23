import React, { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { OnboardingScreen } from '../../components/OnboardingScreen';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';

export default function OnboardingPage() {
    const router = useRouter();
    const { signInAnonymously } = useAuth();
    const [eventTitle, setEventTitle] = useState('Loading...');
    const [puzzleDate, setPuzzleDate] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchTodaysPuzzle();
    }, []);

    const fetchTodaysPuzzle = async () => {
        try {
            const today = new Date().toISOString().split('T')[0];

            // Try fetch today's
            let { data: allocation, error } = await supabase
                .from('questions_allocated_region')
                .select('question_id, puzzle_date')
                .eq('region', 'UK')
                .eq('puzzle_date', today)
                .maybeSingle();

            if (!allocation) {
                // FALLBACK: Get most recent puzzle
                const { data: recent, error: recentError } = await supabase
                    .from('questions_allocated_region')
                    .select('question_id, puzzle_date')
                    .eq('region', 'UK')
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
        // Play as guest - set guest mode first to bypass NavigationGuard
        await signInAnonymously();
        // Navigate to the SPECIFIC date found (or today if fallback)
        // This ensures the game screen loads an actual puzzle even if it's from yesterday
        const targetDate = puzzleDate || 'today';
        router.push(`/game/REGION/${targetDate}`);
    };

    const handleLogin = () => {
        router.push('/(auth)/login');
    };

    const handleSubscribe = () => {
        // Navigate to new subscription flow
        router.push('/(auth)/subscription-flow');
    };

    if (loading) {
        return null;
    }

    return (
        <OnboardingScreen
            eventTitle={eventTitle}
            puzzleDateCanonical={puzzleDate}
            onPlay={handlePlay}
            onLogin={handleLogin}
            onSubscribe={handleSubscribe}
        />
    );
}
