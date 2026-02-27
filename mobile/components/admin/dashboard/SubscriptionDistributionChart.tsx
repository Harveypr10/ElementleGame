/**
 * SubscriptionDistributionChart.tsx
 * Bar chart showing distribution of active subscriptions by billing period.
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';

interface SubscriptionDistributionChartProps {
    distribution: Record<string, number>;
}

const PERIOD_COLORS: Record<string, string> = {
    monthly: '#3b82f6',
    month: '#3b82f6',
    quarterly: '#8b5cf6',
    quarter: '#8b5cf6',
    annual: '#10b981',
    year: '#10b981',
    lifetime: '#f59e0b',
};

const PERIOD_LABELS: Record<string, string> = {
    monthly: 'Monthly',
    month: 'Monthly',
    quarterly: 'Quarterly',
    quarter: 'Quarterly',
    annual: 'Annual',
    year: 'Annual',
    lifetime: 'Lifetime',
};

export default function SubscriptionDistributionChart({ distribution }: SubscriptionDistributionChartProps) {
    const { chartData, total } = useMemo(() => {
        const entries = Object.entries(distribution);
        const total = entries.reduce((sum, [_, v]) => sum + v, 0);
        const chartData = entries.map(([key, count]) => ({
            value: count,
            label: PERIOD_LABELS[key] || key,
            frontColor: PERIOD_COLORS[key] || '#94a3b8',
            topLabelComponent: () => (
                <Text style={styles.barLabel}>{count}</Text>
            ),
        }));
        return { chartData, total };
    }, [distribution]);

    if (chartData.length === 0) {
        return (
            <View style={styles.container}>
                <Text style={styles.title}>Subscription Mix</Text>
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No active subscriptions</Text>
                </View>
            </View>
        );
    }

    const maxValue = Math.max(...chartData.map(d => d.value));

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Subscription Mix</Text>
            <Text style={styles.subtitle}>{total} active subscriptions</Text>
            <View style={styles.chartWrapper}>
                <BarChart
                    data={chartData}
                    height={160}
                    barWidth={48}
                    spacing={24}
                    maxValue={maxValue === 0 ? 10 : Math.ceil(maxValue * 1.15)}
                    noOfSections={4}
                    barBorderRadius={6}
                    yAxisColor="#e2e8f0"
                    xAxisColor="#e2e8f0"
                    yAxisTextStyle={styles.axisText}
                    xAxisLabelTextStyle={styles.xAxisLabel}
                    hideRules={false}
                    rulesColor="#f1f5f9"
                    rulesType="dashed"
                    isAnimated
                    animationDuration={500}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    title: {
        fontSize: 14,
        fontWeight: '700',
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 12,
        color: '#94a3b8',
        marginBottom: 12,
    },
    chartWrapper: {
        alignItems: 'center',
        marginLeft: -8,
    },
    axisText: { fontSize: 10, color: '#94a3b8' },
    xAxisLabel: { fontSize: 11, fontWeight: '600', color: '#475569' },
    barLabel: { fontSize: 10, fontWeight: '600', color: '#475569', marginBottom: 4 },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 100,
    },
    emptyText: { fontSize: 14, color: '#94a3b8' },
});
