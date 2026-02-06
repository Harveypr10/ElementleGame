/**
 * useCategorySelectionLogic.ts
 * Shared logic for Category Selection Screen (Mobile & Web)
 * 
 * Extracted from mobile app's category-selection.tsx
 * Handles: fetching categories, user selections, toggle, min 3 validation, generate flow
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { hapticsManager } from '../lib/hapticsManager';

// Types
export interface Category {
    id: number;
    name: string;
    description?: string | null;
}

export interface CategorySelectionState {
    categories: Category[];
    selectedCategories: number[];
    initialCategories: number[];
    loading: boolean;
    saving: boolean;
    generating: boolean;
    hasSyncedFromApi: boolean;
    welcomeVisible: boolean;
}

// Main Hook
export const useCategorySelectionLogic = () => {
    const router = useRouter();
    const { user } = useAuth();

    // State
    const [categories, setCategories] = useState<Category[]>([]);
    const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
    const [initialCategories, setInitialCategories] = useState<number[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [hasSyncedFromApi, setHasSyncedFromApi] = useState(false);
    const [welcomeVisible, setWelcomeVisible] = useState(false);

    // Check for welcome popup (new Pro user)
    useEffect(() => {
        const checkWelcome = async () => {
            try {
                const pending = await AsyncStorage.getItem('streak_saver_upgrade_pending');
                if (pending === 'true') {
                    setWelcomeVisible(true);
                }
            } catch (e) {
                console.error('[CategorySelection] Welcome check error:', e);
            }
        };
        checkWelcome();
    }, []);

    const handleCloseWelcome = async () => {
        setWelcomeVisible(false);
        try {
            await AsyncStorage.removeItem('streak_saver_upgrade_pending');
        } catch (e) {
            console.error('[CategorySelection] Error clearing welcome flag:', e);
        }
    };

    // Fetch categories from database
    const fetchCategories = useCallback(async () => {
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
    }, []);

    // Load user's saved category preferences
    const loadUserCategories = useCallback(async () => {
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
                setInitialCategories(categoryIds);
            }
        } catch (err) {
            console.error('[CategorySelection] Load error:', err);
        } finally {
            setLoading(false);
            setHasSyncedFromApi(true);
        }
    }, [user]);

    // Initial data fetch
    useEffect(() => {
        fetchCategories();
        loadUserCategories();
    }, [fetchCategories, loadUserCategories]);

    // Toggle category selection
    const toggleCategory = useCallback((categoryId: number) => {
        if (Platform.OS !== 'web') {
            hapticsManager.light();
        }
        setSelectedCategories(prev =>
            prev.includes(categoryId)
                ? prev.filter(id => id !== categoryId)
                : [...prev, categoryId]
        );
    }, []);

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

    // Handle generate/save action
    const handleGenerate = async () => {
        if (selectedCategories.length < 3) {
            if (Platform.OS !== 'web') {
                hapticsManager.error();
            }
            console.log('[CategorySelection] Please select at least 3 categories');
            return;
        }

        if (!categoriesHaveChanged) {
            console.log('[CategorySelection] No changes detected');
            return;
        }

        if (!user?.id) {
            console.error('[CategorySelection] No user ID available');
            if (Platform.OS !== 'web') {
                hapticsManager.error();
            }
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

            if (Platform.OS !== 'web') {
                hapticsManager.success();
            }

            // Step 4: Get user profile data for navigation params
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
            if (Platform.OS !== 'web') {
                hapticsManager.error();
            }
            setSaving(false);
            setGenerating(false);
        }
    };

    // Handle exit/back navigation
    const handleExit = useCallback(async () => {
        try {
            await AsyncStorage.removeItem('streak_saver_upgrade_pending');
        } catch (e) {
            console.error('[CategorySelection] Error clearing welcome flag:', e);
        }

        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/(tabs)/');
        }
    }, [router]);

    // Return all state and handlers
    return {
        // Auth
        user,

        // Data
        categories,
        selectedCategories,
        initialCategories,

        // State
        loading,
        saving,
        generating,
        hasSyncedFromApi,
        welcomeVisible,

        // Computed
        categoriesHaveChanged,
        canGenerate,
        isFirstTimeSelection: initialCategories.length === 0,
        selectedCount: selectedCategories.length,

        // Actions
        toggleCategory,
        handleGenerate,
        handleExit,
        handleCloseWelcome,
    };
};

// Theme helper
export const getCategorySelectionTheme = (isDark: boolean) => {
    return {
        pageBg: isDark ? '#020617' : '#F8FAFC',
        cardBg: isDark ? '#1e293b' : '#FFFFFF',
        headerBg: '#f97316',
        textPrimary: isDark ? '#FFFFFF' : '#1e293b',
        textSecondary: isDark ? '#94A3B8' : '#64748B',
        selectedBg: '#475569', // Dark Slate (user requirement)
        selectedText: '#FFFFFF',
        unselectedBg: isDark ? '#334155' : '#FFFFFF',
        unselectedBorder: isDark ? '#475569' : 'transparent',
        generateEnabled: '#22d3ee', // Cyan-400 (user requirement)
        generateDisabled: isDark ? '#334155' : '#E2E8F0',
        generateTextEnabled: '#FFFFFF',
        generateTextDisabled: isDark ? '#64748B' : '#94A3B8',
    };
};
