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
                    .select('id, badge_count')
                    .eq('user_id', user.id)
                    .eq('badge_id', definition.id)
                    .eq('region', region === 'UK' ? 'UK' : 'GLOBAL') // [FIX] Ensure we match region properly if table is stringent
                    // Actually, the insert block below uses 'region' var. 
                    // Let's assume we match on badge_id + user_id + maybe game_type if needed?
                    // User request says: "region version of the UK game... update existing row... region=UK"
                    // Existing logic below inserts with `region: gameType === 'REGION' ? region : 'GLOBAL'`.
                    // So we must match that.
                    .eq('region', gameType === 'REGION' ? region : 'GLOBAL')
                    .eq('game_type', gameType)
                    .single();

                if (existing) {
                    // [FIX] RE-AWARD: Increment count and reset is_awarded to false
                    const newCount = (existing.badge_count || 1) + 1;
                    console.log(`[BadgeSystem] Re-awarding badge ${definition.name} (Count: ${newCount})`);

                    const { error: updateError } = await supabase
                        .from('user_badges')
                        .update({
                            badge_count: newCount,
                            is_awarded: false, // Reset to trigger popup
                            awarded_at: new Date().toISOString() // Update timestamp
                        })
                        .eq('id', existing.id);

                    if (!updateError) {
                        // Add to list so UI sees it
                        newBadges.push({
                            ...definition,
                            // @ts-ignore - appending runtime property for UI
                            badge_count: newCount
                        });
                        // Invalidate pending so it shows up
                        queryClient.invalidateQueries({ queryKey: ['pendingBadges'] });
                    }
                } else {
                    // Award New
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

        // C. Award New Badges (Insert to DB)
        // [FIX] Filter out badges that were already handled via update (re-awarded)
        // We can just check if they have 'badge_count' > 1 (which we injected above)
        // Or better, track inserts separate from returns.

        const badgesToInsert = newBadges.filter((b: any) => !b.badge_count || b.badge_count === 1);

        if (badgesToInsert.length > 0) {
            const inserts = badgesToInsert.map(b => ({
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

        return newBadges; // Return all (including re-awarded) for UI feedback if needed (though UI uses pendingBadges query usually)

    }, [user, badgeDefinitions, queryClient]);


    // 3. Mark Badge as Awarded (Visualized)
    const markBadgeAsSeen = async (userBadgeId: number) => {
        if (!user) return;

        console.log(`[BadgeSystem] Marking badge ${userBadgeId} as seen...`);

        // We update based on the specific row ID (user_badges.id)
        const { error, data } = await supabase
            .from('user_badges')
            .update({ is_awarded: true })
            .eq('id', userBadgeId)
            .select();

        if (error) {
            console.error('[BadgeSystem] Failed to mark badge seen:', error);
            // This strongly suggests RLS if "PGRST..." or permission error
        } else {
            console.log('[BadgeSystem] Successfully marked badge seen.', data);
            // Only invalidate if successful
            queryClient.invalidateQueries({ queryKey: ['pendingBadges'] });
        }
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

            // Inject badge_count into the badge definition object so UI can see it easily
            return data.map((ub: any) => ({
                ...ub,
                badge: {
                    ...ub.badge,
                    badge_count: ub.badge_count // Pass count to the display object
                }
            })) as UserBadge[];
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
