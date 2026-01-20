
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, Dimensions, Animated } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { useOptions } from '../lib/options';
import { MonthSelectModal } from '../components/archive/MonthSelectModal';
import { GuestRestrictionModal } from '../components/GuestRestrictionModal';
import { hasFeatureAccess } from '../lib/featureGates';

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
}

// Sub-component for individual month page
const MonthPage = React.memo(({ monthDate, isActive, gameMode }: { monthDate: Date, isActive: boolean, gameMode: string }) => {
    const router = useRouter();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [monthData, setMonthData] = useState<Record<string, DayStatus>>({});
    const [hasFetched, setHasFetched] = useState(false);
    const [dataReady, setDataReady] = useState(false);
    const prevModeRef = useRef(gameMode);

    // Load cached data immediately for instant display
    useEffect(() => {
        const loadCachedData = async () => {
            try {
                const monthKey = `${format(monthDate, 'yyyy-MM')}`;
                const cacheKey = `archive-${gameMode}-${monthKey}`;
                const cached = await AsyncStorage.getItem(cacheKey);

                if (cached) {
                    const parsedCache = JSON.parse(cached);
                    console.log('[Archive] Loaded cached data for', monthKey, ':', parsedCache);
                    setMonthData(parsedCache);
                    setLoading(false); // Show cached data immediately
                }
            } catch (e) {
                console.error('[Archive] Cache read error:', e);
            }
        };

        loadCachedData();
    }, [monthDate, gameMode]);

    useEffect(() => {
        // Only reset dataReady if mode actually changed
        if (prevModeRef.current !== gameMode) {
            console.log('[Archive] Mode changed from', prevModeRef.current, 'to', gameMode);
            setDataReady(false);
            prevModeRef.current = gameMode;
        }

        setHasFetched(false);
        fetchData(); // Fetch fresh data in background
    }, [monthDate, user, gameMode]);

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
                // User mode likely filtered by user_id if it's personal allocation?
                // The user said "game_attempts_user links to questions_allocated_user on allocated_user_id".
                // If allocated_user is per user, we need .eq('user_id', user.id).
                // I will add this safety check.
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
                    .select(`${idColumn}, result, num_guesses`)
                    .eq('user_id', user.id)
                    .in(idColumn, puzzleIds);

                console.log('[Archive] Attempts query result:', {
                    table: ATTEMPTS_TABLE,
                    count: userAttempts?.length,
                    error: attemptError,
                    sample: userAttempts?.[0]
                });

                if (attemptError) {
                    console.error('[Archive] Attempt fetch error:', attemptError);
                    throw attemptError;
                }
                attempts = userAttempts || [];
            }

            // 3. Map Data
            const statusMap: Record<string, DayStatus> = {};
            const idColumn = isRegion ? 'allocated_region_id' : 'allocated_user_id';

            console.log('[Archive] Mapping puzzles to status. Sample puzzle:', puzzles?.[0]);
            console.log('[Archive] Sample attempt:', attempts?.[0]);

            puzzles?.forEach(puzzle => {
                const dateKey = format(new Date(puzzle.puzzle_date), 'yyyy-MM-dd');
                const attempt = attempts.find(a => a[idColumn] === puzzle.id);
                let status: DayStatus['status'] = 'not-played';
                if (attempt) {
                    status = attempt.result === 'won' ? 'won' : (attempt.result === 'lost' ? 'lost' : 'played');
                }

                console.log(`[Archive] Date ${dateKey}: puzzle=${puzzle.id}, attempt found=${!!attempt}, result=${attempt?.result}, status=${status}, guesses=${attempt?.num_guesses}`);

                statusMap[dateKey] = {
                    date: dateKey,
                    hasPuzzle: true,
                    puzzleId: puzzle.id,
                    status,
                    guesses: attempt?.num_guesses,
                    isFuture: isFuture(new Date(puzzle.puzzle_date))
                };
            });

            setMonthData(statusMap);
            setHasFetched(true);

            // Cache the data for instant load next time
            try {
                const monthKey = `${format(monthDate, 'yyyy-MM')}`;
                const cacheKey = `archive-${gameMode}-${monthKey}`;
                await AsyncStorage.setItem(cacheKey, JSON.stringify(statusMap));
                console.log('[Archive] Cached data for', monthKey);
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
        // Pass ID directly to Game Screen. Appending mode for safety/clarity in URL though route params handle it.
        const modeSegment = gameMode; // 'REGION' or 'USER'
        router.push(`/game/${modeSegment}/${dayData.puzzleId}`);
    };

    return (
        <StyledView style={{ width }} className="px-4">
            {/* Fixed height container to prevent layout shift */}
            <StyledView className="relative" style={{ minHeight: 300 }}>
                {/* Loading Spinner - fades out when data is ready */}
                <StyledView
                    className="absolute inset-0 flex items-center justify-center"
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        justifyContent: 'center',
                        alignItems: 'center',
                        paddingTop: 60,
                        opacity: dataReady ? 0 : 1,
                        pointerEvents: dataReady ? 'none' : 'auto'
                    }}
                >
                    <ActivityIndicator size="large" color="#94a3b8" />
                </StyledView>

                {/* Calendar Grid - fades in when ready */}
                <Animated.View
                    style={{ opacity: dataReady ? 1 : 0 }}
                >
                    <StyledView className="flex-row flex-wrap">
                        {days.map((day) => {
                            const dateKey = format(day, 'yyyy-MM-dd');
                            const data = monthData[dateKey];
                            const isCurrentMonth = isSameMonth(day, monthDate);
                            const isToday = isSameDay(day, new Date());

                            if (!isCurrentMonth) {
                                return <StyledView key={dateKey} className="w-[14%] aspect-square p-1" />;
                            }

                            let bgColor = "bg-slate-50 dark:bg-slate-800"; // Greyish default
                            let textColor = "text-slate-900 dark:text-slate-200";
                            let borderColor = "border-transparent";

                            if (data) {
                                if (data.status === 'won') {
                                    bgColor = "bg-green-100 dark:bg-green-900/40";
                                    textColor = "text-green-700 dark:text-green-400";
                                } else if (data.status === 'lost') {
                                    bgColor = "bg-red-100 dark:bg-red-900/40";
                                    textColor = "text-red-700 dark:text-red-400";
                                } else if (data.status === 'played') {
                                    bgColor = "bg-blue-100 dark:bg-blue-900/40";
                                    textColor = "text-blue-700 dark:text-blue-400";
                                } else if (data.isFuture) {
                                    bgColor = "bg-slate-50 dark:bg-slate-800/50";
                                    textColor = "text-slate-300 dark:text-slate-600";
                                }
                            } else {
                                // No Data
                                bgColor = "bg-slate-50 dark:bg-slate-800/50";
                                textColor = "text-slate-300 dark:text-slate-600";
                            }

                            if (isToday) borderColor = "border-slate-400 dark:border-slate-500";

                            return (
                                <StyledView key={dateKey} className="w-[14%] aspect-square p-1">
                                    <StyledTouchableOpacity
                                        onPress={() => data && handleDayPress(data)}
                                        disabled={!data || !data.hasPuzzle || data.isFuture}
                                        className={`flex-1 items-center justify-center rounded-lg border-2 ${bgColor} ${borderColor}`}
                                    >
                                        <StyledText className={`text-sm font-n-semibold ${textColor}`}>
                                            {format(day, 'd')}
                                        </StyledText>
                                        {data && data.status !== 'not-played' && (
                                            <StyledText className="text-[10px] mt-0.5 opacity-80 font-n-medium" style={{ color: textColor }}>
                                                {data.status === 'won' ? `✓ ${data.guesses}` : (data.status === 'lost' ? '✗' : '-')}
                                            </StyledText>
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
    const router = useRouter();
    const { gameMode, textScale } = useOptions();
    const flatListRef = useRef<FlatList>(null);
    const { user, isGuest } = useAuth();

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
            // Use timeout to ensure FlatList is ready after data change
            setTimeout(() => {
                flatListRef.current?.scrollToIndex({
                    index: todayIndex,
                    animated: false
                });
            }, 100);
        }
    }, [gameMode, months.length, initializing]);

    const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
        if (viewableItems && viewableItems.length > 0) {
            const index = viewableItems[0].index;
            if (index !== null && index !== undefined) {
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
            <StyledView className="flex-1 bg-white dark:bg-slate-900 items-center justify-center">
                <ActivityIndicator size="large" color="#7DAAE8" />
            </StyledView>
        );
    }

    return (
        <StyledView className="flex-1 bg-white dark:bg-slate-900">
            <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-white dark:bg-slate-900">

                {/* Header matches HomeScreen exactly */}
                <StyledView className="items-center relative pb-2 bg-white dark:bg-slate-900 z-50">
                    <StyledView className="absolute left-4 top-2">
                        <StyledTouchableOpacity onPress={() => router.back()}>
                            <ChevronLeft size={28} color="#1e293b" />
                        </StyledTouchableOpacity>
                    </StyledView>

                    <StyledText style={{ fontSize: 36 * textScale }} className="font-n-bold text-slate-900 dark:text-white mb-2 pt-2 font-heading">
                        Archive
                    </StyledText>
                </StyledView>

                {/* Navigation Controls */}
                <StyledView className="flex-row items-center justify-between px-6 py-6 border-b border-transparent">
                    {/* Left Arrow */}
                    <StyledTouchableOpacity
                        onPress={handlePrev}
                        disabled={isPrevDisabled}
                        className={`p-3 bg-white dark:bg-slate-800 rounded-full shadow-sm border border-slate-100 dark:border-slate-700 ${isPrevDisabled ? 'opacity-30' : 'opacity-100'}`}
                    >
                        <ChevronLeft size={24} color="#7DAAE8" />
                    </StyledTouchableOpacity>

                    {/* Month Title Button */}
                    <StyledTouchableOpacity
                        onPress={() => setModalVisible(true)}
                        className="bg-slate-50 dark:bg-slate-800 px-4 py-2 rounded-xl"
                    >
                        <StyledText style={{ fontSize: 24 * textScale }} className="font-n-bold text-slate-900 dark:text-white">
                            {currentTitle}
                        </StyledText>
                    </StyledTouchableOpacity>

                    {/* Right Arrow */}
                    <StyledTouchableOpacity
                        onPress={handleNext}
                        disabled={isNextDisabled}
                        className={`p-3 bg-white dark:bg-slate-800 rounded-full shadow-sm border border-slate-100 dark:border-slate-700 ${isNextDisabled ? 'opacity-30' : 'opacity-100'}`}
                    >
                        <ChevronRight size={24} color="#7DAAE8" />
                    </StyledTouchableOpacity>
                </StyledView>

                {/* Week Headers */}
                <StyledView className="flex-row justify-between mb-2 px-4 mt-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                        <StyledText key={day} style={{ fontSize: 14 * textScale }} className="w-[14%] text-center font-n-semibold text-slate-400">
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
                        { length: width, offset: width * index, index }
                    )}
                    renderItem={({ item }) => (
                        <MonthPage monthDate={item} isActive={true} gameMode={gameMode} />
                    )}
                    onViewableItemsChanged={onViewableItemsChanged}
                    viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
                    showsHorizontalScrollIndicator={false}
                />

                {/* Return to Today Button (Bottom Floating/Fixed) */}
                {!isTodaySelected && (
                    <StyledView className="absolute bottom-10 left-0 right-0 items-center z-10">
                        <StyledTouchableOpacity
                            onPress={returnToToday}
                            className="bg-white dark:bg-slate-800 px-6 py-3 rounded-full shadow-lg border border-slate-100 dark:border-slate-700"
                        >
                            <StyledText style={{ fontSize: 16 * textScale }} className="text-[#7DAAE8] font-n-bold">
                                Return to today
                            </StyledText>
                        </StyledTouchableOpacity>
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
            </SafeAreaView>
        </StyledView>
    );
}
