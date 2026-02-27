/**
 * dashboard.tsx
 * Performance & Analytics Dashboard — main admin screen.
 * v3: DD/MM/YYYY dates, editable start+end, £ currency, £ icon, game mode pills.
 */
import React, { useState, useCallback } from 'react';
import {
    View, Text, ScrollView, Pressable, ActivityIndicator,
    StyleSheet, Modal, FlatList, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
    ChevronLeft, RefreshCw, Users, Gamepad2,
    TrendingUp, Award, Eye, CreditCard, BarChart3, ChevronDown,
    PoundSterling,
} from 'lucide-react-native';
import {
    useAdminDashboard, type TimeframeKey, type MetricKey, type GameMode,
    toDisplayDate, fromDisplayDate,
} from '../../../../hooks/useAdminDashboard';
import MetricCard from '../../../../components/admin/dashboard/MetricCard';
import MetricDrillDown from '../../../../components/admin/dashboard/MetricDrillDown';
import GuessDistributionChart from '../../../../components/admin/dashboard/GuessDistributionChart';
import SubscriptionDistributionChart from '../../../../components/admin/dashboard/SubscriptionDistributionChart';

// ── Constants ─────────────────────────────────────────────

const TIMEFRAMES: { key: TimeframeKey; label: string }[] = [
    { key: '1d', label: '1d' }, { key: '7d', label: '7d' }, { key: '14d', label: '14d' },
    { key: '30d', label: '30d' }, { key: '60d', label: '60d' }, { key: '90d', label: '90d' },
    { key: '6m', label: '6m' }, { key: '12m', label: '12m' }, { key: '2y', label: '2y' },
    { key: 'all', label: 'All' },
];

const GAME_MODES: { key: GameMode; label: string }[] = [
    { key: 'all', label: 'All' }, { key: 'region', label: 'Region' }, { key: 'user', label: 'User' },
];

// ── Helpers ───────────────────────────────────────────────

function fmtNum(n: number | undefined | null): string {
    if (n == null) return '0';
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n % 1 === 0 ? String(n) : n.toFixed(1);
}

function fmtCurrency(n: number | undefined | null): string {
    if (n == null) return '£0.00';
    return `£${n.toFixed(2)}`;
}

function fmtPct(n: number | undefined | null): string {
    if (n == null) return '0%';
    return `${n.toFixed(1)}%`;
}

// ── Main Component ────────────────────────────────────────

export default function DashboardScreen() {
    const router = useRouter();

    const {
        metrics, timeseries, loading, timeseriesLoading, error,
        activeMetric, timeframe, startDate, endDate, region, regions, gameMode,
        changeTimeframe, setStartDate, setEndDate, changeRegion, changeGameMode,
        selectMetric, refresh,
    } = useAdminDashboard();

    const [showRegionPicker, setShowRegionPicker] = useState(false);
    const [editingField, setEditingField] = useState<'start' | 'end' | null>(null);
    const [dateInput, setDateInput] = useState('');

    const handleMetricPress = useCallback((metric: MetricKey) => {
        selectMetric(metric);
    }, [selectMetric]);

    const handleDrillDownBack = useCallback(() => {
        selectMetric(null);
    }, [selectMetric]);

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

    // ── Drill-down view ───────────────────────────────────
    if (activeMetric) {
        return (
            <View style={styles.root}>
                <SafeAreaView edges={['top']} style={styles.safeArea}>
                    <MetricDrillDown
                        activeMetric={activeMetric}
                        timeseries={timeseries}
                        timeseriesLoading={timeseriesLoading}
                        metrics={metrics}
                        onSelectMetric={selectMetric}
                        onBack={handleDrillDownBack}
                        startDate={startDate} endDate={endDate}
                        timeframe={timeframe} region={region} regions={regions} gameMode={gameMode}
                        changeTimeframe={changeTimeframe}
                        setStartDate={setStartDate} setEndDate={setEndDate}
                        changeRegion={changeRegion} changeGameMode={changeGameMode}
                    />
                </SafeAreaView>
            </View>
        );
    }

    const m = metrics;

    return (
        <View style={styles.root}>
            <SafeAreaView edges={['top']} style={styles.safeArea}>
                {/* Header */}
                <View style={styles.header}>
                    <Pressable onPress={() => router.back()} style={styles.backButton}>
                        <ChevronLeft size={28} color="#1e293b" />
                    </Pressable>
                    <Text style={styles.headerTitle}>Performance</Text>
                    <Pressable onPress={refresh} style={styles.refreshButton}>
                        <RefreshCw size={20} color="#64748b" />
                    </Pressable>
                </View>

                {/* Filters */}
                <View style={styles.filtersContainer}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.timeframeRow}>
                        {TIMEFRAMES.map(tf => (
                            <Pressable key={tf.key} onPress={() => changeTimeframe(tf.key)}
                                style={[styles.timeframePill, timeframe === tf.key && styles.timeframePillActive]}>
                                <Text style={[styles.timeframePillText, timeframe === tf.key && styles.timeframePillTextActive]}>
                                    {tf.label}
                                </Text>
                            </Pressable>
                        ))}
                    </ScrollView>

                    <View style={styles.filterSecondRow}>
                        {/* Tappable dates */}
                        <Pressable onPress={() => openDateEdit('start')} style={styles.dateChip}>
                            <Text style={styles.dateLabel}>From:</Text>
                            <Text style={styles.dateValue}>{toDisplayDate(startDate)}</Text>
                        </Pressable>
                        <Pressable onPress={() => openDateEdit('end')} style={styles.dateChip}>
                            <Text style={styles.dateLabel}>To:</Text>
                            <Text style={styles.dateValue}>{toDisplayDate(endDate)}</Text>
                        </Pressable>

                        {/* Game Mode pills */}
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

                        {/* Region */}
                        <Pressable onPress={() => setShowRegionPicker(true)} style={styles.regionButton}>
                            <Text style={styles.regionButtonText}>
                                {region ? regions.find(r => r.code === region)?.name || region : 'All Regions'}
                            </Text>
                            <ChevronDown size={14} color="#64748b" />
                        </Pressable>
                    </View>
                </View>

                {/* Content */}
                {loading && !m ? (
                    <View style={styles.loadingFull}>
                        <ActivityIndicator size="large" color="#2563eb" />
                        <Text style={styles.loadingText}>Loading dashboard…</Text>
                    </View>
                ) : error ? (
                    <View style={styles.errorContainer}>
                        <Text style={styles.errorText}>{error}</Text>
                        <Pressable onPress={refresh} style={styles.retryButton}>
                            <Text style={styles.retryButtonText}>Retry</Text>
                        </Pressable>
                    </View>
                ) : m ? (
                    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}>
                        {/* ═══ FINANCIAL ═══ */}
                        <Text style={styles.sectionTitle}>💰 Financial</Text>
                        <View style={styles.cardRow}>
                            <MetricCard title="Total Revenue" value={fmtCurrency(m.financial.total_revenue)}
                                color="#dc2626"
                                split={[
                                    { label: 'Subscriptions', value: fmtCurrency(m.financial.sub_revenue) },
                                    { label: 'Ads (est.)', value: fmtCurrency(m.financial.ad_revenue) },
                                ]}
                                onPress={() => handleMetricPress('total_revenue')}
                                icon={<PoundSterling size={14} color="#dc2626" />} />
                            <MetricCard title="MRR" value={fmtCurrency(m.financial.mrr)} color="#059669"
                                subtitle="Active recurring"
                                onPress={() => handleMetricPress('sub_revenue')}
                                icon={<TrendingUp size={14} color="#059669" />} />
                        </View>
                        <View style={styles.cardRow}>
                            <MetricCard title="LTV" value={fmtCurrency(m.financial.ltv)} color="#8b5cf6"
                                subtitle="Per user, all-time"
                                icon={<BarChart3 size={14} color="#8b5cf6" />} />
                            <MetricCard title="Conversion" value={fmtPct(m.financial.conversion_rate)}
                                color="#ec4899" subtitle="Players → Pro"
                                icon={<TrendingUp size={14} color="#ec4899" />} />
                        </View>

                        {/* ═══ PLAYERS ═══ */}
                        <Text style={styles.sectionTitle}>👥 Players</Text>
                        <View style={styles.cardRow}>
                            <MetricCard title="Signups" value={fmtNum(m.players.signups)} color="#2563eb"
                                onPress={() => handleMetricPress('signups')}
                                icon={<Users size={14} color="#2563eb" />} />
                            <MetricCard title="Active Players"
                                value={fmtNum(m.players.unique_users + m.players.unique_guests)}
                                color="#8b5cf6"
                                split={[
                                    { label: 'Registered', value: fmtNum(m.players.unique_users) },
                                    { label: 'Guests', value: fmtNum(m.players.unique_guests) },
                                ]}
                                onPress={() => handleMetricPress('unique_players')}
                                icon={<Users size={14} color="#8b5cf6" />} />
                        </View>

                        {/* ═══ GAMEPLAY ═══ */}
                        <Text style={styles.sectionTitle}>🎮 Gameplay</Text>
                        <View style={styles.cardRow}>
                            <MetricCard title="Games Played" value={fmtNum(m.games.total)} color="#10b981"
                                split={[
                                    { label: 'Region', value: fmtNum(m.games.total_region) },
                                    { label: 'User', value: fmtNum(m.games.total_user) },
                                ]}
                                onPress={() => handleMetricPress('games_played')}
                                icon={<Gamepad2 size={14} color="#10b981" />} />
                            <MetricCard title="Avg Guesses" value={m.games.avg_guesses.toFixed(1)} color="#0891b2"
                                subtitle="Wins only"
                                onPress={() => handleMetricPress('avg_guesses')}
                                icon={<BarChart3 size={14} color="#0891b2" />} />
                        </View>
                        <View style={styles.cardRow}>
                            <MetricCard title="Badges" value={fmtNum(m.games.badges_awarded)} color="#f59e0b"
                                subtitle="Awarded in period"
                                split={m.games.badge_breakdown ? Object.entries(m.games.badge_breakdown).map(
                                    ([k, v]) => ({ label: k, value: fmtNum(v) })
                                ) : undefined}
                                onPress={() => handleMetricPress('badges_awarded')}
                                icon={<Award size={14} color="#f59e0b" />} />
                            <MetricCard title="Ads Watched" value={fmtNum(m.ads.total_watched)} color="#f97316"
                                onPress={() => handleMetricPress('ads_watched')}
                                icon={<Eye size={14} color="#f97316" />} />
                        </View>

                        {/* Inline Guess Distribution */}
                        {m.games.guess_distribution && Object.keys(m.games.guess_distribution).length > 0 && (
                            <GuessDistributionChart distribution={m.games.guess_distribution} />
                        )}

                        {/* ═══ SUBSCRIPTIONS ═══ */}
                        <Text style={styles.sectionTitle}>💎 Subscriptions</Text>
                        <View style={styles.cardRow}>
                            <MetricCard title="Pro Signups" value={fmtNum(m.subscriptions.pro_signups)}
                                color="#ec4899" subtitle="New in period"
                                onPress={() => handleMetricPress('pro_signups')}
                                icon={<CreditCard size={14} color="#ec4899" />} />
                            <MetricCard title="Active Pro" value={fmtNum(m.subscriptions.active_pro)}
                                color="#7c3aed" subtitle="Distinct users"
                                icon={<CreditCard size={14} color="#7c3aed" />} />
                        </View>
                        <View style={styles.cardRow}>
                            <MetricCard title="Auto-Renew" value={fmtPct(m.subscriptions.auto_renew_pct)}
                                color="#0d9488" subtitle="Of active subs"
                                icon={<RefreshCw size={14} color="#0d9488" />} />
                        </View>

                        {m.subscriptions.distribution && Object.keys(m.subscriptions.distribution).length > 0 && (
                            <SubscriptionDistributionChart distribution={m.subscriptions.distribution} />
                        )}

                        <View style={{ height: 40 }} />
                    </ScrollView>
                ) : null}

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

                {/* Region Picker Modal */}
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
                                )} />
                        </View>
                    </Pressable>
                </Modal>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#f8fafc' },
    safeArea: { flex: 1, backgroundColor: '#ffffff' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 10,
        borderBottomWidth: 1, borderBottomColor: '#e2e8f0', backgroundColor: '#ffffff',
    },
    backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginLeft: -8 },
    headerTitle: { fontSize: 20, fontWeight: '700', color: '#1e293b' },
    refreshButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    filtersContainer: { backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingBottom: 10 },
    timeframeRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, gap: 6 },
    timeframePill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#f1f5f9' },
    timeframePillActive: { backgroundColor: '#1e293b' },
    timeframePillText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
    timeframePillTextActive: { color: '#ffffff' },
    filterSecondRow: {
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 6, flexWrap: 'wrap',
    },
    dateChip: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#f1f5f9', borderRadius: 10,
    },
    dateLabel: { fontSize: 11, color: '#94a3b8' },
    dateValue: { fontSize: 12, fontWeight: '600', color: '#475569' },
    modeRow: { flexDirection: 'row', gap: 2 },
    modePill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: '#f1f5f9' },
    modePillActive: { backgroundColor: '#1e293b' },
    modePillText: { fontSize: 11, fontWeight: '600', color: '#64748b' },
    modePillTextActive: { color: '#ffffff' },
    regionButton: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#f1f5f9', borderRadius: 12,
    },
    regionButtonText: { fontSize: 12, fontWeight: '600', color: '#475569' },
    scrollView: { flex: 1, backgroundColor: '#f8fafc' },
    scrollContent: { padding: 16 },
    sectionTitle: {
        fontSize: 13, fontWeight: '700', color: '#475569',
        textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, marginTop: 8,
    },
    cardRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
    loadingFull: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    loadingText: { fontSize: 14, color: '#94a3b8' },
    errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 },
    errorText: { fontSize: 14, color: '#ef4444', textAlign: 'center' },
    retryButton: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#2563eb', borderRadius: 12 },
    retryButtonText: { fontSize: 14, fontWeight: '600', color: '#ffffff' },
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
