/**
 * index.web.tsx
 * Web implementation for Home Screen
 * 
 * Hybrid Design:
 * - Layout: Legacy Web (centered 1000px max-width, 2-column grid)
 * - Styling: Mobile App (vibrant colors, rounded cards, Nunito, hamsters)
 * - No "Options" tile - cleaner design
 */

import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Settings, HelpCircle } from 'lucide-react-native';
import {
    useHomeLogic,
    getHomeTheme,
    HAMSTER_IMAGES,
} from '../../hooks/useHomeLogic';
import { HelpModal } from '../../components/HelpModal';
import { HolidayActiveModal } from '../../components/game/HolidayActiveModal';
import { GoProButton } from '../../components/GoProButton';
import { endHolidayMode } from '../../lib/supabase-rpc';

export default function HomeScreenWeb() {
    const {
        user,
        isPro,
        loading,
        refreshing,
        onRefresh,
        isDark,

        firstName,
        userRegion,
        getGreeting,

        // Region
        regionStats,
        todayStatusRegion,
        guessesRegion,
        regionWinRate,
        regionAvgGuesses,
        regionPercentileMessage,

        // User
        userStats,
        todayStatusUser,
        guessesUser,
        userWinRate,
        userAvgGuesses,
        userPercentileMessage,

        // Navigation
        handlePlayToday,
        handleArchive,
        handleStats,
        handleSettings,
        handleHelp,
        handleSubscription,

        // Holiday
        holidayActive,
        holidayEndDate,
        showHolidayModal,
        setShowHolidayModal,
        holidayModalMode,

        // Help
        helpVisible,
        setHelpVisible,

        todaysPuzzleDate,
    } = useHomeLogic();

    const theme = getHomeTheme(isDark);

    // Hover states
    const [settingsHover, setSettingsHover] = useState(false);
    const [helpHover, setHelpHover] = useState(false);
    const [hoveredCard, setHoveredCard] = useState<string | null>(null);

    // Holiday handlers
    const handleExitHoliday = async () => {
        if (!user) return;
        try {
            await endHolidayMode(user.id, true);
            setShowHolidayModal(false);
            // Navigate to game after exiting holiday
            handlePlayToday(holidayModalMode === 'REGION');
        } catch (e) {
            console.error('[Home] Failed to exit holiday:', e);
            setShowHolidayModal(false);
        }
    };

    const handleContinueHoliday = () => {
        setShowHolidayModal(false);
    };

    if (loading && !refreshing) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: theme.pageBg }]}>
                <ActivityIndicator size="large" color={theme.playRegion} />
                <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
                    Loading...
                </Text>
            </View>
        );
    }

    // Card Component
    const GameCard = ({
        id,
        title,
        backgroundColor,
        hamsterImage,
        onPress,
        children,
    }: {
        id: string;
        title: string;
        backgroundColor: string;
        hamsterImage: any;
        onPress: () => void;
        children?: React.ReactNode;
    }) => {
        const isHovered = hoveredCard === id;

        return (
            <Pressable
                onPress={onPress}
                onHoverIn={() => setHoveredCard(id)}
                onHoverOut={() => setHoveredCard(null)}
                style={[
                    styles.gameCard,
                    { backgroundColor },
                    isHovered && styles.gameCardHover,
                ]}
            >
                <View style={styles.cardContent}>
                    <Text style={styles.cardTitle}>{title}</Text>
                    {children}
                </View>
                <Image
                    source={hamsterImage}
                    style={styles.cardHamster}
                    contentFit="contain"
                />
            </Pressable>
        );
    };

    // Stats pill component
    const StatPill = ({ label, value }: { label: string; value: string | number }) => (
        <View style={styles.statPill}>
            <Text style={styles.statPillLabel}>{label}</Text>
            <Text style={styles.statPillValue}>{value}</Text>
        </View>
    );

    // Column component for each game mode
    const GameColumn = ({
        isRegion,
        columnTitle,
        playColor,
        archiveColor,
        statsColor,
        todayStatus,
        guesses,
        stats,
        winRate,
        avgGuesses,
        percentileMessage,
    }: {
        isRegion: boolean;
        columnTitle: string;
        playColor: string;
        archiveColor: string;
        statsColor: string;
        todayStatus: 'not-played' | 'solved' | 'failed';
        guesses: number;
        stats: typeof regionStats;
        winRate: string;
        avgGuesses: string;
        percentileMessage: string;
    }) => {
        const mode = isRegion ? 'region' : 'user';
        const playHamster = todayStatus === 'solved' ? HAMSTER_IMAGES.playSolved : HAMSTER_IMAGES.playUnsolved;

        return (
            <View style={styles.column}>
                {/* Column Title */}
                <Text style={[styles.columnTitle, { color: theme.textPrimary }]}>
                    {columnTitle}
                </Text>

                {/* Percentile Message */}
                <Text style={[styles.percentileText, { color: theme.textSecondary }]}>
                    {percentileMessage}
                </Text>

                {/* Play Card */}
                <GameCard
                    id={`play-${mode}`}
                    title={todayStatus === 'solved' ? "Today's puzzle solved!" : "Play Today"}
                    backgroundColor={playColor}
                    hamsterImage={playHamster}
                    onPress={() => handlePlayToday(isRegion)}
                >
                    {todayStatus === 'solved' && (
                        <View style={styles.statsRow}>
                            <StatPill label="Solved in" value={guesses} />
                            <StatPill label="Streak" value={stats.current_streak} />
                        </View>
                    )}
                    {todayStatus === 'not-played' && (
                        <Text style={styles.cardSubtitle}>Good luck!</Text>
                    )}
                </GameCard>

                {/* Archive Card */}
                <GameCard
                    id={`archive-${mode}`}
                    title={isRegion ? `${userRegion} Archive` : "Personal Archive"}
                    backgroundColor={archiveColor}
                    hamsterImage={HAMSTER_IMAGES.archive}
                    onPress={() => handleArchive(isRegion)}
                >
                    <View style={styles.statsRow}>
                        <StatPill label="Played" value={stats.games_played} />
                    </View>
                </GameCard>

                {/* Stats Card */}
                <GameCard
                    id={`stats-${mode}`}
                    title={isRegion ? `${userRegion} Stats` : "Personal Stats"}
                    backgroundColor={statsColor}
                    hamsterImage={HAMSTER_IMAGES.stats}
                    onPress={() => handleStats(isRegion)}
                >
                    <View style={styles.statsRow}>
                        <StatPill label="% Won" value={`${winRate}%`} />
                        <StatPill label="Guess avg" value={avgGuesses} />
                    </View>
                </GameCard>
            </View>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.pageBg }]}>
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>

                {/* Header */}
                <View style={[styles.header, { backgroundColor: theme.headerBg }]}>
                    {/* Help Icon */}
                    <Pressable
                        onPress={handleHelp}
                        onHoverIn={() => setHelpHover(true)}
                        onHoverOut={() => setHelpHover(false)}
                        style={[styles.headerIcon, helpHover && styles.headerIconHover]}
                    >
                        <HelpCircle size={28} color={theme.textSecondary} />
                    </Pressable>

                    {/* Logo */}
                    <Text style={[styles.logo, { color: theme.textPrimary }]}>Elementle</Text>

                    {/* Settings Icon */}
                    <Pressable
                        onPress={handleSettings}
                        onHoverIn={() => setSettingsHover(true)}
                        onHoverOut={() => setSettingsHover(false)}
                        style={[styles.headerIcon, settingsHover && styles.headerIconHover]}
                    >
                        <Settings size={28} color={theme.textSecondary} />
                    </Pressable>
                </View>

                {/* Greeting Row */}
                <View style={styles.greetingRow}>
                    <Text style={[styles.greeting, { color: theme.textPrimary }]}>
                        {getGreeting()}
                    </Text>
                    <GoProButton onPress={handleSubscription} scale={1.1} />
                </View>

                {/* 2-Column Grid */}
                <View style={styles.gridContainer}>
                    {/* Left Column: Region */}
                    <GameColumn
                        isRegion={true}
                        columnTitle={`${userRegion} Edition`}
                        playColor={theme.playRegion}
                        archiveColor={theme.archiveRegion}
                        statsColor={theme.statsRegion}
                        todayStatus={todayStatusRegion}
                        guesses={guessesRegion}
                        stats={regionStats}
                        winRate={regionWinRate}
                        avgGuesses={regionAvgGuesses}
                        percentileMessage={regionPercentileMessage}
                    />

                    {/* Right Column: User */}
                    <GameColumn
                        isRegion={false}
                        columnTitle={firstName}
                        playColor={theme.playUser}
                        archiveColor={theme.archiveUser}
                        statsColor={theme.statsUser}
                        todayStatus={todayStatusUser}
                        guesses={guessesUser}
                        stats={userStats}
                        winRate={userWinRate}
                        avgGuesses={userAvgGuesses}
                        percentileMessage={userPercentileMessage}
                    />
                </View>
            </ScrollView>

            {/* Modals */}
            <HelpModal
                visible={helpVisible}
                onClose={() => setHelpVisible(false)}
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

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 32,
        paddingVertical: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    headerIcon: {
        padding: 8,
        borderRadius: 12,
    },
    headerIconHover: {
        backgroundColor: '#F1F5F9',
    },
    logo: {
        fontFamily: 'Nunito_800ExtraBold',
        fontSize: 42,
    },

    // Greeting
    greetingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 24,
        gap: 24,
    },
    greeting: {
        fontFamily: 'Nunito_700Bold',
        fontSize: 24,
    },

    // Grid
    gridContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        maxWidth: 1000,
        width: '100%',
        alignSelf: 'center',
        paddingHorizontal: 24,
        gap: 32,
    },
    column: {
        flex: 1,
        maxWidth: 480,
    },
    columnTitle: {
        fontFamily: 'Nunito_700Bold',
        fontSize: 26,
        textAlign: 'center',
        marginBottom: 8,
    },
    percentileText: {
        fontFamily: 'Nunito_500Medium',
        fontSize: 15,
        textAlign: 'center',
        marginBottom: 20,
    },

    // Cards
    gameCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: 24,
        paddingHorizontal: 20,
        paddingVertical: 16,
        marginBottom: 16,
        minHeight: 120,
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
    },
    gameCardHover: {
        transform: [{ scale: 1.02 }],
        shadowOpacity: 0.15,
    },
    cardContent: {
        flex: 1,
        paddingRight: 12,
    },
    cardTitle: {
        fontFamily: 'Nunito_700Bold',
        fontSize: 20,
        color: '#1e293b',
        marginBottom: 4,
    },
    cardSubtitle: {
        fontFamily: 'Nunito_500Medium',
        fontSize: 15,
        color: '#475569',
        marginTop: 4,
    },
    cardHamster: {
        width: 80,
        height: 80,
    },

    // Stats
    statsRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    statPill: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    statPillLabel: {
        fontFamily: 'Nunito_500Medium',
        fontSize: 13,
        color: '#475569',
    },
    statPillValue: {
        fontFamily: 'Nunito_700Bold',
        fontSize: 18,
        color: '#1e293b',
    },
});
