/**
 * TrophyPopup — Modal for browsing league trophies (medals)
 *
 * Navigation structure (mirroring AllBadgesModal):
 * - Left/Right: Switch between leagues (header league name is swipeable)
 * - Up/Down arrows: Switch between Monthly and Annual trophy rows
 * - Horizontal carousel: Browse trophies within the current row
 *
 * Shows trophy image (20% smaller), medal label (no "Medal" word),
 * and single-line stats (P, Win%, Avg, Rating).
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Modal,
    Animated,
    FlatList,
    Dimensions,
} from 'react-native';
import { X, ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react-native';
import { Image } from 'expo-image';
import type { Medal } from '../../hooks/useLeagueData';
import { formatPeriodLabel } from '../../hooks/useLeagueData';
import type { Timeframe } from '../../hooks/useLeagueData';

// Trophy assets
const TrophyGold = require('../../assets/ui/trophy-gold.png');
const TrophySilver = require('../../assets/ui/trophy-silver.png');
const TrophyBronze = require('../../assets/ui/trophy-bronze.png');

const TROPHY_IMAGES: Record<string, any> = {
    gold: TrophyGold,
    silver: TrophySilver,
    bronze: TrophyBronze,
};

const MEDAL_EMOJI: Record<string, string> = {
    gold: '🥇',
    silver: '🥈',
    bronze: '🥉',
};

const MEDAL_LABEL: Record<string, string> = {
    gold: 'Gold',
    silver: 'Silver',
    bronze: 'Bronze',
};

const MEDAL_COLOR: Record<string, string> = {
    gold: '#f59e0b',
    silver: '#94a3b8',
    bronze: '#cd7f32',
};

type TimeframeRow = 'mtd' | 'ytd';
const ROW_LABELS: Record<TimeframeRow, string> = {
    mtd: 'Monthly',
    ytd: 'Annual',
};

interface TrophyPopupProps {
    visible: boolean;
    onClose: () => void;
    medals: Medal[];
    leagueId: string;        // Initially viewed league
    brandColor?: string;
    initialTimeframe?: 'mtd' | 'ytd';
}

export function TrophyPopup({
    visible,
    onClose,
    medals,
    leagueId,
    brandColor = '#8E57DB',
    initialTimeframe = 'mtd',
}: TrophyPopupProps) {
    const [containerWidth, setContainerWidth] = useState(Dimensions.get('window').width);

    // ─── League-level navigation (left/right on header) ─────────────────
    // Get unique leagues that have trophies, maintaining original order
    const leaguesWithTrophies = useMemo(() => {
        const seen = new Set<string>();
        const leagues: { id: string; name: string }[] = [];
        for (const m of medals) {
            if (!seen.has(m.league_id)) {
                seen.add(m.league_id);
                leagues.push({ id: m.league_id, name: m.league_name });
            }
        }
        return leagues;
    }, [medals]);

    const [currentLeagueIndex, setCurrentLeagueIndex] = useState(0);

    // Reset to initial league when popup opens
    useEffect(() => {
        if (visible) {
            const idx = leaguesWithTrophies.findIndex(l => l.id === leagueId);
            setCurrentLeagueIndex(idx >= 0 ? idx : 0);
            setCurrentRow(initialTimeframe);
            setFocusedIndex(0);
        }
    }, [visible, leagueId, leaguesWithTrophies, initialTimeframe]);

    const currentLeague = leaguesWithTrophies[currentLeagueIndex];
    const currentLeagueName = currentLeague?.name ?? '';
    const currentLeagueId = currentLeague?.id ?? leagueId;

    const handlePrevLeague = () => {
        if (currentLeagueIndex > 0) {
            setCurrentLeagueIndex(prev => prev - 1);
            setCurrentRow('mtd');
            setFocusedIndex(0);
        }
    };

    const handleNextLeague = () => {
        if (currentLeagueIndex < leaguesWithTrophies.length - 1) {
            setCurrentLeagueIndex(prev => prev + 1);
            setCurrentRow('mtd');
            setFocusedIndex(0);
        }
    };

    // ─── Row navigation (up/down: monthly vs annual) ────────────────────
    const [currentRow, setCurrentRow] = useState<TimeframeRow>('mtd');

    // Get available rows for current league
    const availableRows = useMemo(() => {
        const rows: TimeframeRow[] = [];
        const leagueMedals = medals.filter(m => m.league_id === currentLeagueId);
        if (leagueMedals.some(m => m.timeframe === 'mtd')) rows.push('mtd');
        if (leagueMedals.some(m => m.timeframe === 'ytd')) rows.push('ytd');
        return rows;
    }, [medals, currentLeagueId]);

    const currentRowIndex = availableRows.indexOf(currentRow);

    const handlePrevRow = () => {
        if (currentRowIndex > 0) {
            setCurrentRow(availableRows[currentRowIndex - 1]);
            setFocusedIndex(0);
        }
    };

    const handleNextRow = () => {
        if (currentRowIndex < availableRows.length - 1) {
            setCurrentRow(availableRows[currentRowIndex + 1]);
            setFocusedIndex(0);
        }
    };

    // ─── Medals for current league + row ────────────────────────────────
    const rowMedals = useMemo(() => {
        const medalRank: Record<string, number> = { gold: 0, silver: 1, bronze: 2 };
        return medals
            .filter(m => m.league_id === currentLeagueId && m.timeframe === currentRow)
            .sort((a, b) => {
                const periodCmp = b.period_label.localeCompare(a.period_label);
                if (periodCmp !== 0) return periodCmp;
                return (medalRank[a.medal] ?? 9) - (medalRank[b.medal] ?? 9);
            });
    }, [medals, currentLeagueId, currentRow]);

    // ─── Carousel state ─────────────────────────────────────────────────
    const [focusedIndex, setFocusedIndex] = useState(0);
    const scrollX = useRef(new Animated.Value(0)).current;
    const flatListRef = useRef<FlatList>(null);
    const fadeOpacity = useRef(new Animated.Value(1)).current;

    // Trophy image is 80% of original (260 * 0.8 = 208)
    const ITEM_WIDTH = 208;
    const SPACING = 20;
    const ITEM_SIZE = ITEM_WIDTH + SPACING;
    const SPACER_ITEM_SIZE = (containerWidth - ITEM_SIZE) / 2;

    // Fade + reset scroll when row changes
    useEffect(() => {
        fadeOpacity.setValue(0);
        Animated.timing(fadeOpacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
        }).start();
        scrollX.setValue(0);
        flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
    }, [currentRow, currentLeagueId]);

    const handlePrevTrophy = () => {
        if (focusedIndex > 0) {
            const newIndex = focusedIndex - 1;
            setFocusedIndex(newIndex);
            flatListRef.current?.scrollToOffset({ offset: newIndex * ITEM_SIZE, animated: true });
        }
    };

    const handleNextTrophy = () => {
        if (focusedIndex < rowMedals.length - 1) {
            const newIndex = focusedIndex + 1;
            setFocusedIndex(newIndex);
            flatListRef.current?.scrollToOffset({ offset: newIndex * ITEM_SIZE, animated: true });
        }
    };

    const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: any[] }) => {
        if (viewableItems.length > 0) {
            const centerItem = viewableItems[0];
            if (centerItem?.index !== null && centerItem?.index !== undefined) {
                setFocusedIndex(centerItem.index);
            }
        }
    }).current;

    const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

    const focusedMedal = rowMedals[focusedIndex];

    const renderItem = ({ item, index }: { item: Medal; index: number }) => {
        const inputRange = [
            (index - 1) * ITEM_SIZE,
            index * ITEM_SIZE,
            (index + 1) * ITEM_SIZE,
        ];

        const scale = scrollX.interpolate({
            inputRange,
            outputRange: [0.7, 1.1, 0.7],
            extrapolate: 'clamp',
        });

        const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.3, 1, 0.3],
            extrapolate: 'clamp',
        });

        return (
            <Animated.View
                style={{
                    width: ITEM_SIZE,
                    alignItems: 'center',
                    justifyContent: 'center',
                    transform: [{ scale }],
                }}
            >
                <Animated.View style={{ opacity }}>
                    <Image
                        source={TROPHY_IMAGES[item.medal] || TrophyGold}
                        style={{ width: ITEM_WIDTH, height: ITEM_WIDTH }}
                        contentFit="contain"
                    />
                </Animated.View>
            </Animated.View>
        );
    };

    if (leaguesWithTrophies.length === 0) return null;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="overFullScreen"
            onRequestClose={onClose}
            transparent
        >
            <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
                <View
                    style={{
                        height: '75%',
                        width: '100%',
                        maxWidth: 896,
                        alignSelf: 'center',
                        backgroundColor: brandColor,
                        borderTopLeftRadius: 24,
                        borderTopRightRadius: 24,
                        overflow: 'hidden',
                    }}
                >
                    {/* Header: "Trophies" + close button */}
                    <View style={{
                        flexDirection: 'row',
                        justifyContent: 'center',
                        alignItems: 'center',
                        paddingHorizontal: 24,
                        paddingTop: 16,
                        paddingBottom: 6,
                        position: 'relative',
                    }}>
                        <Text style={{
                            fontSize: 30,
                            fontFamily: 'Nunito_700Bold',
                            fontWeight: '700',
                            color: '#FFFFFF',
                            textAlign: 'center',
                        }}>
                            Trophies
                        </Text>
                        <TouchableOpacity
                            onPress={onClose}
                            style={{
                                position: 'absolute',
                                right: 24,
                                padding: 8,
                                backgroundColor: 'rgba(255,255,255,0.25)',
                                borderRadius: 9999,
                            }}
                            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                        >
                            <X size={22} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>

                    {/* League name with left/right navigation */}
                    <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingBottom: 4,
                        gap: 12,
                    }}>
                        <TouchableOpacity
                            onPress={handlePrevLeague}
                            disabled={currentLeagueIndex === 0}
                            style={{ opacity: currentLeagueIndex === 0 ? 0.3 : 1, padding: 4 }}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <ChevronLeft size={18} color="#FFFFFF" />
                        </TouchableOpacity>
                        <Text style={{
                            fontSize: 16,
                            fontFamily: 'Nunito_600SemiBold',
                            fontWeight: '600',
                            color: 'rgba(255,255,255,0.8)',
                            textAlign: 'center',
                            minWidth: 120,
                        }}>
                            {currentLeagueName}
                        </Text>
                        <TouchableOpacity
                            onPress={handleNextLeague}
                            disabled={currentLeagueIndex === leaguesWithTrophies.length - 1}
                            style={{ opacity: currentLeagueIndex === leaguesWithTrophies.length - 1 ? 0.3 : 1, padding: 4 }}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <ChevronRight size={18} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>

                    {/* Content Box */}
                    <View style={{
                        flex: 1,
                        marginHorizontal: 16,
                        marginTop: 8,
                        marginBottom: 8,
                        backgroundColor: 'rgba(255,255,255,0.2)',
                        borderRadius: 20,
                        overflow: 'hidden',
                    }}>
                        {/* Spacer */}
                        <View style={{ flex: 1 }} />

                        {/* Up Arrow (prev row: monthly ↔ annual) */}
                        <View style={{ alignItems: 'center' }}>
                            <TouchableOpacity
                                onPress={handlePrevRow}
                                disabled={currentRowIndex <= 0}
                                style={{ opacity: currentRowIndex <= 0 ? 0.3 : 1 }}
                            >
                                <View style={{
                                    backgroundColor: currentRowIndex <= 0 ? 'rgba(255,255,255,0.2)' : brandColor,
                                    padding: 8,
                                    borderRadius: 9999,
                                }}>
                                    <ChevronUp size={24} color="#FFFFFF" />
                                </View>
                            </TouchableOpacity>
                        </View>

                        {/* Spacer */}
                        <View style={{ flex: 0.5 }} />

                        {/* Row Label */}
                        <View style={{ alignItems: 'center', paddingBottom: 4 }}>
                            <Text style={{
                                fontSize: 20,
                                fontFamily: 'Nunito_700Bold',
                                fontWeight: '700',
                                color: '#FFFFFF',
                                textAlign: 'center',
                                letterSpacing: 1,
                            }}>
                                {ROW_LABELS[currentRow] || 'Monthly'}
                            </Text>
                        </View>

                        {/* Trophy Carousel */}
                        <Animated.View style={{ opacity: fadeOpacity }}>
                            {rowMedals.length > 0 ? (
                                <Animated.FlatList
                                    ref={flatListRef}
                                    data={rowMedals}
                                    keyExtractor={(item, index) => `${item.league_id}-${item.period_label}-${item.medal}-${item.timeframe}-${index}`}
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    snapToInterval={ITEM_SIZE}
                                    snapToAlignment="start"
                                    decelerationRate="fast"
                                    getItemLayout={(_, index) => ({
                                        length: ITEM_SIZE,
                                        offset: ITEM_SIZE * index,
                                        index,
                                    })}
                                    contentContainerStyle={{
                                        paddingHorizontal: SPACER_ITEM_SIZE,
                                        alignItems: 'center',
                                    }}
                                    onScroll={Animated.event(
                                        [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                                        { useNativeDriver: true }
                                    )}
                                    onViewableItemsChanged={onViewableItemsChanged}
                                    viewabilityConfig={viewabilityConfig}
                                    renderItem={renderItem}
                                    onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
                                />
                            ) : (
                                <View style={{ height: ITEM_WIDTH, alignItems: 'center', justifyContent: 'center' }}>
                                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Nunito_500Medium', fontSize: 15 }}>
                                        No {ROW_LABELS[currentRow]?.toLowerCase()} trophies yet
                                    </Text>
                                </View>
                            )}
                        </Animated.View>

                        {/* Details Section */}
                        <View style={{ alignItems: 'center', paddingHorizontal: 24, paddingTop: 8 }}>
                            {focusedMedal && rowMedals.length > 0 ? (
                                <>
                                    {/* Period Label */}
                                    <Text style={{
                                        fontSize: 16,
                                        fontFamily: 'Nunito_700Bold',
                                        fontWeight: '700',
                                        color: '#FFFFFF',
                                        textAlign: 'center',
                                        marginBottom: 6,
                                    }}>
                                        {formatPeriodLabel(focusedMedal.period_label, focusedMedal.timeframe as Timeframe)}
                                    </Text>

                                    {/* Medal type pill (20% smaller text) */}
                                    <View style={{
                                        backgroundColor: MEDAL_COLOR[focusedMedal.medal] || '#f59e0b',
                                        borderRadius: 9999,
                                        paddingHorizontal: 22,
                                        paddingVertical: 8,
                                        shadowColor: '#000',
                                        shadowOffset: { width: 0, height: 2 },
                                        shadowOpacity: 0.15,
                                        shadowRadius: 4,
                                        elevation: 2,
                                    }}>
                                        <Text style={{
                                            color: '#FFFFFF',
                                            fontFamily: 'Nunito_700Bold',
                                            fontWeight: '700',
                                            fontSize: 15,
                                        }}>
                                            {MEDAL_EMOJI[focusedMedal.medal]} {MEDAL_LABEL[focusedMedal.medal]}
                                        </Text>
                                    </View>

                                    {/* Single-line stats */}
                                    <View style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 12,
                                        marginTop: 8,
                                    }}>
                                        <StatItem label="   P " value={`${focusedMedal.games_played ?? 0}`} />
                                        <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>|</Text>
                                        <StatItem label="Win% " value={`${focusedMedal.win_rate ?? 0}%`} />
                                        <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>|</Text>
                                        <StatItem label="Avg " value={`${focusedMedal.avg_guesses ?? 0}`} />
                                        <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>|</Text>
                                        <StatItem label="Rating" value={`${focusedMedal.elementle_rating}`} highlight />
                                    </View>
                                </>
                            ) : rowMedals.length === 0 ? null : (
                                <Text style={{ color: 'rgba(255,255,255,0.5)' }}>...</Text>
                            )}
                        </View>

                        {/* Spacer */}
                        <View style={{ flex: 0.5 }} />

                        {/* Down Arrow (next row: monthly ↔ annual) */}
                        <View style={{ alignItems: 'center' }}>
                            <TouchableOpacity
                                onPress={handleNextRow}
                                disabled={currentRowIndex >= availableRows.length - 1}
                                style={{ opacity: currentRowIndex >= availableRows.length - 1 ? 0.3 : 1 }}
                            >
                                <View style={{
                                    backgroundColor: currentRowIndex >= availableRows.length - 1 ? 'rgba(255,255,255,0.2)' : brandColor,
                                    padding: 8,
                                    borderRadius: 9999,
                                }}>
                                    <ChevronDown size={24} color="#FFFFFF" />
                                </View>
                            </TouchableOpacity>
                        </View>

                        {/* Spacer */}
                        <View style={{ flex: 1 }} />
                    </View>

                    {/* Dots Indicator (for current row) */}
                    <View style={{ alignItems: 'center', paddingBottom: 24, paddingTop: 4 }}>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            {availableRows.map((row, idx) => (
                                <View
                                    key={row}
                                    style={{
                                        height: 8,
                                        borderRadius: 4,
                                        width: idx === currentRowIndex ? 24 : 8,
                                        backgroundColor: idx === currentRowIndex
                                            ? '#FFFFFF'
                                            : 'rgba(255,255,255,0.4)',
                                    }}
                                />
                            ))}
                        </View>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

/** Inline stat item helper */
function StatItem({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Text style={{
                color: 'rgba(255,255,255,0.5)',
                fontFamily: 'Nunito_500Medium',
                fontSize: 11,
            }}>
                {label}
            </Text>
            <Text style={{
                color: highlight ? '#f59e0b' : '#FFFFFF',
                fontFamily: 'Nunito_700Bold',
                fontWeight: '700',
                fontSize: 12,
            }}>
                {value}
            </Text>
        </View>
    );
}
