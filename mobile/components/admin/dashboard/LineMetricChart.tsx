/**
 * LineMetricChart.tsx
 * Reusable line chart with:
 * - Gap-filling: missing dates show as zero
 * - X-axis labels in "DD MMM" format, rotated 270° (vertical, reading bottom-to-top)
 * - Y-axis with sensible intervals (nice numbers)
 * - £ currency support
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { format, parseISO, addDays, addWeeks, addMonths, differenceInDays } from 'date-fns';

interface DataPoint { period: string; value: number }

interface LineMetricChartProps {
    title: string;
    data: DataPoint[];
    loading?: boolean;
    color?: string;
    isCurrency?: boolean;
    height?: number;
}

/** Nice step sizes for y-axis */
function niceStep(range: number, targetSections: number): number {
    if (range <= 0) return 1;
    const rawStep = range / targetSections;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const normalized = rawStep / magnitude;
    let niceNorm: number;
    if (normalized <= 1) niceNorm = 1;
    else if (normalized <= 2) niceNorm = 2;
    else if (normalized <= 5) niceNorm = 5;
    else niceNorm = 10;
    return niceNorm * magnitude;
}

/** Detect granularity from data periods */
function detectGranularity(data: DataPoint[]): 'day' | 'week' | 'month' {
    if (data.length < 2) return 'day';
    try {
        const d1 = parseISO(data[0].period);
        const d2 = parseISO(data[1].period);
        const diff = differenceInDays(d2, d1);
        if (diff >= 25) return 'month';
        if (diff >= 5) return 'week';
    } catch { }
    return 'day';
}

/** Fill gaps so every period has a value (zero if missing) */
function fillGaps(data: DataPoint[], granularity: 'day' | 'week' | 'month'): DataPoint[] {
    if (data.length < 2) return data;

    const valueMap = new Map<string, number>();
    data.forEach(d => valueMap.set(d.period, Number(d.value) || 0));

    const result: DataPoint[] = [];
    const start = parseISO(data[0].period);
    const end = parseISO(data[data.length - 1].period);

    let current = start;
    let safety = 0;
    while (current <= end && safety < 1000) {
        const key = format(current, 'yyyy-MM-dd');
        result.push({ period: key, value: valueMap.get(key) || 0 });

        if (granularity === 'day') current = addDays(current, 1);
        else if (granularity === 'week') current = addWeeks(current, 1);
        else current = addMonths(current, 1);
        safety++;
    }

    return result;
}

const LABEL_HEIGHT = 50;

/** Custom label rendered vertically (270°) and positioned below the x-axis */
function VerticalLabel({ text }: { text: string }) {
    return (
        <View style={vertLabelStyles.outer}>
            <View style={vertLabelStyles.rotator}>
                <Text style={vertLabelStyles.text} numberOfLines={1}>
                    {text}
                </Text>
            </View>
        </View>
    );
}

const vertLabelStyles = StyleSheet.create({
    outer: {
        width: 20,
        height: LABEL_HEIGHT,
        alignItems: 'center',
        overflow: 'visible',
    },
    rotator: {
        position: 'absolute',
        top: 30,
        width: LABEL_HEIGHT,
        height: 14,
        transform: [{ rotate: '-90deg' }, { translateX: -LABEL_HEIGHT / 2 + 7 }, { translateY: LABEL_HEIGHT / 2 - 7 }],
        alignItems: 'center',
        justifyContent: 'center',
    },
    text: {
        fontSize: 8,
        color: '#94a3b8',
        textAlign: 'center',
    },
});

export default function LineMetricChart({
    title, data, loading = false, color = '#2563eb',
    isCurrency = false, height = 200,
}: LineMetricChartProps) {
    // Fill gaps and format labels
    const chartData = useMemo(() => {
        if (!data || data.length === 0) return [];

        const granularity = detectGranularity(data);
        const filled = fillGaps(data, granularity);

        // Show up to ~12-15 labels, evenly spaced
        const maxLabels = Math.min(filled.length, 15);
        const labelEvery = Math.max(1, Math.floor(filled.length / maxLabels));

        return filled.map((d, i) => {
            let formattedLabel = '';
            try {
                const date = parseISO(d.period);
                formattedLabel = format(date, 'd MMM'); // "15 Feb"
            } catch {
                formattedLabel = d.period;
            }

            const showLabel = i % labelEvery === 0 || i === filled.length - 1;

            return {
                value: d.value,
                labelComponent: showLabel
                    ? () => <VerticalLabel text={formattedLabel} />
                    : undefined,
            };
        });
    }, [data]);

    // Nice y-axis
    const { maxVal, sections, stepValue } = useMemo(() => {
        if (chartData.length === 0) return { maxVal: 10, sections: 4, stepValue: 2.5 };
        const dataMax = Math.max(...chartData.map(d => d.value));
        if (dataMax === 0) return { maxVal: 10, sections: 4, stepValue: 2.5 };

        const step = niceStep(dataMax, 4);
        const computedMax = Math.ceil(dataMax / step) * step;
        const finalMax = Math.max(computedMax, step);
        const numSections = Math.round(finalMax / step);

        return { maxVal: finalMax, sections: Math.max(numSections, 2), stepValue: step };
    }, [chartData]);

    const total = useMemo(() => chartData.reduce((sum, d) => sum + d.value, 0), [chartData]);
    const avg = useMemo(() => chartData.length > 0 ? total / chartData.length : 0, [total, chartData]);

    const displayValue = (v: number) => {
        if (isCurrency) return `£${v.toFixed(2)}`;
        if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
        if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
        return v % 1 === 0 ? String(v) : v.toFixed(1);
    };

    if (loading) {
        return (
            <View style={styles.container}>
                <Text style={styles.title}>{title}</Text>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={color} />
                </View>
            </View>
        );
    }

    if (chartData.length === 0) {
        return (
            <View style={styles.container}>
                <Text style={styles.title}>{title}</Text>
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No data for this period</Text>
                </View>
            </View>
        );
    }

    // Spacing between points
    const spacing = chartData.length > 1
        ? Math.max(20, Math.min(50, 280 / chartData.length))
        : 50;

    return (
        <View style={styles.container}>
            <Text style={styles.title}>{title}</Text>
            <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Total</Text>
                    <Text style={[styles.summaryValue, { color }]}>{displayValue(total)}</Text>
                </View>
                <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Avg</Text>
                    <Text style={[styles.summaryValue, { color }]}>{displayValue(avg)}</Text>
                </View>
                <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Points</Text>
                    <Text style={[styles.summaryValue, { color }]}>{chartData.length}</Text>
                </View>
            </View>
            <View style={styles.chartWrapper}>
                <LineChart
                    data={chartData}
                    height={height}
                    width={280}
                    adjustToWidth
                    color={color}
                    thickness={2}
                    startFillColor={`${color}30`}
                    endFillColor={`${color}05`}
                    startOpacity={0.3}
                    endOpacity={0.05}
                    areaChart
                    curved
                    maxValue={maxVal}
                    noOfSections={sections}
                    stepValue={stepValue}
                    yAxisColor="#e2e8f0"
                    xAxisColor="#e2e8f0"
                    yAxisTextStyle={styles.yAxisText}
                    dataPointsColor={color}
                    dataPointsRadius={3}
                    spacing={spacing}
                    hideRules={false}
                    rulesColor="#f1f5f9"
                    rulesType="dashed"
                    yAxisLabelWidth={55}
                    formatYLabel={(label: string) => displayValue(Number(label))}
                    isAnimated
                    animationDuration={600}
                    xAxisLabelsHeight={LABEL_HEIGHT + 10}
                    labelsExtraHeight={LABEL_HEIGHT}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#ffffff', borderRadius: 16, padding: 16,
        marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0',
    },
    title: {
        fontSize: 14, fontWeight: '700', color: '#64748b',
        textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
    },
    summaryRow: { flexDirection: 'row', marginBottom: 12, gap: 16 },
    summaryItem: { flex: 1 },
    summaryLabel: { fontSize: 11, color: '#94a3b8', marginBottom: 2 },
    summaryValue: { fontSize: 16, fontWeight: '700' },
    chartWrapper: { marginLeft: -8 },
    yAxisText: { fontSize: 10, color: '#94a3b8' },
    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 200 },
    emptyContainer: { alignItems: 'center', justifyContent: 'center', minHeight: 200 },
    emptyText: { fontSize: 14, color: '#94a3b8' },
});
