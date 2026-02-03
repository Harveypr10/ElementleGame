import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, Dimensions, Animated, FlatList, PanResponder } from 'react-native';
import { styled } from 'nativewind';
import { X, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { BadgeSlot } from './BadgeSlot';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';

const MathsHamsterTransparent = require('../../assets/ui/webp_assets/Signup-Hamster-Transparent.webp');

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledScrollView = styled(ScrollView);

interface AllBadgesModalProps {
    visible: boolean;
    onClose: () => void;
    gameType?: 'USER' | 'REGION';
    initialCategory?: 'elementle' | 'streak' | 'percentile';
}

type CategoryType = 'elementle' | 'streak' | 'percentile';
const CATEGORIES: CategoryType[] = ['elementle', 'streak', 'percentile'];

const CATEGORY_CONFIG: Record<CategoryType, { title: string; description: string }> = {
    elementle: { title: 'Won In', description: 'Win games in few guesses' },
    streak: { title: 'Streak', description: 'Maintain winning streaks' },
    percentile: { title: 'Top %', description: 'Rank high on leaderboards' }
};

export function AllBadgesModal({ visible, onClose, gameType = 'REGION', initialCategory }: AllBadgesModalProps) {
    const { user } = useAuth();
    const [currentCategoryIndex, setCurrentCategoryIndex] = useState(0);
    const [allBadges, setAllBadges] = useState<any[]>([]);
    const [userBadges, setUserBadges] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [containerWidth, setContainerWidth] = useState(Dimensions.get('window').width);
    const SCREEN_HEIGHT = Dimensions.get('window').height;

    // State for the currently focused badge (for the static details section)
    const [focusedBadgeIndex, setFocusedBadgeIndex] = useState(0);

    // Animations
    const scrollX = useRef(new Animated.Value(0)).current;
    const fadeOpacity = useRef(new Animated.Value(1)).current;

    const flatListRef = useRef<FlatList>(null);

    // Badge Item Dimensions - increased to 2.5x original xl size (120 * 2.5 = 300)
    const ITEM_WIDTH = 300;
    const SPACING = 20;
    const ITEM_SIZE = ITEM_WIDTH + SPACING;
    const SPACER_ITEM_SIZE = (containerWidth - ITEM_SIZE) / 2;

    const currentCategory = CATEGORIES[currentCategoryIndex];

    useEffect(() => {
        if (visible) {
            if (initialCategory) {
                const idx = CATEGORIES.indexOf(initialCategory);
                if (idx !== -1) setCurrentCategoryIndex(idx);
            }
            if (user) {
                fetchBadges();
            }
        }
    }, [visible, user, initialCategory]);

    useEffect(() => {
        // Trigger fade in when category changes
        fadeOpacity.setValue(0);
        Animated.timing(fadeOpacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true
        }).start();

        // Reset focus when category changes
        setFocusedBadgeIndex(0);
        scrollX.setValue(0);
        if (flatListRef.current) {
            flatListRef.current.scrollToOffset({ offset: 0, animated: false });
        }
    }, [currentCategory]);

    const fetchBadges = async () => {
        try {
            setLoading(true);
            const { data: badgesData, error: badgesError } = await supabase.from('badges').select('*');
            if (badgesError) throw badgesError;
            setAllBadges(badgesData || []);

            const { data: earnedData, error: earnedError } = await supabase
                .from('user_badges')
                .select('*, badge:badges(*)')
                .eq('user_id', user!.id);
            if (earnedError) throw earnedError;
            setUserBadges(earnedData || []);
        } catch (error) {
            console.error("Error fetching badges:", error);
        } finally {
            setLoading(false);
        }
    };

    const normalizeCategory = (cat: string): CategoryType => {
        const lower = cat.toLowerCase();
        if (lower.includes('elementle')) return 'elementle';
        if (lower.includes('streak')) return 'streak';
        if (lower.includes('percentile')) return 'percentile';
        return 'elementle';
    };

    // Filter real badges (no spacers)
    const categoryBadges = useMemo(() => {
        return allBadges
            .filter(b => normalizeCategory(b.category) === currentCategory) // Filter strictly by category
            .sort((a, b) => a.threshold - b.threshold)
            .map(badge => {
                const userBadge = userBadges.find(ub => ub.badge_id === badge.id);
                // Simplify isEarned logic - strict check
                const isEarned = !!userBadge;
                return { badge, isEarned, userBadge };
            });
    }, [allBadges, userBadges, currentCategory]);

    // Initial Scroll to highest earned
    useEffect(() => {
        if (categoryBadges.length > 0 && flatListRef.current) {
            let targetIndex = 0;
            const earnedIndices = categoryBadges
                .map((item, idx) => item.isEarned ? idx : -1)
                .filter(idx => idx !== -1);

            if (earnedIndices.length > 0) {
                targetIndex = earnedIndices[earnedIndices.length - 1];
            }

            // small delay to allow layout to settle
            setTimeout(() => {
                flatListRef.current?.scrollToOffset({
                    offset: targetIndex * ITEM_SIZE,
                    animated: false
                });
                setFocusedBadgeIndex(targetIndex);
                scrollX.setValue(targetIndex * ITEM_SIZE);
            }, 100);
        }
    }, [categoryBadges]); // Dependent on badge list update

    const handleNextCategory = () => {
        if (currentCategoryIndex < CATEGORIES.length - 1) {
            setCurrentCategoryIndex(prev => prev + 1);
        }
    };

    const handlePrevCategory = () => {
        if (currentCategoryIndex > 0) {
            setCurrentCategoryIndex(prev => prev - 1);
        }
    };

    // Viewability Config to track focused item
    const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: any[] }) => {
        if (viewableItems.length > 0) {
            // With snapToAlignment center, the center item should be the first fully visible one or close to it.
            // We can just take the item with visiblePercent > 50 or closest to center.
            // Given the config below, we primarily look at the first item that breaks the threshold.
            const centerItem = viewableItems[0];
            if (centerItem && centerItem.index !== null && centerItem.index !== undefined) {
                setFocusedBadgeIndex(centerItem.index);
            }
        }
    }).current;

    const viewabilityConfig = useRef({
        itemVisiblePercentThreshold: 50 // Consider item focused if 50% visible
    }).current;

    const renderItem = ({ item, index }: { item: any; index: number }) => {
        const inputRange = [
            (index - 1) * ITEM_SIZE,
            index * ITEM_SIZE,
            (index + 1) * ITEM_SIZE,
        ];

        const scale = scrollX.interpolate({
            inputRange,
            outputRange: [0.7, 1.3, 0.7],
            extrapolate: 'clamp',
        });

        const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.3, 1, 0.3],
            extrapolate: 'clamp',
        });

        return (
            <Animated.View style={{
                width: ITEM_SIZE,
                alignItems: 'center',
                justifyContent: 'center',
                transform: [{ scale }],
                opacity: item.isEarned ? 1 : 0.5
            }}>
                <Animated.View style={{ opacity: item.isEarned ? opacity : Animated.multiply(opacity, 0.5) }}>
                    <BadgeSlot
                        category={currentCategory}
                        badge={item}
                        size="xxl"
                        placeholderImage={MathsHamsterTransparent}
                        gameMode={gameType}
                    />
                </Animated.View>
            </Animated.View>
        );
    };

    const focusedBadge = categoryBadges[focusedBadgeIndex];

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="overFullScreen"
            onRequestClose={onClose}
            transparent
        >
            <StyledView className="flex-1 bg-slate-50 dark:bg-slate-900 pt-10 pb-10">
                {/* Header (Fixed) */}
                <StyledView className="flex-row justify-between items-center px-6 mb-2 z-10">
                    <StyledText className="text-3xl font-n-bold text-slate-900 dark:text-white">Badges</StyledText>
                    <TouchableOpacity onPress={onClose} className="p-2 bg-slate-200 dark:bg-slate-800 rounded-full">
                        <X size={24} color="#64748b" />
                    </TouchableOpacity>
                </StyledView>

                {/* Vertical Nav - Up */}
                <StyledView className="items-center mb-0 h-14 justify-center z-10">
                    <TouchableOpacity
                        onPress={handlePrevCategory}
                        disabled={currentCategoryIndex === 0}
                        className={`${currentCategoryIndex === 0 ? 'opacity-0' : ''}`}
                    >
                        <StyledView className="bg-blue-100 dark:bg-slate-800 p-3 rounded-full">
                            <ChevronUp size={24} color="#3b82f6" />
                        </StyledView>
                    </TouchableOpacity>
                </StyledView>

                {/* Main Content Area */}
                <StyledView className="flex-1 justify-start pt-0 z-0">

                    {/* Category Title - Push down below Up Arrow */}
                    <StyledView className="items-center mb-2 mt-4 px-6">
                        <StyledText className="text-xl font-n-bold text-slate-800 dark:text-slate-100 text-center uppercase tracking-widest">
                            {CATEGORY_CONFIG[currentCategory].title}
                        </StyledText>
                    </StyledView>

                    {/* Badge Carousel */}
                    <Animated.View style={{ opacity: fadeOpacity, height: ITEM_WIDTH * 1.5 }}>
                        <Animated.FlatList
                            ref={flatListRef}
                            data={categoryBadges}
                            keyExtractor={(item, index) => `${item.badge.id}-${index}`}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            snapToInterval={ITEM_SIZE}
                            snapToAlignment="start" // Changed from center to start for precise interval snapping with padding
                            decelerationRate="fast"
                            getItemLayout={(data, index) => (
                                { length: ITEM_SIZE, offset: ITEM_SIZE * index, index }
                            )}
                            contentContainerStyle={{
                                paddingHorizontal: SPACER_ITEM_SIZE,
                                alignItems: 'center'
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
                    </Animated.View>

                    {/* Details Section (Dynamic based on Focus) */}
                    <StyledView className="items-center px-8 mt-0 h-[100px] justify-start">
                        {focusedBadge ? (
                            <>
                                {focusedBadge.isEarned ? (
                                    <StyledView className="bg-green-500 rounded-full px-8 py-3 shadow-sm transform scale-105">
                                        <StyledText className="text-white font-n-bold text-lg">
                                            {focusedBadge.userBadge?.badge_count > 1
                                                ? `Earned x${focusedBadge.userBadge.badge_count}!`
                                                : 'Earned!'}
                                        </StyledText>
                                    </StyledView>
                                ) : (
                                    <StyledView className="bg-slate-200 dark:bg-slate-700 rounded-full px-8 py-3 opacity-90">
                                        <StyledText className="text-slate-500 dark:text-slate-300 font-n-bold text-lg">
                                            Locked
                                        </StyledText>
                                    </StyledView>
                                )}
                            </>
                        ) : (
                            <StyledText className="text-slate-400">...</StyledText>
                        )}
                    </StyledView>

                </StyledView>

                {/* Vertical Nav - Down */}
                <StyledView className="items-center pb-8 mt-2 z-10">
                    <TouchableOpacity
                        onPress={handleNextCategory}
                        disabled={currentCategoryIndex === CATEGORIES.length - 1}
                        className={`${currentCategoryIndex === CATEGORIES.length - 1 ? 'opacity-0' : ''} mb-6`}
                    >
                        <StyledView className="bg-blue-100 dark:bg-slate-800 p-3 rounded-full">
                            <ChevronDown size={24} color="#3b82f6" />
                        </StyledView>
                    </TouchableOpacity>

                    {/* Dots Indicator */}
                    <StyledView className="flex-row gap-3">
                        {CATEGORIES.map((_, idx) => (
                            <StyledView
                                key={idx}
                                className={`h-2 rounded-full transition-all ${idx === currentCategoryIndex ? 'bg-slate-800 dark:bg-white w-6' : 'bg-slate-300 dark:bg-slate-700 w-2'}`}
                            />
                        ))}
                    </StyledView>
                </StyledView>
            </StyledView>
        </Modal>
    );
}
