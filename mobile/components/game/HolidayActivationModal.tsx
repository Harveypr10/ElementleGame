
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

    // Data State
    const [monthData, setMonthData] = useState<Record<string, DayStatus>>({});
    const [loadingData, setLoadingData] = useState(false);

    // Determines which months to display
    const monthsToShow = useMemo(() => {
        if (!filledDates.length) return [new Date()];
        const dates = filledDates.map(d => new Date(d)).sort((a, b) => b.getTime() - a.getTime()); // Descending

        const uniqueMonths: Date[] = [];
        dates.forEach(date => {
            const startOfM = startOfMonth(date);
            if (!uniqueMonths.some(m => m.getTime() === startOfM.getTime())) {
                uniqueMonths.push(startOfM);
            }
        });

        // Ensure at least current month
        if (uniqueMonths.length === 0) return [new Date()];
        return uniqueMonths;
    }, [filledDates]);

    // Simple slideshow timer
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

                if (isRegion) {
                    // REGION QUERY
                    const { data: regionData } = await supabase
                        .from('game_attempts_region')
                        .select(`allocated_region_id, result, num_guesses, streak_day_status, questions_allocated_region!inner(puzzle_date, region)`)
                        .eq('user_id', user.id)
                        .gte('questions_allocated_region.puzzle_date', start.toISOString())
                        .lte('questions_allocated_region.puzzle_date', end.toISOString())
                        // [FIX] Optional filter: matches Archive's 'UK' assumption or relies on user_id
                        .eq('questions_allocated_region.region', 'UK'); // Aligning with Archive.tsx logic

                    regionData?.forEach((row: any) => {
                        const date = row.questions_allocated_region?.puzzle_date;
                        if (!date) return;

                        let status: DayStatus['status'] = 'not-played';
                        if (row.result === 'won') status = 'won';
                        else if (row.result === 'lost') status = 'lost';
                        else if (row.num_guesses > 0) status = 'played';

                        // [FIX] Archive Logic for Holiday: (streak_day_status === 0)
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
            <StyledView key={monthDate.toISOString()} className="mb-6 bg-white rounded-xl p-4">
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

                    <StyledView>
                        {loadingData ? (
                            <ActivityIndicator size="large" color="white" className="py-8" />
                        ) : (
                            monthsToShow.length > 0 && renderMonth(monthsToShow[currentMonthIndex])
                        )}
                    </StyledView>

                    <StyledView className="mt-4 animate-fade-in">
                        <StyledView
                            onTouchEnd={onClose}
                            className="bg-black rounded-full py-4 items-center shadow-md active:bg-slate-800"
                        >
                            <Text className="text-white font-n-bold text-lg">Continue</Text>
                        </StyledView>
                    </StyledView>
                </StyledView>
            </View>
        </Modal>
    );
}
