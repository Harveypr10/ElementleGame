
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, Dimensions, Animated } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
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

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);

const { width } = Dimensions.get('window');

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
const MonthPage = React.memo(({ monthDate, isActive, gameMode, isScreenFocused }: { monthDate: Date, isActive: boolean, gameMode: string, isScreenFocused: boolean }) => {
    const router = useRouter();
    const { user } = useAuth();
    const { darkMode } = useOptions();
    const borderColorTheme = useThemeColor({}, 'border');
    // Local State
    const [loading, setLoading] = useState(true);
    const [hasFetched, setHasFetched] = useState(false);
    const [dataReady, setDataReady] = useState(false);
    const [monthData, setMonthData] = useState<Record<string, DayStatus>>({});

    // Fetch data when active and screen is focsued
    useEffect(() => {
        if (isActive && isScreenFocused && !hasFetched) {
            fetchData();
        }
    }, [isActive, hasFetched, monthDate, gameMode, isScreenFocused]);


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



    // Trigger fade-in after data is loaded (matching web app's badge pattern)
    useEffect(() => {
        if (!loading && hasFetched) {
            const timer = setTimeout(() => {
                setDataReady(true);
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [loading, hasFetched]);

    const fetchData = async () => {
        if (!user) return;
        try {
            setLoading(true);
            const start = startOfMonth(monthDate);
            const end = endOfMonth(monthDate);

            const isRegion = gameMode === 'REGION';
            const ALLOC_TABLE = isRegion ? 'questions_allocated_region' : 'questions_allocated_user';
            const ATTEMPTS_TABLE = isRegion ? 'game_attempts_region' : 'game_attempts_user';

            // 1. Fetch Puzzles
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

            // 2. Fetch Attempts
            const puzzleIds = puzzles?.map(p => p.id) || [];
            console.log('[Archive] Fetching attempts for puzzleIds:', puzzleIds.slice(0, 5));
            let attempts: any[] = [];
            if (puzzleIds.length > 0) {
                const idColumn = isRegion ? 'allocated_region_id' : 'allocated_user_id';

                const { data: userAttempts, error: attemptError } = await supabase
                    .from(ATTEMPTS_TABLE)
                    .select(`${idColumn}, result, num_guesses, streak_day_status`)
                    .eq('user_id', user.id)
                    .in(idColumn, puzzleIds);

                if (attemptError) {
                    throw attemptError;
                }
                attempts = userAttempts || [];
            }

            // 2.5 Fetch Holiday Events (User Mode Only)
            // This ensures we can show the yellow border even if the user played the game (overwriting streak_day_status)
            let holidayEvents: any[] = [];
            if (gameMode === 'USER') {
                const { data: events, error: eventError } = await supabase
                    .from('user_holiday_events' as any)
                    .select('started_at, ended_at')
                    .eq('user_id', user.id);

                // Don't throw on error, just ignore (table might not exist yet)
                if (!eventError && events) {
                    holidayEvents = events;
                }
            }

            // 3. Map Data
            const statusMap: Record<string, DayStatus> = {};
            const idColumn = isRegion ? 'allocated_region_id' : 'allocated_user_id';

            puzzles?.forEach(puzzle => {
                const dateKey = format(new Date(puzzle.puzzle_date), 'yyyy-MM-dd');
                const attempt = attempts.find(a => a[idColumn] === puzzle.id);
                let status: DayStatus['status'] = 'not-played';
                let isHoliday = false;

                // Check if date falls within any holiday event
                // Holiday spans from [started_at, ended_at]. If ended_at is null, it's ongoing (use today/future).
                const puzzleDateObj = new Date(puzzle.puzzle_date);
                // Reset time components for accurate comparison
                puzzleDateObj.setHours(0, 0, 0, 0);

                const isCoveredByHoliday = holidayEvents.some(event => {
                    const start = new Date(event.started_at);
                    start.setHours(0, 0, 0, 0);

                    const end = event.ended_at ? new Date(event.ended_at) : new Date(8640000000000000); // Far future if null
                    if (event.ended_at) end.setHours(23, 59, 59, 999);

                    return puzzleDateObj >= start && puzzleDateObj <= end;
                });

                if (attempt) {
                    // Check Holiday Status (Priority: Historical Event > Current Status)
                    if (isCoveredByHoliday || attempt.streak_day_status === 0) {
                        isHoliday = true;
                    }

                    if (attempt.result === 'won') status = 'won';
                    else if (attempt.result === 'lost') status = 'lost';
                    else {
                        // Logic: Only show 'played' (Blue) if guesses > 0
                        // If guesses is null/0, it's just initialized (e.g. holiday row), so stay 'not-played'
                        if (attempt.num_guesses && attempt.num_guesses > 0) {
                            status = 'played';
                        }
                    }
                } else if (isCoveredByHoliday) {
                    // Even if no attempt row exists (shouldn't happen for active holidays, but possible), show as holiday
                    isHoliday = true;
                }

                statusMap[dateKey] = {
                    date: dateKey,
                    hasPuzzle: true,
                    puzzleId: puzzle.id,
                    status,
                    guesses: attempt?.num_guesses,
                    isFuture: isFuture(new Date(puzzle.puzzle_date)),
                    isHoliday
                };
            });

            setMonthData(statusMap);
            setHasFetched(true);

            // Cache the data 
            try {
                const monthKey = `${format(monthDate, 'yyyy-MM')}`;
                const cacheKey = `archive-${gameMode}-${monthKey}`;
                await AsyncStorage.setItem(cacheKey, JSON.stringify(statusMap));
            } catch (e) {
                console.error('[Archive] Cache write error:', e);
            }
        } catch (e) {
            console.error('[MonthPage] Error:', e);
        } finally {
            setLoading(false);
        }
    };

    const days = eachDayOfInterval({
        start: startOfWeek(startOfMonth(monthDate)),
        end: endOfWeek(endOfMonth(monthDate))
    });

    const handleDayPress = (dayData: DayStatus) => {
        if (!dayData.hasPuzzle || dayData.isFuture || !dayData.puzzleId) {
            return;
        }
        const modeSegment = gameMode;
        router.push(`/game/${modeSegment}/${dayData.puzzleId}`);
    };

    return (
        <StyledView className="w-full">
            <StyledView className="relative" style={{ minHeight: ((width - 64) / 7) * 6 }}>
                <StyledView
                    className="absolute inset-0 flex items-center justify-center"
                    style={{
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0,
                        justifyContent: 'center', alignItems: 'center', paddingTop: 60,
                        opacity: dataReady ? 0 : 1, pointerEvents: dataReady ? 'none' : 'auto'
                    }}
                >
                    <ActivityIndicator size="large" color="#94a3b8" />
                </StyledView>

                <Animated.View style={{ opacity: dataReady ? 1 : 0 }}>
                    <StyledView className="flex-row flex-wrap justify-center">
                        {days.map((day) => {
                            const dateKey = format(day, 'yyyy-MM-dd');
                            const data = monthData[dateKey];
                            const isCurrentMonth = isSameMonth(day, monthDate);
                            const isToday = isSameDay(day, new Date());

                            if (!isCurrentMonth) {
                                return <StyledView key={dateKey} className="w-[14%] aspect-square p-1" />;
                            }

                            // Determine Colors from Manual Theme
                            let colors = themeColors.default;
                            if (data) {
                                if (data.status === 'won') colors = themeColors.won;
                                else if (data.status === 'lost') colors = themeColors.lost;
                                else if (data.status === 'played') colors = themeColors.played;
                                else if (data.isFuture) colors = themeColors.future;
                            } else {
                                colors = themeColors.future; // No data = default/future look
                            }

                            // Border Logic: Holiday > Today > Default
                            let borderColor = 'transparent';
                            if (data?.isHoliday) {
                                borderColor = '#FACC15'; // Yellow-400 for Holiday
                            } else if (isToday) {
                                borderColor = borderColorTheme;
                            }

                            return (
                                <StyledView key={dateKey} className="w-[14%] aspect-square p-1">
                                    <StyledTouchableOpacity
                                        onPress={() => data && handleDayPress(data)}
                                        disabled={!data || !data.hasPuzzle || data.isFuture}
                                        className="flex-1 items-center justify-center rounded-lg border-2"
                                        style={{ backgroundColor: colors.bg, borderColor: borderColor }}
                                    >
                                        <Text style={{ fontFamily: 'Nunito-SemiBold', fontSize: 14, color: colors.text }}>
                                            {format(day, 'd')}
                                        </Text>
                                        {data && data.status !== 'not-played' && (
                                            <Text style={{ fontFamily: 'Nunito-Medium', fontSize: 10, marginTop: 2, opacity: 0.8, color: colors.text }}>
                                                {data.status === 'won' ? `✓ ${data.guesses}` : (data.status === 'lost' ? '✗' : '-')}
                                            </Text>
                                        )}
                                    </StyledTouchableOpacity>
                                </StyledView>
                            )
                        })}
                    </StyledView>
                </Animated.View>
            </StyledView>
        </StyledView>
    );
});

export default function ArchiveScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { gameMode, textScale, darkMode } = useOptions();
    const flatListRef = useRef<FlatList>(null);
    const { user, isGuest } = useAuth();
    const isFocused = useIsFocused();

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

    // Refetch data when screen comes into focus (user returns to Archive)
    useFocusEffect(
        React.useCallback(() => {
            console.log('[Archive] Screen focused - refetching min date');
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
                        setMinDate(startOfMonth(dbMin));
                    }
                } catch (e) { /* Silent fail */ }
            };
            refetchMinDate();
        }, [gameMode, user])
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

    return (
        <ThemedView className="flex-1 bg-slate-100 dark:bg-slate-900">
            {/* Extended Header Background - Matching Stats Screen */}
            <StyledView
                style={{
                    backgroundColor: brandColor,
                    paddingTop: insets.top + 6, // Added partial spacer to lower title
                    paddingBottom: 24,
                }}
            >
                {/* Header Row */}
                <StyledView className="flex-row items-center justify-between px-6 mb-2 py-3">
                    {/* Back Button */}
                    <StyledTouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center">
                        <ChevronLeft size={28} color="#FFFFFF" />
                    </StyledTouchableOpacity>

                    {/* Title */}
                    <ThemedText className="font-n-bold text-white text-4xl font-heading">
                        Archive
                    </ThemedText>

                    {/* Spacer (to balance Back button) */}
                    <StyledView className="w-10 h-10" />
                </StyledView>
            </StyledView>

            {/* Overlapping Navigation Controls - Matching Badge/Stats Cards style */}
            {/* Overlapping Navigation Controls */}
            <StyledView className="px-6 -mt-6 mb-4">
                <StyledView className="flex-row items-center gap-3">

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
                            <ThemedText className="font-n-bold text-xl text-slate-800 dark:text-white" numberOfLines={1} adjustsFontSizeToFit>
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

            {/* Main Content Area */}
            <StyledView className="flex-1 px-4">
                {/* Week Headers - Styled to match clean look */}
                <StyledView className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm px-4 pb-4 pt-6 mb-4">
                    <StyledView className="flex-row justify-between mb-4 border-b border-slate-100 dark:border-slate-700 pb-2">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                            <StyledText key={day} style={{ fontSize: 13 * textScale }} className="w-[14%] text-center font-n-bold text-slate-400 dark:text-slate-500 uppercase">
                                {day}
                            </StyledText>
                        ))}
                    </StyledView>

                    {/* Swipeable Calendar */}
                    <FlatList
                        ref={flatListRef}
                        data={months}
                        keyExtractor={(item) => item.toISOString()}
                        horizontal
                        pagingEnabled
                        initialScrollIndex={months.length - 1}
                        getItemLayout={(data, index) => (
                            { length: width - 64, offset: (width - 64) * index, index } // Adjust width for padding (32 outer + 32 inner)
                        )}
                        renderItem={({ item }) => (
                            <StyledView style={{ width: width - 64 }} className="items-center">
                                <MonthPage monthDate={item} isActive={true} gameMode={gameMode} isScreenFocused={isFocused} />
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

        </ThemedView>
    );
}

