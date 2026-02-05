/**
 * YearMonthPicker Component
 * 
 * Reusable horizontal wheel picker for year and conditional month selection.
 * Used for age verification in both guest play and account creation flows.
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Dimensions,
    TouchableOpacity,
    ScrollView,
    NativeSyntheticEvent,
    NativeScrollEvent,
} from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import hapticsManager from '../../lib/hapticsManager';
import { getAgeVerification } from '../../lib/ageVerification';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Configuration
const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = 1900;
const MAX_YEAR = CURRENT_YEAR;
const DEFAULT_YEAR = 2001;

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
    variant?: 'light' | 'dark';
}

/**
 * Single horizontal wheel picker
 */
function WheelPicker({ items, selectedIndex, onIndexChange, label, variant = 'light' }: WheelPickerProps) {
    const scrollViewRef = useRef<ScrollView>(null);
    const isScrollingRef = useRef(false);
    const lastHapticIndex = useRef(selectedIndex);

    const sidePadding = (SLIDER_WIDTH - ITEM_WIDTH) / 2;

    const isDark = variant === 'dark';
    const labelColor = isDark ? '#54524F' : 'rgba(255, 255, 255, 0.7)';
    const textColor = isDark ? '#54524F' : '#fff';
    const indicatorBg = isDark ? 'rgba(125, 170, 232, 0.15)' : 'rgba(255, 255, 255, 0.2)';
    const indicatorBorder = isDark ? 'rgba(125, 170, 232, 0.4)' : 'rgba(255, 255, 255, 0.4)';

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

        if (clampedIndex !== lastHapticIndex.current) {
            lastHapticIndex.current = clampedIndex;
            hapticsManager.light();
        }
    }, [items.length]);

    const handleScrollEnd = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const offsetX = event.nativeEvent.contentOffset.x;
        const index = Math.round(offsetX / ITEM_WIDTH);
        const clampedIndex = Math.max(0, Math.min(items.length - 1, index));

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
            <Text style={[styles.sliderLabel, { color: labelColor }]}>{label}</Text>
            <View style={styles.sliderWrapper}>
                <View style={[
                    styles.centerIndicator,
                    { backgroundColor: indicatorBg, borderColor: indicatorBorder }
                ]} />

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
                                    { color: textColor },
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

interface YearMonthPickerProps {
    selectedYear: number;
    selectedMonth: number;
    showMonthSlider: boolean;
    onYearChange: (year: number) => void;
    onMonthChange: (month: number) => void;
    variant?: 'light' | 'dark';
}

/**
 * Combined Year + Month picker with animated month reveal
 */
export function YearMonthPicker({
    selectedYear,
    selectedMonth,
    showMonthSlider,
    onYearChange,
    onMonthChange,
    variant = 'light',
}: YearMonthPickerProps) {
    // Generate year array
    const years = useMemo(() =>
        Array.from({ length: MAX_YEAR - MIN_YEAR + 1 }, (_, i) => MIN_YEAR + i),
        []
    );

    const yearIndex = selectedYear - MIN_YEAR;

    // Animations for month slider
    const monthSliderHeight = useSharedValue(showMonthSlider ? 95 : 0);
    const monthSliderOpacity = useSharedValue(showMonthSlider ? 1 : 0);

    useEffect(() => {
        if (showMonthSlider) {
            monthSliderHeight.value = withSpring(95, { damping: 15, stiffness: 150 });
            monthSliderOpacity.value = withTiming(1, { duration: 200 });
        } else {
            // Use withTiming for collapse to prevent jump
            monthSliderOpacity.value = withTiming(0, { duration: 100 });
            monthSliderHeight.value = withTiming(0, { duration: 200 });
        }
    }, [showMonthSlider]);

    const monthSliderAnimatedStyle = useAnimatedStyle(() => ({
        height: monthSliderHeight.value,
        opacity: monthSliderOpacity.value,
        overflow: 'hidden' as const,
    }));

    const handleYearChange = (index: number) => {
        onYearChange(MIN_YEAR + index);
    };

    return (
        <View style={styles.pickerContainer}>
            <WheelPicker
                items={years}
                selectedIndex={yearIndex}
                onIndexChange={handleYearChange}
                label="Year of birth"
                variant={variant}
            />

            <Animated.View style={monthSliderAnimatedStyle}>
                <WheelPicker
                    items={MONTHS}
                    selectedIndex={selectedMonth}
                    onIndexChange={onMonthChange}
                    label="Month of birth"
                    variant={variant}
                />
            </Animated.View>
        </View>
    );
}

/**
 * Hook to manage year/month picker state with automatic month slider logic
 * Prefills from AsyncStorage if guest age verification data exists
 */
export function useYearMonthPicker(defaultYear: number = DEFAULT_YEAR) {
    const [selectedYear, setSelectedYear] = useState(defaultYear);
    const [selectedMonth, setSelectedMonth] = useState(0);
    const [showMonthSlider, setShowMonthSlider] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);

    const currentYear = CURRENT_YEAR;

    // Load saved age data from AsyncStorage on mount (for guest-to-account conversion)
    useEffect(() => {
        const loadSavedAge = async () => {
            try {
                const ageData = await getAgeVerification();

                if (ageData?.ageDate) {
                    // Parse the age_date (format: YYYY-MM-DD)
                    const parts = ageData.ageDate.split('-');
                    if (parts.length >= 2) {
                        const year = parseInt(parts[0], 10);
                        const month = parseInt(parts[1], 10) - 1; // 0-indexed

                        // Validate year is within range
                        if (year >= MIN_YEAR && year <= MAX_YEAR) {
                            setSelectedYear(year);
                            // The month in age_date is "1st of following month", so subtract 1
                            // to get the actual birth month. If month is 1 (January), wrap to December.
                            const birthMonth = month === 0 ? 11 : month - 1;
                            setSelectedMonth(birthMonth);
                            console.log('[YearMonthPicker] Prefilled from AsyncStorage:', { year, birthMonth });
                        }
                    }
                }
            } catch (error) {
                console.log('[YearMonthPicker] No saved age data to prefill');
            } finally {
                setIsLoaded(true);
            }
        };

        loadSavedAge();
    }, []);

    // Determine if month is needed based on year
    useEffect(() => {
        const yearsAgo = currentYear - selectedYear;
        // Show month slider if year could be under 18 (yearsAgo <= 18)
        // This ensures we capture birth month for anyone who might be <18
        const needsMonth = yearsAgo <= 18;
        setShowMonthSlider(needsMonth);
    }, [selectedYear, currentYear]);

    return {
        selectedYear,
        setSelectedYear,
        selectedMonth,
        setSelectedMonth,
        showMonthSlider,
        isLoaded, // Expose loading state if needed
    };
}

// Export constants for external use
export { DEFAULT_YEAR, MIN_YEAR, MAX_YEAR, MONTHS };

const styles = StyleSheet.create({
    pickerContainer: {
        width: '100%',
        alignItems: 'center',
    },
    sliderContainer: {
        width: '100%',
        alignItems: 'center',
        marginBottom: 16,
    },
    sliderLabel: {
        fontSize: 20,
        fontWeight: 'bold',
        fontFamily: 'Nunito_700Bold',
        marginBottom: 8,
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
        borderWidth: 2,
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
    },
    sliderItemTextSelected: {
        fontSize: 24,
    },
    sliderItemTextUnselected: {
        opacity: 0.5,
    },
});
