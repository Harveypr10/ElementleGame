/**
 * archive.web.tsx
 * Web implementation for Archive Screen
 * 
 * Hybrid Design:
 * - Layout Density: Legacy Web (centered 600px container, clean header)
 * - Component Styling: Mobile App (rounded day cells, pastel colors, Nunito fonts)
 * - Header: Clean white/dark with dark text (matching Settings/Stats web screens)
 */

import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { format, isSameMonth, isSameDay } from 'date-fns';
import {
    useArchiveLogic,
    getArchiveTheme,
    generateCalendarDays,
    DayStatus,
} from '../hooks/useArchiveLogic';
import { MonthSelectModal } from '../components/archive/MonthSelectModal';
import { GuestRestrictionModal } from '../components/GuestRestrictionModal';
import { HolidayActiveModal } from '../components/game/HolidayActiveModal';
import { hasFeatureAccess } from '../lib/featureGates';

export default function ArchiveScreenWeb() {
    const {
        user,
        isGuest,
        gameMode,
        isDark,
        isConnected,
        initializing,
        loading,
        monthData,
        currentMonthDate,
        currentTitle,
        calendarDays,
        isPrevDisabled,
        isNextDisabled,
        isTodaySelected,
        handlePrev,
        handleNext,
        handleDateSelect,
        returnToToday,
        handleBack,
        handlePlayPuzzle,
        handleExitHoliday,
        handleContinueHoliday,
        holidayEndDate,
        showHolidayModal,
        setShowHolidayModal,
        modalVisible,
        setModalVisible,
        guestModalVisible,
        setGuestModalVisible,
        minDate,
        today,
    } = useArchiveLogic();

    const theme = getArchiveTheme(gameMode, isDark);

    // Hover states
    const [backHover, setBackHover] = useState(false);
    const [prevHover, setPrevHover] = useState(false);
    const [nextHover, setNextHover] = useState(false);
    const [todayHover, setTodayHover] = useState(false);
    const [hoveredDay, setHoveredDay] = useState<string | null>(null);

    // Check guest modal on mount
    React.useEffect(() => {
        if (isGuest && !hasFeatureAccess('archive', !isGuest)) {
            setGuestModalVisible(true);
        }
    }, [isGuest, setGuestModalVisible]);

    if (initializing) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: theme.pageBg }]}>
                <ActivityIndicator size="large" color={theme.brandColor} />
                <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
                    Loading archive...
                </Text>
            </View>
        );
    }

    // Get day colors based on status
    const getDayColors = (data: DayStatus | undefined) => {
        if (!data) return theme.dayFuture;
        if (data.isFuture) return theme.dayFuture;
        if (data.status === 'won') return theme.dayWon;
        if (data.status === 'lost') return theme.dayLost;
        if (data.status === 'played') return theme.dayPlayed;
        return theme.dayDefault;
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.pageBg }]}>
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>

                {/* Header - Clean White Style (Web Dashboard) */}
                <View style={[styles.header, { backgroundColor: theme.cardBg }]}>
                    <Pressable
                        onPress={handleBack}
                        onHoverIn={() => setBackHover(true)}
                        onHoverOut={() => setBackHover(false)}
                        style={[styles.backButton, backHover && styles.backButtonHover]}
                    >
                        <ChevronLeft size={24} color={theme.textSecondary} />
                        <Text style={[styles.backButtonText, { color: theme.textSecondary }]}>Back</Text>
                    </Pressable>

                    <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Archive</Text>

                    <View style={styles.headerSpacer} />
                </View>

                {/* Centered Container - Max Width 600px */}
                <View style={styles.centeredContainer}>

                    {/* Offline Banner */}
                    {!isConnected && (
                        <View style={styles.offlineBanner}>
                            <View style={styles.offlineDot} />
                            <Text style={styles.offlineText}>Offline - Showing Cached Data</Text>
                        </View>
                    )}

                    {/* Month Navigation Card */}
                    <View style={[styles.navCard, { backgroundColor: theme.cardBg }]}>
                        <Pressable
                            onPress={handlePrev}
                            onHoverIn={() => setPrevHover(true)}
                            onHoverOut={() => setPrevHover(false)}
                            disabled={isPrevDisabled}
                            style={[
                                styles.navButton,
                                prevHover && !isPrevDisabled && styles.navButtonHover,
                                isPrevDisabled && styles.navButtonDisabled,
                            ]}
                        >
                            <ChevronLeft size={24} color={isPrevDisabled ? '#CBD5E1' : theme.textSecondary} />
                        </Pressable>

                        <Pressable
                            onPress={() => setModalVisible(true)}
                            style={styles.monthTitleButton}
                        >
                            <Text style={[styles.monthTitle, { color: theme.textPrimary }]}>
                                {currentTitle}
                            </Text>
                        </Pressable>

                        <Pressable
                            onPress={handleNext}
                            onHoverIn={() => setNextHover(true)}
                            onHoverOut={() => setNextHover(false)}
                            disabled={isNextDisabled}
                            style={[
                                styles.navButton,
                                nextHover && !isNextDisabled && styles.navButtonHover,
                                isNextDisabled && styles.navButtonDisabled,
                            ]}
                        >
                            <ChevronRight size={24} color={isNextDisabled ? '#CBD5E1' : theme.textSecondary} />
                        </Pressable>
                    </View>

                    {/* Calendar Card */}
                    <View style={[styles.calendarCard, { backgroundColor: theme.cardBg }]}>
                        {/* Week Headers */}
                        <View style={styles.weekHeaders}>
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                                <View key={day} style={styles.weekHeaderCell}>
                                    <Text style={styles.weekHeaderText}>{day}</Text>
                                </View>
                            ))}
                        </View>

                        {/* Calendar Grid */}
                        {loading ? (
                            <View style={styles.loadingGrid}>
                                <ActivityIndicator size="large" color={theme.brandColor} />
                            </View>
                        ) : (
                            <View style={styles.calendarGrid}>
                                {calendarDays.map((day) => {
                                    const dateKey = format(day, 'yyyy-MM-dd');
                                    const data = monthData[dateKey];
                                    const isCurrentMonth = isSameMonth(day, currentMonthDate);
                                    const isToday = isSameDay(day, new Date());
                                    const isHovered = hoveredDay === dateKey;

                                    // Empty cell for days not in current month
                                    if (!isCurrentMonth) {
                                        return <View key={dateKey} style={styles.dayCell} />;
                                    }

                                    const colors = getDayColors(data);
                                    const isPlayable = data?.hasPuzzle && !data?.isFuture;

                                    // Border logic
                                    let borderColor = 'transparent';
                                    let borderWidth = 0;
                                    if (data?.isHoliday) {
                                        borderColor = theme.holidayBorder;
                                        borderWidth = 2;
                                    } else if (isToday) {
                                        borderColor = theme.todayBorder;
                                        borderWidth = 2;
                                    }

                                    return (
                                        <View key={dateKey} style={styles.dayCell}>
                                            <Pressable
                                                onPress={() => data && handlePlayPuzzle(data.puzzleId || 0, day, data.status)}
                                                onHoverIn={() => isPlayable && setHoveredDay(dateKey)}
                                                onHoverOut={() => setHoveredDay(null)}
                                                disabled={!isPlayable}
                                                style={[
                                                    styles.dayButton,
                                                    { backgroundColor: colors.bg },
                                                    borderWidth > 0 && { borderColor, borderWidth },
                                                    isPlayable && isHovered && styles.dayButtonHover,
                                                    !isPlayable && styles.dayButtonDisabled,
                                                ]}
                                            >
                                                <Text style={[styles.dayNumber, { color: colors.text }]}>
                                                    {format(day, 'd')}
                                                </Text>
                                                {data && data.status !== 'not-played' && (
                                                    <Text style={[styles.dayStatus, { color: colors.text }]}>
                                                        {data.status === 'won'
                                                            ? `✓ ${data.guesses}`
                                                            : data.status === 'lost'
                                                                ? '✗'
                                                                : data.guesses && data.guesses > 0
                                                                    ? `${data.guesses}`
                                                                    : '-'
                                                        }
                                                    </Text>
                                                )}
                                            </Pressable>
                                        </View>
                                    );
                                })}
                            </View>
                        )}
                    </View>

                    {/* Return to Today Button */}
                    {!isTodaySelected && (
                        <Pressable
                            onPress={returnToToday}
                            onHoverIn={() => setTodayHover(true)}
                            onHoverOut={() => setTodayHover(false)}
                            style={[
                                styles.todayButton,
                                { backgroundColor: theme.cardBg },
                                todayHover && styles.todayButtonHover,
                            ]}
                        >
                            <Text style={[styles.todayButtonText, { color: theme.brandColorDark }]}>
                                Return to today
                            </Text>
                        </Pressable>
                    )}
                </View>
            </ScrollView>

            {/* Modals */}
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
                    handleBack();
                }}
                feature="Archive"
                description="Sign up to access past puzzles and track your history!"
            />

            <HolidayActiveModal
                visible={showHolidayModal}
                holidayEndDate={holidayEndDate || "Unknown Date"}
                onExitHoliday={handleExitHoliday}
                onContinueHoliday={handleContinueHoliday}
            />
        </View>
    );
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        minHeight: '100%' as any,
        paddingBottom: 80,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh' as any,
    },
    loadingText: {
        fontFamily: 'Nunito_500Medium',
        fontSize: 16,
        marginTop: 12,
    },

    // Header - Clean Web Dashboard Style
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
        borderRadius: 8,
    },
    backButtonHover: {
        backgroundColor: '#F1F5F9',
    },
    backButtonText: {
        fontFamily: 'Nunito_600SemiBold',
        fontSize: 16,
        marginLeft: 4,
    },
    headerTitle: {
        fontFamily: 'Nunito_800ExtraBold',
        fontSize: 28,
    },
    headerSpacer: {
        width: 80,
    },

    // Centered Container - Max 600px
    centeredContainer: {
        width: '100%',
        maxWidth: 600,
        alignSelf: 'center',
        paddingHorizontal: 24,
        paddingTop: 24,
    },

    // Offline Banner
    offlineBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1e293b',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 12,
        marginBottom: 16,
        gap: 8,
    },
    offlineDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#f87171',
    },
    offlineText: {
        fontFamily: 'Nunito_700Bold',
        fontSize: 12,
        color: '#FFFFFF',
    },

    // Navigation Card
    navCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: 24,
        padding: 8,
        marginBottom: 16,
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
    },
    navButton: {
        width: 48,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 16,
    },
    navButtonHover: {
        backgroundColor: '#F1F5F9',
    },
    navButtonDisabled: {
        opacity: 0.4,
    },
    monthTitleButton: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 8,
    },
    monthTitle: {
        fontFamily: 'Nunito_700Bold',
        fontSize: 20,
    },

    // Calendar Card
    calendarCard: {
        borderRadius: 24,
        padding: 24,
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
    },
    weekHeaders: {
        flexDirection: 'row',
        marginBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
        paddingBottom: 12,
    },
    weekHeaderCell: {
        width: '14.285714%' as any,
        alignItems: 'center',
    },
    weekHeaderText: {
        fontFamily: 'Nunito_700Bold',
        fontSize: 13,
        color: '#94A3B8',
        textTransform: 'uppercase',
    },

    // Calendar Grid
    loadingGrid: {
        height: 300,
        alignItems: 'center',
        justifyContent: 'center',
    },
    calendarGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    dayCell: {
        width: '14.285714%' as any,
        aspectRatio: 1,
        padding: 3,
    },
    dayButton: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12, // Rounded squares like Mobile
    },
    dayButtonHover: {
        transform: [{ scale: 1.05 }],
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    dayButtonDisabled: {
        // No cursor change needed for web
    },
    dayNumber: {
        fontFamily: 'Nunito_700Bold',
        fontSize: 14,
    },
    dayStatus: {
        fontFamily: 'Nunito_600SemiBold',
        fontSize: 10,
        marginTop: 2,
        opacity: 0.8,
    },

    // Return to Today Button
    todayButton: {
        alignSelf: 'center',
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 999,
        marginTop: 24,
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    todayButtonHover: {
        transform: [{ scale: 1.02 }],
        shadowOpacity: 0.12,
    },
    todayButtonText: {
        fontFamily: 'Nunito_700Bold',
        fontSize: 16,
    },
});
