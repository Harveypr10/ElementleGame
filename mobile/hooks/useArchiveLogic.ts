/**
 * useArchiveLogic.ts
 * Shared logic for Archive Screen (Mobile & Web)
 * 
 * Extracted from mobile app's archive.tsx
 * Handles: month navigation, day status fetching, grid generation, caching
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import {
    format,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    isSameMonth,
    isSameDay,
    isFuture,
    eachMonthOfInterval,
    differenceInMonths
} from 'date-fns';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { useOptions } from '../lib/options';
import { useNetwork } from '../contexts/NetworkContext';
import { useStreakSaverStatus } from '../hooks/useStreakSaverStatus';
import { endHolidayMode } from '../lib/supabase-rpc';

// Types
export interface DayStatus {
    date: string;
    hasPuzzle: boolean;
    puzzleId?: number;
    status: 'won' | 'lost' | 'played' | 'not-played';
    guesses?: number;
    isFuture: boolean;
    isHoliday: boolean;
}

export interface MonthData {
    [dateKey: string]: DayStatus;
}

// Theme Colors for Archive
export const getArchiveTheme = (gameMode: string, isDark: boolean) => {
    const brandColor = gameMode === 'USER' ? '#FFB067' : '#FFD429'; // Orange for User, Yellow for Region
    const brandColorDark = gameMode === 'USER' ? '#E69900' : '#E6B800';

    return {
        pageBg: isDark ? '#0f172a' : '#F1F5F9',
        cardBg: isDark ? '#1e293b' : '#FFFFFF',
        headerBg: brandColor,
        textPrimary: isDark ? '#FFFFFF' : '#1e293b',
        textSecondary: isDark ? '#94A3B8' : '#64748B',
        dayDefault: { bg: isDark ? '#1e293b' : '#f8fafc', text: isDark ? '#e2e8f0' : '#0f172a' },
        dayWon: { bg: isDark ? 'rgba(20, 83, 45, 0.4)' : '#dcfce7', text: isDark ? '#4ade80' : '#15803d' },
        dayLost: { bg: isDark ? 'rgba(127, 29, 29, 0.4)' : '#fee2e2', text: isDark ? '#f87171' : '#b91c1c' },
        dayPlayed: { bg: isDark ? 'rgba(30, 58, 138, 0.4)' : '#dbeafe', text: isDark ? '#60a5fa' : '#1d4ed8' },
        dayFuture: { bg: isDark ? 'rgba(30, 41, 59, 0.5)' : '#f8fafc', text: isDark ? '#475569' : '#cbd5e1' },
        holidayBorder: '#FACC15',
        todayBorder: isDark ? '#64748B' : '#334155',
        brandColor,
        brandColorDark,
    };
};

// Calendar Grid Generation
export const generateCalendarDays = (monthDate: Date): Date[] => {
    return eachDayOfInterval({
        start: startOfWeek(startOfMonth(monthDate)),
        end: endOfWeek(endOfMonth(monthDate))
    });
};

// Main Hook
export const useArchiveLogic = () => {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { user, isGuest } = useAuth();
    const { gameMode: contextMode, darkMode } = useOptions();
    const { isConnected } = useNetwork();
    const { holidayActive, holidayEndDate } = useStreakSaverStatus();

    // Prioritize passed param, fallback to context
    const gameMode = (params.mode as string) || contextMode;
    const isDark = darkMode;

    // State
    const [initializing, setInitializing] = useState(true);
    const [minDate, setMinDate] = useState<Date>(new Date(2022, 0, 1));
    const [activeIndex, setActiveIndex] = useState(0);
    const [monthData, setMonthData] = useState<MonthData>({});
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [guestModalVisible, setGuestModalVisible] = useState(false);
    const [showHolidayModal, setShowHolidayModal] = useState(false);
    const [pendingPuzzleId, setPendingPuzzleId] = useState<number | null>(null);

    const today = useMemo(() => new Date(), []);

    // Generate months array
    const months = useMemo(() => {
        if (minDate > today) return [today];
        return eachMonthOfInterval({ start: minDate, end: today });
    }, [today, minDate]);

    const currentMonthDate = months[activeIndex] || today;
    const currentTitle = format(currentMonthDate, 'MMMM yyyy');

    // Fetch Min Date on mount
    useEffect(() => {
        const fetchMinDate = async () => {
            if (!user) {
                setInitializing(false);
                return;
            }

            try {
                const isRegion = gameMode === 'REGION';
                const ALLOC_TABLE = isRegion ? 'questions_allocated_region' : 'questions_allocated_user';

                let query = supabase
                    .from(ALLOC_TABLE)
                    .select('puzzle_date')
                    .order('puzzle_date', { ascending: true })
                    .limit(1);

                if (isRegion) {
                    query = query.eq('region', 'UK');
                } else {
                    query = query.eq('user_id', user.id);
                }

                const { data } = await query.single();

                if (data?.puzzle_date) {
                    const dbMin = new Date(data.puzzle_date);
                    setMinDate(startOfMonth(dbMin));
                }
            } catch (e) {
                console.error('[Archive] Error fetching min date:', e);
            } finally {
                setInitializing(false);
            }
        };

        fetchMinDate();
    }, [gameMode, user]);

    // Set active index to today's month once initialized
    useEffect(() => {
        if (!initializing && months.length > 0) {
            setActiveIndex(months.length - 1);
        }
    }, [initializing, months.length]);

    // Fetch month data
    const fetchMonthData = useCallback(async (monthDate: Date) => {
        if (!user) return;

        const start = startOfMonth(monthDate);
        const end = endOfMonth(monthDate);
        const monthKey = format(monthDate, 'yyyy-MM');
        const cacheKey = `archive-${gameMode}-${monthKey}`;

        setLoading(true);

        try {
            // Offline handling
            if (isConnected === false) {
                const cached = await AsyncStorage.getItem(cacheKey);
                if (cached) {
                    setMonthData(JSON.parse(cached));
                }
                setLoading(false);
                return;
            }

            const isRegion = gameMode === 'REGION';
            const ALLOC_TABLE = isRegion ? 'questions_allocated_region' : 'questions_allocated_user';
            const ATTEMPTS_TABLE = isRegion ? 'game_attempts_region' : 'game_attempts_user';

            // Fetch Puzzles
            let query = supabase
                .from(ALLOC_TABLE)
                .select('id, puzzle_date')
                .gte('puzzle_date', start.toISOString())
                .lte('puzzle_date', end.toISOString());

            if (isRegion) {
                query = query.eq('region', 'UK');
            } else {
                query = query.eq('user_id', user.id);
            }

            const { data: puzzles, error: puzzleError } = await query;
            if (puzzleError) throw puzzleError;

            const puzzleIds = puzzles?.map(p => p.id) || [];

            // Fetch Attempts
            let attempts: any[] = [];
            if (puzzleIds.length > 0) {
                const idColumn = isRegion ? 'allocated_region_id' : 'allocated_user_id';

                const { data: userAttempts, error: attemptError } = await supabase
                    .from(ATTEMPTS_TABLE)
                    .select(isRegion
                        ? 'allocated_region_id, result, num_guesses, streak_day_status'
                        : 'allocated_user_id, result, num_guesses, streak_day_status'
                    )
                    .eq('user_id', user.id)
                    .in(isRegion ? 'allocated_region_id' : 'allocated_user_id', puzzleIds);

                if (attemptError) throw attemptError;
                attempts = userAttempts || [];
            }

            // Fetch Holiday Events (User Mode Only)
            let holidayEvents: any[] = [];
            if (gameMode === 'USER') {
                const { data: events } = await supabase
                    .from('user_holiday_events' as any)
                    .select('started_at, ended_at')
                    .eq('user_id', user.id);
                holidayEvents = events || [];
            }

            // Process Data
            const processed: MonthData = {};
            const daysToProcess = eachDayOfInterval({ start, end });
            const idColumn = isRegion ? 'allocated_region_id' : 'allocated_user_id';

            daysToProcess.forEach(day => {
                const dateKey = format(day, 'yyyy-MM-dd');
                const puzzle = puzzles?.find(p => p.puzzle_date === dateKey);
                const attempt = attempts.find(a => puzzle && a[idColumn] === puzzle.id);

                let status: DayStatus['status'] = 'not-played';
                let isHoliday = false;

                if (puzzle) {
                    const puzzleDateObj = new Date(puzzle.puzzle_date);
                    puzzleDateObj.setHours(0, 0, 0, 0);

                    // Check Holiday coverage
                    const isCoveredByHoliday = holidayEvents.some(event => {
                        const hStart = new Date(event.started_at);
                        hStart.setHours(0, 0, 0, 0);
                        const hEnd = event.ended_at ? new Date(event.ended_at) : new Date(8640000000000000);
                        if (event.ended_at) hEnd.setHours(23, 59, 59, 999);
                        return puzzleDateObj >= hStart && puzzleDateObj <= hEnd;
                    });

                    if (attempt) {
                        if (isCoveredByHoliday || attempt.streak_day_status === 0) isHoliday = true;

                        if (attempt.result === 'won') status = 'won';
                        else if (attempt.result === 'lost') status = 'lost';
                        else if (attempt.num_guesses && attempt.num_guesses > 0) status = 'played';
                    } else if (isCoveredByHoliday) {
                        isHoliday = true;
                    }
                }

                processed[dateKey] = {
                    date: dateKey,
                    hasPuzzle: !!puzzle,
                    puzzleId: puzzle?.id,
                    status,
                    guesses: attempt?.num_guesses,
                    isFuture: isFuture(day) && !isSameDay(day, new Date()),
                    isHoliday
                };
            });

            setMonthData(processed);
            await AsyncStorage.setItem(cacheKey, JSON.stringify(processed));

        } catch (e) {
            console.error('[Archive] Fetch error:', e);
            // Try to load from cache on error
            try {
                const cached = await AsyncStorage.getItem(cacheKey);
                if (cached) setMonthData(JSON.parse(cached));
            } catch (ce) { }
        } finally {
            setLoading(false);
        }
    }, [user, gameMode, isConnected]);

    // Fetch data when active month changes
    useEffect(() => {
        if (!initializing && currentMonthDate) {
            fetchMonthData(currentMonthDate);
        }
    }, [activeIndex, initializing, fetchMonthData, currentMonthDate]);

    // Navigation handlers
    const handlePrev = useCallback(() => {
        if (activeIndex > 0) {
            setActiveIndex(activeIndex - 1);
        }
    }, [activeIndex]);

    const handleNext = useCallback(() => {
        if (activeIndex < months.length - 1) {
            setActiveIndex(activeIndex + 1);
        }
    }, [activeIndex, months.length]);

    const handleDateSelect = useCallback((date: Date) => {
        const monthsDiff = differenceInMonths(startOfMonth(date), startOfMonth(minDate));
        const targetIndex = Math.max(0, Math.min(months.length - 1, monthsDiff));
        setActiveIndex(targetIndex);
        setModalVisible(false);
    }, [minDate, months.length]);

    const returnToToday = useCallback(() => {
        handleDateSelect(today);
    }, [today, handleDateSelect]);

    // Play puzzle handler with holiday check
    const handlePlayPuzzle = useCallback((puzzleId: number, date?: Date, status?: string) => {
        let shouldShowHolidayModal = false;

        if (holidayActive && date) {
            const isToday = isSameDay(date, new Date());
            const isCompleted = status === 'won' || status === 'lost';

            if (isToday && !isCompleted) {
                shouldShowHolidayModal = true;
            }
        }

        if (shouldShowHolidayModal) {
            setPendingPuzzleId(puzzleId);
            setShowHolidayModal(true);
        } else {
            router.push(`/game/${gameMode}/${puzzleId}`);
        }
    }, [holidayActive, gameMode, router]);

    // Holiday modal handlers
    const handleExitHoliday = async () => {
        if (!user) return;
        try {
            await endHolidayMode(user.id, true);
            setShowHolidayModal(false);
            if (pendingPuzzleId) {
                router.push(`/game/${gameMode}/${pendingPuzzleId}`);
                setPendingPuzzleId(null);
            }
        } catch (e) {
            console.error('[Archive] Failed to exit holiday:', e);
            setShowHolidayModal(false);
            if (pendingPuzzleId) {
                router.push(`/game/${gameMode}/${pendingPuzzleId}`);
                setPendingPuzzleId(null);
            }
        }
    };

    const handleContinueHoliday = () => {
        setShowHolidayModal(false);
        if (pendingPuzzleId) {
            router.push({
                pathname: `/game/${gameMode}/${pendingPuzzleId}`,
                params: { preserveStreakStatus: 'true' }
            });
            setPendingPuzzleId(null);
        }
    };

    const handleBack = useCallback(() => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/(tabs)/');
        }
    }, [router]);

    // Computed values
    const isPrevDisabled = activeIndex === 0;
    const isNextDisabled = activeIndex === months.length - 1;
    const isTodaySelected = isSameMonth(currentMonthDate, today);

    // Calendar days for current month
    const calendarDays = useMemo(() => {
        return generateCalendarDays(currentMonthDate);
    }, [currentMonthDate]);

    return {
        // Auth
        user,
        isGuest,

        // Config
        gameMode,
        isDark,
        isConnected,

        // State
        initializing,
        loading,
        monthData,
        months,
        activeIndex,
        setActiveIndex,

        // Current month
        currentMonthDate,
        currentTitle,
        calendarDays,

        // Navigation
        isPrevDisabled,
        isNextDisabled,
        isTodaySelected,
        handlePrev,
        handleNext,
        handleDateSelect,
        returnToToday,
        handleBack,

        // Play & Holiday
        handlePlayPuzzle,
        handleExitHoliday,
        handleContinueHoliday,
        holidayEndDate,
        showHolidayModal,
        setShowHolidayModal,

        // Modals
        modalVisible,
        setModalVisible,
        guestModalVisible,
        setGuestModalVisible,

        // Data
        minDate,
        today,
    };
};
