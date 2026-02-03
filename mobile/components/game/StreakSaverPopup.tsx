import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, Alert, Dimensions, Modal } from 'react-native';
import { Image } from 'expo-image';
import { styled } from 'nativewind';
import { Flame, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStreakSaverStatus } from '../../hooks/useStreakSaverStatus';
import { useStreakSaver } from '../../contexts/StreakSaverContext';
import { useToast } from '../../contexts/ToastContext';
import { useSubscription } from '../../hooks/useSubscription';
import { useProfile } from '../../hooks/useProfile';
import hapticsManager from '../../lib/hapticsManager';
import soundManager from '../../lib/soundManager';
import { HolidayActivationModal } from './HolidayActivationModal';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);
const SCREEN_WIDTH = Dimensions.get('window').width;

export type StreakSaverCloseAction = 'use_streak_saver' | 'decline' | 'holiday' | 'dismiss';

interface StreakSaverPopupProps {
    visible: boolean;
    onClose: (action?: StreakSaverCloseAction) => void;
    gameType: 'REGION' | 'USER';
    currentStreak: number;
    showCloseButton?: boolean;
}

export function StreakSaverPopup({
    visible,
    onClose,
    gameType,
    currentStreak,
    showCloseButton = false
}: StreakSaverPopupProps) {
    const router = useRouter();
    const { toast } = useToast();
    const { startStreakSaverSession } = useStreakSaver();
    const { isPro } = useSubscription(); // Direct sub check
    const {
        regionStreakSaversRemaining,
        userStreakSaversRemaining,
        regionOfferStreakSaver,
        userOfferStreakSaver,
        holidaysRemaining,
        holidayDurationDays,
        hasAnyValidStreakForHoliday,
        declineStreakSaver,
        startHoliday,
    } = useStreakSaverStatus();

    // Internal Modal Visibility (Keeps modal open if either Main Popup OR Reset Toast is active)
    // We sync this with props.visible + internal resetPopup state
    const [modalVisible, setModalVisible] = useState(false);

    const streakSaversRemaining = gameType === 'REGION' ? regionStreakSaversRemaining : userStreakSaversRemaining;
    const hasStreakSaversLeft = streakSaversRemaining > 0;

    // Eligibility acts as the gate for the "Streak Saver" view mode
    const isEligibleForStreakSaver = gameType === 'REGION' ? regionOfferStreakSaver : userOfferStreakSaver;
    const showStreakSaverButton = isEligibleForStreakSaver;

    const { profile } = useProfile();
    const userRegion = profile?.region || 'UK'; // Default to UK if not available
    const gameModeLabel = gameType === 'REGION' ? `${userRegion} Edition` : 'Personal Edition';

    // Helper to get formatted next month date (e.g. "1st February")
    const getNextMonthFirst = () => {
        const now = new Date();
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        return nextMonth.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
    };

    const nextResetDate = getNextMonthFirst();

    const [pendingNav, setPendingNav] = useState<string | null>(null);

    // Animation Refs
    const mainSlideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;

    // Reset Success Popup Animation (Bottom Sheet style)
    const successSlideAnim = useRef(new Animated.Value(300)).current;

    // Action states
    const [isDeclining, setIsDeclining] = useState(false);
    const [isStartingHoliday, setIsStartingHoliday] = useState(false);
    const [isAnimatingOut, setIsAnimatingOut] = useState(false);

    // [FIX] Separate animation states for Region and User modals
    const [regionAnimationVisible, setRegionAnimationVisible] = useState(false);
    const [userAnimationVisible, setUserAnimationVisible] = useState(false);
    const [regionFilledDates, setRegionFilledDates] = useState<string[]>([]);
    const [userFilledDates, setUserFilledDates] = useState<string[]>([]);

    // Internal State for Reset Success Popup
    // [FIX] Store Type to prevent color flipping when parent props change
    const [resetPopup, setResetPopup] = useState<{ visible: boolean; type: 'REGION' | 'USER' }>({
        visible: false,
        type: 'REGION'
    });

    // Sync Modal Visibility
    useEffect(() => {
        // Modal is open if:
        // 1. Parent prop 'visible' is true (Main Popup Active)
        // 2. Internal 'resetPopup.visible' is true (Reset Toast Active)
        // 3. We are pending navigation (optional, to prevent flicker)
        // 4. [FIX] Either animation modal is visible
        if (visible || resetPopup.visible || pendingNav || regionAnimationVisible || userAnimationVisible) {
            setModalVisible(true);
        } else {
            // Only close if all are inactive
            // Add small delay to allow exit animations to finish?
            // Actually animations handle their own timing, we just need container to exist.
            const timer = setTimeout(() => {
                if (!visible && !resetPopup.visible && !pendingNav && !regionAnimationVisible && !userAnimationVisible) {
                    setModalVisible(false);
                }
            }, 100); // 100ms buffer
            return () => clearTimeout(timer);
        }
    }, [visible, resetPopup.visible, pendingNav, regionAnimationVisible, userAnimationVisible]);

    // Helper to handle post-interaction navigation and upgrade check
    const completeInteraction = async (action?: StreakSaverCloseAction) => {
        try {
            const pendingUpgrade = await AsyncStorage.getItem('streak_saver_upgrade_pending');
            if (pendingUpgrade === 'true') {
                if (action !== 'use_streak_saver') {
                    // Signal parent we are done
                    onClose(action);
                    // Don't close modal yet if user needs redirect?
                    // Actually redirect pushes new screen, so modal unmounts.
                    setTimeout(() => {
                        router.push('/category-selection');
                    }, 300);
                    return;
                }
            }
            // Standard Close
            onClose(action);
        } catch (e) {
            console.error('Error checking upgrade status:', e);
            onClose(action);
        }
    };

    // Effect to handle Main Popup Animation (In from Right / Out to Left)
    useEffect(() => {
        if (visible) {
            setIsAnimatingOut(false);
            // Slide In from Right
            mainSlideAnim.setValue(SCREEN_WIDTH); // Reset position
            Animated.spring(mainSlideAnim, {
                toValue: 0,
                friction: 8,
                tension: 40,
                useNativeDriver: true,
            }).start();
        } else {
            // If parent hides us, and we ARE NOT handling a reset workflow, ensure hidden?
            // If we ARE handling reset, 'resetPopup.visible' keeps Modal open, but Main Card should govern itself via 'visible' prop logic below in Render.
        }
    }, [visible]);

    // Effect to handle navigation after modal closes
    useEffect(() => {
        if (!visible && pendingNav) {
            const timer = setTimeout(() => {
                router.push(pendingNav);
                setPendingNav(null);
            }, 450);
            return () => clearTimeout(timer);
        }
    }, [visible, pendingNav]);

    // Effect for Reset Success Logic
    useEffect(() => {
        if (resetPopup.visible) {
            // 1. Slide Success UP (from Bottom margin)
            successSlideAnim.setValue(300); // Reset
            Animated.spring(successSlideAnim, {
                toValue: 0,
                useNativeDriver: true,
                damping: 20,
                stiffness: 90
            }).start();

            // 2. Wait and Slide DOWN
            const timer = setTimeout(() => {
                Animated.timing(successSlideAnim, {
                    toValue: 400, // Slide back down
                    duration: 300,
                    useNativeDriver: true,
                }).start(() => {
                    // Close Reset Popup State
                    setResetPopup(prev => ({ ...prev, visible: false }));
                    // [FIX] Do NOT call onClose() here. Main flow already closed.
                    // This just cleans up the toast.
                });
            }, 3000); // [FIX] Increased to 3 seconds

            return () => clearTimeout(timer);
        }
    }, [resetPopup.visible]);

    const handleUseStreakSaver = async () => {
        if (!hasStreakSaversLeft) {
            hapticsManager.warning();
            return;
        }

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        await startStreakSaverSession(gameType, yesterdayStr, currentStreak);

        hapticsManager.success();
        soundManager.play('tap');

        // Animate Out to Left
        Animated.timing(mainSlideAnim, {
            toValue: -SCREEN_WIDTH,
            duration: 300,
            useNativeDriver: true,
        }).start(() => {
            setPendingNav(`/game/${gameType}/${yesterdayStr}`);
            completeInteraction('use_streak_saver');
        });
    };

    const handleDecline = async () => {
        setIsDeclining(true);
        const typeAtStart = gameType; // Capture current type

        try {
            hapticsManager.warning();
            await declineStreakSaver(gameType);

            // 1. Animate Main Popup OUT to LEFT
            Animated.timing(mainSlideAnim, {
                toValue: -SCREEN_WIDTH,
                duration: 300,
                useNativeDriver: true,
            }).start(() => {
                // [FIX] Signal Parent to Close Main Popup IMMEDIATELY after animation
                // This allows the Next Popup (User) to start processing logic
                // The Modal will stay open because 'resetPopup.visible' is true.
                completeInteraction('decline');
                setIsDeclining(false);
            });

            // 2. Trigger Reset Success (Slides IN from Bottom concurrently)
            // [FIX] Use Captured Type
            setResetPopup({ visible: true, type: typeAtStart });

        } catch (error: any) {
            hapticsManager.error();
            toast({ title: 'Error', description: error?.message, variant: 'error' });
            setIsDeclining(false);
        }
    };

    const handleStartHoliday = async () => {
        setIsStartingHoliday(true);
        try {
            hapticsManager.success();
            const { regionDates, userDates } = await startHoliday();
            console.log('[StreakSaverPopup] Holiday activated. Region dates:', regionDates, 'User dates:', userDates);

            // [FIX] Store separate date arrays and show Region modal first
            setRegionFilledDates(regionDates || []);
            setUserFilledDates(userDates || []);
            setRegionAnimationVisible(true);
        } catch (error: any) {
            hapticsManager.error();
            toast({ title: 'Error', description: error?.message, variant: 'error' });
        } finally {
            setIsStartingHoliday(false);
        }
    };

    const handleGetMoreSavers = () => {
        hapticsManager.medium();
        router.push({ pathname: '/subscription', params: { from: 'streakSaver' } });
    };

    const handleGetHolidayAllowance = () => {
        hapticsManager.medium();
        onClose('dismiss'); // Close modal first
        router.push({ pathname: '/subscription', params: { from: 'streakSaver' } });
    }

    // Colors
    // [FIX] Use resetPopup.type for Reset Toast, props.gameType for Main Card
    const mainBgColor = gameType === 'REGION' ? '#FFD429' : '#fdab58';
    const resetBgColor = resetPopup.type === 'REGION' ? '#FFD429' : '#fdab58';

    // RENDER: Concurrent Views inside MODAL
    return (
        <Modal
            visible={modalVisible}
            transparent
            animationType="none"
            onRequestClose={() => {
                if (showCloseButton && visible) onClose('dismiss');
            }}
        >
            <View
                style={{
                    flex: 1,
                    zIndex: 99999,
                    // Pass through touches if only Reset Toast is showing?
                    // View doesn't have pointerEvents per se in this context easily without blocking.
                    // But if Main Card is hidden, we want to allow touches behind?
                    // Modal generally blocks. But that's fine for 3s toast.
                }}
            >
                {/* 1. Main Popup Wrapper (Active only if visible prop is true) */}
                {visible && (
                    <Animated.View
                        style={{
                            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                            backgroundColor: 'rgba(0,0,0,0.7)',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        {/* MAIN POPUP CARD */}
                        <Animated.View
                            style={{
                                transform: [{ translateX: mainSlideAnim }],
                                width: '100%',
                                padding: 24,
                                alignItems: 'center'
                            }}
                        >
                            <StyledView
                                className="rounded-2xl p-6 w-full max-w-sm shadow-2xl"
                                style={{ backgroundColor: mainBgColor }}
                            >
                                {/* Header */}
                                <StyledView className="flex-row items-center justify-center gap-2 mb-2 relative">
                                    <Flame size={24} color="#ef4444" />
                                    <StyledText className="text-2xl font-n-bold text-slate-900">
                                        {showStreakSaverButton ? 'Save Your Streak?' : 'Protect Your Streak?'}
                                    </StyledText>

                                    {showCloseButton && (
                                        <StyledTouchableOpacity
                                            onPress={() => onClose('dismiss')}
                                            className="absolute -right-2 -top-2 p-2 bg-white/20 rounded-full"
                                        >
                                            <X size={20} color="#1e293b" />
                                        </StyledTouchableOpacity>
                                    )}
                                </StyledView>

                                {/* Description */}
                                <StyledText className="text-center text-slate-700 font-n-medium mb-6">
                                    {showStreakSaverButton
                                        ? `You missed yesterday's ${gameModeLabel} puzzle!`
                                        : `You've been away for multiple days. Use holiday mode to protect your ${gameModeLabel} streak, or let it reset.`
                                    }
                                </StyledText>

                                {/* Hamster Image */}
                                <StyledView className="items-center mb-6">
                                    <StyledView className="w-40 h-40 items-center justify-center mb-2">
                                        <Image
                                            source={require('../../assets/ui/webp_assets/Streak-Hamster-Black.webp')}
                                            style={{ width: 150, height: 150 }}
                                            contentFit="contain"
                                            cachePolicy="disk"
                                        />
                                    </StyledView>

                                    <StyledText className="text-3xl font-n-bold text-slate-900">
                                        {currentStreak} Day Streak
                                    </StyledText>
                                    <StyledText className="text-sm text-slate-700 font-n-medium mt-2">
                                        {showStreakSaverButton
                                            ? (hasStreakSaversLeft
                                                ? `You have ${streakSaversRemaining} streak saver${streakSaversRemaining > 1 ? 's' : ''} remaining this month`
                                                : "You've used all your streak savers this month")
                                            : (isPro
                                                ? `You have ${holidaysRemaining} holiday${holidaysRemaining !== 1 ? 's' : ''} remaining this year`
                                                : "Upgrade to Pro to access holiday protection")
                                        }
                                    </StyledText>
                                </StyledView>

                                {/* Action Buttons */}
                                <StyledView className="gap-3">
                                    {showStreakSaverButton && (
                                        hasStreakSaversLeft ? (
                                            <StyledTouchableOpacity
                                                onPress={handleUseStreakSaver}
                                                className="bg-black active:bg-slate-800 py-3 rounded-2xl"
                                            >
                                                <StyledText className="text-white font-n-bold text-center text-lg">
                                                    Use streak saver
                                                </StyledText>
                                            </StyledTouchableOpacity>
                                        ) : (
                                            isPro ? (
                                                <StyledView className="bg-black py-3 px-6 rounded-2xl opacity-40">
                                                    <StyledText className="text-white font-n-bold text-center text-lg">
                                                        Streak saver allowance resets on {nextResetDate}
                                                    </StyledText>
                                                </StyledView>
                                            ) : (
                                                <StyledTouchableOpacity
                                                    onPress={handleGetMoreSavers}
                                                    className="bg-gradient-to-r from-orange-400 to-amber-500 py-3 rounded-2xl"
                                                    style={{ backgroundColor: '#fb923c' }}
                                                >
                                                    <StyledText className="text-white font-n-bold text-center text-lg">
                                                        Get more streak savers
                                                    </StyledText>
                                                </StyledTouchableOpacity>
                                            )
                                        )
                                    )}

                                    <StyledTouchableOpacity
                                        onPress={isPro ? handleStartHoliday : handleGetHolidayAllowance}
                                        disabled={isPro && (isStartingHoliday || holidaysRemaining <= 0 || !hasAnyValidStreakForHoliday)}
                                        className={`py-3 rounded-2xl ${!isPro
                                            ? 'bg-indigo-500 active:bg-indigo-600'
                                            : (holidaysRemaining > 0 && hasAnyValidStreakForHoliday)
                                                ? 'bg-blue-400 active:bg-blue-500'
                                                : 'bg-slate-400 opacity-60'
                                            }`}
                                    >
                                        <StyledText className="text-white font-n-bold text-center text-lg">
                                            {isPro
                                                ? (isStartingHoliday
                                                    ? 'Starting...'
                                                    : !hasAnyValidStreakForHoliday
                                                        ? 'No streak to protect'
                                                        : holidaysRemaining <= 0
                                                            ? 'No holidays remaining'
                                                            : `Go on holiday (up to ${holidayDurationDays} days)`)
                                                : 'Get a holiday allowance'
                                            }
                                        </StyledText>
                                    </StyledTouchableOpacity>

                                    <StyledTouchableOpacity
                                        onPress={handleDecline}
                                        disabled={isDeclining}
                                        className="bg-white active:bg-slate-100 py-3 rounded-2xl"
                                    >
                                        <StyledText className="text-slate-700 font-n-bold text-center text-lg">
                                            {isDeclining ? 'Resetting...' : 'Let streak reset'}
                                        </StyledText>
                                    </StyledTouchableOpacity>
                                </StyledView>
                            </StyledView>
                        </Animated.View>
                    </Animated.View>
                )}

                {/* 2. RESET SUCCESS POPUP (Independent Overlay) */}
                {resetPopup.visible && (
                    <View
                        style={{
                            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                            zIndex: 99999,
                            justifyContent: 'flex-end',
                        }}
                        pointerEvents="box-none"
                    >
                        <Animated.View
                            style={{
                                backgroundColor: resetBgColor,
                                transform: [{ translateY: successSlideAnim }]
                            }}
                            className="w-full p-8 rounded-t-3xl shadow-2xl items-center pb-10"
                        >
                            <StyledView className="w-16 h-1 mt-2 mb-6 bg-black/10 rounded-full" />

                            <StyledText className="text-xl font-n-bold text-slate-900 mb-2 text-center">
                                Streak Reset - {resetPopup.type === 'REGION' ? 'Region Edition' : 'Personal Edition'}
                            </StyledText>

                            <StyledText className="text-base font-n-medium text-slate-800 text-center mb-2 leading-6">
                                Your streak has been reset to 0.{'\n'}Start fresh today!
                            </StyledText>
                        </Animated.View>
                    </View>
                )}

                {/* [FIX] Region Animation Modal - Shows First */}
                <HolidayActivationModal
                    visible={regionAnimationVisible && modalVisible}
                    filledDates={regionFilledDates}
                    gameType="REGION"
                    onClose={() => {
                        setRegionAnimationVisible(false);
                        // [FIX] After Region modal closes, show User modal
                        console.log('[StreakSaverPopup] Region modal closed, showing User modal');
                        setUserAnimationVisible(true);
                    }}
                />

                {/* [FIX] User Animation Modal - Shows Second */}
                <HolidayActivationModal
                    visible={userAnimationVisible && modalVisible}
                    filledDates={userFilledDates}
                    gameType="USER"
                    onClose={() => {
                        setUserAnimationVisible(false);
                        // [FIX] After both modals complete, close the entire flow
                        console.log('[StreakSaverPopup] User modal closed, completing holiday activation');
                        completeInteraction('holiday');
                    }}
                />
            </View>
        </Modal>
    );
}
