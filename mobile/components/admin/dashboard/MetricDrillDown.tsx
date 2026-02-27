/**
 * MetricDrillDown.tsx
 * Stacked triple-chart drill-down with embedded filters.
 * Fixed: timeframe selector height, end date editing, £ currency.
 */
import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Modal, FlatList, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronDown } from 'lucide-react-native';
import LineMetricChart from './LineMetricChart';
import GuessDistributionChart from './GuessDistributionChart';
import SubscriptionDistributionChart from './SubscriptionDistributionChart';
import {
    MetricKey, METRIC_LABELS, ALL_METRICS,
    type TimeseriesPoint, type DashboardMetrics,
    type TimeframeKey, type GameMode, type Region,
    toDisplayDate, fromDisplayDate,
} from '../../../hooks/useAdminDashboard';

const TIMEFRAMES: { key: TimeframeKey; label: string }[] = [
    { key: '1d', label: '1d' }, { key: '7d', label: '7d' }, { key: '14d', label: '14d' },
    { key: '30d', label: '30d' }, { key: '60d', label: '60d' }, { key: '90d', label: '90d' },
    { key: '6m', label: '6m' }, { key: '12m', label: '12m' }, { key: '2y', label: '2y' },
    { key: 'all', label: 'All' },
];

const GAME_MODES: { key: GameMode; label: string }[] = [
    { key: 'all', label: 'All' }, { key: 'region', label: 'Region' }, { key: 'user', label: 'User' },
];

interface MetricDrillDownProps {
    activeMetric: MetricKey;
    timeseries: { daily: TimeseriesPoint[]; weekly: TimeseriesPoint[]; monthly: TimeseriesPoint[] };
    timeseriesLoading: boolean;
    metrics: DashboardMetrics | null;
    onSelectMetric: (metric: MetricKey | null) => void;
    onBack: () => void;
    startDate: string; endDate: string;
    timeframe: TimeframeKey; region: string; regions: Region[]; gameMode: GameMode;
    changeTimeframe: (tf: TimeframeKey) => void;
    setStartDate: (d: string) => void;
    setEndDate: (d: string) => void;
    changeRegion: (code: string) => void;
    changeGameMode: (mode: GameMode) => void;
}

const METRIC_COLORS: Record<MetricKey, string> = {
    signups: '#2563eb', games_played: '#10b981', unique_players: '#8b5cf6',
    guests_played: '#6366f1', ads_watched: '#f59e0b', pro_signups: '#ec4899',
    sub_revenue: '#059669', total_revenue: '#dc2626', avg_guesses: '#0891b2',
    badges_awarded: '#f59e0b',
};

export default function MetricDrillDown({
    activeMetric, timeseries, timeseriesLoading, metrics,
    onSelectMetric, onBack, startDate, endDate,
    timeframe, region, regions, gameMode,
    changeTimeframe, setStartDate, setEndDate, changeRegion, changeGameMode,
}: MetricDrillDownProps) {
    const color = METRIC_COLORS[activeMetric] || '#2563eb';
    const isCurrency = ['sub_revenue', 'total_revenue'].includes(activeMetric);

    const [showRegionPicker, setShowRegionPicker] = useState(false);
    const [editingField, setEditingField] = useState<'start' | 'end' | null>(null);
    const [dateInput, setDateInput] = useState('');

    const openDateEdit = (field: 'start' | 'end') => {
        setDateInput(toDisplayDate(field === 'start' ? startDate : endDate));
        setEditingField(field);
    };

    const handleDateSubmit = () => {
        if (!editingField) return;
        const ymd = fromDisplayDate(dateInput);
        if (ymd) {
            if (editingField === 'start') setStartDate(ymd);
            else setEndDate(ymd);
        }
        setEditingField(null);
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={onBack} style={styles.backButton}>
                    <ChevronLeft size={24} color="#1e293b" />
                </Pressable>
                <Text style={styles.headerTitle}>Metric Detail</Text>
            </View>

            {/* Metric Picker */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
                style={styles.metricPicker} contentContainerStyle={styles.metricPickerContent}>
                {ALL_METRICS.map(m => (
                    <Pressable key={m} onPress={() => onSelectMetric(m)}
                        style={[styles.metricPill, activeMetric === m && { backgroundColor: METRIC_COLORS[m] || '#2563eb' }]}>
                        <Text style={[styles.metricPillText, activeMetric === m && styles.metricPillTextActive]}>
                            {METRIC_LABELS[m]}
                        </Text>
                    </Pressable>
                ))}
            </ScrollView>

            {/* Timeframe pills — compact horizontal row */}
            <View style={styles.timeframeContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.timeframeRow}>
                    {TIMEFRAMES.map(tf => (
                        <Pressable key={tf.key} onPress={() => changeTimeframe(tf.key)}
                            style={[styles.tfPill, timeframe === tf.key && styles.tfPillActive]}>
                            <Text style={[styles.tfPillText, timeframe === tf.key && styles.tfPillTextActive]}>
                                {tf.label}
                            </Text>
                        </Pressable>
                    ))}
                </ScrollView>
            </View>

            {/* Filters row: dates, game mode, region */}
            <View style={styles.filterRow}>
                <Pressable onPress={() => openDateEdit('start')} style={styles.filterChip}>
                    <Text style={styles.filterChipLabel}>From:</Text>
                    <Text style={styles.filterChipValue}>{toDisplayDate(startDate)}</Text>
                </Pressable>
                <Pressable onPress={() => openDateEdit('end')} style={styles.filterChip}>
                    <Text style={styles.filterChipLabel}>To:</Text>
                    <Text style={styles.filterChipValue}>{toDisplayDate(endDate)}</Text>
                </Pressable>

                <View style={styles.modeRow}>
                    {GAME_MODES.map(gm => (
                        <Pressable key={gm.key} onPress={() => changeGameMode(gm.key)}
                            style={[styles.modePill, gameMode === gm.key && styles.modePillActive]}>
                            <Text style={[styles.modePillText, gameMode === gm.key && styles.modePillTextActive]}>
                                {gm.label}
                            </Text>
                        </Pressable>
                    ))}
                </View>

                <Pressable onPress={() => setShowRegionPicker(true)} style={styles.filterChip}>
                    <Text style={styles.filterChipValue}>
                        {region ? regions.find(r => r.code === region)?.name || region : 'All'}
                    </Text>
                    <ChevronDown size={12} color="#64748b" />
                </Pressable>
            </View>

            {/* Charts */}
            <ScrollView style={styles.chartsScroll} contentContainerStyle={styles.chartsContent}
                showsVerticalScrollIndicator={false}>
                {activeMetric === 'avg_guesses' && metrics?.games.guess_distribution && (
                    <GuessDistributionChart distribution={metrics.games.guess_distribution} />
                )}

                <LineMetricChart title="Daily" data={timeseries.daily} loading={timeseriesLoading}
                    color={color} isCurrency={isCurrency} />
                <LineMetricChart title="Weekly" data={timeseries.weekly} loading={timeseriesLoading}
                    color={color} isCurrency={isCurrency} />
                <LineMetricChart title="Monthly" data={timeseries.monthly} loading={timeseriesLoading}
                    color={color} isCurrency={isCurrency} />

                {(activeMetric === 'pro_signups' || activeMetric === 'sub_revenue') &&
                    metrics?.subscriptions.distribution && (
                        <SubscriptionDistributionChart distribution={metrics.subscriptions.distribution} />
                    )}

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* Date edit modal */}
            <Modal visible={editingField !== null} transparent animationType="fade"
                onRequestClose={() => setEditingField(null)}>
                <Pressable style={styles.modalOverlay} onPress={() => setEditingField(null)}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>
                            {editingField === 'start' ? 'Start Date' : 'End Date'}
                        </Text>
                        <Text style={styles.modalSubtitle}>Format: DD/MM/YYYY</Text>
                        <TextInput style={styles.dateInput} value={dateInput}
                            onChangeText={setDateInput} placeholder="DD/MM/YYYY"
                            keyboardType="numbers-and-punctuation" autoFocus />
                        <Pressable onPress={handleDateSubmit} style={styles.dateSubmit}>
                            <Text style={styles.dateSubmitText}>Apply</Text>
                        </Pressable>
                    </View>
                </Pressable>
            </Modal>

            {/* Region picker modal */}
            <Modal visible={showRegionPicker} transparent animationType="fade"
                onRequestClose={() => setShowRegionPicker(false)}>
                <Pressable style={styles.modalOverlay} onPress={() => setShowRegionPicker(false)}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Select Region</Text>
                        <Pressable onPress={() => { changeRegion(''); setShowRegionPicker(false); }}
                            style={[styles.modalItem, !region && styles.modalItemActive]}>
                            <Text style={[styles.modalItemText, !region && styles.modalItemTextActive]}>All Regions</Text>
                        </Pressable>
                        <FlatList data={regions} keyExtractor={r => r.code}
                            renderItem={({ item }) => (
                                <Pressable onPress={() => { changeRegion(item.code); setShowRegionPicker(false); }}
                                    style={[styles.modalItem, region === item.code && styles.modalItemActive]}>
                                    <Text style={[styles.modalItemText, region === item.code && styles.modalItemTextActive]}>
                                        {item.name}
                                    </Text>
                                </Pressable>
                            )}
                        />
                    </View>
                </Pressable>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
        paddingVertical: 10, gap: 8, borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
    },
    backButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginLeft: -8 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
    metricPicker: { maxHeight: 44, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    metricPickerContent: { paddingHorizontal: 16, paddingVertical: 8, gap: 8, flexDirection: 'row' },
    metricPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f1f5f9' },
    metricPillText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
    metricPillTextActive: { color: '#ffffff' },
    // Compact timeframe container — critical: fixed height, no flex expansion
    timeframeContainer: { height: 40, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    timeframeRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, gap: 5, alignItems: 'center' },
    tfPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: '#f1f5f9' },
    tfPillActive: { backgroundColor: '#1e293b' },
    tfPillText: { fontSize: 11, fontWeight: '600', color: '#64748b' },
    tfPillTextActive: { color: '#ffffff' },
    filterRow: {
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
        paddingVertical: 6, gap: 6, flexWrap: 'wrap',
    },
    filterChip: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#f1f5f9', borderRadius: 10,
    },
    filterChipLabel: { fontSize: 10, color: '#94a3b8' },
    filterChipValue: { fontSize: 11, fontWeight: '600', color: '#475569' },
    modeRow: { flexDirection: 'row', gap: 2 },
    modePill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: '#f1f5f9' },
    modePillActive: { backgroundColor: '#1e293b' },
    modePillText: { fontSize: 11, fontWeight: '600', color: '#64748b' },
    modePillTextActive: { color: '#ffffff' },
    chartsScroll: { flex: 1 },
    chartsContent: { paddingHorizontal: 16, paddingTop: 8 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { backgroundColor: '#ffffff', borderRadius: 20, width: '80%', maxHeight: '60%', padding: 20 },
    modalTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 4 },
    modalSubtitle: { fontSize: 13, color: '#94a3b8', marginBottom: 12 },
    modalItem: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, marginBottom: 4 },
    modalItemActive: { backgroundColor: '#eff6ff' },
    modalItemText: { fontSize: 15, color: '#475569' },
    modalItemTextActive: { color: '#2563eb', fontWeight: '600' },
    dateInput: {
        borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12,
        paddingHorizontal: 16, paddingVertical: 12, fontSize: 16,
        color: '#1e293b', marginBottom: 12,
    },
    dateSubmit: { backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
    dateSubmitText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
});
