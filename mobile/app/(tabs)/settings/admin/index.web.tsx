/**
 * index.web.tsx
 * Web implementation for Admin dashboard
 */

import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { ChevronLeft, Shield, Zap, CalendarClock, Layers, ChevronRight } from 'lucide-react-native';
import { useAdminLogic } from '../../../../hooks/useAdminLogic';
import DebugControlPanel from '../../../../components/admin/DebugControlPanel';

// Map icon names to components
const iconMap: Record<string, any> = {
    Shield,
    Zap,
    CalendarClock,
    Layers,
};

export default function AdminDashboardWeb() {
    const {
        isAdmin,
        isLoading,
        menuItems,
        goBack,
        navigateTo,
    } = useAdminLogic();

    // Hover states
    const [backHover, setBackHover] = useState(false);
    const [hoverIndex, setHoverIndex] = useState<number | null>(null);

    if (isLoading || !isAdmin) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3b82f6" />
                <Text style={styles.loadingText}>Loading...</Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
            <View style={styles.contentWrapper}>
                {/* Header */}
                <View style={styles.header}>
                    <Pressable
                        onPress={goBack}
                        onHoverIn={() => setBackHover(true)}
                        onHoverOut={() => setBackHover(false)}
                        style={[styles.backButton, backHover && styles.backButtonHover]}
                    >
                        <ChevronLeft size={24} color="#334155" />
                        <Text style={styles.backButtonText}>Settings</Text>
                    </Pressable>
                    <Text style={styles.title}>Admin Dashboard</Text>
                    <View style={{ width: 80 }} />
                </View>

                {/* Management Tools Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Management Tools</Text>

                    {menuItems.map((item, index) => {
                        const IconComponent = iconMap[item.icon];
                        const isHovered = hoverIndex === index;

                        return (
                            <Pressable
                                key={index}
                                onPress={() => navigateTo(item.route)}
                                onHoverIn={() => setHoverIndex(index)}
                                onHoverOut={() => setHoverIndex(null)}
                                style={[styles.menuItem, isHovered && styles.menuItemHover]}
                            >
                                <View style={[styles.menuIcon, { backgroundColor: `${item.color}20` }]}>
                                    {IconComponent && <IconComponent size={24} color={item.color} />}
                                </View>

                                <View style={styles.menuInfo}>
                                    <Text style={styles.menuTitle}>{item.title}</Text>
                                    <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
                                </View>

                                <ChevronRight size={20} color="#94a3b8" />
                            </Pressable>
                        );
                    })}
                </View>

                {/* Debug Actions Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Debug Actions</Text>
                    <View style={styles.debugCard}>
                        <DebugControlPanel />
                    </View>
                </View>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    scrollContent: {
        alignItems: 'center',
        paddingTop: 40,
        paddingBottom: 80,
        minHeight: '100%' as any,
    },
    contentWrapper: {
        width: '100%',
        maxWidth: 600,
        paddingHorizontal: 16,
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: '#F8FAFC',
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
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
        borderRadius: 8,
    },
    backButtonHover: {
        backgroundColor: '#E2E8F0',
    },
    backButtonText: {
        fontFamily: 'Nunito_600SemiBold',
        color: '#334155',
        fontSize: 16,
        marginLeft: 4,
    },
    title: {
        fontFamily: 'Nunito_700Bold',
        fontSize: 22,
        color: '#0f172a',
    },
    section: {
        marginBottom: 32,
    },
    sectionTitle: {
        fontFamily: 'Nunito_700Bold',
        fontSize: 12,
        color: '#94a3b8',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 12,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
    },
    menuItemHover: {
        borderColor: '#3b82f6',
        shadowOpacity: 0.1,
    },
    menuIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    menuInfo: {
        flex: 1,
    },
    menuTitle: {
        fontFamily: 'Nunito_700Bold',
        fontSize: 16,
        color: '#0f172a',
    },
    menuSubtitle: {
        fontFamily: 'Nunito_500Medium',
        fontSize: 14,
        color: '#64748b',
        marginTop: 2,
    },
    debugCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
});
