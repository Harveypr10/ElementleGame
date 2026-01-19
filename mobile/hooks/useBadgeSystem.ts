import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../lib/auth';

export interface Badge {
    id: number;
    name: string;
    category: string;
    threshold: number;
    icon_url: string;
    description: string;
}

export interface UserBadge {
    id: number;
    user_id: string;
    badge_id: number;
    is_awarded: boolean;
    region: string;
    game_type: string;
    awarded_at: string;
    badge?: Badge; // Joined
}

export const useBadgeSystem = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    // 1. Fetch Badge Definitions (Cached)
    const { data: badgeDefinitions } = useQuery({
        queryKey: ['badgeDefinitions'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('badges')
                .select('*')
                .order('threshold', { ascending: true });
            if (error) throw error;
            return data as Badge[];
        },
        staleTime: 1000 * 60 * 60, // 1 hour
    });

    // 2. Check & Award Badges on Win
    const checkBadgesForWin = useCallback(async (
        guesses: number,
        streak: number,
        gameType: 'REGION' | 'USER',
        region: string = 'UK'
    ): Promise<Badge[]> => {
        if (!user || !badgeDefinitions) return [];

        const newBadges: Badge[] = [];

        // A. Check Elementle In (Guesses)
        // Correct categories are "Elementle In" (from DB query)
        if (guesses === 1 || guesses === 2) {
            const definition = badgeDefinitions.find(
                b => b.category === 'Elementle In' && b.threshold === guesses
            );

            if (definition) {
                // Check if already owns this badge
                const { data: existing } = await supabase
                    .from('user_badges')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('badge_id', definition.id)
                    .single();

                if (!existing) {
                    newBadges.push(definition);
                }
            }
        }

        // B. Check Streak
        // Correct category is "Streak"
        const streakDef = badgeDefinitions.find(
            b => b.category === 'Streak' && b.threshold === streak
        );

        if (streakDef) {
            const { data: existing } = await supabase
                .from('user_badges')
                .select('id')
                .eq('user_id', user.id)
                .eq('badge_id', streakDef.id)
                .single();

            if (!existing) {
                newBadges.push(streakDef);
            }
        }

        // C. Award New Badges (Insert to DB with is_awarded=false initially for safety, 
        // or true if we handle display immediately. 
        // Plan: Insert is_awarded=false. Return them to UI. UI shows them. UI calls markAsAwarded.
        if (newBadges.length > 0) {
            const inserts = newBadges.map(b => ({
                user_id: user.id,
                badge_id: b.id,
                is_awarded: false, // Pending display
                game_type: gameType,
                region: gameType === 'REGION' ? region : 'GLOBAL',
                badge_count: 1
            }));

            const { error } = await supabase.from('user_badges').insert(inserts);
            if (error) console.error("Error awarding badges:", error);

            // Invalidate cache
            queryClient.invalidateQueries({ queryKey: ['userBadges'] });
        }

        return newBadges;

    }, [user, badgeDefinitions, queryClient]);


    // 3. Mark Badge as Awarded (Visualized)
    const markBadgeAsSeen = async (badgeId: number) => {
        if (!user) return;

        // We update based on badge_id for this user
        await supabase
            .from('user_badges')
            .update({ is_awarded: true })
            .eq('user_id', user.id)
            .eq('badge_id', badgeId);

        queryClient.invalidateQueries({ queryKey: ['pendingBadges'] });
    };

    // 4. Fetch Pending Badges (Inbox)
    const { data: pendingBadges, refetch: refetchPending } = useQuery({
        queryKey: ['pendingBadges', user?.id],
        queryFn: async () => {
            if (!user) return [];
            const { data, error } = await supabase
                .from('user_badges')
                .select('*, badge:badges(*)')
                .eq('user_id', user.id)
                .eq('is_awarded', false);

            if (error) return [];
            return data as UserBadge[]; // Returns joined data
        },
        enabled: !!user,
        refetchOnWindowFocus: true
    });

    return {
        checkBadgesForWin,
        markBadgeAsSeen,
        pendingBadges,
        refetchPending
    };
};
