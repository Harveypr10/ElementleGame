/**
 * Category Selection Screen (for USER mode)
 * 
 * Allows users to select their interest categories for personalized puzzles
 */

import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Modal, useColorScheme, useWindowDimensions, LayoutChangeEvent } from 'react-native';
import { Image } from 'expo-image';
import { styled } from 'nativewind';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, Loader2, ChevronLeft } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { hapticsManager } from '../../lib/hapticsManager';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';

import { ThemedText } from '../../components/ThemedText';
import { ThemedView } from '../../components/ThemedView';
import { useThemeColor } from '../../hooks/useThemeColor';

const StyledView = styled(View);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledScrollView = styled(ScrollView);

interface Category {
    id: number;
    name: string;
    description?: string | null;
}

export default function CategorySelectionScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';

    // System colors matches stats.tsx
    const systemBackgroundColor = '#020617'; // slate-950
    const systemSurfaceColor = '#1e293b'; // slate-800

    const [categories, setCategories] = useState<Category[]>([]);
    const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
    const [initialCategories, setInitialCategories] = useState<number[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [hasSyncedFromApi, setHasSyncedFromApi] = useState(false);
    const [welcomeVisible, setWelcomeVisible] = useState(false);

    // Layout and Dimensions Logic
    const { width: windowWidth, height: windowHeight } = useWindowDimensions();
    const isLargeScreen = windowWidth >= 768; // IPad width threshold
    const [contentHeight, setContentHeight] = useState(0);
    const [containerHeight, setContainerHeight] = useState(0);

    // Calculate if content overflows (needs scroll)
    // We add some buffer for safety
    const isScrollable = contentHeight > containerHeight + 20; // 20px buffer

    // Button width logic: Match columns (max-w-3xl = 768px - padding)
    // On large screens, we match the grid width. On small, we fill screen - padding.
    const buttonWidth = isLargeScreen ? 720 : '100%'; // max-3xl approx 768. 720 is safe inner width.
    const surfaceColor = useThemeColor({}, 'surface');
    const backgroundColor = useThemeColor({}, 'background');
    const textColor = useThemeColor({}, 'text');
    const iconColor = useThemeColor({}, 'icon');
    const borderColor = useThemeColor({}, 'border');
    const surfaceHighlight = useThemeColor({}, 'surface');

    // Check for welcome popup (new Pro user)
    useEffect(() => {
        const checkWelcome = async () => {
            try {
                const pending = await AsyncStorage.getItem('streak_saver_upgrade_pending');
                if (pending === 'true') {
                    setWelcomeVisible(true);
                }
            } catch (e) {
                console.error(e);
            }
        };
        checkWelcome();
    }, []);

    const handleCloseWelcome = async () => {
        setWelcomeVisible(false);
        try {
            await AsyncStorage.removeItem('streak_saver_upgrade_pending');
        } catch (e) {
            console.error(e);
        }
    };

    // Fetch categories and user's selections on mount
    useEffect(() => {
        fetchCategories();
        loadUserCategories();
    }, []);

    const fetchCategories = async () => {
        try {
            const { data, error } = await supabase
                .from('categories')
                .select('id, name, description')
                .order('name');

            if (error) {
                console.error('[CategorySelection] Error fetching categories:', error);
            } else if (data) {
                // Filter out "Local History" (id 999)
                const filteredData = data.filter(cat => cat.id !== 999);
                console.log('[CategorySelection] Loaded categories:', filteredData.length);
                setCategories(filteredData);
            }
        } catch (err) {
            console.error('[CategorySelection] Fetch error:', err);
        }
    };

    const loadUserCategories = async () => {
        if (!user) {
            setLoading(false);
            setHasSyncedFromApi(true);
            return;
        }

        try {
            const { data, error } = await supabase
                .from('user_category_preferences')
                .select('category_id')
                .eq('user_id', user.id);

            if (error) {
                console.error('[CategorySelection] Error loading user categories:', error);
            } else if (data) {
                const categoryIds = data.map(p => p.category_id);
                console.log('[CategorySelection] Loaded user selections:', categoryIds);
                setSelectedCategories(categoryIds);
                setInitialCategories(categoryIds); // Store initial state
            }
        } catch (err) {
            console.error('[CategorySelection] Load error:', err);
        } finally {
            setLoading(false);
            setHasSyncedFromApi(true);
        }
    };

    const toggleCategory = (categoryId: number) => {
        hapticsManager.light();
        setSelectedCategories(prev =>
            prev.includes(categoryId)
                ? prev.filter(id => id !== categoryId)
                : [...prev, categoryId]
        );
    };

    // Check if categories have changed from initial selection
    const categoriesHaveChanged = useMemo(() => {
        if (!hasSyncedFromApi) return false;

        // For first-time selection (no initial categories), allow generation
        if (initialCategories.length === 0) return true;

        // Check if sizes differ
        if (selectedCategories.length !== initialCategories.length) return true;

        // Check if all initial categories are still selected
        return !initialCategories.every(catId => selectedCategories.includes(catId));
    }, [selectedCategories, initialCategories, hasSyncedFromApi]);

    // Button enabled only when 3+ categories AND they differ from initial
    const canGenerate = selectedCategories.length >= 3 && categoriesHaveChanged;

    const handleContinue = async () => {
        if (selectedCategories.length < 3) {
            hapticsManager.error();
            console.log('[CategorySelection] Please select at least 3 categories');
            return;
        }

        if (!categoriesHaveChanged) {
            console.log('[CategorySelection] No changes detected');
            return;
        }

        if (!user?.id) {
            console.error('[CategorySelection] No user ID available');
            hapticsManager.error();
            return;
        }

        setSaving(true);

        try {
            // Step 1: Delete existing preferences
            const { error: deleteError } = await supabase
                .from('user_category_preferences')
                .delete()
                .eq('user_id', user.id);

            if (deleteError) {
                console.error('[CategorySelection] Error deleting old preferences:', deleteError);
                throw deleteError;
            }

            // Step 2: Insert new preferences
            const preferences = selectedCategories.map(categoryId => ({
                user_id: user.id,
                category_id: categoryId,
            }));

            const { error: insertError } = await supabase
                .from('user_category_preferences')
                .insert(preferences);

            if (insertError) {
                console.error('[CategorySelection] Error inserting preferences:', insertError);
                throw insertError;
            }

            console.log('[CategorySelection] Categories saved successfully');

            // Step 3: Call Edge Function to reset allocations
            setGenerating(true);
            const { data, error: edgeFunctionError } = await supabase.functions.invoke(
                'reset-and-reallocate-user',
                { body: { user_id: user.id } }
            );

            if (edgeFunctionError) {
                console.error('[CategorySelection] Edge Function error:', edgeFunctionError);
                // Don't throw - navigate anyway
            } else {
                console.log('[CategorySelection] Reset complete:', data);
            }

            hapticsManager.success();

            // Step 4: Get user profile data for params
            const { data: profile } = await supabase
                .from('user_profiles')
                .select('postcode, region')
                .eq('id', user.id)
                .single();

            // Step 5: Navigate to GeneratingQuestionsScreen
            router.push({
                pathname: '/(auth)/generating-questions',
                params: {
                    userId: user.id,
                    postcode: profile?.postcode || '',
                    region: profile?.region || 'UK',
                    regenerationType: 'category_change',
                    selectedCategoryIds: JSON.stringify(selectedCategories)
                }
            });

        } catch (err) {
            console.error('[CategorySelection] Error:', err);
            hapticsManager.error();
            setSaving(false);
            setGenerating(false);
        }
    };

    // Colors moved to top

    const handleExit = async () => {
        try {
            await AsyncStorage.removeItem('streak_saver_upgrade_pending');
        } catch (e) {
            console.error(e);
        }

        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/(tabs)/');
        }
    };

    if (loading) {
        return (
            <ThemedView className="flex-1 items-center justify-center">
                <ActivityIndicator size="large" color="#3b82f6" />
                <ThemedText className="mt-4" size="base" style={{ opacity: 0.6 }}>
                    Loading categories...
                </ThemedText>
            </ThemedView>
        );
    }

    return (
        <ThemedView className="flex-1" style={{ backgroundColor: isDark ? systemBackgroundColor : '#FAFBFC' }}>
            {/* Header with Orange Accent */}
            <StyledView style={{ backgroundColor: '#f97316' }}>
                <SafeAreaView edges={['top']} className="px-5 pb-6">
                    <StyledView className="flex-row items-center justify-between py-2 relative">
                        {/* Back Button - Absolute Left */}
                        <StyledTouchableOpacity
                            onPress={handleExit}
                            className="absolute left-0 top-2 p-2 -ml-2 z-10"
                        >
                            <ChevronLeft size={28} color="#FFFFFF" />
                        </StyledTouchableOpacity>

                        {/* Title - Centered */}
                        <StyledView className="flex-1 items-center px-12">
                            <ThemedText className="font-n-bold font-heading text-center" size={isLargeScreen ? "4xl" : "3xl"} style={{ color: '#FFFFFF', lineHeight: isLargeScreen ? 48 : 32 }}>
                                Select Your{'\n'}Categories
                            </ThemedText>
                            <ThemedText className="font-n-medium text-center mt-1" size={isLargeScreen ? "xl" : "base"} style={{ color: 'rgba(255,255,255,0.8)' }}>
                                Choose at least 3 categories
                            </ThemedText>
                        </StyledView>

                        {/* Hamster Image - Absolute Right */}
                        <StyledView
                            className="absolute"
                            style={{
                                right: isLargeScreen ? 32 : 0, // Double distance (approx, assuming 16 default padding context) 
                                top: isLargeScreen ? '50%' : 0, // Middle vertically if large
                                transform: isLargeScreen ? [{ translateY: -36 }] : [], // Center offset
                            }}
                        >
                            <Image
                                source={require('../../assets/ui/webp_assets/Question-Hamster-v2.webp')}
                                style={{ width: 72, height: 72 }}
                                contentFit="contain"
                                cachePolicy="disk"
                            />
                        </StyledView>
                    </StyledView>
                </SafeAreaView>
            </StyledView>

            {/* Categories Grid - Overlapping Header */}
            <StyledScrollView
                className="flex-1"
                showsVerticalScrollIndicator={false}
                style={{ marginTop: -18 }} // Pull up overlap (reduced from -24 to move down slightly)
                contentContainerStyle={{ paddingBottom: 160 }} // Extra padding for taller button area
                onContentSizeChange={(w, h) => setContentHeight(h)}
                onLayout={(e: LayoutChangeEvent) => setContainerHeight(e.nativeEvent.layout.height)}
            >
                <StyledView className="px-4 w-full max-w-3xl self-center">
                    <StyledView className="flex-row flex-wrap gap-2 pb-6 justify-center">
                        {categories.map(category => {
                            const isSelected = selectedCategories.includes(category.id);
                            // Darker Grey #64748B for selected state
                            const itemBg = isSelected ? '#64748B' : (isDark ? systemSurfaceColor : '#FFFFFF');
                            // No border when unselected
                            const itemBorder = isSelected ? '#64748B' : 'transparent';

                            return (
                                <StyledTouchableOpacity
                                    key={category.id}
                                    onPress={() => toggleCategory(category.id)}
                                    style={{
                                        minHeight: 68, // Increased height (+20%)
                                        borderColor: itemBorder,
                                        backgroundColor: itemBg,
                                        borderWidth: 1, // Keep border width for structure
                                        shadowColor: '#000',
                                        shadowOffset: { width: 0, height: 2 },
                                        shadowOpacity: isSelected || isDark ? 0 : 0.05, // Only shadow on white cards
                                        shadowRadius: 3,
                                        elevation: isSelected || isDark ? 0 : 2,
                                    }}
                                    className={`flex-1 min-w-[44%] px-3 py-3 rounded-xl items-center justify-center`} // Reduced width ~10% via min-w
                                >
                                    <ThemedText
                                        className={`font-n-bold text-center ${isSelected ? 'text-white' : ''}`}
                                        size={isLargeScreen ? "xl" : "sm"}
                                    >
                                        {category.name}
                                    </ThemedText>
                                </StyledTouchableOpacity>
                            );
                        })}
                    </StyledView>
                </StyledView>
            </StyledScrollView>

            {/* Bottom Action Area - Fixed at Bottom */}
            <StyledView className="absolute bottom-0 left-0 right-0 px-6 pb-8 pt-0 border-t border-transparent"
                style={{
                    // Gradient handled by LinearGradient
                }}
            >
                {/* Fade Effect - Conditional & Revised Height */}
                {isScrollable && (
                    <LinearGradient
                        colors={['transparent', isDark ? systemBackgroundColor : '#FAFBFC']}
                        style={{
                            position: 'absolute',
                            top: isLargeScreen ? -30 : -60, // Half height on large screens
                            left: 0,
                            right: 0,
                            bottom: 0
                        }}
                        pointerEvents="none"
                    />
                )}

                <StyledView className="w-full items-center" style={{ paddingHorizontal: 0 }}>
                    {/* Width constrained button wrapper */}
                    <StyledView style={{ width: isLargeScreen ? 696 : '100%', maxWidth: '100%' }}>
                        <StyledTouchableOpacity
                            onPress={handleContinue}
                            disabled={!canGenerate || saving || generating}
                            className={`rounded-full items-center shadow-lg justify-center w-full`}
                            style={{
                                backgroundColor: canGenerate && !saving && !generating ? '#3b82f6' : '#48EDF3', // Blue-500 or Cyan (User request)
                                opacity: 1, // Solid opacity always
                                paddingVertical: 24, // Increased height
                            }}
                        >
                            {saving || generating ? (
                                <StyledView className="items-center">
                                    <StyledView className="flex-row items-center mb-1">
                                        <Loader2 size={24} color="white" className="mr-2" />
                                        <ThemedText className="text-white font-n-bold" size="lg">
                                            {generating ? 'Generating...' : 'Saving...'}
                                        </ThemedText>
                                    </StyledView>
                                    <ThemedText className="text-white font-n-medium opacity-80" size="sm">
                                        Please wait
                                    </ThemedText>
                                </StyledView>
                            ) : (
                                <StyledView className="items-center">
                                    <ThemedText
                                        className="font-n-bold"
                                        size={isLargeScreen ? "2xl" : "lg"}
                                        style={{ color: canGenerate ? '#FFFFFF' : textColor }} // White or Default Text Color
                                    >
                                        {initialCategories.length === 0 ? 'Generate' : 'Re-Generate'}
                                    </ThemedText>
                                    <ThemedText
                                        className="font-n-medium opacity-90 mt-0.5"
                                        size={isLargeScreen ? "base" : "sm"}
                                        style={{ color: canGenerate ? '#FFFFFF' : textColor }} // White or Default Text Color
                                    >
                                        {selectedCategories.length} {selectedCategories.length === 1 ? 'Category' : 'Categories'} Selected
                                    </ThemedText>
                                </StyledView>
                            )}
                        </StyledTouchableOpacity>
                    </StyledView>
                </StyledView>
            </StyledView>

            {/* Welcome Pro Modal */}
            <Modal
                visible={welcomeVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={handleCloseWelcome}
            >
                <View className="flex-1 bg-black/70 justify-center items-center px-6">
                    <StyledView
                        className="rounded-2xl p-6 w-full max-w-sm shadow-2xl"
                        style={{ backgroundColor: surfaceColor }}
                    >
                        <ThemedText className="text-2xl font-n-bold text-center mb-4 text-slate-900" style={{ color: textColor }}>
                            Welcome Pro User!
                        </ThemedText>
                        <ThemedText className="text-center font-n-medium mb-6 opacity-80" size="base">
                            Now you're a Pro user you can select the categories for your personalised questions. Hammie the hamster will then generate new puzzles for you, adding limitless questions to the archive whenever you run low. Enjoy!
                        </ThemedText>
                        <StyledTouchableOpacity
                            onPress={handleCloseWelcome}
                            className="bg-black active:bg-slate-800 rounded-2xl py-3"
                        >
                            <ThemedText className="text-white font-n-bold text-center text-lg">
                                Ok
                            </ThemedText>
                        </StyledTouchableOpacity>
                    </StyledView>
                </View>
            </Modal>
        </ThemedView >
    );
}
