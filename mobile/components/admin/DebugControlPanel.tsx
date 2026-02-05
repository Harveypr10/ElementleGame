import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { styled } from 'nativewind';
import { Trash2, Trophy, Flag, RefreshCw } from 'lucide-react-native';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { format, subDays } from 'date-fns';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);

interface DebugAction {
    label: string;
    color: string;
    icon: typeof Trash2;
    onPress: () => Promise<void>;
    confirmMessage?: string;
}

export default function DebugControlPanel() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [loading, setLoading] = useState<string | null>(null);

    // Helper: Get today's date in YYYY-MM-DD format
    const getDateStr = (daysAgo: number = 0): string => {
        const date = subDays(new Date(), daysAgo);
        return format(date, 'yyyy-MM-dd');
    };

    // Helper: Show toast notification
    const showToast = (message: string, isError: boolean = false) => {
        Alert.alert(isError ? 'Error' : 'Success', message);
    };

    // Helper: Clear all AsyncStorage game-related keys
    const clearGameCache = async () => {
        if (!user) return;

        const keysToRemove = [
            // Pending game states
            `pending_game_${user.id}_REGION_today`,
            `pending_game_${user.id}_USER_today`,
            // Cached game statuses
            'cached_game_status_region',
            'cached_game_status_user',
            // Puzzle caches (pattern-based, will clear all matching)
            'puzzle_data_REGION_',
            'puzzle_data_USER_',
        ];

        // Remove specific keys
        await Promise.all(keysToRemove.map(key =>
            AsyncStorage.removeItem(key).catch(() => { })
        ));

        // Clear all pending_game_ keys for this user
        const allKeys = await AsyncStorage.getAllKeys();
        const pendingGameKeys = allKeys.filter(key =>
            key.startsWith(`pending_game_${user.id}`)
        );
        await AsyncStorage.multiRemove(pendingGameKeys);

        console.log('[DebugPanel] Cleared AsyncStorage game cache');
    };

    // Helper: Invalidate React Query cache
    const invalidateAllQueries = () => {
        queryClient.invalidateQueries({ queryKey: ['game_status'] });
        queryClient.invalidateQueries({ queryKey: ['user_stats'] });
        queryClient.invalidateQueries({ queryKey: ['streak_saver_status'] });
        queryClient.invalidateQueries({ queryKey: ['archive_games'] });
        queryClient.invalidateQueries({ queryKey: ['user_profile'] });
        console.log('[DebugPanel] Invalidated React Query cache');
    };

    // Helper: Get or create allocation for a date
    const getOrCreateAllocation = async (mode: 'REGION' | 'USER', dateStr: string): Promise<number | null> => {
        const allocTable = mode === 'REGION' ? 'questions_allocated_region' : 'questions_allocated_user';
        const masterTable = mode === 'REGION' ? 'questions_master_region' : 'questions_master_user';

        // Check if allocation exists
        let query = supabase.from(allocTable).select('id').eq('puzzle_date', dateStr);

        if (mode === 'USER' && user) {
            query = query.eq('user_id', user.id);
        } else if (mode === 'REGION') {
            // Get user's region
            // @ts-ignore - Supabase type mismatch for user_profile table
            const { data: profile } = await supabase
                .from('user_profile')
                .select('region')
                .eq('user_id', user!.id)
                .maybeSingle();
            const region = profile?.region || 'UK';
            query = query.eq('region', region);
        }

        const { data: existing } = await query.maybeSingle();
        if (existing) return existing.id;

        // Create allocation if it doesn't exist
        if (mode === 'REGION') {
            // @ts-ignore - Supabase type mismatch for user_profile table
            const { data: profile } = await supabase
                .from('user_profile')
                .select('region')
                .eq('user_id', user!.id)
                .maybeSingle();
            const region = profile?.region || 'UK';

            // Find master question for this date
            const { data: master } = await supabase
                .from(masterTable)
                .select('id')
                .eq('answer_date_canonical', dateStr)
                .maybeSingle();

            if (!master) {
                console.warn(`[DebugPanel] No master question for ${mode} ${dateStr}`);
                return null;
            }

            // Create allocation
            // @ts-ignore - Supabase type mismatch for allocation insert
            const { data: newAlloc } = await supabase
                .from(allocTable)
                .insert({
                    question_id: master.id,
                    puzzle_date: dateStr,
                    region: region
                })
                .select('id')
                .single();

            return newAlloc?.id || null;
        } else {
            // USER mode - questions are user-specific
            const { data: master } = await supabase
                .from(masterTable)
                .select('id')
                .eq('answer_date_canonical', dateStr)
                .eq('user_id', user!.id)
                .maybeSingle();

            if (!master) {
                console.warn(`[DebugPanel] No master question for ${mode} ${dateStr}`);
                return null;
            }

            // @ts-ignore - Supabase type mismatch for allocation insert
            const { data: newAlloc } = await supabase
                .from(allocTable)
                .insert({
                    question_id: master.id,
                    puzzle_date: dateStr,
                    user_id: user!.id
                })
                .select('id')
                .single();

            return newAlloc?.id || null;
        }
    };

    // ACTION 1: Hard Reset Account
    const handleHardReset = async () => {
        if (!user) return;
        setLoading('reset');

        try {
            console.log('[DebugPanel] Starting hard reset for user:', user.id);

            // 1. Delete all game attempts
            const { error: regionAttemptsError } = await supabase
                .from('game_attempts_region')
                .delete()
                .eq('user_id', user.id);

            if (regionAttemptsError) throw regionAttemptsError;

            const { error: userAttemptsError } = await supabase
                .from('game_attempts_user')
                .delete()
                .eq('user_id', user.id);

            if (userAttemptsError) throw userAttemptsError;

            console.log('[DebugPanel] Deleted all game attempts');

            // 2. Get current next_holiday_reset_date from user_stats_user 
            // (Note: this column only exists in user_stats_user, NOT in user_stats_region)
            const { data: userStats } = await supabase
                .from('user_stats_user')
                .select('next_holiday_reset_date')
                .eq('user_id', user.id)
                .maybeSingle();

            console.log('[DebugPanel] Fetched holiday date:', userStats?.next_holiday_reset_date);

            // 3. Reset stats to defaults
            const { error: regionStatsError } = await supabase
                .from('user_stats_region')
                .update({
                    current_streak: 0,
                    max_streak: 0,
                    games_played: 0,
                    games_won: 0,
                    guess_distribution: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 },
                    missed_yesterday_flag_region: false
                })
                .eq('user_id', user.id);

            if (regionStatsError) {
                console.error('[DebugPanel] Region stats update error:', regionStatsError);
                throw regionStatsError;
            }
            console.log('[DebugPanel] Updated region stats');

            const { error: userStatsError } = await supabase
                .from('user_stats_user')
                .update({
                    current_streak: 0,
                    max_streak: 0,
                    games_played: 0,
                    games_won: 0,
                    guess_distribution: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 },
                    missed_yesterday_flag_user: false,
                    next_holiday_reset_date: userStats?.next_holiday_reset_date || null
                })
                .eq('user_id', user.id);

            if (userStatsError) {
                console.error('[DebugPanel] User stats update error:', userStatsError);
                throw userStatsError;
            }
            console.log('[DebugPanel] Updated user stats');

            // 4. Clear AsyncStorage cache
            await clearGameCache();

            // 5. Invalidate React Query cache
            invalidateAllQueries();

            showToast('Account reset successfully! All game data cleared.');
        } catch (error) {
            console.error('[DebugPanel] Hard reset error:', error);
            showToast(`Failed to reset account: ${error}`, true);
        } finally {
            setLoading(null);
        }
    };

    // ACTION 2-5: Force Win
    const handleForceWin = async (mode: 'REGION' | 'USER', daysAgo: number, label: string) => {
        if (!user) return;
        setLoading(label);

        try {
            const dateStr = getDateStr(daysAgo);
            const allocId = await getOrCreateAllocation(mode, dateStr);

            if (!allocId) {
                throw new Error(`No allocation found for ${mode} ${dateStr}`);
            }

            const attemptsTable = mode === 'REGION' ? 'game_attempts_region' : 'game_attempts_user';
            const allocIdCol = mode === 'REGION' ? 'allocated_region_id' : 'allocated_user_id';

            // Check if attempt already exists
            const { data: existing } = await supabase
                .from(attemptsTable)
                .select('id')
                .eq('user_id', user.id)
                .eq(allocIdCol, allocId)
                .maybeSingle();

            if (existing) {
                // Update existing
                await supabase
                    .from(attemptsTable)
                    .update({
                        result: 'won',
                        streak_day_status: 1,
                        num_guesses: 1,
                        completed_at: new Date().toISOString()
                    })
                    .eq('id', existing.id);
            } else {
                // Insert new
                await supabase
                    .from(attemptsTable)
                    .insert({
                        user_id: user.id,
                        [allocIdCol]: allocId,
                        result: 'won',
                        streak_day_status: 1,
                        num_guesses: 1,
                        completed_at: new Date().toISOString()
                    });
            }

            invalidateAllQueries();
            showToast(`${mode} win added for ${dateStr}`);
        } catch (error) {
            console.error(`[DebugPanel] Force win error:`, error);
            showToast(`Failed to add ${mode} win: ${error}`, true);
        } finally {
            setLoading(null);
        }
    };

    // ACTION 6-7: Set Missed Flag
    const handleSetMissedFlag = async (mode: 'REGION' | 'USER') => {
        if (!user) return;
        setLoading(`flag_${mode}`);

        try {
            const statsTable = mode === 'REGION' ? 'user_stats_region' : 'user_stats_user';
            const flagCol = mode === 'REGION' ? 'missed_yesterday_flag_region' : 'missed_yesterday_flag_user';

            await supabase
                .from(statsTable)
                .update({
                    [flagCol]: true,
                    current_streak: 1
                })
                .eq('user_id', user.id);

            invalidateAllQueries();
            showToast(`${mode} missed flag set (streak = 1)`);
        } catch (error) {
            console.error(`[DebugPanel] Set flag error:`, error);
            showToast(`Failed to set ${mode} flag: ${error}`, true);
        } finally {
            setLoading(null);
        }
    };

    // ACTION 8: Clear ALL AsyncStorage (for testing first-run)
    const handleClearAllAsyncStorage = async () => {
        setLoading('clear_storage');
        try {
            await AsyncStorage.clear();
            invalidateAllQueries();
            showToast('All AsyncStorage cleared! Reload app to test as new user.');
        } catch (error) {
            console.error('[DebugPanel] Clear AsyncStorage error:', error);
            showToast(`Failed to clear AsyncStorage: ${error}`, true);
        } finally {
            setLoading(null);
        }
    };

    const debugActions: DebugAction[] = [
        {
            label: '⚠️ HARD RESET ACCOUNT',
            color: '#dc2626',
            icon: Trash2,
            onPress: handleHardReset,
            confirmMessage: 'This will DELETE ALL game attempts and RESET all stats (preserving next_holiday_reset_date in user stats). AsyncStorage and React Query cache will be cleared. This action cannot be undone. Continue?'
        },
        {
            label: 'Force Region Win (2 Days Ago)',
            color: '#2563eb',
            icon: Trophy,
            onPress: () => handleForceWin('REGION', 2, 'region_2days')
        },
        {
            label: 'Force User Win (2 Days Ago)',
            color: '#7c3aed',
            icon: Trophy,
            onPress: () => handleForceWin('USER', 2, 'user_2days')
        },
        {
            label: 'Force Region Win (T-3 Days)',
            color: '#0891b2',
            icon: Trophy,
            onPress: () => handleForceWin('REGION', 3, 'region_t3')
        },
        {
            label: 'Force User Win (T-4 Days)',
            color: '#9333ea',
            icon: Trophy,
            onPress: () => handleForceWin('USER', 4, 'user_t4')
        },
        {
            label: 'Set Region Missed Flag',
            color: '#ea580c',
            icon: Flag,
            onPress: () => handleSetMissedFlag('REGION')
        },
        {
            label: 'Set User Missed Flag',
            color: '#d97706',
            icon: Flag,
            onPress: () => handleSetMissedFlag('USER')
        },
        {
            label: '🗑️ Clear All AsyncStorage',
            color: '#8b5cf6',
            icon: RefreshCw,
            onPress: handleClearAllAsyncStorage,
            confirmMessage: 'This will clear ALL AsyncStorage data (age verification, settings, caches, etc). Use to test first-run experience. Continue?'
        }
    ];

    const handleActionPress = (action: DebugAction) => {
        if (action.confirmMessage) {
            Alert.alert(
                'Confirm Action',
                action.confirmMessage,
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Proceed',
                        style: 'destructive',
                        onPress: action.onPress
                    }
                ]
            );
        } else {
            action.onPress();
        }
    };

    if (!user) {
        return (
            <StyledView className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                <StyledText className="text-slate-500 text-center">
                    User not authenticated
                </StyledText>
            </StyledView>
        );
    }

    return (
        <StyledView className="gap-3">
            {debugActions.map((action, index) => {
                const isLoading = loading === action.label ||
                    loading === 'reset' ||
                    loading?.includes(action.label.toLowerCase().replace(/\s+/g, '_'));
                const Icon = action.icon;

                return (
                    <StyledTouchableOpacity
                        key={index}
                        onPress={() => handleActionPress(action)}
                        disabled={!!loading}
                        className="flex-row items-center p-4 rounded-xl border border-slate-200 dark:border-slate-700"
                        style={{
                            backgroundColor: loading ? '#f1f5f9' : '#ffffff',
                            opacity: loading && !isLoading ? 0.5 : 1
                        }}
                    >
                        <StyledView
                            className="w-10 h-10 rounded-full items-center justify-center mr-3"
                            style={{ backgroundColor: `${action.color}20` }}
                        >
                            {isLoading ? (
                                <ActivityIndicator size="small" color={action.color} />
                            ) : (
                                <Icon size={20} color={action.color} />
                            )}
                        </StyledView>

                        <StyledView className="flex-1">
                            <StyledText
                                className="font-n-bold text-slate-900 dark:text-white"
                                style={{ fontSize: 15 }}
                            >
                                {action.label}
                            </StyledText>
                        </StyledView>
                    </StyledTouchableOpacity>
                );
            })}
        </StyledView>
    );
}
