/**
 * GuessDistributionChart.tsx
 * Color-coded bar chart: 1-5 = wins at that guess count, X = losses.
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';

interface GuessDistributionChartProps {
    distribution: Record<string, number>;
}

const GUESS_COLORS: Record<string, string> = {
    '1': '#10b981',
    '2': '#22c55e',
    '3': '#84cc16',
    '4': '#eab308',
    '5': '#f97316',
    'X': '#ef4444',
};

export default function GuessDistributionChart({ distribution }: GuessDistributionChartProps) {
    const chartData = useMemo(() => {
        const keys = ['1', '2', '3', '4', '5', 'X'];
        return keys.map(k => ({
            value: distribution[k] || 0,
            label: k,
            frontColor: GUESS_COLORS[k],
            topLabelComponent: () => (
                <Text style={styles.barLabel}>{distribution[k] || 0}</Text>
            ),
        }));
    }, [distribution]);

    const maxValue = useMemo(() => {
        const max = Math.max(...chartData.map(d => d.value));
        return max === 0 ? 10 : Math.ceil(max * 1.15);
    }, [chartData]);

    const totalWins = useMemo(() =>
        ['1', '2', '3', '4', '5'].reduce((sum, k) => sum + (distribution[k] || 0), 0),
        [distribution]
    );

    const totalLosses = distribution['X'] || 0;

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Guess Distribution</Text>
            <Text style={styles.subtitle}>
                {totalWins.toLocaleString()} wins · {totalLosses.toLocaleString()} losses
            </Text>
            <View style={styles.chartWrapper}>
                <BarChart
                    data={chartData}
                    height={160}
                    barWidth={32}
                    spacing={16}
                    maxValue={maxValue}
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
            <Text style={styles.footer}>Guesses to win (X = lost)</Text>
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
    xAxisLabel: { fontSize: 12, fontWeight: '600', color: '#475569' },
    barLabel: { fontSize: 10, fontWeight: '600', color: '#475569', marginBottom: 4 },
    footer: { fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 8 },
});
