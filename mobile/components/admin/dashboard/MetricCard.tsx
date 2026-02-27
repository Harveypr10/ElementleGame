/**
 * MetricCard.tsx
 * Tappable card displaying a single KPI with an optional split breakdown.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

interface MetricCardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    split?: { label: string; value: string | number }[];
    color?: string;
    icon?: React.ReactNode;
    onPress?: () => void;
    small?: boolean;
}

export default function MetricCard({
    title,
    value,
    subtitle,
    split,
    color = '#1e293b',
    icon,
    onPress,
    small = false,
}: MetricCardProps) {
    return (
        <Pressable
            style={({ pressed }) => [
                styles.container,
                small && styles.containerSmall,
                pressed && styles.pressed,
            ]}
            onPress={onPress}
            disabled={!onPress}
        >
            <View style={styles.header}>
                {icon && <View style={styles.iconContainer}>{icon}</View>}
                <Text style={styles.title} numberOfLines={1}>{title}</Text>
            </View>
            <Text style={[styles.value, { color }]} numberOfLines={1}>
                {value}
            </Text>
            {subtitle && (
                <Text style={styles.subtitle}>{subtitle}</Text>
            )}
            {split && split.length > 0 && (
                <View style={styles.splitContainer}>
                    {split.map((s, i) => (
                        <View key={i} style={styles.splitRow}>
                            <Text style={styles.splitLabel}>{s.label}</Text>
                            <Text style={styles.splitValue}>{s.value}</Text>
                        </View>
                    ))}
                </View>
            )}
            {onPress && (
                <View style={[styles.tapHint, { backgroundColor: `${color}15` }]}>
                    <Text style={[styles.tapHintText, { color }]}>Tap to explore →</Text>
                </View>
            )}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        minWidth: '47%',
        flex: 1,
    },
    containerSmall: {
        minWidth: '30%',
    },
    pressed: {
        opacity: 0.85,
        transform: [{ scale: 0.98 }],
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 6,
    },
    iconContainer: {
        width: 18,
        height: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 11,
        fontWeight: '600',
        color: '#94a3b8',
        textTransform: 'uppercase',
        letterSpacing: 0.3,
        flex: 1,
    },
    value: {
        fontSize: 24,
        fontWeight: '800',
        marginBottom: 2,
    },
    subtitle: {
        fontSize: 11,
        color: '#94a3b8',
        marginBottom: 4,
    },
    splitContainer: {
        marginTop: 6,
        paddingTop: 6,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        gap: 3,
    },
    splitRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    splitLabel: {
        fontSize: 11,
        color: '#94a3b8',
    },
    splitValue: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748b',
    },
    tapHint: {
        marginTop: 8,
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 8,
        alignSelf: 'flex-start',
    },
    tapHintText: {
        fontSize: 10,
        fontWeight: '600',
    },
});
