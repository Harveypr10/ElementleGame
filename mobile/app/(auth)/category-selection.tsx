/**
 * Category Selection Screen (for USER mode)
 * 
 * Allows users to select their interest categories for personalized puzzles
 */

import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Image } from 'react-native';
import { styled } from 'nativewind';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, Loader2, ChevronLeft } from 'lucide-react-native';
import { hapticsManager } from '../../lib/hapticsManager';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';

import { ThemedText } from '../../components/ThemedText';

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
    const [categories, setCategories] = useState<Category[]>([]);
    const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
    const [initialCategories, setInitialCategories] = useState<number[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [hasSyncedFromApi, setHasSyncedFromApi] = useState(false);

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
                console.log('[CategorySelection] Loaded categories:', data.length);
                setCategories(data);
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

    if (loading) {
        return (
            <SafeAreaView className="flex-1 bg-white dark:bg-slate-900 items-center justify-center">
                <ActivityIndicator size="large" color="#3b82f6" />
                <ThemedText className="text-slate-600 dark:text-slate-400 mt-4" size="base">
                    Loading categories...
                </ThemedText>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-slate-900">
            {/* Back Button */}
            <StyledTouchableOpacity
                onPress={() => router.back()}
                className="absolute left-4 top-12 z-10 w-12 h-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800"
            >
                <ChevronLeft size={28} color="#1e293b" />
            </StyledTouchableOpacity>

            {/* Hamster Image */}
            <StyledView className="absolute right-4 top-8 z-10">
                <Image
                    source={require('../../assets/Question-Hamster-Cutout.png')}
                    style={{ width: 80, height: 80 }}
                    resizeMode="contain"
                />
            </StyledView>

            <StyledView className="flex-1 px-6">
                <StyledView className="py-6 pt-20">
                    <ThemedText className="font-n-bold text-slate-900 dark:text-white mb-2 text-center" size="3xl">
                        Select Your{'\n'}Categories
                    </ThemedText>
                    <ThemedText className="text-slate-600 dark:text-slate-400 font-n-medium text-center" size="base">
                        Choose at least 3 categories
                    </ThemedText>
                </StyledView>

                {/* Categories Grid */}
                <StyledScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                    <StyledView className="flex-row flex-wrap gap-2 pb-6">
                        {categories.map(category => {
                            const isSelected = selectedCategories.includes(category.id);

                            return (
                                <StyledTouchableOpacity
                                    key={category.id}
                                    onPress={() => toggleCategory(category.id)}
                                    style={{ minHeight: 56 }}
                                    className={`
                                        flex-1 min-w-[48%] px-4 py-3 rounded-xl items-center justify-center
                                        ${isSelected
                                            ? 'bg-blue-500 dark:bg-blue-600'
                                            : 'bg-slate-200 dark:bg-slate-700'
                                        }
                                    `}
                                >
                                    <ThemedText className={`
                                        font-n-bold text-center
                                        ${isSelected ? 'text-white' : 'text-slate-700 dark:text-slate-300'}
                                    `} size="sm">
                                        {category.name}
                                    </ThemedText>
                                </StyledTouchableOpacity>
                            );
                        })}
                    </StyledView>
                </StyledScrollView>

                {/* Bottom Action */}
                <StyledView className="py-4">
                    <ThemedText className="text-slate-500 dark:text-slate-400 mb-3 text-center font-n-medium" size="sm">
                        {selectedCategories.length} {selectedCategories.length === 1 ? 'Category' : 'Categories'} Selected
                    </ThemedText>

                    <StyledTouchableOpacity
                        onPress={handleContinue}
                        disabled={!canGenerate || saving || generating}
                        className={`
                            py-4 rounded-full items-center
                            ${canGenerate && !saving && !generating
                                ? 'bg-blue-500 dark:bg-blue-600'
                                : 'bg-slate-300 dark:bg-slate-700'
                            }
                        `}
                    >
                        {saving || generating ? (
                            <StyledView className="flex-row items-center">
                                <Loader2 size={20} color="white" className="mr-2" />
                                <ThemedText className="text-white font-n-bold" size="lg">
                                    {generating ? 'Generating...' : 'Saving...'}
                                </ThemedText>
                            </StyledView>
                        ) : (
                            <ThemedText className={`
                                font-n-bold
                                ${canGenerate ? 'text-white' : 'text-slate-500 dark:text-slate-400'}
                            `} size="lg">
                                {initialCategories.length === 0 ? 'Generate' : 'Re-Generate'}
                            </ThemedText>
                        )}
                    </StyledTouchableOpacity>
                </StyledView>
            </StyledView>
        </SafeAreaView>
    );
}
