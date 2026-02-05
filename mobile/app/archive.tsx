
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, Dimensions, Animated, useWindowDimensions } from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { styled } from 'nativewind';
import { ChevronLeft, ChevronRight, Settings, HelpCircle, ArrowLeft } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { useOptions } from '../lib/options';
import { MonthSelectModal } from '../components/archive/MonthSelectModal';
import { GuestRestrictionModal } from '../components/GuestRestrictionModal';
import { hasFeatureAccess } from '../lib/featureGates';
import { ThemedView } from '../components/ThemedView';
import { ThemedText } from '../components/ThemedText';
import { useThemeColor } from '../hooks/useThemeColor';
import { HolidayActivationModal } from '../components/game/HolidayActivationModal';
import { useNetwork } from '../contexts/NetworkContext';
import { useStreakSaverStatus } from '../hooks/useStreakSaverStatus';
import { HolidayActiveModal } from '../components/game/HolidayActiveModal';
import { endHolidayMode } from '../lib/supabase-rpc';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);

const { width: STATIC_WIDTH } = Dimensions.get('window');

interface DayStatus {
    date: string;
    hasPuzzle: boolean;
    puzzleId?: number;
    status: 'won' | 'lost' | 'played' | 'not-played';
    guesses?: number;
    isFuture: boolean;
    isHoliday: boolean;
}

// Sub-component for individual month page
const MonthPage = React.memo(({ monthDate, isActive, gameMode, isScreenFocused, onPlayPuzzle, width }: {
    monthDate: Date,
    isActive: boolean,
    gameMode: string,
    isScreenFocused: boolean,
    onPlayPuzzle: (puzzleId: number, date?: Date, status?: string) => void,
    width: number
}) => {
    const router = useRouter();
    const { user } = useAuth();
    const { darkMode } = useOptions();
    const borderColorTheme = useThemeColor({}, 'border');

    // Dynamic Text Size for Tablet
    const { width: screenWidth } = useWindowDimensions();
    const isTablet = screenWidth >= 768;
    const dateFontSize = isTablet ? 14 * 1.5 : 14;
    const statusFontSize = isTablet ? 10 * 1.4 : 10;
    // Responsive border radius: 8px (phone), 12px (medium ~600-768px), 16px (large >=768px)
    const borderRadius = screenWidth >= 768 ? 16 : screenWidth >= 600 ? 12 : 8;
    // Responsive padding: 2.5px (phone), 4px (larger screens)
    const dateBoxPadding = screenWidth >= 600 ? 4 : 2.5;

    // Local State
    const [loading, setLoading] = useState(true);
    const [hasFetched, setHasFetched] = useState(false);
    const [dataReady, setDataReady] = useState(false);
    const [monthData, setMonthData] = useState<Record<string, DayStatus>>({});
    const { isConnected } = useNetwork();


    // Fetch data when active and screen is focused
    useEffect(() => {
        if (isActive && isScreenFocused) {
            // Force refresh on focus to ensure data is fresh
            fetchData(true);
        }
    }, [isActive, isScreenFocused]);


    const themeColors = useMemo(() => {
        return {
            default: { bg: darkMode ? '#1e293b' : '#f8fafc', text: darkMode ? '#e2e8f0' : '#0f172a' },
            won: { bg: darkMode ? 'rgba(20, 83, 45, 0.4)' : '#dcfce7', text: darkMode ? '#4ade80' : '#15803d' },
            lost: { bg: darkMode ? 'rgba(127, 29, 29, 0.4)' : '#fee2e2', text: darkMode ? '#f87171' : '#b91c1c' },
            played: { bg: darkMode ? 'rgba(30, 58, 138, 0.4)' : '#dbeafe', text: darkMode ? '#60a5fa' : '#1d4ed8' },
            future: { bg: darkMode ? 'rgba(30, 41, 59, 0.5)' : '#f8fafc', text: darkMode ? '#475569' : '#cbd5e1' },
            empty: { bg: 'transparent', text: 'transparent' }
        };
    }, [darkMode]);

    // Trigger fade-in after data is loaded
    useEffect(() => {
        if (!loading && hasFetched) {
            const timer = setTimeout(() => {
                setDataReady(true);
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [loading, hasFetched]);

    const fetchData = async (forceRefresh = false) => {
        if (!user) return;

        const start = startOfMonth(monthDate);
        const end = endOfMonth(monthDate);
        const monthKey = `${format(monthDate, 'yyyy-MM')}`;
        const cacheKey = `archive-${gameMode}-${monthKey}`;

        // If forcing refresh, show loading immediately to block stale data
        if (forceRefresh) {
            setLoading(true);
        }

        try {
            // 1. Offline Handle
            if (isConnected === false) {
                const cached = await AsyncStorage.getItem(cacheKey);
                if (cached) {
                    setMonthData(JSON.parse(cached));
                    setHasFetched(true);
                }
                setLoading(false);
                return;
            }

            const isRegion = gameMode === 'REGION';
            const ALLOC_TABLE = isRegion ? 'questions_allocated_region' : 'questions_allocated_user';
            const ATTEMPTS_TABLE = isRegion ? 'game_attempts_region' : 'game_attempts_user';

            // 2. Fetch Puzzles
            let query = supabase
                .from(ALLOC_TABLE)
                .select(`id, puzzle_date`)
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

            // 3. Fetch Attempts
            let attempts: any[] = [];
            if (puzzleIds.length > 0) {
                const idColumn = isRegion ? 'allocated_region_id' : 'allocated_user_id';

                const { data: userAttempts, error: attemptError } = await supabase
                    .from(ATTEMPTS_TABLE)
                    .select(isRegion ? 'allocated_region_id, result, num_guesses, streak_day_status' : 'allocated_user_id, result, num_guesses, streak_day_status')
                    .eq('user_id', user.id)
                    .in(isRegion ? 'allocated_region_id' : 'allocated_user_id', puzzleIds);

                if (attemptError) throw attemptError;
                attempts = userAttempts || [];
            }

            // 4. Fetch Holiday Events (User Mode Only)
            let holidayEvents: any[] = [];
            if (gameMode === 'USER') {
                const { data: events, error: eventError } = await supabase
                    .from('user_holiday_events' as any)
                    .select('started_at, ended_at')
                    .eq('user_id', user.id);
                if (!eventError && events) holidayEvents = events;
            }

            // 5. Process Data
            const processed: Record<string, DayStatus> = {};
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

                    // Check Holiday
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
            setHasFetched(true);
            await AsyncStorage.setItem(cacheKey, JSON.stringify(processed));

        } catch (e) {
            console.error('[Archive] Fetch error:', e);
            if (!hasFetched) {
                try {
                    const cached = await AsyncStorage.getItem(cacheKey);
                    if (cached) setMonthData(JSON.parse(cached));
                } catch (ce) { }
            }
        } finally {
            setLoading(false);
        }
    };

    // --- HELPERS ---
    const days = eachDayOfInterval({
        start: startOfWeek(startOfMonth(monthDate)),
        end: endOfWeek(endOfMonth(monthDate))
    });

    const handleDayPress = (dayData: DayStatus) => {
        if (!dayData.hasPuzzle || dayData.isFuture || !dayData.puzzleId) return;
        // Delegate navigation/actions to parent
        onPlayPuzzle(dayData.puzzleId);
    };

    // --- RENDER ---

    if (loading) {
        return (
            <View style={{ width: width, flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#0ea5e9" />
                <ThemedText className="mt-4 text-slate-500">Loading history...</ThemedText>
            </View>
        );
    }

    // If offline and no data
    if (isConnected === false && Object.keys(monthData).length === 0) {
        return (
            <View style={{ width: width, flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <HelpCircle size={48} color={themeColors.default.text} opacity={0.5} />
                <ThemedText className="mt-4 text-slate-500 font-n-bold">Offline</ThemedText>
                <ThemedText className="text-slate-400 text-sm">Connect to view archive</ThemedText>
            </View>
        );
    }

    // Main Calendar Render
    return (
        <StyledView className="w-full">
            <StyledView className="relative" style={{ minHeight: (width / 7) * 6 }}>
                <Animated.View style={{ opacity: 1 }}>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: '100%' }}>
                        {days.map((day) => {
                            const dateKey = format(day, 'yyyy-MM-dd');
                            const data = monthData[dateKey];
                            const isCurrentMonth = isSameMonth(day, monthDate);
                            const isToday = isSameDay(day, new Date());

                            if (!isCurrentMonth) {
                                return <View key={dateKey} style={{ width: '14.285714%', aspectRatio: 1 }} />;
                            }

                            // Determine Colors
                            let colors = themeColors.default;
                            if (data) {
                                if (data.status === 'won') colors = themeColors.won;
                                else if (data.status === 'lost') colors = themeColors.lost;
                                else if (data.status === 'played') colors = themeColors.played;
                                else if (data.isFuture) colors = themeColors.future;
                            } else {
                                colors = themeColors.future;
                            }

                            let borderColor = 'transparent';
                            if (data?.isHoliday) borderColor = '#FACC15';
                            else if (isToday) borderColor = borderColorTheme;

                            return (
                                <View key={dateKey} style={{ width: '14.285714%', aspectRatio: 1, padding: dateBoxPadding }}>
                                    <StyledView style={{ flex: 1 }}>
                                        <StyledTouchableOpacity
                                            onPress={() => data && onPlayPuzzle(data.puzzleId || 0, day, data.status)}
                                            disabled={!data || !data.hasPuzzle || data.isFuture}
                                            className="flex-1 items-center justify-center border-2"
                                            style={{ backgroundColor: colors.bg, borderColor: borderColor, borderRadius: borderRadius }}
                                        >
                                            <Text style={{ fontFamily: 'Nunito-SemiBold', fontSize: dateFontSize, color: colors.text }}>
                                                {format(day, 'd')}
                                            </Text>
                                            {data && data.status !== 'not-played' && (
                                                <Text style={{ fontFamily: 'Nunito-Medium', fontSize: statusFontSize, marginTop: 2, opacity: 0.8, color: colors.text }}>
                                                    {data.status === 'won' ? `✓ ${data.guesses}` : (data.status === 'lost' ? '✗' : (data.guesses && data.guesses > 0 ? `${data.guesses}` : '-'))}
                                                </Text>
                                            )}
                                        </StyledTouchableOpacity>
                                    </StyledView>
                                </View>
                            )
                        })}
                    </View>
                </Animated.View>
            </StyledView>
        </StyledView>
    );
});

export default function ArchiveScreen() {
    const { width: screenWidth } = useWindowDimensions();
    const isTablet = screenWidth >= 768;
    const dateFontSize = isTablet ? 14 * 1.5 : 14;

    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const router = useRouter();
    const { gameMode: contextMode, textScale, darkMode } = useOptions();
    // Prioritize passed param, fallback to context
    const gameMode = (params.mode as string) || contextMode;
    const flatListRef = useRef<FlatList>(null);
    const { user, isGuest } = useAuth();
    const isFocused = useIsFocused();
    const { isConnected } = useNetwork();

    // Holiday Logic Integration
    const { holidayActive, holidayEndDate } = useStreakSaverStatus();
    const [showHolidayModal, setShowHolidayModal] = useState(false);
    const [pendingPuzzleId, setPendingPuzzleId] = useState<number | null>(null);

    const handlePlayPuzzle = (puzzleId: number, date?: Date, status?: string) => {
        // [FIX] Holiday Modal Logic Check
        // 1. Is Holiday Mode Active?
        // 2. Is it TODAY'S puzzle? (Archive matches should not trigger unless it's actually today)
        // 3. Is it NOT already won/lost? (If won/lost, let them view it)

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
    };


    // Theme Colors for Archive
    const brandColor = gameMode === 'USER' ? '#FFB067' : '#FFD429'; // Orange for User, Yellow for Region
    const brandColorDark = gameMode === 'USER' ? '#E69900' : '#E6B800'; // Darker variants

    // Initial Loading State for MinDate
    const [initializing, setInitializing] = useState(true);
    const [minDate, setMinDate] = useState<Date>(new Date(2022, 0, 1)); // Default fallback
    const today = useMemo(() => new Date(), []);

    // Modal State
    const [modalVisible, setModalVisible] = useState(false);
    const [guestModalVisible, setGuestModalVisible] = useState(false);

    // Check for guest mode on mount
    useEffect(() => {
        if (isGuest && !hasFeatureAccess('archive', !isGuest)) {
            setGuestModalVisible(true);
        }
    }, [isGuest]);

    // Fetch Min Date on Mount
    useEffect(() => {
        const fetchMinDate = async () => {
            if (!user) return;
            try {
                // Determine table based on Mode
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

                const { data, error } = await query.single();

                if (data && data.puzzle_date) {
                    const dbMin = new Date(data.puzzle_date);
                    setMinDate(startOfMonth(dbMin));
                }
            } catch (e) { /* fallback */ }
            finally {
                setInitializing(false);
            }
        };
        fetchMinDate();
    }, [gameMode, user]); // Re-run if mode changes

    // Use a ref to track minDate for comparison without triggering effect re-runs
    const minDateRef = useRef(minDate);
    useEffect(() => { minDateRef.current = minDate; }, [minDate]);

    // Refetch data when screen comes into focus (user returns to Archive)
    useFocusEffect(
        React.useCallback(() => {
            // Refetch min date to ensure it's current
            const refetchMinDate = async () => {
                if (!user) return;
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
                        const newMinDate = startOfMonth(dbMin);

                        // Optimize: Only update state if date actually changed
                        // Use Ref to Compare to avoid Re-running this effect
                        if (newMinDate.getTime() !== minDateRef.current.getTime()) {
                            console.log('[Archive] Min date changed, updating state.');
                            setMinDate(newMinDate);
                        }
                    }
                } catch (e) { /* Silent fail */ }
            };
            refetchMinDate();
        }, [gameMode, user]) // Removed minDate dependency
    );

    const months = useMemo(() => {
        if (minDate > today) return [today];
        return eachMonthOfInterval({ start: minDate, end: today });
    }, [today, minDate]);

    const [activeIndex, setActiveIndex] = useState(0);

    // Once initialized, scroll to end (Today)
    useEffect(() => {
        if (!initializing) {
            setActiveIndex(months.length - 1);
        }
    }, [initializing, months.length]);

    // Reset scroll to today when mode changes
    useEffect(() => {
        if (!initializing && months.length > 0) {
            const todayIndex = months.length - 1;
            setActiveIndex(todayIndex);

            // Only scroll if screen is visible/focused
            if (isFocused) {
                // Use timeout to ensure FlatList is ready after data change
                setTimeout(() => {
                    flatListRef.current?.scrollToIndex({
                        index: todayIndex,
                        animated: false
                    });
                }, 100);
            }
        }
    }, [gameMode, months.length, initializing]); // Removed isFocused to prevent reset on every focus

    // Keep activeIndexRef in sync for stable callbacks
    const activeIndexRef = useRef(activeIndex);
    useEffect(() => {
        activeIndexRef.current = activeIndex;
    }, [activeIndex]);

    // Ensure we sync scroll position when returning to the screen
    useFocusEffect(
        React.useCallback(() => {
            if (months.length > 0) {
                setTimeout(() => {
                    // Use ref to avoid dependency loop
                    const targetIndex = activeIndexRef.current;
                    flatListRef.current?.scrollToIndex({
                        index: targetIndex,
                        animated: false
                    });
                }, 100);
            }
        }, [months.length]) // Removed activeIndex from deps
    );

    // Sync initializing state to ref for stable callback usage
    const initializingRef = useRef(initializing);
    useEffect(() => {
        initializingRef.current = initializing;
    }, [initializing]);

    const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
        // Prevent updates during initialization or if empty
        // Use ref because this callback is created once and never recreated
        if (initializingRef.current) return;

        if (viewableItems && viewableItems.length > 0) {
            const index = viewableItems[0].index;
            if (index !== null && index !== undefined) {
                // Debounce or immediate update? Immediate is fine if initialized.
                setActiveIndex(index);
            }
        }
    }).current;

    const currentMonthDate = months[activeIndex] || today;
    const currentTitle = format(currentMonthDate, 'MMMM yyyy');

    const handlePrev = () => {
        if (activeIndex > 0) {
            flatListRef.current?.scrollToIndex({ index: activeIndex - 1, animated: true });
        }
    };

    const handleNext = () => {
        if (activeIndex < months.length - 1) {
            flatListRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
        }
    };

    const handleDateSelect = (date: Date) => {
        const monthsDiff = differenceInMonths(startOfMonth(date), startOfMonth(minDate));
        let targetIndex = Math.max(0, Math.min(months.length - 1, monthsDiff));

        flatListRef.current?.scrollToIndex({ index: targetIndex, animated: false });
        setActiveIndex(targetIndex);
    };

    const returnToToday = () => {
        handleDateSelect(today);
    };

    const isPrevDisabled = activeIndex === 0;
    const isNextDisabled = activeIndex === months.length - 1;
    const isTodaySelected = isSameMonth(currentMonthDate, today);

    if (initializing) {
        return (
            <ThemedView className="flex-1 items-center justify-center">
                <ActivityIndicator size="large" color="#7DAAE8" />
            </ThemedView>
        );
    }

    // Constrain max width for tablet (3xl is approx 768px)
    const MAX_WIDTH = 768;
    const effectiveContainerWidth = Math.min(screenWidth, MAX_WIDTH);
    const cardPadding = 32; // px-4 * 2 (outer container)
    // The width of the calendar card itself
    const calendarCardWidth = effectiveContainerWidth - cardPadding;
    // The header has responsive padding inside the card
    // Phone: px-2 (8px each side = 16px total), Larger: px-4 (16px each side = 32px total)
    const innerPadding = screenWidth >= 600 ? 32 : 16;
    const calendarContentWidth = calendarCardWidth - innerPadding;

    return (
        <ThemedView className="flex-1 bg-slate-100 dark:bg-slate-900">
            {/* Extended Header Background */}
            <StyledView
                style={{
                    backgroundColor: brandColor,
                    paddingTop: insets.top + 6,
                    paddingBottom: 24,
                }}
            >
                {/* Header Row */}
                <StyledView className="flex-row items-center justify-center py-3 w-full" style={{ position: 'relative', flexDirection: 'row' }}>
                    {/* Back Button - Absolute positioned at left - Web Safe Padding */}
                    <StyledTouchableOpacity onPress={() => router.back()} className="p-2" style={{ position: 'absolute', left: 16, zIndex: 10 }}>
                        <ChevronLeft size={28} color="#FFFFFF" />
                    </StyledTouchableOpacity>

                    {/* Title */}
                    <ThemedText className="font-n-bold text-white text-4xl font-heading">
                        Archive
                    </ThemedText>
                </StyledView>
            </StyledView>

            {/* Overlapping Navigation Controls - Matching Badge/Stats Cards style */}
            <StyledView className="w-full max-w-3xl self-center px-6 -mt-6 mb-4">
                <StyledView className="flex-row items-center gap-3" style={{ flexDirection: 'row' }}>

                    {/* Left Arrow Card */}
                    <StyledTouchableOpacity
                        onPress={handlePrev}
                        disabled={isPrevDisabled}
                        className={`bg-white dark:bg-slate-800 rounded-3xl shadow-sm items-center justify-center ${isPrevDisabled ? 'opacity-50' : 'opacity-100'}`}
                        style={{ width: 48, height: 60 }}
                    >
                        <ChevronLeft size={24} color={darkMode ? '#FFFFFF' : '#64748B'} />
                    </StyledTouchableOpacity>

                    {/* Month Title Card (Middle) */}
                    <StyledView
                        className="flex-1 bg-white dark:bg-slate-800 rounded-3xl shadow-sm items-center justify-center"
                        style={{ height: 60 }}
                    >
                        <TouchableOpacity onPress={() => setModalVisible(true)} className="items-center justify-center w-full h-full">
                            <ThemedText style={{ fontSize: isTablet ? 30 : 20 }} className="font-n-bold text-slate-800 dark:text-white" numberOfLines={1} adjustsFontSizeToFit>
                                {currentTitle}
                            </ThemedText>
                        </TouchableOpacity>
                    </StyledView>

                    {/* Right Arrow Card */}
                    <StyledTouchableOpacity
                        onPress={handleNext}
                        disabled={isNextDisabled}
                        className={`bg-white dark:bg-slate-800 rounded-3xl shadow-sm items-center justify-center ${isNextDisabled ? 'opacity-50' : 'opacity-100'}`}
                        style={{ width: 48, height: 60 }}
                    >
                        <ChevronRight size={24} color={darkMode ? '#FFFFFF' : '#64748B'} />
                    </StyledTouchableOpacity>

                </StyledView>
            </StyledView>

            {/* Offline Indicator */}
            {!isConnected && (
                <StyledView className="mx-6 mb-4 p-2 bg-slate-800 dark:bg-slate-700 rounded-xl items-center flex-row justify-center gap-2">
                    <View className="w-2 h-2 rounded-full bg-red-400" />
                    <ThemedText className="text-white text-xs font-n-bold">Offline Mode - Showing Cached Data</ThemedText>
                </StyledView>
            )}

            {/* Main Content Area */}
            <StyledView className="flex-1 px-4 w-full max-w-3xl self-center">
                {/* Calendar Card Container */}
                <StyledView className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm pb-4 pt-6 mb-4">
                    {/* Week Headers - with padding */}
                    <StyledView className={`${screenWidth >= 600 ? 'px-4' : 'px-2'} mb-4 border-b border-slate-100 dark:border-slate-700 pb-2`}>
                        <StyledView className="flex-row" style={{ flexDirection: 'row' }}>
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                                <StyledText key={day} style={{ fontSize: isTablet ? dateFontSize : 13 * textScale, width: '14.285714%' }} className="text-center font-n-bold text-slate-400 dark:text-slate-500 uppercase">
                                    {day}
                                </StyledText>
                            ))}
                        </StyledView>
                    </StyledView>

                    {/* Swipeable Calendar - with padding to match headers */}
                    <StyledView className={screenWidth >= 600 ? 'px-4' : 'px-2'}>
                        <FlatList
                            ref={flatListRef}
                            data={months}
                            keyExtractor={(item) => item.toISOString()}
                            horizontal
                            pagingEnabled
                            initialScrollIndex={months.length - 1}
                            getItemLayout={(data, index) => (
                                // Use content width for item layout
                                { length: calendarContentWidth, offset: calendarContentWidth * index, index }
                            )}
                            renderItem={({ item }) => (
                                <StyledView style={{ width: calendarContentWidth, paddingHorizontal: 8 }}>
                                    <MonthPage
                                        monthDate={item}
                                        isActive={true}
                                        gameMode={gameMode}
                                        isScreenFocused={isFocused}
                                        onPlayPuzzle={handlePlayPuzzle}
                                        width={calendarContentWidth - 16}
                                    />
                                </StyledView>
                            )}
                            onViewableItemsChanged={onViewableItemsChanged}
                            viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
                            onScrollToIndexFailed={(info) => {
                                const wait = new Promise(resolve => setTimeout(resolve, 500));
                                wait.then(() => {
                                    flatListRef.current?.scrollToIndex({ index: info.index, animated: false });
                                });
                            }}
                            showsHorizontalScrollIndicator={false}
                        />
                    </StyledView>
                </StyledView>
            </StyledView>

            {/* Return to Today Button (Bottom Floating/Fixed) */}
            {!isTodaySelected && (
                <StyledView className="absolute bottom-10 left-0 right-0 items-center z-10">
                    <ThemedView
                        variant="surface"
                        className="px-6 py-3 rounded-full shadow-lg border border-slate-100 dark:border-slate-700"
                    >
                        <TouchableOpacity onPress={returnToToday}>
                            <ThemedText style={{ fontSize: 16 * textScale, color: brandColorDark }} className="font-n-bold">
                                Return to today
                            </ThemedText>
                        </TouchableOpacity>
                    </ThemedView>
                </StyledView>
            )}

            <MonthSelectModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                currentDate={currentMonthDate}
                minDate={minDate}
                maxDate={today}
                onSelectDate={handleDateSelect}
            />

            <GuestRestrictionModal
                visible={guestModalVisible}
                onClose={() => {
                    setGuestModalVisible(false);
                    router.back();
                }}
                feature="Archive"
                description="Sign up to access past puzzles and track your history!"
            />

            {/* Holiday Active Modal */}
            <HolidayActiveModal
                visible={showHolidayModal}
                holidayEndDate={holidayEndDate || "Unknown Date"}
                onExitHoliday={async () => {
                    if (!user) return;
                    console.log(`[Archive] Exiting Holiday Mode`);
                    try {
                        await endHolidayMode(user.id, true);
                        setShowHolidayModal(false);
                        if (pendingPuzzleId) {
                            router.push(`/game/${gameMode}/${pendingPuzzleId}`);
                            setPendingPuzzleId(null);
                        }
                    } catch (e) {
                        console.error("[Archive] Failed to deactivate holiday:", e);
                        setShowHolidayModal(false);
                        if (pendingPuzzleId) {
                            router.push(`/game/${gameMode}/${pendingPuzzleId}`);
                            setPendingPuzzleId(null);
                        }
                    }
                }}
                onContinueHoliday={() => {
                    console.log(`[Archive] Continuing in Holiday Mode`);
                    setShowHolidayModal(false);
                    if (pendingPuzzleId) {
                        router.push({
                            pathname: `/game/${gameMode}/${pendingPuzzleId}`,
                            params: { preserveStreakStatus: 'true' }
                        });
                        setPendingPuzzleId(null);
                    }
                }}
            />

        </ThemedView>
    );
}
