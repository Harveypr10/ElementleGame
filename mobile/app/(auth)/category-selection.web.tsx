/**
 * category-selection.web.tsx
 * Web implementation for Category Selection Screen
 * 
 * Hybrid Design:
 * - Layout Density: Legacy Web (centered 800px white card, 2-column grid)
 * - Component Styling: Mobile App (Dark Slate selected, soft shadows, Nunito fonts)
 * - Generate Button: Cyan/Teal pill (mobile app's action color)
 */

import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { ChevronLeft, Loader2 } from 'lucide-react-native';
import {
    useCategorySelectionLogic,
    getCategorySelectionTheme,
} from '../../hooks/useCategorySelectionLogic';

export default function CategorySelectionWeb() {
    const {
        categories,
        selectedCategories,
        loading,
        saving,
        generating,
        canGenerate,
        isFirstTimeSelection,
        selectedCount,
        toggleCategory,
        handleGenerate,
        handleExit,
    } = useCategorySelectionLogic();

    const isDark = false; // Web uses light mode
    const theme = getCategorySelectionTheme(isDark);

    // Hover states
    const [backHover, setBackHover] = useState(false);
    const [generateHover, setGenerateHover] = useState(false);
    const [hoveredCategoryId, setHoveredCategoryId] = useState<number | null>(null);

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.headerBg} />
                <Text style={styles.loadingText}>Loading categories...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                {/* Centered White Card Container */}
                <View style={styles.card}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Pressable
                            onPress={handleExit}
                            onHoverIn={() => setBackHover(true)}
                            onHoverOut={() => setBackHover(false)}
                            style={[styles.backButton, backHover && styles.backButtonHover]}
                        >
                            <ChevronLeft size={24} color="#475569" />
                            <Text style={styles.backButtonText}>Back</Text>
                        </Pressable>
                    </View>

                    {/* Title Section */}
                    <View style={styles.titleSection}>
                        <Text style={styles.title}>Select Your Categories</Text>
                        <Text style={styles.subtitle}>
                            Choose your favourite subjects so Hammie can personalise your puzzles
                        </Text>
                        <View style={styles.countBadge}>
                            <Text style={styles.countText}>
                                {selectedCount} selected (min 3)
                            </Text>
                        </View>
                    </View>

                    {/* Categories Grid - 2 Column */}
                    <View style={styles.categoriesGrid}>
                        {categories.map((category) => {
                            const isSelected = selectedCategories.includes(category.id);
                            const isHovered = hoveredCategoryId === category.id;

                            return (
                                <Pressable
                                    key={category.id}
                                    onPress={() => toggleCategory(category.id)}
                                    onHoverIn={() => setHoveredCategoryId(category.id)}
                                    onHoverOut={() => setHoveredCategoryId(null)}
                                    style={[
                                        styles.categoryButton,
                                        isSelected && styles.categoryButtonSelected,
                                        !isSelected && isHovered && styles.categoryButtonHover,
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.categoryText,
                                            isSelected && styles.categoryTextSelected,
                                        ]}
                                    >
                                        {category.name}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>

                    {/* Generate Button - Inside Card at Bottom */}
                    <Pressable
                        onPress={handleGenerate}
                        onHoverIn={() => setGenerateHover(true)}
                        onHoverOut={() => setGenerateHover(false)}
                        disabled={!canGenerate || saving || generating}
                        style={[
                            styles.generateButton,
                            canGenerate && styles.generateButtonEnabled,
                            canGenerate && generateHover && styles.generateButtonHover,
                            (!canGenerate || saving || generating) && styles.generateButtonDisabled,
                        ]}
                    >
                        {saving || generating ? (
                            <View style={styles.generatingContent}>
                                <Loader2 size={20} color="#FFFFFF" />
                                <Text style={styles.generateButtonTextEnabled}>
                                    {generating ? 'Generating...' : 'Saving...'}
                                </Text>
                            </View>
                        ) : (
                            <View style={styles.generateContent}>
                                <Text
                                    style={[
                                        styles.generateButtonText,
                                        canGenerate
                                            ? styles.generateButtonTextEnabled
                                            : styles.generateButtonTextDisabled,
                                    ]}
                                >
                                    {isFirstTimeSelection ? 'Generate' : 'Re-Generate'}
                                </Text>
                                <Text
                                    style={[
                                        styles.generateSubtext,
                                        canGenerate
                                            ? styles.generateSubtextEnabled
                                            : styles.generateSubtextDisabled,
                                    ]}
                                >
                                    {selectedCount} {selectedCount === 1 ? 'Category' : 'Categories'} Selected
                                </Text>
                            </View>
                        )}
                    </Pressable>
                </View>
            </ScrollView>
        </View>
    );
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F1F5F9', // Slate-100 background
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        alignItems: 'center',
        paddingTop: 48,
        paddingBottom: 80,
        paddingHorizontal: 24,
        minHeight: '100%' as any,
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh' as any,
    },
    loadingText: {
        fontFamily: 'Nunito_500Medium',
        fontSize: 16,
        color: '#64748b',
        marginTop: 12,
    },

    // Card Container (Legacy Web Layout)
    card: {
        width: '100%',
        maxWidth: 800,
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 32,
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 24,
    },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
        marginLeft: -8,
        borderRadius: 8,
    },
    backButtonHover: {
        backgroundColor: '#F1F5F9',
    },
    backButtonText: {
        fontFamily: 'Nunito_600SemiBold',
        fontSize: 16,
        color: '#475569',
        marginLeft: 4,
    },

    // Title Section
    titleSection: {
        alignItems: 'center',
        marginBottom: 32,
    },
    title: {
        fontFamily: 'Nunito_800ExtraBold',
        fontSize: 32,
        color: '#1e293b',
        textAlign: 'center',
        marginBottom: 12,
    },
    subtitle: {
        fontFamily: 'Nunito_500Medium',
        fontSize: 16,
        color: '#64748B',
        textAlign: 'center',
        maxWidth: 400,
        lineHeight: 24,
        marginBottom: 16,
    },
    countBadge: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    countText: {
        fontFamily: 'Nunito_700Bold',
        fontSize: 14,
        color: '#475569',
    },

    // Categories Grid (2-Column from Legacy)
    categoriesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 32,
    },
    categoryButton: {
        width: 'calc(50% - 6px)' as any, // 2 columns with gap
        paddingVertical: 18,
        paddingHorizontal: 16,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    categoryButtonSelected: {
        backgroundColor: '#475569', // Dark Slate (Mobile skin)
        borderColor: '#475569',
        shadowOpacity: 0,
    },
    categoryButtonHover: {
        backgroundColor: '#F8FAFC',
        borderColor: '#CBD5E1',
        transform: [{ scale: 1.02 }],
    },
    categoryText: {
        fontFamily: 'Nunito_700Bold',
        fontSize: 15,
        color: '#334155',
        textAlign: 'center',
    },
    categoryTextSelected: {
        color: '#FFFFFF',
    },

    // Generate Button (Cyan Pill from Mobile)
    generateButton: {
        width: '100%',
        paddingVertical: 20,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
    },
    generateButtonEnabled: {
        backgroundColor: '#22D3EE', // Cyan-400 (Mobile primary action)
    },
    generateButtonHover: {
        backgroundColor: '#06B6D4', // Cyan-500
        transform: [{ scale: 1.02 }],
    },
    generateButtonDisabled: {
        backgroundColor: '#E2E8F0',
    },
    generateContent: {
        alignItems: 'center',
    },
    generatingContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    generateButtonText: {
        fontFamily: 'Nunito_700Bold',
        fontSize: 18,
    },
    generateButtonTextEnabled: {
        color: '#FFFFFF',
    },
    generateButtonTextDisabled: {
        color: '#94A3B8',
    },
    generateSubtext: {
        fontFamily: 'Nunito_500Medium',
        fontSize: 13,
        marginTop: 4,
    },
    generateSubtextEnabled: {
        color: 'rgba(255,255,255,0.9)',
    },
    generateSubtextDisabled: {
        color: '#94A3B8',
    },
});
