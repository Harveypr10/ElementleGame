/**
 * Age Verification Screen
 * 
 * First-run gate that collects year (and potentially month) of birth
 * for ad compliance (COPPA, AppLovin age restrictions).
 * 
 * Design: Matches SplashScreen styling with blue background (#7DAAE8),
 * white text, and Sherlock Hamster image.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Dimensions,
    TouchableOpacity,
    Platform,
    ScrollView,
    NativeSyntheticEvent,
    NativeScrollEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    interpolate,
    Extrapolation,
    FadeIn,
    FadeOut,
} from 'react-native-reanimated';
import hapticsManager from '../../lib/hapticsManager';
import { saveAgeVerification, calculateAgeDate, is16Plus } from '../../lib/ageVerification';
import { useInterstitialAd } from '../../hooks/useInterstitialAd';
import { initializeAds } from '../../lib/AdManager';

const SherlockHamster = require('../../assets/ui/webp_assets/Sherlock-Hamster.webp');
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Year range configuration
const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = 1900;
const MAX_YEAR = CURRENT_YEAR;
const DEFAULT_YEAR = 2001;

// Month names
const MONTHS = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

// Slider dimensions
const SLIDER_WIDTH = SCREEN_WIDTH * 0.85;
const ITEM_WIDTH = 70;

interface WheelPickerProps {
    items: (string | number)[];
    selectedIndex: number;
    onIndexChange: (index: number) => void;
    label: string;
}

/**
 * Horizontal wheel picker with momentum scrolling
 */
function WheelPicker({ items, selectedIndex, onIndexChange, label }: WheelPickerProps) {
    const scrollViewRef = useRef<ScrollView>(null);
    const isScrollingRef = useRef(false);
    const lastHapticIndex = useRef(selectedIndex);

    // Center padding to allow first/last items to be centered
    const sidePadding = (SLIDER_WIDTH - ITEM_WIDTH) / 2;

    // Scroll to selected index on mount (with small delay for layout)
    useEffect(() => {
        const timer = setTimeout(() => {
            if (!isScrollingRef.current) {
                scrollViewRef.current?.scrollTo({
                    x: selectedIndex * ITEM_WIDTH,
                    animated: false,
                });
            }
        }, 50);
        return () => clearTimeout(timer);
    }, []);

    const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const offsetX = event.nativeEvent.contentOffset.x;
        const index = Math.round(offsetX / ITEM_WIDTH);
        const clampedIndex = Math.max(0, Math.min(items.length - 1, index));

        // Trigger haptic on each item pass
        if (clampedIndex !== lastHapticIndex.current) {
            lastHapticIndex.current = clampedIndex;
            hapticsManager.light();
        }
    }, [items.length]);

    const handleScrollEnd = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const offsetX = event.nativeEvent.contentOffset.x;
        const index = Math.round(offsetX / ITEM_WIDTH);
        const clampedIndex = Math.max(0, Math.min(items.length - 1, index));

        // Snap to nearest item
        scrollViewRef.current?.scrollTo({
            x: clampedIndex * ITEM_WIDTH,
            animated: true,
        });

        if (clampedIndex !== selectedIndex) {
            onIndexChange(clampedIndex);
        }

        isScrollingRef.current = false;
    }, [items.length, selectedIndex, onIndexChange]);

    const handleScrollBegin = useCallback(() => {
        isScrollingRef.current = true;
    }, []);

    return (
        <View style={styles.sliderContainer}>
            <Text style={styles.sliderLabel}>{label}</Text>
            <View style={styles.sliderWrapper}>
                {/* Center indicator */}
                <View style={styles.centerIndicator} />

                <ScrollView
                    ref={scrollViewRef}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    decelerationRate={0.992}
                    snapToInterval={ITEM_WIDTH}
                    snapToAlignment="start"
                    contentContainerStyle={{ paddingHorizontal: sidePadding }}
                    onScroll={handleScroll}
                    onScrollBeginDrag={handleScrollBegin}
                    onMomentumScrollEnd={handleScrollEnd}
                    scrollEventThrottle={16}
                >
                    {items.map((item, index) => {
                        const isSelected = index === selectedIndex;
                        return (
                            <TouchableOpacity
                                key={index}
                                onPress={() => {
                                    hapticsManager.light();
                                    scrollViewRef.current?.scrollTo({
                                        x: index * ITEM_WIDTH,
                                        animated: true,
                                    });
                                    onIndexChange(index);
                                }}
                                style={styles.sliderItem}
                                activeOpacity={0.7}
                            >
                                <Text style={[
                                    styles.sliderItemText,
                                    isSelected && styles.sliderItemTextSelected,
                                    !isSelected && styles.sliderItemTextUnselected,
                                ]}>
                                    {item}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>
        </View>
    );
}

export default function AgeVerificationScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{
        returnTo?: string;
        puzzleDate?: string;
        firstName?: string;
        lastName?: string;
        subscribeFirst?: string;
    }>();
    const { showAd, isLoaded, isClosed } = useInterstitialAd();

    // State
    const [selectedYearIndex, setSelectedYearIndex] = useState(DEFAULT_YEAR - MIN_YEAR);
    const [selectedMonthIndex, setSelectedMonthIndex] = useState(0);
    const [showMonthSlider, setShowMonthSlider] = useState(false);
    const [waitingForAd, setWaitingForAd] = useState(false);
    const [savedPuzzleDate, setSavedPuzzleDate] = useState<string>('today');

    // Animations
    const monthSliderHeight = useSharedValue(0);
    const monthSliderOpacity = useSharedValue(0);
    const buttonTranslateY = useSharedValue(0);

    // Generate year options
    const years: number[] = [];
    for (let year = MIN_YEAR; year <= MAX_YEAR; year++) {
        years.push(year);
    }

    // Calculate selected year
    const selectedYear = MIN_YEAR + selectedYearIndex;

    // Check if user could be under 18 based on year alone
    const isAmbiguousAge = (CURRENT_YEAR - selectedYear) <= 18;

    // Animate month slider visibility
    useEffect(() => {
        if (isAmbiguousAge && !showMonthSlider) {
            // Show month slider with spring animation
            setShowMonthSlider(true);
            monthSliderHeight.value = withSpring(100, { damping: 15, stiffness: 120 });
            monthSliderOpacity.value = withTiming(1, { duration: 300 });
            buttonTranslateY.value = withSpring(50, { damping: 15, stiffness: 120 });
        } else if (!isAmbiguousAge && showMonthSlider) {
            // Hide month slider
            monthSliderOpacity.value = withTiming(0, { duration: 200 });
            monthSliderHeight.value = withTiming(0, { duration: 300 });
            buttonTranslateY.value = withSpring(0, { damping: 15, stiffness: 120 });
            setTimeout(() => setShowMonthSlider(false), 300);
        }
    }, [isAmbiguousAge]);

    const monthSliderAnimatedStyle = useAnimatedStyle(() => ({
        height: monthSliderHeight.value,
        opacity: monthSliderOpacity.value,
        overflow: 'hidden' as const,
    }));

    const buttonAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: buttonTranslateY.value }],
    }));

    // Watch for ad close to navigate to game
    useEffect(() => {
        if (waitingForAd && isClosed) {
            router.replace({
                pathname: `/game/REGION/${savedPuzzleDate}`,
                params: { skipIntro: 'true' }
            });
            setWaitingForAd(false);
        }
    }, [waitingForAd, isClosed, savedPuzzleDate]);

    const handleContinue = async () => {
        hapticsManager.medium();

        // Calculate and save age verification data
        const month = showMonthSlider ? selectedMonthIndex + 1 : undefined;
        const ageData = calculateAgeDate(selectedYear, month);
        await saveAgeVerification(selectedYear, month);

        // Initialize ads with correct age settings (force re-init since age just changed)
        await initializeAds(true);

        // Check if user is 16+ (ads only for 16+)
        const canShowAds = is16Plus(ageData.ageDate);
        const isAdult = ageData.isAdult;
        console.log('[AgeVerification] Age check:', { ageDate: ageData.ageDate, canShowAds, isAdult });

        // Navigate based on returnTo param
        if (params.returnTo === 'game') {
            // Coming from guest play - show ad (if 16+) then go to game
            const targetDate = params.puzzleDate || 'today';
            setSavedPuzzleDate(targetDate);

            if (canShowAds && isLoaded) {
                setWaitingForAd(true);
                showAd();
            } else {
                // Under 16 OR no ad ready - proceed directly (no ads for children)
                router.replace({
                    pathname: `/game/REGION/${targetDate}`,
                    params: { skipIntro: 'true' }
                });
            }
        } else if (params.returnTo === 'personalise') {
            // Coming from social auth signup - go to personalise screen with name if provided
            router.replace({
                pathname: '/(auth)/personalise',
                params: {
                    firstName: params.firstName || '',
                    lastName: params.lastName || '',
                    ...(params.subscribeFirst === '1' ? { subscribeFirst: '1' } : {}),
                },
            });
        } else {
            // Coming from other flows - go to onboarding
            router.replace('/(auth)/onboarding');
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar style="light" />
            <SafeAreaView style={styles.safeArea}>
                <Animated.View
                    style={styles.content}
                    entering={FadeIn.duration(600)}
                >
                    {/* Title */}
                    <Text style={styles.title}>Let's personalise Elementle for you!</Text>
                    <Text style={styles.subtitle}>Please confirm your year of birth..</Text>

                    {/* Sherlock Hamster */}
                    <View style={styles.imageContainer}>
                        <Image
                            source={SherlockHamster}
                            style={styles.hamsterImage}
                            contentFit="contain"
                            cachePolicy="disk"
                        />
                    </View>

                    {/* Year Slider */}
                    <WheelPicker
                        items={years}
                        selectedIndex={selectedYearIndex}
                        onIndexChange={setSelectedYearIndex}
                        label="Year of birth"
                    />

                    {/* Month Slider (conditional) */}
                    <Animated.View style={monthSliderAnimatedStyle}>
                        {showMonthSlider && (
                            <WheelPicker
                                items={MONTHS}
                                selectedIndex={selectedMonthIndex}
                                onIndexChange={setSelectedMonthIndex}
                                label="Month of birth"
                            />
                        )}
                    </Animated.View>

                    {/* Continue Button */}
                    <Animated.View style={[styles.buttonContainer, buttonAnimatedStyle]}>
                        <TouchableOpacity
                            onPress={handleContinue}
                            style={styles.continueButton}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.continueButtonText}>Continue</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </Animated.View>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#7DAAE8', // Matching SplashScreen
    },
    safeArea: {
        flex: 1,
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        fontFamily: 'Nunito_700Bold',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 18,
        fontFamily: 'Nunito_500Medium',
        color: 'rgba(255, 255, 255, 0.9)',
        textAlign: 'center',
        marginBottom: 24,
    },
    imageContainer: {
        width: 140,
        height: 140,
        marginBottom: 64, // Doubled gap between image and slider
    },
    hamsterImage: {
        width: '100%',
        height: '100%',
    },
    sliderContainer: {
        width: '100%',
        alignItems: 'center',
        marginBottom: 16,
    },
    sliderLabel: {
        fontSize: 12,
        fontFamily: 'Nunito_600SemiBold',
        color: 'rgba(255, 255, 255, 0.7)',
        marginBottom: 8,
        letterSpacing: 1,
    },
    sliderWrapper: {
        width: SLIDER_WIDTH,
        height: 50,
        justifyContent: 'center',
    },
    centerIndicator: {
        position: 'absolute',
        left: (SLIDER_WIDTH - ITEM_WIDTH - 8) / 2,
        width: ITEM_WIDTH + 8,
        height: 44,
        borderRadius: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.4)',
        zIndex: 0,
    },
    sliderItem: {
        width: ITEM_WIDTH,
        alignItems: 'center',
        justifyContent: 'center',
        height: 50,
    },
    sliderItemText: {
        fontSize: 20,
        fontWeight: 'bold',
        fontFamily: 'Nunito_700Bold',
        color: '#fff',
    },
    sliderItemTextSelected: {
        fontSize: 24,
        color: '#fff',
    },
    sliderItemTextUnselected: {
        opacity: 0.5,
    },
    buttonContainer: {
        width: '100%',
        alignItems: 'center',
        marginTop: 24,
    },
    continueButton: {
        backgroundColor: '#FFFFFF', // White fill
        paddingVertical: 16,
        paddingHorizontal: 48,
        borderRadius: 9999,
        minWidth: 200,
        alignItems: 'center',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 8,
            },
            android: {
                elevation: 4,
            },
        }),
    },
    continueButtonText: {
        fontSize: 20,
        fontWeight: 'bold',
        fontFamily: 'Nunito_700Bold',
        color: '#4A7DB8', // Darker blue text
    },
    privacyNote: {
        fontSize: 12,
        fontFamily: 'Nunito_400Regular',
        color: 'rgba(255, 255, 255, 0.6)',
        textAlign: 'center',
        marginTop: 16,
    },
});
