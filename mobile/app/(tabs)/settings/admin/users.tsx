/**
 * users.tsx
 * Admin CRM — master-detail split-pane user management screen.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View, Text, Pressable, StyleSheet, ScrollView, TextInput,
    useWindowDimensions, ActivityIndicator, FlatList, Alert, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../../lib/supabase';
import {
    ChevronLeft, Search, RefreshCw, Users as UsersIcon,
    ChevronDown, ChevronRight, Star, Shield, Award, MapPin,
    Settings, Gamepad2, CreditCard, Grid3X3, Pencil, Plus, Tag, ToggleLeft, X,
} from 'lucide-react-native';
import { format } from 'date-fns';

import { useAdminUsers, AdminUser } from '../../../../hooks/useAdminUsers';
import { useAdminUserDetail } from '../../../../hooks/useAdminUserDetail';
import { useAdminMutations, validateNonNegative, validateFutureDate } from '../../../../hooks/useAdminMutations';
import ConfirmModal from '../../../../components/admin/ConfirmModal';

// ════════════════════════════════════════════════════════════════
// Helper components
// ════════════════════════════════════════════════════════════════

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
    return (
        <View style={s.statCard}>
            <Text style={s.statValue}>{value}</Text>
            <Text style={s.statLabel}>{label}</Text>
            {sub ? <Text style={s.statSub}>{sub}</Text> : null}
        </View>
    );
}

function BadgeTag({ text, color }: { text: string; color: string }) {
    return (
        <View style={[s.badge, { backgroundColor: `${color}18` }]}>
            <Text style={[s.badgeText, { color }]}>{text}</Text>
        </View>
    );
}

function SectionHeader({ title, icon: Icon }: { title: string; icon: any }) {
    return (
        <View style={s.sectionHeader}>
            <Icon size={16} color="#64748b" />
            <Text style={s.sectionTitle}>{title}</Text>
        </View>
    );
}

// Dropdown picker
function Picker({ label, value, options, onChange }: {
    label: string; value: string;
    options: { label: string; value: string }[];
    onChange: (v: string) => void;
}) {
    if (Platform.OS === 'web') {
        return (
            <View style={s.pickerWrap}>
                <Text style={s.pickerLabel}>{label}</Text>
                <select
                    value={value}
                    onChange={(e: any) => onChange(e.target.value)}
                    style={{
                        fontFamily: 'Nunito_500Medium, sans-serif', fontSize: 13,
                        padding: '6px 10px', borderRadius: 8,
                        border: '1px solid #e2e8f0', background: '#f8fafc',
                        color: '#334155', outline: 'none', minWidth: 80,
                    }}
                >
                    {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
            </View>
        );
    }
    return (
        <Pressable
            onPress={() => {
                Alert.alert(label, 'Select an option', options.map(o => ({
                    text: o.label,
                    onPress: () => onChange(o.value),
                })).concat([{ text: 'Cancel', onPress: () => { }, style: 'cancel' } as any]));
            }}
            style={s.pickerNative}
        >
            <Text style={s.pickerNativeLabel}>{label}: </Text>
            <Text style={s.pickerNativeValue}>{options.find(o => o.value === value)?.label || '—'}</Text>
            <ChevronDown size={14} color="#64748b" />
        </Pressable>
    );
}

// ════════════════════════════════════════════════════════════════
// Main Screen
// ════════════════════════════════════════════════════════════════

export default function UsersScreen() {
    const router = useRouter();
    const { width } = useWindowDimensions();
    const isWide = width >= 768;

    // ── Data hooks ─────────────────────────────────────────
    const {
        users, loading, error, hasMore, filters, setFilter,
        loadMore, refetch, regions, tierNames, tierTypes, getTierDisplay,
    } = useAdminUsers();

    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const selectedUser = useMemo(() => users.find(u => u.id === selectedUserId) || null, [users, selectedUserId]);

    const detail = useAdminUserDetail(selectedUserId);
    const mutations = useAdminMutations();

    // ── Game mode toggle (persists across user selection) ───
    const [gameMode, setGameMode] = useState<'user' | 'region'>('region');

    // Fetch detail when user selected
    useEffect(() => {
        if (selectedUserId) detail.fetchDetail();
    }, [selectedUserId]);

    // ── Tabs ───────────────────────────────────────────────
    const tabs = ['Games', 'Subs', 'Badges', 'Locations', 'Settings', 'Categories'] as const;
    type Tab = typeof tabs[number];
    const [activeTab, setActiveTab] = useState<Tab>('Games');
    const tabIcons: Record<Tab, any> = {
        Games: Gamepad2, Subs: CreditCard, Badges: Award,
        Locations: MapPin, Settings: Settings, Categories: Tag,
    };

    // ── Derived mode-dependent data ────────────────────────
    const activeStats = gameMode === 'user' ? detail.statsUser : detail.statsRegion;
    const activeGames = gameMode === 'user' ? detail.gameAttemptsUser : detail.gameAttemptsRegion;

    // ── Modal state ────────────────────────────────────────
    const [modal, setModal] = useState<{
        type: 'editStat' | 'awardBadge' | 'assignSub' | 'toggleSetting' | 'editStreakDay' | 'editBadgeCount' | 'editSubExpiry' | 'deactivateSub' | null;
        field?: string;
        label?: string;
        currentValue?: any;
        attemptId?: number;
        badgeId?: number;
        subId?: number;
        gameMode?: 'user' | 'region';
    }>({ type: null });
    const [modalValue, setModalValue] = useState<string>('');
    const [modalError, setModalError] = useState<string | null>(null);
    const [modalLoading, setModalLoading] = useState(false);
    const [selectedBadgeId, setSelectedBadgeId] = useState<number | null>(null);
    const [selectedTierId, setSelectedTierId] = useState<string>('');
    const [subExpiry, setSubExpiry] = useState<string>('');
    const [subAutoRenew, setSubAutoRenew] = useState(false);
    const [expandedAttempt, setExpandedAttempt] = useState<string | null>(null);

    const closeModal = () => {
        setModal({ type: null });
        setModalValue('');
        setModalError(null);
        setModalLoading(false);
        setSelectedBadgeId(null);
        setSelectedTierId('');
        setSubExpiry('');
        setSubAutoRenew(false);
    };

    // ── Modal confirm handlers ─────────────────────────────
    const handleEditStatConfirm = async () => {
        if (!selectedUserId || !modal.field || !modal.label) return;
        const val = parseInt(modalValue, 10);
        const vError = validateNonNegative(val, modal.label);
        if (vError) { setModalError(vError); return; }
        setModalLoading(true);
        const res = await mutations.editStat(selectedUserId, modal.field, modal.currentValue, val, modal.label, gameMode);
        setModalLoading(false);
        if (!res.success) { setModalError(res.error || 'Failed'); return; }
        closeModal();
        detail.refreshStats();
    };

    const handleToggleConfirm = async () => {
        if (!selectedUserId || !modal.field) return;
        setModalLoading(true);
        const res = await mutations.toggleSetting(
            selectedUserId,
            modal.field as 'streak_saver_active' | 'holiday_saver_active',
            modal.currentValue,
        );
        setModalLoading(false);
        if (!res.success) { setModalError(res.error || 'Failed'); return; }
        closeModal();
        detail.refreshSettings();
    };

    const handleAwardBadgeConfirm = async () => {
        if (!selectedUserId || !selectedBadgeId) return;
        const badge = detail.allBadges.find(b => b.id === selectedBadgeId);
        if (!badge) return;
        setModalLoading(true);
        const res = await mutations.awardBadge(selectedUserId, selectedBadgeId, badge.name);
        setModalLoading(false);
        if (!res.success) { setModalError(res.error || 'Failed'); return; }
        closeModal();
        detail.refreshBadges();
    };

    const handleAssignSubConfirm = async () => {
        if (!selectedUserId || !selectedTierId) return;
        const tier = detail.allTiers.find(t => t.id === selectedTierId);
        if (!tier) return;
        const expiresAt = tier.tier_type === 'lifetime' ? null : subExpiry || null;
        if (tier.tier_type !== 'lifetime') {
            const dateErr = validateFutureDate(expiresAt);
            if (dateErr) { setModalError(dateErr); return; }
        }
        setModalLoading(true);
        const billingPeriod = tier.tier_type === 'lifetime' ? 'lifetime' : tier.billing_period;
        const res = await mutations.assignSubscription(
            selectedUserId, selectedTierId, tier.tier, billingPeriod, expiresAt, subAutoRenew,
        );
        setModalLoading(false);
        if (!res.success) { setModalError(res.error || 'Failed'); return; }
        closeModal();
        detail.refreshSubs();
        refetch();
    };

    const handleEditStreakDayConfirm = async () => {
        if (!selectedUserId || !modal.attemptId) return;
        let newVal: number | null = null;
        if (modalValue === '0') newVal = 0;
        else if (modalValue === '1') newVal = 1;
        else if (modalValue.toLowerCase() === 'null' || modalValue === '') newVal = null;
        else { setModalError('Must be NULL, 0, or 1.'); return; }
        setModalLoading(true);
        const res = await mutations.editStreakDayStatus(selectedUserId, modal.attemptId, modal.currentValue, newVal, gameMode);
        setModalLoading(false);
        if (!res.success) { setModalError(res.error || 'Failed'); return; }
        closeModal();
        detail.refreshGames(gameMode);
    };

    // ── Validate modal value on change ─────────────────────
    const onModalValueChange = (text: string) => {
        setModalValue(text);
        if (modal.type === 'editStat') {
            const val = parseInt(text, 10);
            if (isNaN(val)) { setModalError('Must be a number.'); return; }
            const err = validateNonNegative(val, modal.label || 'Value');
            setModalError(err);
        } else if (modal.type === 'editStreakDay') {
            if (text === '' || text.toLowerCase() === 'null' || text === '0' || text === '1') {
                setModalError(null);
            } else {
                setModalError('Must be NULL, 0, or 1.');
            }
        }
    };

    const onSubExpiryChange = (text: string) => {
        setSubExpiry(text);
        const tier = detail.allTiers.find(t => t.id === selectedTierId);
        if (tier?.tier_type !== 'lifetime' && text) {
            setModalError(validateFutureDate(text));
        } else {
            setModalError(null);
        }
    };

    // ══════════════════════════════════════════════════════
    // RENDER: Master List
    // ══════════════════════════════════════════════════════

    const renderUserItem = ({ item }: { item: AdminUser }) => {
        const isSelected = item.id === selectedUserId;
        const tierDisplay = getTierDisplay(item);
        const tierColor = (!item.tier_name || item.tier_name === 'standard') ? '#64748b' : '#9333ea';
        return (
            <Pressable
                onPress={() => { setSelectedUserId(item.id); setActiveTab('Games'); }}
                style={[s.userRow, isSelected && s.userRowSelected]}
            >
                <View style={s.userRowLeft}>
                    <Text style={s.userName} numberOfLines={1}>
                        {item.first_name || ''} {item.last_name || ''}
                    </Text>
                    <Text style={s.userEmail} numberOfLines={1}>{item.email}</Text>
                </View>
                <View style={s.userRowRight}>
                    <BadgeTag text={tierDisplay} color={tierColor} />
                    {item.region ? <Text style={s.userRegion}>{item.region.toUpperCase()}</Text> : null}
                </View>
            </Pressable>
        );
    };

    const masterList = (
        <View style={[s.masterPane, isWide && { flex: 0.4, borderRightWidth: 1, borderRightColor: '#e2e8f0' }]}>
            {/* Header */}
            <View style={s.masterHeader}>
                <Pressable onPress={() => router.back()} style={s.backBtn}>
                    <ChevronLeft size={22} color="#334155" />
                </Pressable>
                <Text style={s.masterTitle}>Users</Text>
                <View style={s.headerRight}>
                    <Pressable onPress={refetch} style={s.iconBtn}>
                        <RefreshCw size={18} color="#64748b" />
                    </Pressable>
                    <View style={s.countBadge}>
                        <Text style={s.countText}>{users.length}</Text>
                    </View>
                </View>
            </View>

            {/* Search */}
            <View style={s.searchRow}>
                <Search size={16} color="#94a3b8" />
                <TextInput
                    style={s.searchInput}
                    placeholder="Search name or email..."
                    placeholderTextColor="#94a3b8"
                    value={filters.search}
                    onChangeText={v => setFilter('search', v)}
                />
            </View>

            {/* Filters */}
            <View style={s.filterRow}>
                <Picker
                    label="Region"
                    value={filters.region}
                    options={[{ label: 'All', value: '' }, ...regions.map(r => ({ label: r.name, value: r.code }))]}
                    onChange={v => setFilter('region', v)}
                />
                <Picker
                    label="Tier"
                    value={filters.tierName}
                    options={[{ label: 'All', value: '' }, ...tierNames.map(t => ({
                        label: t.charAt(0).toUpperCase() + t.slice(1),
                        value: t,
                    }))]}
                    onChange={v => setFilter('tierName', v)}
                />
                <Picker
                    label="Plan"
                    value={filters.tierType}
                    options={[{ label: 'All', value: '' }, ...tierTypes.map(t => ({
                        label: t.charAt(0).toUpperCase() + t.slice(1),
                        value: t,
                    }))]}
                    onChange={v => setFilter('tierType', v)}
                />
            </View>

            {/* List */}
            <FlatList
                data={users}
                keyExtractor={u => u.id}
                renderItem={renderUserItem}
                style={s.userList}
                contentContainerStyle={{ paddingBottom: 80 }}
                ListEmptyComponent={
                    loading ? <ActivityIndicator style={{ marginTop: 32 }} color="#3b82f6" />
                        : <Text style={s.emptyText}>{error || 'No users found.'}</Text>
                }
                onEndReached={() => { if (hasMore && !loading) loadMore(); }}
                onEndReachedThreshold={0.5}
            />
        </View>
    );

    // ══════════════════════════════════════════════════════
    // RENDER: Detail Panel
    // ══════════════════════════════════════════════════════

    const renderDetailContent = () => {
        if (!selectedUser) {
            return (
                <View style={s.emptyDetail}>
                    <UsersIcon size={48} color="#cbd5e1" />
                    <Text style={s.emptyDetailText}>Select a user to view details</Text>
                </View>
            );
        }

        if (detail.loading) {
            return <ActivityIndicator style={{ marginTop: 48 }} size="large" color="#3b82f6" />;
        }

        const stats = activeStats;
        const winPct = stats?.games_played && stats.games_played > 0
            ? Math.round(((stats.games_won || 0) / stats.games_played) * 100) : 0;

        return (
            <ScrollView style={s.detailScroll} contentContainerStyle={s.detailContent}>
                {/* Identity Card */}
                <View style={s.idCard}>
                    <View style={s.idCardRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={s.idName}>{selectedUser.first_name || ''} {selectedUser.last_name || ''}</Text>
                            <Text style={s.idEmail}>{selectedUser.email}</Text>
                        </View>
                        {selectedUser.is_admin && <BadgeTag text="Admin" color="#dc2626" />}
                    </View>
                    <View style={s.idMeta}>
                        <Text style={s.idMetaItem}>Region: {selectedUser.region?.toUpperCase() || '—'}</Text>
                        <Text style={s.idMetaItem}>Tier: {getTierDisplay(selectedUser)}</Text>
                        <Text style={s.idMetaItem}>
                            Expires: {selectedUser.subscription_end_date
                                ? format(new Date(selectedUser.subscription_end_date), 'dd MMM yyyy')
                                : '—'}
                        </Text>
                        <Text style={s.idMetaItem}>Joined: {selectedUser.created_at ? format(new Date(selectedUser.created_at), 'dd MMM yyyy') : '—'}</Text>
                    </View>
                </View>

                {/* Mode Toggle */}
                <View style={s.modeToggleRow}>
                    <Pressable
                        onPress={() => setGameMode('region')}
                        style={[s.modeBtn, gameMode === 'region' && s.modeBtnActive]}
                    >
                        <MapPin size={14} color={gameMode === 'region' ? '#fff' : '#64748b'} />
                        <Text style={[s.modeBtnText, gameMode === 'region' && s.modeBtnTextActive]}>Region Mode</Text>
                    </Pressable>
                    <Pressable
                        onPress={() => setGameMode('user')}
                        style={[s.modeBtn, gameMode === 'user' && s.modeBtnActive]}
                    >
                        <Gamepad2 size={14} color={gameMode === 'user' ? '#fff' : '#64748b'} />
                        <Text style={[s.modeBtnText, gameMode === 'user' && s.modeBtnTextActive]}>User Mode</Text>
                    </Pressable>
                </View>

                {/* Stats Grid */}
                {stats && (
                    <View style={s.statsGrid}>
                        <StatCard label="Played" value={stats.games_played || 0} />
                        <StatCard label="Win %" value={`${winPct}%`} />
                        <StatCard label="Avg Guesses" value={detail.computeAvgGuesses(stats)} sub="per win" />
                        <StatCard label="Streak" value={stats.current_streak || 0} sub={`Max: ${stats.max_streak || 0}`} />
                        <StatCard
                            label="Savers"
                            value={`${stats.streak_savers_used_month}/${detail.tierConfig?.streak_savers ?? '?'}`}
                            sub="this month"
                        />
                        <StatCard
                            label="Holidays"
                            value={`${stats.holidays_used_year}/${detail.tierConfig?.holiday_savers ?? '?'}`}
                            sub={stats.holiday_active ? '🏖 Active' : 'Inactive'}
                        />
                    </View>
                )}

                {/* Tabs */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabBar}>
                    {tabs.map(tab => {
                        const TabIcon = tabIcons[tab];
                        const isActive = tab === activeTab;
                        return (
                            <Pressable
                                key={tab}
                                onPress={() => setActiveTab(tab)}
                                style={[s.tab, isActive && s.tabActive]}
                            >
                                <TabIcon size={14} color={isActive ? '#3b82f6' : '#94a3b8'} />
                                <Text style={[s.tabText, isActive && s.tabTextActive]}>{tab}</Text>
                            </Pressable>
                        );
                    })}
                </ScrollView>

                {/* Tab Content */}
                <View style={s.tabContent}>
                    {activeTab === 'Games' && renderGamesTab()}
                    {activeTab === 'Subs' && renderSubsTab()}
                    {activeTab === 'Badges' && renderBadgesTab()}
                    {activeTab === 'Locations' && renderLocationsTab()}
                    {activeTab === 'Settings' && renderSettingsTab()}
                    {activeTab === 'Categories' && renderCategoriesTab()}
                </View>
            </ScrollView>
        );
    };

    // ── Tab: Games ──────────────────────────────────────────
    const renderGamesTab = () => {
        const games = activeGames;
        const modeLabel = gameMode === 'user' ? 'User' : 'Region';

        return (
            <View>
                <SectionHeader title={`${modeLabel} Mode Games`} icon={Gamepad2} />
                {/* Column Headers */}
                <View style={s.gameHeaderRow}>
                    <Text style={[s.gameHeaderText, { width: 76 }]}>Puzzle</Text>
                    <Text style={[s.gameHeaderText, { width: 76 }]}>Answer</Text>
                    <Text style={[s.gameHeaderText, { width: 26 }]}>D</Text>
                    <Text style={[s.gameHeaderText, { width: 50 }]}>Result</Text>
                    <Text style={[s.gameHeaderText, { width: 24 }]}>G</Text>
                    <Text style={[s.gameHeaderText, { flex: 1 }]}>Category</Text>
                    <Text style={[s.gameHeaderText, { width: 36 }]}>Str</Text>
                    <View style={{ width: 14 }} />
                </View>
                {games.length === 0 ? (
                    <Text style={s.emptyTabText}>No games played in {modeLabel} Mode.</Text>
                ) : (
                    games.map(g => {
                        const key = `${gameMode}_${g.id}`;
                        const isExpanded = expandedAttempt === key;
                        const isWon = g.result === 'won';
                        const streakLabel = g.streak_day_status === 1 ? '●1' : g.streak_day_status === 0 ? '●0' : '●—';
                        return (
                            <View key={g.id}>
                                <Pressable
                                    onPress={() => {
                                        setExpandedAttempt(isExpanded ? null : key);
                                        if (!isExpanded) detail.fetchGuesses(g.id, gameMode);
                                    }}
                                    style={s.gameRow}
                                >
                                    <View style={s.gameMainRow}>
                                        <Text style={s.gamePuzzleDate}>
                                            {g.puzzle_date || '—'}
                                        </Text>
                                        <Text style={s.gameAnswerDate}>
                                            {g.answer_date || '—'}
                                        </Text>
                                        <Text style={s.gameDigits}>{g.digits || '—'}</Text>
                                        <BadgeTag
                                            text={isWon ? '✓ Won' : g.result === 'lost' ? '✗ Lost' : g.result || '—'}
                                            color={isWon ? '#16a34a' : '#dc2626'}
                                        />
                                        <Text style={s.gameGuesses}>{g.num_guesses || 0}</Text>
                                        <Text style={s.gameCategoryName} numberOfLines={1}>{g.category_name || '—'}</Text>
                                        <Pressable
                                            onPress={(e) => {
                                                e.stopPropagation?.();
                                                setModal({
                                                    type: 'editStreakDay',
                                                    attemptId: g.id,
                                                    label: 'Streak Day Status',
                                                    currentValue: g.streak_day_status,
                                                });
                                                setModalValue(g.streak_day_status != null ? String(g.streak_day_status) : '');
                                            }}
                                            style={s.streakDayBtn}
                                        >
                                            <Text style={[s.streakDayText, {
                                                color: g.streak_day_status === 1 ? '#16a34a' : g.streak_day_status === 0 ? '#f59e0b' : '#94a3b8'
                                            }]}>
                                                {streakLabel}
                                            </Text>
                                            <Pencil size={10} color="#94a3b8" />
                                        </Pressable>
                                        <ChevronRight size={14} color="#94a3b8" style={{ transform: [{ rotate: isExpanded ? '90deg' : '0deg' }] }} />
                                    </View>
                                    {g.event_title ? (
                                        <Text style={s.gameEventTitle} numberOfLines={1}>{g.event_title}</Text>
                                    ) : null}
                                </Pressable>
                                {isExpanded && (
                                    <View style={s.guessesWrap}>
                                        {(detail.guesses[key] || []).map((guess, i) => (
                                            <Text key={guess.id} style={s.guessText}>Guess {i + 1}: {guess.guess_value}</Text>
                                        ))}
                                        {!detail.guesses[key] && <ActivityIndicator size="small" color="#3b82f6" />}
                                    </View>
                                )}
                            </View>
                        );
                    })
                )}
            </View>
        );
    };

    // ── Tab: Subscriptions ──────────────────────────────────
    const renderSubsTab = () => (
        <View>
            <View style={s.tabActionRow}>
                <Pressable
                    onPress={() => {
                        setModal({ type: 'assignSub' });
                        if (detail.allTiers.length > 0) {
                            setSelectedTierId(detail.allTiers[0].id);
                            const d = new Date();
                            d.setDate(d.getDate() + 30);
                            setSubExpiry(d.toISOString().split('T')[0]);
                        }
                    }}
                    style={s.actionBtn}
                >
                    <Plus size={14} color="#fff" />
                    <Text style={s.actionBtnText}>Assign Subscription</Text>
                </Pressable>
                <Pressable
                    onPress={() => {
                        const lifetime = detail.allTiers.find(t => t.tier_type === 'lifetime');
                        if (!lifetime) { Alert.alert('Error', 'No lifetime tier configured.'); return; }
                        setModal({ type: 'assignSub' });
                        setSelectedTierId(lifetime.id);
                        setSubExpiry('');
                    }}
                    style={[s.actionBtn, { backgroundColor: '#9333ea' }]}
                >
                    <Star size={14} color="#fff" />
                    <Text style={s.actionBtnText}>Grant Lifetime Pro</Text>
                </Pressable>
            </View>
            {detail.subs.length === 0 ? (
                <Text style={s.emptyTabText}>No subscription history.</Text>
            ) : (
                detail.subs.map(sub => (
                    <View key={sub.id} style={[s.subRow, sub.status === 'active' && { borderLeftWidth: 3, borderLeftColor: '#16a34a' }]}>
                        <View style={s.subRowTop}>
                            <BadgeTag
                                text={sub.status}
                                color={sub.status === 'active' ? '#16a34a' : sub.status === 'expired' ? '#dc2626' : '#f59e0b'}
                            />
                            <Text style={s.subTier}>{sub.tier || '—'} · {sub.billing_period}</Text>
                        </View>
                        <View style={s.subRowMeta}>
                            <Text style={s.subMetaText}>Source: {sub.source || '—'}</Text>
                            <Text style={s.subMetaText}>Expires: {sub.expires_at ? format(new Date(sub.expires_at), 'dd MMM yyyy') : 'Never'}</Text>
                            <Text style={s.subMetaText}>
                                {sub.amount_paid != null ? `${sub.currency.toUpperCase()} ${(sub.amount_paid / 100).toFixed(2)}` : '—'}
                            </Text>
                            <Text style={s.subMetaText}>Auto-renew: {sub.auto_renew ? 'Yes' : 'No'}</Text>
                            <Text style={s.subMetaText}>Created: {format(new Date(sub.created_at), 'dd MMM yyyy')}</Text>
                        </View>
                        {sub.status === 'active' && (
                            <View style={s.subActions}>
                                <Pressable
                                    style={[s.subActionBtn, { backgroundColor: '#3b82f6' }]}
                                    onPress={() => {
                                        setModalValue(sub.expires_at ? sub.expires_at.split('T')[0] : '');
                                        setModalError(null);
                                        setModal({ type: 'editSubExpiry', subId: sub.id, currentValue: sub.expires_at });
                                    }}
                                >
                                    <Pencil size={12} color="#fff" />
                                    <Text style={s.subActionBtnText}>Edit Expiry</Text>
                                </Pressable>
                                <Pressable
                                    style={[s.subActionBtn, { backgroundColor: '#dc2626' }]}
                                    onPress={() => {
                                        setModalError(null);
                                        setModal({ type: 'deactivateSub', subId: sub.id, label: `${sub.tier} · ${sub.billing_period}` });
                                    }}
                                >
                                    <X size={12} color="#fff" />
                                    <Text style={s.subActionBtnText}>Deactivate</Text>
                                </Pressable>
                            </View>
                        )}
                    </View>
                ))
            )}
        </View>
    );

    // ── Tab: Badges ─────────────────────────────────────────
    const renderBadgesTab = () => (
        <View>
            <View style={s.tabActionRow}>
                <Pressable
                    onPress={() => setModal({ type: 'awardBadge' })}
                    style={s.actionBtn}
                >
                    <Plus size={14} color="#fff" />
                    <Text style={s.actionBtnText}>Award Badge</Text>
                </Pressable>
            </View>
            {detail.badges.length === 0 ? (
                <Text style={s.emptyTabText}>No badges.</Text>
            ) : (
                detail.badges.map(b => (
                    <View key={b.id} style={s.badgeRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={s.badgeName}>{b.badge_name || `Badge #${b.badge_id}`}</Text>
                            <Text style={s.badgeCat}>{b.badge_category} · {b.game_type} · {b.region}</Text>
                        </View>
                        <Pressable
                            onPress={() => {
                                setModalValue(String(b.badge_count || 1));
                                setModalError(null);
                                setModal({ type: 'editBadgeCount', badgeId: b.id, label: 'Badge Count', currentValue: b.badge_count });
                            }}
                            style={s.badgeCountChip}
                        >
                            <Text style={s.badgeCountText}>×{b.badge_count || 1}</Text>
                            <Pencil size={10} color="#64748b" />
                        </Pressable>
                        <BadgeTag
                            text={b.is_awarded ? '✓ Earned' : '✗'}
                            color={b.is_awarded ? '#16a34a' : '#dc2626'}
                        />
                        {b.awarded_at && <Text style={s.badgeDate}>{format(new Date(b.awarded_at), 'dd MMM yy')}</Text>}
                    </View>
                ))
            )}
        </View>
    );

    // ── Tab: Locations ──────────────────────────────────────
    const renderLocationsTab = () => (
        <View>
            {detail.locations.length === 0 ? (
                <Text style={s.emptyTabText}>No locations allocated.</Text>
            ) : (
                detail.locations.map(loc => (
                    <View key={loc.id} style={s.locRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={s.locName}>{loc.place_name || loc.location_id}</Text>
                            <Text style={s.locMeta}>
                                Questions: {loc.questions_allocated || 0} · Score: {loc.score}
                            </Text>
                        </View>
                        <BadgeTag
                            text={loc.allocation_active ? 'Active' : 'Inactive'}
                            color={loc.allocation_active ? '#16a34a' : '#94a3b8'}
                        />
                    </View>
                ))
            )}
        </View>
    );

    // ── Tab: Settings ───────────────────────────────────────
    const renderSettingsTab = () => {
        if (!detail.settings) return <Text style={s.emptyTabText}>No settings found.</Text>;
        const st = detail.settings;

        const editableRow = (label: string, field: string, val: boolean) => (
            <View style={s.settingRow} key={field}>
                <Text style={s.settingLabel}>{label}</Text>
                <Pressable
                    onPress={() => setModal({ type: 'toggleSetting', field, label, currentValue: val })}
                    style={[s.settingToggle, val && s.settingToggleOn]}
                >
                    <Text style={[s.settingToggleText, val && { color: '#fff' }]}>{val ? 'ON' : 'OFF'}</Text>
                </Pressable>
            </View>
        );

        const readOnlyRow = (label: string, val: string) => (
            <View style={s.settingRow} key={label}>
                <Text style={s.settingLabel}>{label}</Text>
                <Text style={s.settingValue}>{val}</Text>
            </View>
        );

        const editStatRow = (label: string, field: string, val: number) => (
            <View style={s.settingRow} key={field}>
                <Text style={s.settingLabel}>{label}</Text>
                <Pressable
                    onPress={() => { setModal({ type: 'editStat', field, label, currentValue: val }); setModalValue(String(val)); }}
                    style={s.editBtn}
                >
                    <Text style={s.settingValue}>{val}</Text>
                    <Pencil size={12} color="#64748b" />
                </Pressable>
            </View>
        );

        return (
            <View>
                <SectionHeader title="Editable Settings" icon={Settings} />
                {editableRow('Streak Saver Active', 'streak_saver_active', st.streak_saver_active)}
                {editableRow('Holiday Saver Active', 'holiday_saver_active', st.holiday_saver_active)}

                <View style={{ marginTop: 16 }} />
                <SectionHeader title="Editable Stats" icon={Pencil} />
                {activeStats && (
                    <>
                        {editStatRow('Current Streak', 'current_streak', activeStats.current_streak || 0)}
                        {editStatRow('Streak Savers Used (Month)', 'streak_savers_used_month', activeStats.streak_savers_used_month)}
                        {editStatRow('Holidays Used (Year)', 'holidays_used_year', activeStats.holidays_used_year)}
                    </>
                )}

                <View style={{ marginTop: 16 }} />
                <SectionHeader title="Read-Only" icon={Shield} />
                {readOnlyRow('Dark Mode', st.dark_mode ? 'On' : 'Off')}
                {readOnlyRow('Sounds', st.sounds_enabled ? 'On' : 'Off')}
                {readOnlyRow('Clues', st.clues_enabled ? 'On' : 'Off')}
                {readOnlyRow('Quick Menu', st.quick_menu_enabled ? 'On' : 'Off')}
                {readOnlyRow('Text Size', st.text_size || 'Default')}
                {readOnlyRow('Digit Preference', st.digit_preference || 'Default')}
            </View>
        );
    };

    // ── Tab: Categories ─────────────────────────────────────
    const renderCategoriesTab = () => (
        <View>
            {detail.categories.length === 0 ? (
                <Text style={s.emptyTabText}>No category preferences set.</Text>
            ) : (
                detail.categories.map(c => (
                    <View key={c.id} style={s.catRow}>
                        <Tag size={14} color="#3b82f6" />
                        <Text style={s.catName}>{c.category_name || `Category #${c.category_id}`}</Text>
                    </View>
                ))
            )}
        </View>
    );

    // ══════════════════════════════════════════════════════
    // RENDER: Modals
    // ══════════════════════════════════════════════════════

    const renderModals = () => (
        <>
            {/* Edit Stat Modal */}
            <ConfirmModal
                visible={modal.type === 'editStat'}
                title={`Edit ${modal.label || 'Stat'}`}
                message={`Change "${modal.label}" for ${selectedUser?.email || 'user'}.`}
                validationError={modalError}
                loading={modalLoading}
                onCancel={closeModal}
                onConfirm={handleEditStatConfirm}
            >
                <View style={s.modalInputRow}>
                    <Text style={s.modalInputLabel}>Current: {modal.currentValue}</Text>
                    <TextInput
                        style={s.modalInput}
                        value={modalValue}
                        onChangeText={onModalValueChange}
                        keyboardType="number-pad"
                        placeholder="New value"
                        placeholderTextColor="#94a3b8"
                    />
                </View>
            </ConfirmModal>

            {/* Toggle Setting Modal */}
            <ConfirmModal
                visible={modal.type === 'toggleSetting'}
                title={`Toggle ${modal.label || 'Setting'}`}
                message={`Set "${modal.label}" to ${!modal.currentValue ? 'ON' : 'OFF'} for ${selectedUser?.email || 'user'}?`}
                loading={modalLoading}
                onCancel={closeModal}
                onConfirm={handleToggleConfirm}
            />

            {/* Edit Streak Day Status Modal */}
            <ConfirmModal
                visible={modal.type === 'editStreakDay'}
                title="Edit Streak Day Status"
                message={`Change streak_day_status for game attempt #${modal.attemptId} (${selectedUser?.email || 'user'}).`}
                validationError={modalError}
                loading={modalLoading}
                onCancel={closeModal}
                onConfirm={handleEditStreakDayConfirm}
            >
                <View style={s.modalInputRow}>
                    <Text style={s.modalInputLabel}>
                        Current: {modal.currentValue != null ? modal.currentValue : 'NULL'}
                    </Text>
                    <View style={s.streakDayOptions}>
                        {['', '0', '1'].map(opt => {
                            const label = opt === '' ? 'NULL' : opt;
                            const isActive = modalValue === opt;
                            return (
                                <Pressable
                                    key={opt}
                                    onPress={() => { setModalValue(opt); setModalError(null); }}
                                    style={[s.streakDayOption, isActive && s.streakDayOptionActive]}
                                >
                                    <Text style={[s.streakDayOptionText, isActive && { color: '#3b82f6' }]}>{label}</Text>
                                </Pressable>
                            );
                        })}
                    </View>
                </View>
            </ConfirmModal>

            {/* Award Badge Modal */}
            <ConfirmModal
                visible={modal.type === 'awardBadge'}
                title="Award Badge"
                message={`Award a badge to ${selectedUser?.email || 'user'}.`}
                validationError={modalError}
                loading={modalLoading}
                onCancel={closeModal}
                onConfirm={handleAwardBadgeConfirm}
            >
                <ScrollView style={s.modalPickerWrap}>
                    {detail.allBadges
                        .filter(b => !detail.badges.some(ub => ub.badge_id === b.id && ub.is_awarded))
                        .map(b => (
                            <Pressable
                                key={b.id}
                                onPress={() => { setSelectedBadgeId(b.id); setModalError(null); }}
                                style={[s.badgePickerItem, selectedBadgeId === b.id && s.badgePickerItemSelected]}
                            >
                                <Text style={[s.badgePickerText, selectedBadgeId === b.id && { color: '#3b82f6' }]}>{b.name}</Text>
                                <Text style={s.badgePickerCat}>{b.category}</Text>
                            </Pressable>
                        ))
                    }
                </ScrollView>
            </ConfirmModal>

            {/* Assign Subscription Modal */}
            <ConfirmModal
                visible={modal.type === 'assignSub'}
                title="Assign Subscription"
                message={`Assign subscription to ${selectedUser?.email || 'user'}. This will update their profile and create a subscription history record.`}
                validationError={modalError}
                loading={modalLoading}
                onCancel={closeModal}
                onConfirm={handleAssignSubConfirm}
            >
                <View style={s.modalInputRow}>
                    <Text style={s.modalInputLabel}>Tier:</Text>
                    <ScrollView style={{ maxHeight: 120 }}>
                        {detail.allTiers.map(t => (
                            <Pressable
                                key={t.id}
                                onPress={() => {
                                    setSelectedTierId(t.id);
                                    setModalError(null);
                                    if (t.tier_type === 'lifetime') {
                                        setSubExpiry('');
                                    } else {
                                        const d = new Date();
                                        const months = t.billing_period === 'monthly' ? 1 : t.billing_period === 'quarterly' ? 3 : 12;
                                        d.setMonth(d.getMonth() + months);
                                        setSubExpiry(d.toISOString().split('T')[0]);
                                    }
                                }}
                                style={[s.tierPickerItem, selectedTierId === t.id && s.tierPickerItemSelected]}
                            >
                                <Text style={[s.tierPickerText, selectedTierId === t.id && { color: '#3b82f6', fontFamily: 'Nunito_700Bold' }]}>
                                    {t.tier_type === 'lifetime'
                                        ? `⭐ ${t.tier.charAt(0).toUpperCase() + t.tier.slice(1)} · Lifetime`
                                        : `${t.tier.charAt(0).toUpperCase() + t.tier.slice(1)} · ${t.tier_type.charAt(0).toUpperCase() + t.tier_type.slice(1)}`
                                    }
                                </Text>
                            </Pressable>
                        ))}
                    </ScrollView>
                </View>
                {detail.allTiers.find(t => t.id === selectedTierId)?.tier_type !== 'lifetime' && (
                    <View style={s.modalInputRow}>
                        <Text style={s.modalInputLabel}>Expires (YYYY-MM-DD):</Text>
                        <TextInput
                            style={s.modalInput}
                            value={subExpiry}
                            onChangeText={onSubExpiryChange}
                            placeholder="2026-03-26"
                            placeholderTextColor="#94a3b8"
                        />
                    </View>
                )}
            </ConfirmModal>

            {/* Edit Badge Count Modal */}
            <ConfirmModal
                visible={modal.type === 'editBadgeCount'}
                title="Edit Badge Count"
                message={`Update how many times this badge has been earned.`}
                validationError={modalError}
                loading={modalLoading}
                onCancel={closeModal}
                onConfirm={async () => {
                    if (!selectedUserId || !modal.badgeId) return;
                    const newCount = parseInt(modalValue, 10);
                    if (isNaN(newCount) || newCount < 0) { setModalError('Enter a valid number (0+)'); return; }
                    setModalLoading(true);
                    const { error } = await supabase
                        .from('user_badges')
                        .update({ badge_count: newCount })
                        .eq('id', modal.badgeId);
                    setModalLoading(false);
                    if (error) { setModalError(error.message); return; }
                    closeModal();
                    detail.refreshBadges();
                }}
            >
                <View style={s.modalInputRow}>
                    <Text style={s.modalInputLabel}>Count:</Text>
                    <TextInput
                        style={s.modalInput}
                        value={modalValue}
                        onChangeText={setModalValue}
                        keyboardType="numeric"
                        placeholder="1"
                        placeholderTextColor="#94a3b8"
                    />
                </View>
            </ConfirmModal>

            {/* Edit Subscription Expiry Modal */}
            <ConfirmModal
                visible={modal.type === 'editSubExpiry'}
                title="Edit Expiry Date"
                message="Update the expiry date for this subscription."
                validationError={modalError}
                loading={modalLoading}
                onCancel={closeModal}
                onConfirm={async () => {
                    if (!selectedUserId || !modal.subId) return;
                    if (!modalValue) { setModalError('Enter a date (YYYY-MM-DD)'); return; }
                    const dateErr = validateFutureDate(modalValue);
                    if (dateErr) { setModalError(dateErr); return; }
                    setModalLoading(true);
                    const { error } = await supabase
                        .from('user_subscriptions')
                        .update({ expires_at: modalValue })
                        .eq('id', modal.subId);
                    setModalLoading(false);
                    if (error) { setModalError(error.message); return; }
                    closeModal();
                    detail.refreshSubs();
                    refetch();
                }}
            >
                <View style={s.modalInputRow}>
                    <Text style={s.modalInputLabel}>Expires (YYYY-MM-DD):</Text>
                    <TextInput
                        style={s.modalInput}
                        value={modalValue}
                        onChangeText={setModalValue}
                        placeholder="2026-06-01"
                        placeholderTextColor="#94a3b8"
                    />
                </View>
            </ConfirmModal>

            {/* Deactivate Subscription Modal */}
            <ConfirmModal
                visible={modal.type === 'deactivateSub'}
                title="Deactivate Subscription"
                message={`Cancel the active subscription (${modal.label || ''}) and revert this user to Standard tier?\n\nThis will set the subscription status to 'canceled' and update the user's profile to the standard tier.`}
                validationError={modalError}
                loading={modalLoading}
                onCancel={closeModal}
                onConfirm={async () => {
                    if (!selectedUserId || !modal.subId) return;
                    setModalLoading(true);
                    // 1. Set subscription status to canceled
                    const { error: subErr } = await supabase
                        .from('user_subscriptions')
                        .update({ status: 'canceled' })
                        .eq('id', modal.subId);
                    if (subErr) { setModalLoading(false); setModalError(subErr.message); return; }
                    // 2. Revert user profile to standard tier
                    const standardTier = detail.allTiers.find(t => t.tier === 'standard');
                    if (standardTier) {
                        const { error: profileErr } = await supabase
                            .from('user_profiles')
                            .update({ user_tier_id: standardTier.id, subscription_end_date: null })
                            .eq('id', selectedUserId);
                        if (profileErr) console.error('[Deactivate] Profile update error:', profileErr);
                    }
                    setModalLoading(false);
                    closeModal();
                    detail.refreshSubs();
                    refetch();
                }}
            />
        </>
    );

    // ══════════════════════════════════════════════════════
    // RENDER: Layout
    // ══════════════════════════════════════════════════════

    if (!isWide && selectedUserId) {
        return (
            <SafeAreaView edges={['top']} style={s.container}>
                <View style={s.mobileDetailHeader}>
                    <Pressable onPress={() => setSelectedUserId(null)} style={s.backBtn}>
                        <ChevronLeft size={22} color="#334155" />
                        <Text style={s.backText}>Users</Text>
                    </Pressable>
                </View>
                {renderDetailContent()}
                {renderModals()}
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView edges={['top']} style={[s.container, isWide && { flexDirection: 'row' }]}>
            {masterList}
            {isWide && (
                <View style={{ flex: 0.6 }}>
                    {renderDetailContent()}
                </View>
            )}
            {renderModals()}
        </SafeAreaView>
    );
}

// ════════════════════════════════════════════════════════════════
// Styles
// ════════════════════════════════════════════════════════════════

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },

    // ── Master ──────────────────────
    masterPane: { flex: 1, backgroundColor: '#fff' },
    masterHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
    masterTitle: { fontFamily: 'Nunito_700Bold', fontSize: 20, color: '#0f172a' },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    backBtn: { flexDirection: 'row', alignItems: 'center', padding: 4 },
    backText: { fontFamily: 'Nunito_600SemiBold', fontSize: 15, color: '#334155', marginLeft: 2 },
    iconBtn: { padding: 6, borderRadius: 8, backgroundColor: '#f1f5f9' },
    countBadge: { backgroundColor: '#eff6ff', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
    countText: { fontFamily: 'Nunito_600SemiBold', fontSize: 12, color: '#3b82f6' },

    searchRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 8, backgroundColor: '#f8fafc', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#e2e8f0' },
    searchInput: { flex: 1, marginLeft: 8, fontFamily: 'Nunito_500Medium', fontSize: 14, color: '#334155', padding: 0 },

    filterRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 8, flexWrap: 'wrap' },
    pickerWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    pickerLabel: { fontFamily: 'Nunito_600SemiBold', fontSize: 12, color: '#64748b' },
    pickerNative: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#e2e8f0' },
    pickerNativeLabel: { fontFamily: 'Nunito_600SemiBold', fontSize: 12, color: '#64748b' },
    pickerNativeValue: { fontFamily: 'Nunito_500Medium', fontSize: 12, color: '#334155' },

    userList: { flex: 1 },
    userRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    userRowSelected: { backgroundColor: '#eff6ff' },
    userRowLeft: { flex: 1 },
    userName: { fontFamily: 'Nunito_600SemiBold', fontSize: 14, color: '#0f172a' },
    userEmail: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: '#64748b', marginTop: 2 },
    userRowRight: { alignItems: 'flex-end', gap: 4 },
    userRegion: { fontFamily: 'Nunito_500Medium', fontSize: 11, color: '#94a3b8' },

    emptyText: { fontFamily: 'Nunito_500Medium', fontSize: 14, color: '#94a3b8', textAlign: 'center', marginTop: 32 },

    // ── Detail ──────────────────────
    emptyDetail: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
    emptyDetailText: { fontFamily: 'Nunito_500Medium', fontSize: 16, color: '#94a3b8', marginTop: 12 },

    mobileDetailHeader: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },

    detailScroll: { flex: 1 },
    detailContent: { padding: 16, paddingBottom: 80 },

    idCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12 },
    idCardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    idName: { fontFamily: 'Nunito_700Bold', fontSize: 18, color: '#0f172a' },
    idEmail: { fontFamily: 'Nunito_400Regular', fontSize: 13, color: '#64748b', marginTop: 2 },
    idMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    idMetaItem: { fontFamily: 'Nunito_500Medium', fontSize: 12, color: '#475569' },

    // ── Mode Toggle ──────────────────
    modeToggleRow: { flexDirection: 'row', gap: 4, marginBottom: 12, backgroundColor: '#f1f5f9', borderRadius: 10, padding: 3 },
    modeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 8 },
    modeBtnActive: { backgroundColor: '#3b82f6' },
    modeBtnText: { fontFamily: 'Nunito_600SemiBold', fontSize: 13, color: '#64748b' },
    modeBtnTextActive: { color: '#fff' },

    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
    statCard: { backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#e2e8f0', minWidth: 90, flex: 1, alignItems: 'center' },
    statValue: { fontFamily: 'Nunito_700Bold', fontSize: 20, color: '#0f172a' },
    statLabel: { fontFamily: 'Nunito_500Medium', fontSize: 11, color: '#64748b', marginTop: 2 },
    statSub: { fontFamily: 'Nunito_400Regular', fontSize: 10, color: '#94a3b8', marginTop: 1 },

    // ── Tabs ──────────────────────
    tabBar: { marginBottom: 12 },
    tab: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 4, backgroundColor: '#f1f5f9' },
    tabActive: { backgroundColor: '#eff6ff' },
    tabText: { fontFamily: 'Nunito_600SemiBold', fontSize: 13, color: '#94a3b8' },
    tabTextActive: { color: '#3b82f6' },
    tabContent: { minHeight: 200 },

    // ── Tab content shared ──────────
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, marginTop: 4 },
    sectionTitle: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 },
    emptyTabText: { fontFamily: 'Nunito_400Regular', fontSize: 13, color: '#94a3b8', marginTop: 8 },

    tabActionRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#3b82f6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
    actionBtnText: { fontFamily: 'Nunito_600SemiBold', fontSize: 13, color: '#fff' },

    // ── Games ──────────────────────
    gameHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingBottom: 4, borderBottomWidth: 2, borderBottomColor: '#e2e8f0' },
    gameHeaderText: { fontFamily: 'Nunito_700Bold', fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 },
    gameRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    gameMainRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    gamePuzzleDate: { fontFamily: 'Nunito_500Medium', fontSize: 11, color: '#475569', width: 76 },
    gameAnswerDate: { fontFamily: 'Nunito_500Medium', fontSize: 11, color: '#475569', width: 76 },
    gameDigits: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: '#0f172a', width: 26 },
    gameGuesses: { fontFamily: 'Nunito_600SemiBold', fontSize: 12, color: '#64748b', width: 24 },
    gameCategoryName: { fontFamily: 'Nunito_400Regular', fontSize: 11, color: '#64748b', flex: 1 },
    gameEventTitle: { fontFamily: 'Nunito_400Regular', fontSize: 11, color: '#94a3b8', marginTop: 2, marginLeft: 0 },
    streakDayBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: '#f8fafc' },
    streakDayText: { fontFamily: 'Nunito_600SemiBold', fontSize: 11 },
    guessesWrap: { backgroundColor: '#f8fafc', padding: 10, borderRadius: 8, marginBottom: 4 },
    guessText: { fontFamily: 'Nunito_500Medium', fontSize: 13, color: '#334155', marginBottom: 2 },

    // ── Subscriptions ──────────────
    subRow: { backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 8 },
    subRowTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
    subTier: { fontFamily: 'Nunito_600SemiBold', fontSize: 13, color: '#334155' },
    subRowMeta: { gap: 2 },
    subMetaText: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: '#64748b' },
    subActions: { flexDirection: 'row' as const, gap: 8, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
    subActionBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
    subActionBtnText: { fontFamily: 'Nunito_600SemiBold', fontSize: 12, color: '#fff' },

    // ── Badges ─────────────────────
    badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    badgeName: { fontFamily: 'Nunito_600SemiBold', fontSize: 14, color: '#0f172a' },
    badgeCat: { fontFamily: 'Nunito_400Regular', fontSize: 11, color: '#94a3b8', marginTop: 2 },
    badgeDate: { fontFamily: 'Nunito_400Regular', fontSize: 11, color: '#94a3b8' },
    badgeCountChip: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: '#f1f5f9', marginRight: 6 },
    badgeCountText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: '#475569' },

    badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    badgeText: { fontFamily: 'Nunito_600SemiBold', fontSize: 11 },

    // ── Locations ──────────────────
    locRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    locName: { fontFamily: 'Nunito_600SemiBold', fontSize: 14, color: '#0f172a' },
    locMeta: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: '#64748b', marginTop: 2 },

    // ── Settings ───────────────────
    settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    settingLabel: { fontFamily: 'Nunito_500Medium', fontSize: 14, color: '#334155' },
    settingValue: { fontFamily: 'Nunito_600SemiBold', fontSize: 14, color: '#0f172a' },
    settingToggle: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, backgroundColor: '#f1f5f9' },
    settingToggleOn: { backgroundColor: '#3b82f6' },
    settingToggleText: { fontFamily: 'Nunito_600SemiBold', fontSize: 12, color: '#64748b' },
    editBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 6, borderRadius: 6, backgroundColor: '#f8fafc' },

    // ── Categories ─────────────────
    catRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    catName: { fontFamily: 'Nunito_600SemiBold', fontSize: 14, color: '#0f172a' },

    // ── Modals ─────────────────────
    modalInputRow: { marginBottom: 10 },
    modalInputLabel: { fontFamily: 'Nunito_600SemiBold', fontSize: 13, color: '#475569', marginBottom: 4 },
    modalInput: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontFamily: 'Nunito_500Medium', fontSize: 14, color: '#0f172a', backgroundColor: '#f8fafc' },

    modalPickerWrap: { maxHeight: 200 },
    badgePickerItem: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, marginBottom: 2 },
    badgePickerItemSelected: { backgroundColor: '#eff6ff' },
    badgePickerText: { fontFamily: 'Nunito_500Medium', fontSize: 13, color: '#334155' },
    badgePickerCat: { fontFamily: 'Nunito_400Regular', fontSize: 11, color: '#94a3b8' },

    tierPickerItem: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, marginBottom: 2 },
    tierPickerItemSelected: { backgroundColor: '#eff6ff' },
    tierPickerText: { fontFamily: 'Nunito_500Medium', fontSize: 13, color: '#334155' },

    // ── Streak Day Status Options ──
    streakDayOptions: { flexDirection: 'row', gap: 8, marginTop: 4 },
    streakDayOption: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
    streakDayOptionActive: { backgroundColor: '#eff6ff', borderColor: '#3b82f6' },
    streakDayOptionText: { fontFamily: 'Nunito_600SemiBold', fontSize: 14, color: '#334155' },
});
