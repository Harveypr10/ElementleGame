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
    brandColor?: string;
    playButtonColor?: string;
}

type CategoryType = 'elementle' | 'streak' | 'percentile';
const CATEGORIES: CategoryType[] = ['elementle', 'streak', 'percentile'];

const CATEGORY_CONFIG: Record<CategoryType, { title: string; description: string }> = {
    elementle: { title: 'Won In', description: 'Win games in few guesses' },
    streak: { title: 'Streak', description: 'Maintain winning streaks' },
    percentile: { title: 'Top %', description: 'Rank high on leaderboards' }
};

export function AllBadgesModal({ visible, onClose, gameType = 'REGION', initialCategory, brandColor = '#93c54e', playButtonColor = '#7DAAE8' }: AllBadgesModalProps) {
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
            .filter(b => normalizeCategory(b.category) === currentCategory)
            .sort((a, b) => currentCategory === 'percentile'
                ? b.threshold - a.threshold  // Percentile: 50% first → 1% last
                : a.threshold - b.threshold) // Others: ascending
            .map(badge => {
                const userBadge = userBadges.find(ub => ub.badge_id === badge.id);
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
            const centerItem = viewableItems[0];
            if (centerItem && centerItem.index !== null && centerItem.index !== undefined) {
                setFocusedBadgeIndex(centerItem.index);
            }
        }
    }).current;

    const viewabilityConfig = useRef({
        itemVisiblePercentThreshold: 50
    }).current;

    // Scale Won In badges by 1.2x in the carousel
    const getBadgeDisplaySize = (): 'xxl' | 'xxl' => 'xxl';

    const renderItem = ({ item, index }: { item: any; index: number }) => {
        const inputRange = [
            (index - 1) * ITEM_SIZE,
            index * ITEM_SIZE,
            (index + 1) * ITEM_SIZE,
        ];

        const centerScale = currentCategory === 'elementle' ? 1.44 : currentCategory === 'percentile' ? 1.0 : 1.3;
        const scale = scrollX.interpolate({
            inputRange,
            outputRange: [0.7, centerScale, 0.7],
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
            {/* Semi-transparent overlay + slide-up card */}
            <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
                <View style={{
                    height: '80%',
                    backgroundColor: brandColor,
                    borderTopLeftRadius: 24,
                    borderTopRightRadius: 24,
                    overflow: 'hidden',
                }}>
                    {/* Header */}
                    <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, paddingTop: 16, paddingBottom: 6, position: 'relative' }}>
                        <Text style={{ fontSize: 30, fontFamily: 'Nunito-Bold', color: '#FFFFFF', textAlign: 'center' }}>Badges</Text>
                        <TouchableOpacity onPress={onClose} style={{ position: 'absolute', right: 24, padding: 8, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 9999 }}>
                            <X size={22} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>

                    {/* Content Box - lighter green, badges clip at edges */}
                    <View style={{
                        flex: 1,
                        marginHorizontal: 16,
                        marginTop: 8,
                        marginBottom: 8,
                        backgroundColor: 'rgba(255,255,255,0.2)',
                        borderRadius: 20,
                        overflow: 'hidden',
                    }}>

                        {/* Spacer - pushes up arrow away from top edge */}
                        <View style={{ flex: 1 }} />

                        {/* Up Arrow */}
                        <View style={{ alignItems: 'center' }}>
                            <TouchableOpacity
                                onPress={handlePrevCategory}
                                disabled={currentCategoryIndex === 0}
                                style={{ opacity: currentCategoryIndex === 0 ? 0.6 : 1 }}
                            >
                                <View style={{ backgroundColor: currentCategoryIndex === 0 ? 'rgba(255,255,255,0.2)' : brandColor, padding: 8, borderRadius: 9999 }}>
                                    <ChevronUp size={24} color="#FFFFFF" />
                                </View>
                            </TouchableOpacity>
                        </View>

                        {/* Spacer - between up arrow and content */}
                        <View style={{ flex: 1 }} />

                        {/* Middle content group - title + carousel + details */}
                        <View>
                            {/* Category Title */}
                            <View style={{ alignItems: 'center', paddingBottom: 4, paddingHorizontal: 24 }}>
                                <Text style={{ fontSize: 22, fontFamily: 'Nunito-Bold', color: '#FFFFFF', textAlign: 'center', letterSpacing: 2 }}>
                                    {CATEGORY_CONFIG[currentCategory].title}
                                </Text>
                            </View>

                            {/* Badge Carousel - clips at box edges */}
                            <Animated.View style={{ opacity: fadeOpacity, maxHeight: ITEM_WIDTH * 0.85, justifyContent: 'center' }}>
                                <Animated.FlatList
                                    ref={flatListRef}
                                    data={categoryBadges}
                                    keyExtractor={(item, index) => `${item.badge.id}-${index}`}
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    snapToInterval={ITEM_SIZE}
                                    snapToAlignment="start"
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

                            {/* Details Section */}
                            <View style={{ alignItems: 'center', paddingHorizontal: 24, paddingTop: 4 }}>
                                {focusedBadge ? (
                                    <>
                                        {/* Badge Name */}
                                        <Text style={{ fontSize: 18, fontFamily: 'Nunito-Bold', color: '#FFFFFF', textAlign: 'center', marginBottom: 8, maxWidth: 220 }} numberOfLines={2}>
                                            {focusedBadge.badge?.name || 'Unknown'}
                                        </Text>
                                        {focusedBadge.isEarned ? (
                                            <View style={{ backgroundColor: playButtonColor, borderRadius: 9999, paddingHorizontal: 28, paddingVertical: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 2 }}>
                                                <Text style={{ color: '#FFFFFF', fontFamily: 'Nunito-Bold', fontSize: 19 }}>
                                                    {focusedBadge.userBadge?.badge_count > 1
                                                        ? `Earned x${focusedBadge.userBadge.badge_count}!`
                                                        : 'Earned!'}
                                                </Text>
                                            </View>
                                        ) : (
                                            <View style={{ backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 9999, paddingHorizontal: 28, paddingVertical: 10 }}>
                                                <Text style={{ color: 'rgba(255,255,255,0.7)', fontFamily: 'Nunito-Bold', fontSize: 19 }}>
                                                    Locked
                                                </Text>
                                            </View>
                                        )}
                                    </>
                                ) : (
                                    <Text style={{ color: 'rgba(255,255,255,0.5)' }}>...</Text>
                                )}
                            </View>
                        </View>

                        {/* Spacer - between content and down arrow */}
                        <View style={{ flex: 1 }} />

                        {/* Down Arrow */}
                        <View style={{ alignItems: 'center' }}>
                            <TouchableOpacity
                                onPress={handleNextCategory}
                                disabled={currentCategoryIndex === CATEGORIES.length - 1}
                                style={{ opacity: currentCategoryIndex === CATEGORIES.length - 1 ? 0.6 : 1 }}
                            >
                                <View style={{ backgroundColor: currentCategoryIndex === CATEGORIES.length - 1 ? 'rgba(255,255,255,0.2)' : brandColor, padding: 8, borderRadius: 9999 }}>
                                    <ChevronDown size={24} color="#FFFFFF" />
                                </View>
                            </TouchableOpacity>
                        </View>

                        {/* Spacer - pushes down arrow away from bottom edge */}
                        <View style={{ flex: 1 }} />
                    </View>

                    {/* Dots Indicator */}
                    <View style={{ alignItems: 'center', paddingBottom: 24, paddingTop: 4 }}>
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            {CATEGORIES.map((_, idx) => (
                                <View
                                    key={idx}
                                    style={{
                                        height: 8,
                                        borderRadius: 4,
                                        width: idx === currentCategoryIndex ? 24 : 8,
                                        backgroundColor: idx === currentCategoryIndex ? '#FFFFFF' : 'rgba(255,255,255,0.4)',
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

