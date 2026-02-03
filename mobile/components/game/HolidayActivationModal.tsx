
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Modal, Image, Dimensions, Animated, ActivityIndicator } from 'react-native';
import { styled } from 'nativewind';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay } from 'date-fns';
import { ThemedText } from '../ThemedText';
import { ThemedView } from '../ThemedView';
import { useThemeColor } from '../../hooks/useThemeColor';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';

const StyledView = styled(View);
const { width } = Dimensions.get('window');

interface HolidayActivationModalProps {
    visible: boolean;
    filledDates: string[]; // ['YYYY-MM-DD', ...]
    onClose: () => void;
    gameType?: 'REGION' | 'USER'; // Optional, defaults to USER if not provided but caller should provide it
}

interface DayStatus {
    status: 'won' | 'lost' | 'played' | 'not-played';
    guesses?: number;
    isHoliday?: boolean;
}

export function HolidayActivationModal({ visible, filledDates, onClose, gameType = 'USER' }: HolidayActivationModalProps) {
    const { user } = useAuth();

    // Derived Settings based on gameType
    const isRegion = gameType === 'REGION';
    const modalBgColor = isRegion ? '#FFD429' : '#fdab58';

    // Slideshow State
    const [currentMonthIndex, setCurrentMonthIndex] = useState(0);
    const [fadeAnim] = useState(new Animated.Value(1)); // For smooth month transitions

    // Data State
    const [monthData, setMonthData] = useState<Record<string, DayStatus>>({});
    const [loadingData, setLoadingData] = useState(false);

    // Determines which months to display
    const monthsToShow = useMemo(() => {
        console.log(`[HolidayActivationModal] Calculating months for gameType: ${gameType}, filledDates:`, filledDates);

        // [FIX] Always show at least current month, even if no dates
        if (!filledDates.length) {
            console.log(`[HolidayActivationModal] No filled dates, showing current month only`);
            return [new Date()];
        }

        // [FIX] Sort dates ascending (oldest first) then reverse to get descending
        const dates = filledDates.map(d => new Date(d)).sort((a, b) => a.getTime() - b.getTime());

        const uniqueMonths: Date[] = [];
        dates.forEach(date => {
            const startOfM = startOfMonth(date);
            if (!uniqueMonths.some(m => m.getTime() === startOfM.getTime())) {
                uniqueMonths.push(startOfM);
            }
        });

        // [FIX] Reverse to show CURRENT month first, then previous months
        // This ensures February shows before January when backfill spans both
        uniqueMonths.reverse();

        // Ensure at least current month
        if (uniqueMonths.length === 0) return [new Date()];
        console.log(`[HolidayActivationModal] Showing ${uniqueMonths.length} months:`, uniqueMonths.map(m => format(m, 'MMMM yyyy')));
        return uniqueMonths;
    }, [filledDates, gameType]);

    // Reset state when modal becomes visible
    useEffect(() => {
        if (visible) {
            setCurrentMonthIndex(0);
            fadeAnim.setValue(1);
        }
    }, [visible, fadeAnim]);

    // Fade animation when month changes
    useEffect(() => {
        // Fade out, then fade in with new month
        Animated.sequence([
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start();
    }, [currentMonthIndex, fadeAnim]);

    // [RESTORED] Automatic slideshow - auto-advance to next month after 2 seconds
    useEffect(() => {
        if (monthsToShow.length > 1 && currentMonthIndex < monthsToShow.length - 1) {
            const timer = setTimeout(() => {
                setCurrentMonthIndex(prev => prev + 1);
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [monthsToShow, currentMonthIndex]);

    // Data Fetching - STRICTLY separate based on gameType
    useEffect(() => {
        const fetchData = async () => {
            if (!visible || !user || monthsToShow.length === 0) return;

            setLoadingData(true);
            try {
                // Calculate range
                const start = startOfMonth(monthsToShow[monthsToShow.length - 1]); // Earliest
                const end = endOfMonth(monthsToShow[0]); // Latest

                const map: Record<string, DayStatus> = {};

                // [REVERTED] Fetch data ONLY for the current gameType
                // Each modal shows its own game mode's data separately
                if (isRegion) {
                    // REGION QUERY
                    const { data: regionData } = await supabase
                        .from('game_attempts_region')
                        .select(`allocated_region_id, result, num_guesses, streak_day_status, questions_allocated_region!inner(puzzle_date, region)`)
                        .eq('user_id', user.id)
                        .gte('questions_allocated_region.puzzle_date', start.toISOString())
                        .lte('questions_allocated_region.puzzle_date', end.toISOString())
                        .eq('questions_allocated_region.region', 'UK'); // Aligning with Archive.tsx logic

                    regionData?.forEach((row: any) => {
                        const date = row.questions_allocated_region?.puzzle_date;
                        if (!date) return;

                        let status: DayStatus['status'] = 'not-played';
                        if (row.result === 'won') status = 'won';
                        else if (row.result === 'lost') status = 'lost';
                        else if (row.num_guesses > 0) status = 'played';

                        const isHoliday = (row.streak_day_status === 0);

                        map[date] = { status, guesses: row.num_guesses, isHoliday };
                    });

                } else {
                    // USER QUERY
                    const { data: userData } = await supabase
                        .from('game_attempts_user')
                        .select(`allocated_user_id, result, num_guesses, streak_day_status, questions_allocated_user!inner(puzzle_date)`)
                        .eq('user_id', user.id)
                        .gte('questions_allocated_user.puzzle_date', start.toISOString())
                        .lte('questions_allocated_user.puzzle_date', end.toISOString());

                    userData?.forEach((row: any) => {
                        const date = row.questions_allocated_user?.puzzle_date;
                        if (!date) return;

                        let status: DayStatus['status'] = 'not-played';
                        if (row.result === 'won') status = 'won';
                        else if (row.result === 'lost') status = 'lost';
                        else if (row.num_guesses > 0) status = 'played';

                        const isHoliday = (row.streak_day_status === 0);

                        map[date] = { status, guesses: row.num_guesses, isHoliday };
                    });
                }

                console.log(`[HolidayActivationModal] Fetched ${gameType} data:`, Object.keys(map).length, 'dates');
                setMonthData(map);
            } catch (e) {
                console.error('Error fetching modal data:', e);
            } finally {
                setLoadingData(false);
            }
        };

        fetchData();
    }, [visible, user, monthsToShow, isRegion]);

    const renderMonth = (monthDate: Date) => {
        const start = startOfWeek(startOfMonth(monthDate));
        const end = endOfWeek(endOfMonth(monthDate));
        const days = eachDayOfInterval({ start, end });
        const monthTitle = format(monthDate, 'MMMM yyyy');

        return (
            <StyledView
                key={monthDate.toISOString()}
                className="mb-6 bg-white rounded-xl p-4"
                style={{ minHeight: 320 }} // Fixed height for 6 rows: header (20) + day labels (20) + 6 rows * 44 = 320
            >
                <ThemedText className="font-n-bold text-center mb-2 text-slate-900" size="lg">{monthTitle}</ThemedText>

                <StyledView className="flex-row justify-between mb-1">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                        <StyledView key={i} className="w-[14%] items-center">
                            <Text style={{ fontFamily: 'Nunito-Bold', fontSize: 12, color: '#94a3b8' }}>{day}</Text>
                        </StyledView>
                    ))}
                </StyledView>

                <StyledView className="flex-row flex-wrap">
                    {days.map((day) => {
                        const dateKey = format(day, 'yyyy-MM-dd');
                        const isCurrentMonth = isSameMonth(day, monthDate);
                        const isToday = isSameDay(day, new Date());

                        if (!isCurrentMonth) {
                            return <StyledView key={dateKey} className="w-[14%] aspect-square" />;
                        }

                        const data = monthData[dateKey];
                        const status = data?.status || 'not-played';
                        const isHoliday = data?.isHoliday;

                        // Visual Styles (Matching Archive.tsx)
                        let bg = '#ffffff';
                        let text = '#cbd5e1';
                        let borderColor = 'transparent';
                        let borderWidth = 0;

                        if (status === 'won') {
                            bg = '#dcfce7'; text = '#15803d';
                        } else if (status === 'lost') {
                            bg = '#fee2e2'; text = '#b91c1c';
                        } else if (status === 'played') {
                            bg = '#dbeafe'; text = '#1d4ed8';
                        }

                        // Border Logic
                        if (isHoliday) {
                            borderColor = '#FACC15'; // Yellow Holiday Border
                            borderWidth = 2;
                        } else if (filledDates.includes(dateKey)) {
                            // Also highlight newly filled dates if not already updated in DB
                            borderColor = '#FACC15';
                            borderWidth = 2;
                        } else if (isToday) {
                            borderColor = '#e2e8f0';
                            borderWidth = 2;
                        } else if (status === 'not-played' && day <= new Date()) {
                            borderColor = '#f1f5f9';
                            borderWidth = 1;
                        }

                        return (
                            <StyledView key={dateKey} className="w-[14%] aspect-square p-1">
                                <StyledView
                                    className="flex-1 items-center justify-center rounded-lg relative"
                                    style={{
                                        backgroundColor: bg,
                                        borderColor: borderColor,
                                        borderWidth: borderWidth,
                                    }}
                                >
                                    <Text style={{
                                        fontFamily: 'Nunito-SemiBold',
                                        fontSize: 12,
                                        color: text
                                    }}>
                                        {format(day, 'd')}
                                    </Text>
                                </StyledView>
                            </StyledView>
                        );
                    })}
                </StyledView>
            </StyledView>
        );
    };

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View className="flex-1 bg-black/70 justify-center items-center px-4">
                <StyledView
                    className="w-full max-w-sm rounded-3xl p-6 shadow-2xl"
                    style={{ backgroundColor: modalBgColor }}
                >
                    <ThemedText className="text-2xl font-n-bold text-center mb-2 text-slate-900">
                        Holiday mode activated
                    </ThemedText>
                    <Text className="text-gray-800 text-base text-center mb-6 leading-6 font-medium">
                        Setting your missed days to holidays...
                    </Text>

                    <Animated.View style={{ opacity: fadeAnim }}>
                        {loadingData ? (
                            <ActivityIndicator size="large" color="white" className="py-8" />
                        ) : (
                            monthsToShow.length > 0 && renderMonth(monthsToShow[currentMonthIndex])
                        )}
                    </Animated.View>

                    {/* [FIX] Always show Continue button to prevent size changes, but disable until last month */}
                    <StyledView className="mt-4">
                        <StyledView
                            onTouchEnd={() => {
                                // Only respond to touch on last month
                                if (currentMonthIndex === monthsToShow.length - 1) {
                                    onClose();
                                }
                            }}
                            className="rounded-full py-4 items-center shadow-md"
                            style={{
                                backgroundColor: currentMonthIndex === monthsToShow.length - 1 ? '#000000' : '#64748b',
                                opacity: currentMonthIndex === monthsToShow.length - 1 ? 1 : 0.5,
                            }}
                        >
                            <Text className="text-white font-n-bold text-lg">Continue</Text>
                        </StyledView>
                    </StyledView>
                </StyledView>
            </View>
        </Modal>
    );
}
