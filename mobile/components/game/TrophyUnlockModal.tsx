/**
 * TrophyUnlockModal — Full-screen celebration for league medal awards
 *
 * Layout (top to bottom):
 * - Lottie trophy animation
 * - League name as headline
 * - Trophy image (gold/silver/bronze)
 * - Formatted period ("February 2026" or "2025")
 * - Medal label ("Gold" / "Silver" / "Bronze")
 * - Stacked stats: Played, Win%, Avg Guesses, Rating
 * - "Click anywhere to dismiss"
 *
 * 9s auto-dismiss, tap-to-close.
 * Purple background matching game mode color.
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, Animated } from 'react-native';
import { Image } from 'expo-image';
import { styled } from 'nativewind';
import LottieView from 'lottie-react-native';
import { formatPeriodLabel } from '../../hooks/useLeagueData';
import type { Timeframe } from '../../hooks/useLeagueData';

const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);

const TROPHY_ANIMATION = require('../../assets/animation/Trophy.json');

const TROPHY_IMAGES: Record<string, any> = {
    gold: require('../../assets/ui/trophy-gold.png'),
    silver: require('../../assets/ui/trophy-silver.png'),
    bronze: require('../../assets/ui/trophy-bronze.png'),
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
    silver: '#c0c0c0',
    bronze: '#cd7f32',
};

interface TrophyUnlockModalProps {
    visible: boolean;
    trophy: {
        id: number;
        league_name: string;
        timeframe: string;
        period_label: string;
        medal: 'gold' | 'silver' | 'bronze';
        elementle_rating: number;
        game_mode?: string;
        games_played?: number;
        win_rate?: number;
        avg_guesses?: number;
    } | null;
    onClose: () => void;
}

export function TrophyUnlockModal({ visible, trophy, onClose }: TrophyUnlockModalProps) {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scale = useRef(new Animated.Value(0)).current;
    const animationRef = useRef<LottieView>(null);
    const loopCount = useRef(0);

    const [isClosing, setIsClosing] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const lastOpenedTrophyRef = useRef<string | null>(null);

    const bgColor = trophy?.game_mode === 'user' ? '#B278CD' : '#8E57DB';

    useEffect(() => {
        if (visible && !isClosing && trophy) {
            const trophyKey = `${trophy.id}-${trophy.medal}-${trophy.period_label}`;
            if (lastOpenedTrophyRef.current === trophyKey) return;
            lastOpenedTrophyRef.current = trophyKey;

            setShowModal(true);
            loopCount.current = 0;

            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }).start();

            Animated.spring(scale, {
                toValue: 1,
                friction: 6,
                tension: 40,
                useNativeDriver: true,
            }).start();

            setTimeout(() => {
                animationRef.current?.play();
            }, 300);
        }

        if (!visible) {
            lastOpenedTrophyRef.current = null;
        }
    }, [visible, isClosing, trophy]);

    // Auto-dismiss timer (9 seconds)
    const autoDismissTimerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (visible && !isClosing && trophy && !autoDismissTimerRef.current) {
            autoDismissTimerRef.current = setTimeout(() => {
                console.log('[TrophyUnlockModal] Auto-dismissing after 9 seconds');
                autoDismissTimerRef.current = null;
                handleClose();
            }, 9000);
        }

        return () => {
            if (autoDismissTimerRef.current) {
                clearTimeout(autoDismissTimerRef.current);
                autoDismissTimerRef.current = null;
            }
        };
    }, [visible, isClosing, trophy]);

    useEffect(() => {
        return () => {
            setShowModal(false);
            setIsClosing(false);
            if (autoDismissTimerRef.current) {
                clearTimeout(autoDismissTimerRef.current);
                autoDismissTimerRef.current = null;
            }
        };
    }, []);

    const handleClose = () => {
        if (isClosing) return;
        setIsClosing(true);

        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 400,
                useNativeDriver: true,
            }),
            Animated.timing(scale, {
                toValue: 0.8,
                duration: 400,
                useNativeDriver: true,
            })
        ]).start(() => {
            setShowModal(false);
            setIsClosing(false);
            scale.setValue(0);
            onClose();
        });
    };

    if (!showModal || !trophy) return null;

    const medalColor = MEDAL_COLOR[trophy.medal] || '#f59e0b';
    const formattedPeriod = formatPeriodLabel(trophy.period_label, trophy.timeframe as Timeframe);

    return (
        <Modal transparent visible={showModal} animationType="none">
            <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
                <StyledTouchableOpacity
                    style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: bgColor }}
                    activeOpacity={1}
                    onPress={handleClose}
                    disabled={isClosing}
                >
                    <Animated.View style={{ transform: [{ scale }], alignItems: 'center', width: '100%' }}>

                        {/* Trophy Lottie Animation */}
                        <View style={{ width: 200, height: 200, marginBottom: 12, zIndex: 10 }}>
                            <LottieView
                                ref={animationRef}
                                source={TROPHY_ANIMATION}
                                style={{ width: '100%', height: '100%' }}
                                autoPlay={false}
                                loop={false}
                                onAnimationFinish={() => {
                                    if (loopCount.current < 1) {
                                        loopCount.current += 1;
                                        animationRef.current?.play();
                                    }
                                }}
                            />
                        </View>

                        {/* League Name (Headline) */}
                        <StyledText style={{
                            fontSize: 28,
                            fontWeight: '900',
                            fontFamily: 'Nunito_800ExtraBold',
                            color: '#FFFFFF',
                            marginBottom: 16,
                            textAlign: 'center',
                            letterSpacing: 0.5,
                        }}>
                            {trophy.league_name}
                        </StyledText>

                        {/* Trophy Image */}
                        <View style={{ width: 192, height: 192, marginBottom: 16, alignItems: 'center', justifyContent: 'center' }}>
                            <Image
                                source={TROPHY_IMAGES[trophy.medal] || TROPHY_IMAGES.gold}
                                style={{ width: 192, height: 192 }}
                                contentFit="contain"
                                cachePolicy="disk"
                            />
                        </View>

                        {/* Period Label */}
                        <StyledText style={{
                            fontSize: 20,
                            fontWeight: '700',
                            fontFamily: 'Nunito_700Bold',
                            color: '#FFFFFF',
                            marginBottom: 10,
                            textAlign: 'center',
                        }}>
                            {formattedPeriod}
                        </StyledText>

                        {/* Medal Label (Gold / Silver / Bronze) */}
                        <StyledText style={{
                            fontSize: 26,
                            fontWeight: '900',
                            fontFamily: 'Nunito_800ExtraBold',
                            color: medalColor,
                            marginBottom: 20,
                            textAlign: 'center',
                            letterSpacing: 0.5,
                        }}>
                            {MEDAL_EMOJI[trophy.medal]} {MEDAL_LABEL[trophy.medal]}
                        </StyledText>

                        {/* Stacked Stats */}
                        <View style={{ alignItems: 'center', gap: 4, marginBottom: 24 }}>
                            <StatRow label="Played" value={`${trophy.games_played ?? 0}`} />
                            <StatRow label="Win %" value={`${trophy.win_rate ?? 0}%`} />
                            <StatRow label="Avg Guesses" value={`${trophy.avg_guesses ?? 0}`} />
                            <StatRow label="Rating" value={`${trophy.elementle_rating}`} highlight />
                        </View>

                        <StyledText style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, paddingBottom: 20 }}>
                            Click anywhere to dismiss
                        </StyledText>

                    </Animated.View>
                </StyledTouchableOpacity>
            </Animated.View>
        </Modal>
    );
}

/** Stat row helper */
function StatRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{
                color: 'rgba(255,255,255,0.6)',
                fontFamily: 'Nunito_500Medium',
                fontSize: 15,
                width: 100,
                textAlign: 'right',
            }}>
                {label}
            </Text>
            <Text style={{
                color: highlight ? '#f59e0b' : '#FFFFFF',
                fontFamily: 'Nunito_700Bold',
                fontWeight: '700',
                fontSize: 16,
                width: 60,
            }}>
                {value}
            </Text>
        </View>
    );
}
