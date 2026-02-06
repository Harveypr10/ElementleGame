import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';

import { useEndGameLogic } from '../hooks/useEndGameLogic';
import { StreakCelebrationWeb } from '../components/game/StreakCelebration.web';
import { BadgePopupWeb } from '../components/game/BadgePopup.web';

// Assets - Using actual available hamster images
const WinHamster = require('../assets/ui/webp_assets/Celebration-Hamster-Grey.webp');
const LoseHamster = require('../assets/ui/webp_assets/Commiseration-Hamster-Grey.webp');
const StatsHamster = require('../assets/ui/webp_assets/Maths-Hamster.webp');
const ShareHamster = require('../assets/ui/webp_assets/Login-Hamster-White.webp');
const HomeHamster = require('../assets/ui/webp_assets/Historian-Hamster.webp');
const ArchiveHamster = require('../assets/ui/webp_assets/Librarian-Hamster-Yellow.webp');

// ============================================================================
// Confetti Component
// ============================================================================

function ConfettiOverlay() {
    const [particles, setParticles] = useState<Array<{ id: number; left: number; delay: number; color: string }>>([]);

    useEffect(() => {
        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];
        const newParticles = Array.from({ length: 30 }).map((_, i) => ({
            id: i,
            left: Math.random() * 100,
            delay: Math.random() * 0.5,
            color: colors[Math.floor(Math.random() * colors.length)],
        }));
        setParticles(newParticles);
    }, []);

    return (
        <View style={styles.confettiContainer}>
            {particles.map((p) => (
                <View
                    key={p.id}
                    style={[
                        styles.confettiPiece,
                        {
                            left: `${p.left}%` as any,
                            backgroundColor: p.color,
                            animationDelay: `${p.delay}s`,
                        } as any,
                    ]}
                />
            ))}
            <style>{`
                @keyframes confetti-fall {
                    0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
                    100% { transform: translateY(400px) rotate(720deg); opacity: 0; }
                }
            `}</style>
        </View>
    );
}

// ============================================================================
// Rain Overlay Component
// ============================================================================

function RainOverlay() {
    const [drops, setDrops] = useState<Array<{ id: number; left: number; duration: number; delay: number }>>([]);

    useEffect(() => {
        const newDrops = Array.from({ length: 40 }).map((_, i) => ({
            id: i,
            left: Math.random() * 100,
            duration: 1 + Math.random() * 1.5,
            delay: Math.random() * 2,
        }));
        setDrops(newDrops);
    }, []);

    return (
        <View style={styles.rainContainer}>
            {drops.map((d) => (
                <View
                    key={d.id}
                    style={[
                        styles.raindrop,
                        {
                            left: `${d.left}%` as any,
                            animationDuration: `${d.duration}s`,
                            animationDelay: `${d.delay}s`,
                        } as any,
                    ]}
                />
            ))}
            <style>{`
                @keyframes rain-fall {
                    0% { transform: translateY(-20px); opacity: 0.7; }
                    100% { transform: translateY(100vh); opacity: 0.2; }
                }
            `}</style>
        </View>
    );
}

// ============================================================================
// Main Screen Component
// ============================================================================

export default function GameResultScreenWeb() {
    const router = useRouter();
    const params = useLocalSearchParams();

    // Parse params
    const parsedParams = {
        isWin: params.isWin === 'true',
        guessesCount: parseInt(params.guessesCount as string, 10) || 0,
        maxGuesses: parseInt(params.maxGuesses as string, 10) || 5,
        answerDateCanonical: (params.answerDateCanonical as string) || '',
        eventTitle: (params.eventTitle as string) || '',
        eventDescription: (params.eventDescription as string) || '',
        gameMode: (params.gameMode as 'REGION' | 'USER') || 'REGION',
        puzzleId: (params.puzzleId as string) || '',
        isGuest: params.isGuest === 'true',
        isStreakSaverGame: params.isStreakSaverGame === 'true',
        isToday: params.isToday === 'true',
        justFinished: params.justFinished === 'true',
        currentStreak: parseInt(params.currentStreak as string, 10) || 0,
        earnedBadges: params.earnedBadges ? JSON.parse(params.earnedBadges as string) : [],
    };

    // Use logic hook
    const {
        formattedDate,
        statsColor,
        shareColor,
        homeColor,
        archiveColor,
        showStreakCelebration,
        showBadgePopup,
        currentBadge,
        handleShare,
        goHome,
        goStats,
        goArchive,
        goLogin,
        dismissStreakCelebration,
        dismissBadgePopup,
    } = useEndGameLogic(parsedParams);

    const { isWin, guessesCount, eventTitle, eventDescription, isGuest, gameMode } = parsedParams;

    return (
        <View style={styles.container}>
            {/* Weather Effects */}
            {isWin ? <ConfettiOverlay /> : <RainOverlay />}

            {/* Celebrations */}
            <StreakCelebrationWeb
                visible={showStreakCelebration}
                streak={parsedParams.currentStreak}
                onClose={dismissStreakCelebration}
            />

            <BadgePopupWeb
                visible={showBadgePopup}
                badge={currentBadge}
                onClose={dismissBadgePopup}
                gameMode={gameMode}
            />

            {/* Main Content Card */}
            <View style={styles.contentWrapper}>
                <View style={styles.card}>
                    {/* Header */}
                    <Text style={styles.headerText}>
                        {isWin ? "Congratulations!" : "Unlucky!"}
                    </Text>

                    {/* Hamster Image */}
                    <View style={styles.hamsterContainer}>
                        <Image
                            source={isWin ? WinHamster : LoseHamster}
                            style={styles.hamsterImage}
                            contentFit="contain"
                        />
                    </View>

                    {/* Date */}
                    <Text style={styles.dateText}>{formattedDate}</Text>

                    {/* Fact Card */}
                    <View style={styles.factCard}>
                        <Text style={styles.factTitle}>{eventTitle}</Text>
                        {eventDescription && (
                            <Text style={styles.factDescription}>{eventDescription}</Text>
                        )}
                    </View>

                    {/* Guesses Text */}
                    {isWin && guessesCount > 0 && (
                        <Text style={styles.guessesText}>
                            You solved it in {guessesCount} {guessesCount === 1 ? 'guess' : 'guesses'}!
                        </Text>
                    )}

                    {/* Action Buttons */}
                    {isGuest ? (
                        <Pressable
                            style={[styles.fullButton, { backgroundColor: statsColor, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 24 }]}
                            onPress={goLogin}
                        >
                            <Text style={styles.buttonText}>Continue</Text>
                            <Image source={StatsHamster} style={{ width: 40, height: 40 }} contentFit="contain" />
                        </Pressable>
                    ) : (
                        <View style={styles.buttonGrid}>
                            {/* Top Row: Stats + Share */}
                            <View style={styles.buttonRow}>
                                <Pressable
                                    style={[styles.gridButton, { backgroundColor: statsColor }]}
                                    onPress={goStats}
                                >
                                    <Text style={styles.buttonText}>Stats</Text>
                                    <Image source={StatsHamster} style={styles.buttonHamster} contentFit="contain" />
                                </Pressable>

                                <Pressable
                                    style={[styles.gridButton, { backgroundColor: shareColor }]}
                                    onPress={handleShare}
                                >
                                    <Text style={styles.buttonText}>Share</Text>
                                    <Image source={ShareHamster} style={styles.buttonHamster} contentFit="contain" />
                                </Pressable>
                            </View>

                            {/* Bottom Row: Home + Archive */}
                            <View style={styles.buttonRow}>
                                <Pressable
                                    style={[styles.gridButton, { backgroundColor: homeColor }]}
                                    onPress={goHome}
                                >
                                    <Text style={styles.buttonText}>Home</Text>
                                    <Image source={HomeHamster} style={styles.buttonHamster} contentFit="contain" />
                                </Pressable>

                                <Pressable
                                    style={[styles.gridButton, { backgroundColor: archiveColor }]}
                                    onPress={goArchive}
                                >
                                    <Text style={styles.buttonText}>Archive</Text>
                                    <Image source={ArchiveHamster} style={styles.buttonHamster} contentFit="contain" />
                                </Pressable>
                            </View>
                        </View>
                    )}
                </View>
            </View>
        </View>
    );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F1F5F9',
        minHeight: '100vh' as any,
    },
    contentWrapper: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 32,
        maxWidth: 600,
        width: '100%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 24,
        elevation: 8,
        alignItems: 'center',
    },
    headerText: {
        fontSize: 32,
        fontWeight: '800',
        fontFamily: 'Nunito_800ExtraBold, Nunito',
        color: '#1e293b',
        textAlign: 'center',
        marginBottom: 16,
    },
    hamsterContainer: {
        width: 150,
        height: 150,
        marginBottom: 16,
    },
    hamsterImage: {
        width: '100%',
        height: '100%',
    },
    dateText: {
        fontSize: 24,
        fontWeight: '700',
        fontFamily: 'Nunito_700Bold, Nunito',
        color: '#1e293b',
        textAlign: 'center',
        marginBottom: 16,
    },
    factCard: {
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        padding: 16,
        width: '100%',
        marginBottom: 16,
    },
    factTitle: {
        fontSize: 18,
        fontWeight: '700',
        fontFamily: 'Nunito_700Bold, Nunito',
        color: '#1e293b',
        textAlign: 'center',
        marginBottom: 8,
    },
    factDescription: {
        fontSize: 14,
        fontWeight: '500',
        fontFamily: 'Nunito_500Medium, Nunito',
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 20,
    },
    guessesText: {
        fontSize: 14,
        fontWeight: '600',
        fontFamily: 'Nunito_600SemiBold, Nunito',
        color: '#64748B',
        textAlign: 'center',
        marginBottom: 24,
    },
    fullButton: {
        width: '100%',
        height: 64,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonGrid: {
        width: '100%',
        gap: 12,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 12,
    },
    gridButton: {
        flex: 1,
        height: 72,
        borderRadius: 24,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
    },
    buttonText: {
        fontSize: 18,
        fontWeight: '700',
        fontFamily: 'Nunito_700Bold, Nunito',
        color: '#1e293b',
    },
    buttonHamster: {
        width: 48,
        height: 48,
    },

    // Confetti
    confettiContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 400,
        overflow: 'hidden',
        pointerEvents: 'none' as any,
        zIndex: 10,
    },
    confettiPiece: {
        position: 'absolute',
        top: -20,
        width: 10,
        height: 10,
        borderRadius: 2,
        animation: 'confetti-fall 2.5s linear forwards' as any,
    },

    // Rain
    rainContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden',
        pointerEvents: 'none' as any,
        zIndex: 10,
    },
    raindrop: {
        position: 'absolute',
        top: -20,
        width: 2,
        height: 12,
        backgroundColor: '#60a5fa',
        borderRadius: 1,
        opacity: 0.7,
        animation: 'rain-fall linear infinite' as any,
    },
});
