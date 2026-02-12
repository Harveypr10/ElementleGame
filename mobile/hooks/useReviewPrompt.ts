import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';

const REVIEW_MILESTONES = [7, 20, 50];

/**
 * Hook to determine if a review prompt should be shown.
 * Returns shouldShowReview=true when total games_won across
 * REGION + USER stats equals one of the milestone values.
 *
 * Call triggerReview() to request the native store review dialog
 * and mark it as triggered (so it doesn't show again this session).
 */
export function useReviewPrompt() {
    const { user } = useAuth();
    const [shouldShowReview, setShouldShowReview] = useState(false);
    const [totalWins, setTotalWins] = useState<number | null>(null);
    const [triggered, setTriggered] = useState(false);

    useEffect(() => {
        if (!user?.id || Platform.OS === 'web') return;

        const checkWins = async () => {
            try {
                // Fetch games_won from both stats tables
                const [regionResult, userResult] = await Promise.all([
                    supabase
                        .from('user_stats_region')
                        .select('games_won')
                        .eq('user_id', user.id)
                        .maybeSingle(),
                    supabase
                        .from('user_stats_user')
                        .select('games_won')
                        .eq('user_id', user.id)
                        .maybeSingle(),
                ]);

                const regionWins = regionResult.data?.games_won ?? 0;
                const userWins = userResult.data?.games_won ?? 0;
                const total = regionWins + userWins;

                console.log('[ReviewPrompt] Total wins:', total, '(region:', regionWins, 'user:', userWins, ')');
                setTotalWins(total);

                if (REVIEW_MILESTONES.includes(total)) {
                    console.log('[ReviewPrompt] Milestone reached:', total);
                    setShouldShowReview(true);
                }
            } catch (e) {
                console.error('[ReviewPrompt] Error checking wins:', e);
            }
        };

        checkWins();
    }, [user?.id]);

    const triggerReview = async () => {
        if (triggered) return;
        setTriggered(true);
        setShouldShowReview(false);

        try {
            const StoreReview = require('expo-store-review');

            if (await StoreReview.isAvailableAsync()) {
                console.log('[ReviewPrompt] Requesting store review');
                await StoreReview.requestReview();
            } else {
                console.log('[ReviewPrompt] Store review not available');
            }
        } catch (e) {
            console.error('[ReviewPrompt] Error requesting review:', e);
        }
    };

    return { shouldShowReview, triggerReview, totalWins };
}
