/**
 * Category Selection Screen (for USER mode)
 * 
 * Allows users to select their interest categories for personalized puzzles
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { styled } from 'nativewind';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, Loader2 } from 'lucide-react-native';
import hapticsManager from '../../lib/hapticsManager';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';

const StyledView = styled(View);
const StyledText = styled(Text);
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
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [generating, setGenerating] = useState(false);

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
            }
        } catch (err) {
            console.error('[CategorySelection] Load error:', err);
        } finally {
            setLoading(false);
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

    const handleContinue = async () => {
        if (selectedCategories.length < 3) {
            hapticsManager.error();
            console.log('[CategorySelection] Please select at least 3 categories');
            return;
        }

        setSaving(true);

        try {
            // Step 1: Delete existing preferences
            const { error: deleteError } = await supabase
                .from('user_category_preferences')
                .delete()
                .eq('user_id', user?.id);

            if (deleteError) {
                console.error('[CategorySelection] Error deleting old preferences:', deleteError);
                throw deleteError;
            }

            // Step 2: Insert new preferences
            const preferences = selectedCategories.map(categoryId => ({
                user_id: user?.id,
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

            // Step 3: Call Edge Function to regenerate questions
            setGenerating(true);
            const { data, error: edgeFunctionError } = await supabase.functions.invoke(
                'reset-and-reallocate-user',
                { body: { user_id: user?.id } }
            );

            if (edgeFunctionError) {
                console.error('[CategorySelection] Edge Function error:', edgeFunctionError);
            } else {
                console.log('[CategorySelection] Questions regenerated:', data);
            }

            hapticsManager.success();

            // Navigate back to home
            setTimeout(() => {
                router.replace('/(tabs)');
            }, 1500);

        } catch (err) {
            console.error('[CategorySelection] Error:', err);
            hapticsManager.error();
        } finally {
            setSaving(false);
            setGenerating(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView className="flex-1 bg-white dark:bg-slate-900 items-center justify-center">
                <ActivityIndicator size="large" color="#3b82f6" />
                <StyledText className="text-slate-600 dark:text-slate-400 mt-4">
                    Loading categories...
                </StyledText>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-slate-900">
            <StyledView className="flex-1 px-6">
                <StyledView className="py-6">
                    <StyledText className="text-3xl font-n-bold text-slate-900 dark:text-white mb-2">
                        Choose Your Interests
                    </StyledText>
                    <StyledText className="text-slate-600 dark:text-slate-400 font-n-medium">
                        Select at least 3 categories for personalized puzzles
                    </StyledText>
                </StyledView>

                {/* Categories Grid */}
                <StyledScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                    <StyledView className="flex-row flex-wrap gap-3 pb-6">
                        {categories.map(category => {
                            const isSelected = selectedCategories.includes(category.id);

                            return (
                                <StyledTouchableOpacity
                                    key={category.id}
                                    onPress={() => toggleCategory(category.id)}
                                    className={`
                                        flex-1 min-w-[45%] p-4 rounded-2xl border-2
                                        ${isSelected
                                            ? 'bg-blue-500 border-blue-600 dark:bg-blue-600 dark:border-blue-700'
                                            : 'bg-slate-100 border-slate-200 dark:bg-slate-800 dark:border-slate-700'
                                        }
                                    `}
                                >
                                    <StyledView className="flex-row items-center justify-between mb-2">
                                        <StyledText className={`
                                            text-lg font-n-bold
                                            ${isSelected ? 'text-white' : 'text-slate-900 dark:text-white'}
                                        `}>
                                            {category.name}
                                        </StyledText>
                                        {isSelected && (
                                            <Check size={20} color="white" />
                                        )}
                                    </StyledView>
                                    {category.description && (
                                        <StyledText className={`
                                            text-sm
                                            ${isSelected ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'}
                                        `}>
                                            {category.description}
                                        </StyledText>
                                    )}
                                </StyledTouchableOpacity>
                            );
                        })}
                    </StyledView>
                </StyledScrollView>

                {/* Bottom Action */}
                <StyledView className="py-4 border-t border-slate-200 dark:border-slate-800">
                    <StyledText className="text-sm text-slate-500 dark:text-slate-400 mb-3 text-center">
                        {selectedCategories.length} of {categories.length} selected (minimum 3)
                    </StyledText>

                    <StyledTouchableOpacity
                        onPress={handleContinue}
                        disabled={selectedCategories.length < 3 || saving || generating}
                        className={`
                            py-4 rounded-xl items-center
                            ${selectedCategories.length >= 3 && !saving && !generating
                                ? 'bg-blue-500 dark:bg-blue-600'
                                : 'bg-slate-300 dark:bg-slate-700'
                            }
                        `}
                    >
                        {saving || generating ? (
                            <StyledView className="flex-row items-center">
                                <Loader2 size={20} color="white" className="mr-2" />
                                <StyledText className="text-white font-n-bold text-lg">
                                    {generating ? 'Generating Questions...' : 'Saving...'}
                                </StyledText>
                            </StyledView>
                        ) : (
                            <StyledText className={`
                                font-n-bold text-lg
                                ${selectedCategories.length >= 3 ? 'text-white' : 'text-slate-500 dark:text-slate-400'}
                            `}>
                                Continue
                            </StyledText>
                        )}
                    </StyledTouchableOpacity>
                </StyledView>
            </StyledView>
        </SafeAreaView>
    );
}
