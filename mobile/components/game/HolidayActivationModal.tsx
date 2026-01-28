
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
    gameType?: 'REGION' | 'USER'; // Optional now
}

interface DayStatus {
    status: 'won' | 'lost' | 'played' | 'not-played';
    guesses?: number;
    isHoliday?: boolean;
}

export function HolidayActivationModal({ visible, filledDates, onClose, gameType }: HolidayActivationModalProps) {
    const { user } = useAuth();

    // Theme Colors
    const borderColor = useThemeColor({}, 'border');

    // Archive Button Colors (as requested)
    const modalBgColor = gameType === 'REGION' ? '#FFD429' : '#fdab58';

    const [visibleDates, setVisibleDates] = useState<string[]>([]);
    const [animationComplete, setAnimationComplete] = useState(false);

    // Slideshow State
    const [currentMonthIndex, setCurrentMonthIndex] = useState(0);

    // Data State
    const [monthData, setMonthData] = useState<Record<string, DayStatus>>({});
    const [loadingData, setLoadingData] = useState(false);

    // Glow Animation
    const glowAnim = React.useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(glowAnim, {
                    toValue: 1,
                    duration: 1500,
                    useNativeDriver: true,
                }),
                Animated.timing(glowAnim, {
                    toValue: 0.3,
                    duration: 1500,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, []);

    // Determine months to show
    const monthsToShow = useMemo(() => {
        if (!filledDates.length) return [new Date()];
        const dates = filledDates.map(d => new Date(d)).sort((a, b) => a.getTime() - b.getTime());
        const uniqueMonths: Date[] = [];

        dates.forEach(date => {
            const startOfM = startOfMonth(date);
            if (!uniqueMonths.some(m => m.getTime() === startOfM.getTime())) {
                uniqueMonths.push(startOfM);
            }
        });

        // Ensure at least current month is shown if empty (though filledDates check usually handles this)
        if (uniqueMonths.length === 0) return [new Date()];

        // Ensure reverse chronological order? 
        // User asked: "show the current month first and then animate in the previous month"
        // So we should sort DESCENDING?
        // "go back from the current month to the previous month, then the animation should show the current month first"
        // Yes, start with latest (current) month, then go back.
        // So Sort Descending.
        return uniqueMonths.sort((a, b) => b.getTime() - a.getTime());
    }, [filledDates]);

    // Slideshow Timer
    useEffect(() => {
        if (monthsToShow.length > 1 && currentMonthIndex < monthsToShow.length - 1) {
            const timer = setTimeout(() => {
                setCurrentMonthIndex(prev => prev + 1);
            }, 2000); // 2 seconds per month
            return () => clearTimeout(timer);
        }
    }, [monthsToShow, currentMonthIndex]);

    // Fetch Data for these months (BOTH User and Region merged)
    useEffect(() => {
        const fetchData = async () => {
            if (!visible || !user || monthsToShow.length === 0) return;

            setLoadingData(true);
            try {
                // Determine total range across all relevant months
                // Since we might jump months, let's just get the min and max of the monthsToShow
                // Actually, monthsToShow are startOfMonths.
                // We need date range covering all of them.
                const minMonth = monthsToShow[monthsToShow.length - 1]; // Earliest (last in list)
                const maxMonth = monthsToShow[0]; // Latest (first in list)

                const start = startOfMonth(minMonth);
                const end = endOfMonth(maxMonth);

                // Fetch User Attempts
                const { data: userData } = await supabase
                    .from('game_attempts_user')
                    .select(`allocated_user_id, result, num_guesses, streak_day_status, questions_allocated_user!inner(puzzle_date)`)
                    .eq('user_id', user.id)
                    .gte('questions_allocated_user.puzzle_date', start.toISOString())
                    .lte('questions_allocated_user.puzzle_date', end.toISOString());

                // Fetch Region Attempts
                // [FIX] Filter by user's region to avoid pollution from other regions
                // We need to know the region. For now, assume UK or fetch it?
                // Ideally we should pass 'userRegion' prop or fetch it.
                // Given the context, we can try to join profile or just use 'UK' as default if not available?
                // Actually, user_stats_region usually has the region. 
                // Let's filter by 'UK' for now as it matches the standard app flow, or better, 
                // We should rely on the fact that the user only sees what they play.
                // But to be safe:

                let regionQuery = supabase
                    .from('game_attempts_region')
                    .select(`allocated_region_id, result, num_guesses, streak_day_status, questions_allocated_region!inner(puzzle_date)`)
                    .eq('user_id', user.id)
                    .gte('questions_allocated_region.puzzle_date', start.toISOString())
                    .lte('questions_allocated_region.puzzle_date', end.toISOString());

                // For now, hardcode UK or leave open if user only plays one. 
                // User says "making up other data". Probably best to be safe if they have stale US data.
                regionQuery = regionQuery.eq('questions_allocated_region.region', 'UK');

                const { data: regionData } = await regionQuery;

                const map: Record<string, DayStatus> = {};

                // Process function to populate map
                // [FIX] We should NOT merge blindly. The user wants the animation to reflect the status of valid games.
                // If we are in "Region Mode" (onClose -> Region), maybe we prioritize Region?
                // But this modal is "Holiday Mode Activated" - usually global state.
                // The visual issue: "Animation reading across both games".
                // We should track them separately or prioritize: Won > Lost > Played > Holiday > NotPlayed.
                // AND we must ensure a "User" game date doesn't overwrite a "Region" game date if the dates differ?
                // Actually, dates are keys.
                // If I played Region on Jan 23 and User on Jan 25.
                // Jan 23: Region=Played, User=Null. Result=Played.
                // Jan 25: Region=Null, User=Played. Result=Played.
                // This seems correct for a "Global Calendar".
                // BUT user complained: "Animation is reading across from both games... giving confused picture."
                // "The user version of the data is being read across to the region version."
                // If `gameType` is passed, maybe we should ONLY show that game type's data?
                // If the modal was triggered by Region gap, show Region dates?
                // Lines 19-20 define `gameType`. Let's use it!

                const processRow = (row: any, isRegionSource: boolean) => {
                    // Strict Mode Filtering: If gameType is defined, ONLY process rows matching that type.
                    if (gameType === 'REGION' && !isRegionSource) return;
                    if (gameType === 'USER' && isRegionSource) return;

                    const date = isRegionSource ? row.questions_allocated_region?.puzzle_date : row.questions_allocated_user?.puzzle_date;
                    if (!date) return;

                    let status: DayStatus['status'] = 'not-played';
                    if (row.result === 'won') status = 'won';
                    else if (row.result === 'lost') status = 'lost';
                    else if (row.num_guesses > 0) status = 'played';

                    // [FIX] Ensure Won/Lost games are NEVER flagged as static holidays
                    const isHoliday = (row.streak_day_status == 0) && status !== 'won' && status !== 'lost';

                    const existing = map[date];

                    if (!existing) {
                        map[date] = { status, guesses: row.num_guesses, isHoliday };
                    } else {
                        // Merge strategies (only needed if we are NOT strict filtering, but good fallback)
                        let finalStatus = existing.status;
                        if (status === 'won' || status === 'lost') finalStatus = status;
                        else if (status === 'played' && finalStatus === 'not-played') finalStatus = 'played';

                        let finalIsHoliday = existing.isHoliday || isHoliday;
                        if (finalStatus === 'won' || finalStatus === 'lost') finalIsHoliday = false;

                        map[date] = {
                            status: finalStatus,
                            guesses: Math.max(existing.guesses || 0, row.num_guesses),
                            isHoliday: finalIsHoliday
                        };
                    }
                };

                userData?.forEach(r => processRow(r, false));
                regionData?.forEach(r => processRow(r, true));

                setMonthData(map);
            } catch (e) {
                console.error('Error fetching animation data:', e);
            } finally {
                setLoadingData(false);
            }
        };

        fetchData();
    }, [visible, user, monthsToShow]);


    useEffect(() => {
        if (visible && filledDates.length > 0) {
            setVisibleDates([]);
            setAnimationComplete(false);

            // Animate filling one by one
            let index = 0;
            const interval = setInterval(() => {
                if (index >= filledDates.length) {
                    clearInterval(interval);
                    setTimeout(() => setAnimationComplete(true), 500);
                    return;
                }
                setVisibleDates(prev => [...prev, filledDates[index]]); // Add next date
                index++;
            }, 150); // 150ms per day

            return () => clearInterval(interval);
        } else if (visible && filledDates.length === 0) {
            setAnimationComplete(true);
        }
    }, [visible, filledDates]);

    const renderMonth = (monthDate: Date) => {
        const start = startOfWeek(startOfMonth(monthDate));
        const end = endOfWeek(endOfMonth(monthDate));
        const days = eachDayOfInterval({ start, end });
        const monthTitle = format(monthDate, 'MMMM yyyy');

        return (
            <StyledView key={monthDate.toISOString()} className="mb-6 bg-white rounded-xl p-4">
                <ThemedText className="font-n-bold text-center mb-2 text-slate-900" size="lg">{monthTitle}</ThemedText>

                {/* Week Headers */}
                <StyledView className="flex-row justify-between mb-1">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                        <StyledView key={i} className="w-[14%] items-center">
                            <Text style={{ fontFamily: 'Nunito-Bold', fontSize: 12, color: '#94a3b8' }}>{day}</Text>
                        </StyledView>
                    ))}
                </StyledView>

                {/* Days */}
                <StyledView className="flex-row flex-wrap">
                    {days.map((day) => {
                        const dateKey = format(day, 'yyyy-MM-dd');
                        const isCurrentMonth = isSameMonth(day, monthDate);

                        // Status Data from DB
                        const status = monthData[dateKey]?.status || 'not-played';
                        const isStaticHoliday = monthData[dateKey]?.isHoliday;

                        // Animation Logic:
                        // Only show "Filled" (Yellow Animation) if:
                        // 1. It is in the visibleDates list (passed from backfill)
                        // 2. AND it is NOT already a won/lost game (Safety Check)
                        // 3. AND it is NOT already a static holiday (avoid double animation if re-opening)
                        const isFilled = visibleDates.includes(dateKey) && status !== 'won' && status !== 'lost';

                        if (!isCurrentMonth) {
                            return <StyledView key={dateKey} className="w-[14%] aspect-square" />;
                        }

                        // Status Color Logic (Copying Archive)
                        // status and isStaticHoliday are already defined above
                        let bg = 'transparent';
                        let text = '#1e293b'; // Slate-800
                        let opacity = 1;

                        if (status === 'won') {
                            bg = '#dcfce7'; text = '#15803d'; // Green
                        } else if (status === 'lost') {
                            bg = '#fee2e2'; text = '#b91c1c'; // Red
                        } else if (status === 'played') {
                            bg = '#dbeafe'; text = '#1d4ed8'; // Blue
                        } else {
                            // Empty/Future/NotPlayed
                            bg = '#ffffff'; text = '#cbd5e1'; // Slate-300
                        }

                        // Border Logic
                        // If "Filled" (Animate Holiday) -> Yellow!
                        // isStaticHoliday is already defined above
                        const isHolidayAnimation = isFilled;
                        let cellBorderColor = (isHolidayAnimation || isStaticHoliday) ? '#FACC15' : 'transparent';
                        if (!isHolidayAnimation && !isStaticHoliday && status === 'not-played') {
                            cellBorderColor = '#e2e8f0'; // Slate-200 border for empty cells
                            if (day > new Date()) cellBorderColor = 'transparent'; // Future: no border
                        }

                        return (
                            <StyledView key={dateKey} className="w-[14%] aspect-square p-1">
                                <StyledView
                                    className="flex-1 items-center justify-center rounded-lg relative"
                                    style={{
                                        backgroundColor: bg,
                                        borderColor: cellBorderColor,
                                        borderWidth: (isHolidayAnimation || isStaticHoliday || status === 'not-played') ? 2 : 0,
                                    }}
                                >
                                    <Text style={{
                                        fontFamily: 'Nunito-SemiBold',
                                        fontSize: 12,
                                        color: text
                                    }}>
                                        {format(day, 'd')}
                                    </Text>

                                    {/* Glow Overlay for Holiday Animation */}
                                    {isHolidayAnimation && (
                                        <Animated.View
                                            style={{
                                                position: 'absolute',
                                                top: -2, left: -2, right: -2, bottom: -2, // Expand to cover border
                                                borderRadius: 8,
                                                borderWidth: 2,
                                                borderColor: '#FACC15',
                                                shadowColor: '#FACC15',
                                                shadowOffset: { width: 0, height: 0 },
                                                shadowOpacity: glowAnim.interpolate({
                                                    inputRange: [0, 1],
                                                    outputRange: [0.3, 0.8]
                                                }),
                                                shadowRadius: glowAnim.interpolate({
                                                    inputRange: [0, 1],
                                                    outputRange: [2, 8]
                                                }),
                                                elevation: 4
                                            }}
                                        />
                                    )}
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
            onRequestClose={() => { if (animationComplete) onClose(); }}
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
