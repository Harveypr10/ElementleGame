/**
 * questions.tsx
 * Question Management CMS — 4-tab split-pane layout
 * Tabs: Master Library | Region Tracks | User Tracks | QA Audit
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View, Text, Pressable, ScrollView, TextInput, FlatList,
    StyleSheet, ActivityIndicator, Modal, Platform, useWindowDimensions,
} from 'react-native';
import {
    ChevronLeft, Search, BookOpen, MapPin, User, Shield,
    ChevronRight, ChevronDown, Pencil, Check, X, ArrowUpDown,
    RefreshCw, Gamepad2, Trash2, Calendar, ArrowLeftRight, ShieldOff,
    Eye, EyeOff, ArrowRightLeft,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAdminQuestions, MasterQuestion, SortField } from '../../../../hooks/useAdminQuestions';
import { useAdminAllocations, AllocationRow, UnallocatedRow, TrackMode, StatusFilter } from '../../../../hooks/useAdminAllocations';
import { useAdminQuestionMutations } from '../../../../hooks/useAdminQuestionMutations';
import { supabase } from '../../../../lib/supabase';
import ConfirmModal from '../../../../components/admin/ConfirmModal';

// ─── Constants ────────────────────────────────────────────────

type TabName = 'Master Library' | 'Region Tracks' | 'User Tracks' | 'QA Audit';
const TABS: TabName[] = ['Master Library', 'Region Tracks', 'User Tracks', 'QA Audit'];

const tabIcons: Record<TabName, any> = {
    'Master Library': BookOpen,
    'Region Tracks': MapPin,
    'User Tracks': User,
    'QA Audit': Shield,
};

// ─── Small reusable components ────────────────────────────────

function BadgeTag({ text, color }: { text: string; color: string }) {
    return (
        <View style={[s.badge, { backgroundColor: `${color}18` }]}>
            <Text style={[s.badgeText, { color }]}>{text}</Text>
        </View>
    );
}

function SortableHeader({
    label, field, currentField, currentAsc, onSort, width, flex,
}: {
    label: string; field: SortField; currentField: SortField;
    currentAsc: boolean; onSort: (f: SortField) => void;
    width?: number; flex?: number;
}) {
    const isActive = field === currentField;
    return (
        <Pressable onPress={() => onSort(field)} style={[s.colHeader, width ? { width } : { flex: flex || 1 }]}>
            <Text style={[s.colHeaderText, isActive && s.colHeaderActive]}>{label}</Text>
            {isActive && <ArrowUpDown size={10} color="#3b82f6" />}
        </Pressable>
    );
}

// ─── Main Screen ──────────────────────────────────────────────

export default function QuestionsScreen() {
    const router = useRouter();
    const { width } = useWindowDimensions();
    const isWide = width >= 768;

    // ── Hooks ──
    const master = useAdminQuestions();
    const allocs = useAdminAllocations();
    const mutations = useAdminQuestionMutations();

    // ── State ──
    const [activeTab, setActiveTab] = useState<TabName>('Master Library');
    const [selectedQuestion, setSelectedQuestion] = useState<MasterQuestion | null>(null);
    const [selectedAlloc, setSelectedAlloc] = useState<AllocationRow | null>(null);

    // Modal state
    const [selectedUnalloc, setSelectedUnalloc] = useState<UnallocatedRow | null>(null);

    const [modal, setModal] = useState<{
        type: 'editField' | 'approve' | 'unallocate' | 'redate' | 'swap' | 'block' | 'allocate' | 'move';
        data?: any;
    } | null>(null);
    const [modalValue, setModalValue] = useState('');
    const [modalLoading, setModalLoading] = useState(false);
    const [modalError, setModalError] = useState<string | null>(null);

    // Category name map (id → name)
    const [categoryMap, setCategoryMap] = useState<Record<number, string>>({});

    // Search for user track
    const [userSearch, setUserSearch] = useState('');
    const [userResults, setUserResults] = useState<{ id: string; email: string; first_name: string | null }[]>([]);

    // ── Initial load ──
    useEffect(() => {
        master.refresh();
        // Fetch category names
        supabase.from('categories').select('id, name').then(({ data }) => {
            if (data) {
                const map: Record<number, string> = {};
                data.forEach((c: any) => { map[c.id] = c.name; });
                setCategoryMap(map);
            }
        });
        allocs.fetchRegions();
    }, []);

    // ── Tab change handlers ──
    const handleTabChange = useCallback((tab: TabName) => {
        setActiveTab(tab);
        setSelectedQuestion(null);
        setSelectedAlloc(null);
        setSelectedUnalloc(null);
        // Reset track-specific filters when switching tabs
        allocs.toggleUnallocated(false);
        allocs.changeStatusFilter('all');

        if (tab === 'Master Library') {
            master.toggleQaMode(false);
            master.refresh();
        } else if (tab === 'QA Audit') {
            master.toggleQaMode(true);
        } else if (tab === 'Region Tracks') {
            // Keep current region selection
        } else if (tab === 'User Tracks') {
            // Keep current user selection
        }
    }, [master]);

    // ── User search for User Tracks ──
    const searchUsers = useCallback(async (query: string) => {
        setUserSearch(query);
        if (query.length < 2) { setUserResults([]); return; }
        const { data } = await supabase
            .from('user_profiles')
            .select('id, email, first_name')
            .or(`email.ilike.%${query}%,first_name.ilike.%${query}%`)
            .limit(10);
        if (data) setUserResults(data as any[]);
    }, []);

    // ── Mutation Handlers ──

    const handleEditField = useCallback(async () => {
        if (!modal?.data) return;

        // Resolve the question ID and mode from whichever context is active
        const questionId = modal.data.questionId
            ?? selectedQuestion?.id
            ?? selectedAlloc?.question_id
            ?? selectedUnalloc?.question_id;
        if (!questionId) return;

        const mode = (activeTab === 'User Tracks') ? 'user' as const : 'region' as const;

        setModalLoading(true);
        setModalError(null);

        const { field, oldValue } = modal.data;
        // Cast numeric fields
        const newVal = ['quality_score', 'accuracy_score'].includes(field)
            ? (modalValue ? parseInt(modalValue, 10) : null)
            : modalValue;

        const result = await mutations.editMasterField(
            mode, questionId, field, oldValue, newVal,
        );

        setModalLoading(false);
        if (!result.success) {
            setModalError(result.error || 'Update failed');
            return;
        }

        setModal(null);

        // Refresh the appropriate list and local state
        if (selectedQuestion) {
            master.refresh();
            setSelectedQuestion(prev => prev ? { ...prev, [field]: newVal } : null);
        } else if (selectedAlloc) {
            allocs.refresh();
        } else if (selectedUnalloc) {
            allocs.fetchUnallocatedMasters(0, false);
            setSelectedUnalloc(prev => prev ? { ...prev, [field]: newVal } as any : null);
        }
    }, [modal, selectedQuestion, selectedAlloc, selectedUnalloc, modalValue, mutations, master, allocs, activeTab]);

    const handleApprove = useCallback(async () => {
        if (!selectedQuestion) return;
        setModalLoading(true);
        setModalError(null);

        const result = await mutations.approveQuestion(master.mode, selectedQuestion.id);
        setModalLoading(false);

        if (!result.success) {
            setModalError(result.error || 'Approve failed');
            return;
        }

        setModal(null);
        setSelectedQuestion(null);
        master.refresh();
    }, [selectedQuestion, mutations, master]);

    const handleUnallocate = useCallback(async () => {
        if (!selectedAlloc) return;
        setModalLoading(true);
        setModalError(null);

        const result = await mutations.unallocate(
            allocs.trackMode, selectedAlloc.alloc_id,
            selectedAlloc.puzzle_date, selectedAlloc.question_id,
        );
        setModalLoading(false);

        if (!result.success) {
            setModalError(result.error || 'Unallocate failed');
            return;
        }

        setModal(null);
        setSelectedAlloc(null);
        allocs.refresh();
    }, [selectedAlloc, mutations, allocs]);

    const handleRedate = useCallback(async () => {
        if (!selectedAlloc || !modalValue) return;
        setModalLoading(true);
        setModalError(null);

        const result = await mutations.redateAllocation(
            allocs.trackMode, selectedAlloc.alloc_id,
            selectedAlloc.puzzle_date, modalValue,
        );
        setModalLoading(false);

        if (!result.success) {
            setModalError(result.error || 'Re-date failed');
            return;
        }

        setModal(null);
        setSelectedAlloc(null);
        allocs.refresh();
    }, [selectedAlloc, modalValue, mutations, allocs]);

    const handleSwap = useCallback(async () => {
        if (allocs.selectedForSwap.length !== 2) return;
        setModalLoading(true);
        setModalError(null);

        const [idA, idB] = allocs.selectedForSwap;
        const result = await mutations.swapDates(allocs.trackMode, idA, idB);
        setModalLoading(false);

        if (!result.success) {
            setModalError(result.error || 'Swap failed');
            return;
        }

        setModal(null);
        allocs.clearSwapSelection();
        allocs.refresh();
    }, [allocs.selectedForSwap, mutations, allocs]);

    // ── Highlight digits in event_title ──
    const highlightDigits = (text: string) => {
        const parts = text.split(/(\d+)/);
        return parts.map((part, i) =>
            /\d+/.test(part)
                ? <Text key={i} style={s.digitHighlight}>{part}</Text>
                : <Text key={i}>{part}</Text>
        );
    };

    // ════════════════════════════════════════════════════════════
    // ── RENDER: Master Pane ────────────────────────────────────
    // ════════════════════════════════════════════════════════════

    const renderMasterPane = () => (
        <View style={[s.masterPane, !isWide && { flex: selectedQuestion || selectedAlloc ? 0 : 1 }]}>
            {/* Header */}
            <View style={s.masterHeader}>
                <Pressable onPress={() => router.back()} style={s.backBtn}>
                    <ChevronLeft size={20} color="#334155" />
                </Pressable>
                <Text style={s.headerTitle}>Questions</Text>
                <Pressable onPress={() => {
                    if (activeTab === 'Master Library' || activeTab === 'QA Audit') {
                        master.refresh();
                    } else {
                        allocs.refresh();
                    }
                }}>
                    <RefreshCw size={18} color="#64748b" />
                </Pressable>
            </View>

            {/* Tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabBar}>
                {TABS.map(tab => {
                    const Icon = tabIcons[tab];
                    const isActive = tab === activeTab;
                    return (
                        <Pressable key={tab} onPress={() => handleTabChange(tab)} style={[s.tab, isActive && s.tabActive]}>
                            <Icon size={13} color={isActive ? '#3b82f6' : '#94a3b8'} />
                            <Text style={[s.tabText, isActive && s.tabTextActive]}>{tab}</Text>
                        </Pressable>
                    );
                })}
            </ScrollView>

            {/* Tab-specific content */}
            {(activeTab === 'Master Library' || activeTab === 'QA Audit') && renderMasterList()}
            {activeTab === 'Region Tracks' && renderRegionTrack()}
            {activeTab === 'User Tracks' && renderUserTrack()}
        </View>
    );

    // ── Master Library / QA List ──────────────────────────────

    const renderMasterList = () => (
        <View style={s.listWrap}>
            {/* Mode toggle */}
            <View style={s.modeToggleRow}>
                {(['region', 'user'] as const).map(m => (
                    <Pressable key={m} onPress={() => master.changeMode(m)}
                        style={[s.modeBtn, master.mode === m && s.modeBtnActive]}>
                        <Text style={[s.modeBtnText, master.mode === m && s.modeBtnTextActive]}>
                            {m === 'region' ? 'Region' : 'User'}
                        </Text>
                    </Pressable>
                ))}
            </View>

            {/* Search */}
            <View style={s.searchRow}>
                <Search size={16} color="#94a3b8" />
                <TextInput
                    style={s.searchInput}
                    placeholder="Search event title..."
                    placeholderTextColor="#94a3b8"
                    value={master.searchQuery}
                    onChangeText={(t) => master.search(t)}
                />
            </View>

            {/* Column headers */}
            <View style={s.colHeaderRow}>
                <SortableHeader label="Title" field="event_title" currentField={master.sortField} currentAsc={master.sortAsc} onSort={master.changeSort} flex={1} />
                <SortableHeader label="Answer" field="answer_date_canonical" currentField={master.sortField} currentAsc={master.sortAsc} onSort={master.changeSort} width={80} />
                <SortableHeader label="Allocs" field="allocation_count" currentField={master.sortField} currentAsc={master.sortAsc} onSort={master.changeSort} width={50} />
            </View>

            {/* List */}
            {master.loading && master.questions.length === 0 ? (
                <ActivityIndicator style={{ marginTop: 40 }} color="#3b82f6" />
            ) : (
                <FlatList
                    data={master.questions}
                    keyExtractor={q => `${master.mode}_${q.id}`}
                    onEndReached={() => master.hasMore && master.loadMore()}
                    onEndReachedThreshold={0.3}
                    renderItem={({ item: q }) => (
                        <Pressable
                            onPress={() => { setSelectedQuestion(q); setSelectedAlloc(null); }}
                            style={[s.listRow, selectedQuestion?.id === q.id && s.listRowSelected]}
                        >
                            <View style={s.listRowMain}>
                                <Text style={s.listTitle} numberOfLines={1}>
                                    {activeTab === 'QA Audit' ? highlightDigits(q.event_title) : q.event_title}
                                </Text>
                                <View style={s.listRowMeta}>
                                    <Text style={s.listMeta}>{q.answer_date_canonical}</Text>
                                    <Text style={s.listMetaCount}>{q.allocation_count}</Text>
                                </View>
                            </View>
                            {activeTab === 'QA Audit' && !q.is_approved ? (
                                <Pressable
                                    onPress={async (e) => {
                                        e.stopPropagation?.();
                                        const result = await mutations.approveQuestion(master.mode, q.id);
                                        if (result.success) master.refresh();
                                    }}
                                    style={s.inlineApproveBtn}
                                >
                                    <Check size={14} color="#fff" />
                                </Pressable>
                            ) : (
                                !q.is_approved && <View style={s.unapprovedDot} />
                            )}
                        </Pressable>
                    )}
                    ListEmptyComponent={
                        <Text style={s.emptyText}>
                            {activeTab === 'QA Audit' ? 'No unapproved questions with digits found.' : 'No questions found.'}
                        </Text>
                    }
                />
            )}
        </View>
    );

    // ── Status filter + unallocated toggle (shared) ────────────

    const renderTrackFilters = () => (
        <>
            {/* Status filter: All / Played / Unplayed */}
            <View style={s.statusRow}>
                {(['all', 'played', 'unplayed'] as StatusFilter[]).map(f => (
                    <Pressable key={f} onPress={() => allocs.changeStatusFilter(f)}
                        style={[s.statusChip, allocs.statusFilter === f && s.statusChipActive]}>
                        <Text style={[s.statusChipText, allocs.statusFilter === f && s.statusChipTextActive]}>
                            {f === 'all' ? 'All' : f === 'played' ? '✓ Played' : '○ Unplayed'}
                        </Text>
                    </Pressable>
                ))}

                {/* Allocated / Unallocated toggle */}
                <Pressable onPress={() => allocs.toggleUnallocated(!allocs.showUnallocated)}
                    style={[s.statusChip, allocs.showUnallocated && s.statusChipUnalloc]}>
                    {allocs.showUnallocated
                        ? <EyeOff size={12} color="#f59e0b" />
                        : <Eye size={12} color="#64748b" />
                    }
                    <Text style={[s.statusChipText, allocs.showUnallocated && { color: '#f59e0b' }]}>
                        {allocs.showUnallocated ? 'Unallocated' : 'Show Unalloc'}
                    </Text>
                </Pressable>
            </View>
        </>
    );

    // ── Region Tracks ─────────────────────────────────────────

    const renderRegionTrack = () => (
        <View style={s.listWrap}>
            {/* Region filter */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterRow}>
                {allocs.regions.map(r => (
                    <Pressable key={r.code}
                        onPress={() => allocs.changeFilter('region', r.code)}
                        style={[s.filterChip, allocs.filterValue === r.code && s.filterChipActive]}
                    >
                        <Text style={[s.filterChipText, allocs.filterValue === r.code && s.filterChipTextActive]}>
                            {r.code.toUpperCase()}
                        </Text>
                    </Pressable>
                ))}
            </ScrollView>

            {allocs.filterValue ? renderTrackFilters() : null}

            {/* Swap toolbar */}
            {allocs.selectedForSwap.length > 0 && (
                <View style={s.swapToolbar}>
                    <Text style={s.swapToolbarText}>
                        {allocs.selectedForSwap.length}/2 selected for swap
                    </Text>
                    {allocs.selectedForSwap.length === 2 && (
                        <Pressable style={s.swapBtn} onPress={() => {
                            setModalError(null);
                            setModal({ type: 'swap' });
                        }}>
                            <ArrowLeftRight size={14} color="#fff" />
                            <Text style={s.swapBtnText}>Swap Dates</Text>
                        </Pressable>
                    )}
                    <Pressable onPress={allocs.clearSwapSelection}>
                        <X size={16} color="#94a3b8" />
                    </Pressable>
                </View>
            )}

            {allocs.showUnallocated ? renderUnallocatedList() : renderAllocationList()}
        </View>
    );

    // ── User Tracks ───────────────────────────────────────────

    const renderUserTrack = () => (
        <View style={s.listWrap}>
            {/* User search */}
            <View style={s.searchRow}>
                <Search size={16} color="#94a3b8" />
                <TextInput
                    style={s.searchInput}
                    placeholder="Search user by email..."
                    placeholderTextColor="#94a3b8"
                    value={userSearch}
                    onChangeText={searchUsers}
                />
            </View>

            {/* User results dropdown */}
            {userResults.length > 0 && (
                <View style={s.userDropdown}>
                    {userResults.map(u => (
                        <Pressable key={u.id} style={s.userDropdownItem}
                            onPress={() => {
                                allocs.changeFilter('user', u.id);
                                setUserSearch(u.email);
                                setUserResults([]);
                            }}>
                            <Text style={s.userDropdownText}>{u.first_name || ''} — {u.email}</Text>
                        </Pressable>
                    ))}
                </View>
            )}

            {/* Swap toolbar */}
            {allocs.selectedForSwap.length > 0 && (
                <View style={s.swapToolbar}>
                    <Text style={s.swapToolbarText}>
                        {allocs.selectedForSwap.length}/2 selected for swap
                    </Text>
                    {allocs.selectedForSwap.length === 2 && (
                        <Pressable style={s.swapBtn} onPress={() => {
                            setModalError(null);
                            setModal({ type: 'swap' });
                        }}>
                            <ArrowLeftRight size={14} color="#fff" />
                            <Text style={s.swapBtnText}>Swap Dates</Text>
                        </Pressable>
                    )}
                    <Pressable onPress={allocs.clearSwapSelection}>
                        <X size={16} color="#94a3b8" />
                    </Pressable>
                </View>
            )}

            {allocs.filterValue ? (
                <>
                    {renderTrackFilters()}
                    {/* Swap toolbar */}
                    {allocs.selectedForSwap.length > 0 && (
                        <View style={s.swapToolbar}>
                            <Text style={s.swapToolbarText}>
                                {allocs.selectedForSwap.length}/2 selected for swap
                            </Text>
                            {allocs.selectedForSwap.length === 2 && (
                                <Pressable style={s.swapBtn} onPress={() => {
                                    setModalError(null);
                                    setModal({ type: 'swap' });
                                }}>
                                    <ArrowLeftRight size={14} color="#fff" />
                                    <Text style={s.swapBtnText}>Swap Dates</Text>
                                </Pressable>
                            )}
                            <Pressable onPress={allocs.clearSwapSelection}>
                                <X size={16} color="#94a3b8" />
                            </Pressable>
                        </View>
                    )}
                    {allocs.showUnallocated ? renderUnallocatedList() : renderAllocationList()}
                </>
            ) : (
                <Text style={s.emptyText}>Search and select a user above to view their track.</Text>
            )}
        </View>
    );

    // ── Shared Allocation List ────────────────────────────────

    const renderAllocationList = () => (
        <>
            {/* Column headers */}
            <View style={s.allocHeaderRow}>
                <Text style={[s.allocHeaderText, { width: 20 }]}></Text>
                <Text style={[s.allocHeaderText, { width: 80 }]}>Puzzle</Text>
                <Text style={[s.allocHeaderText, { width: 80 }]}>Answer</Text>
                <Text style={[s.allocHeaderText, { flex: 1 }]}>Event</Text>
                <Text style={[s.allocHeaderText, { width: 60 }]}>Cat</Text>
                <Text style={[s.allocHeaderText, { width: 35 }]}>▶</Text>
                <Text style={[s.allocHeaderText, { width: 30 }]}>W</Text>
            </View>

            {allocs.loading && allocs.allocations.length === 0 ? (
                <ActivityIndicator style={{ marginTop: 40 }} color="#3b82f6" />
            ) : (
                <FlatList
                    data={allocs.filteredAllocations}
                    keyExtractor={a => `alloc_${a.alloc_id}`}
                    onEndReached={() => allocs.hasMore && allocs.loadMore()}
                    onEndReachedThreshold={0.3}
                    renderItem={({ item: a }) => {
                        const isSwapSelected = allocs.selectedForSwap.includes(a.alloc_id);
                        return (
                            <Pressable
                                onPress={() => {
                                    setSelectedAlloc(a);
                                    setSelectedQuestion(null);
                                    setSelectedUnalloc(null);
                                }}
                                onLongPress={() => {
                                    if (!a.is_played) allocs.toggleSwapSelection(a.alloc_id);
                                }}
                                style={[
                                    s.allocRow,
                                    selectedAlloc?.alloc_id === a.alloc_id && s.listRowSelected,
                                    isSwapSelected && s.allocRowSwapSelected,
                                ]}
                            >
                                {/* Swap checkbox */}
                                <Pressable
                                    onPress={() => { if (!a.is_played) allocs.toggleSwapSelection(a.alloc_id); }}
                                    style={[s.swapCheckbox, isSwapSelected && s.swapCheckboxActive, a.is_played && { opacity: 0.3 }]}
                                >
                                    {isSwapSelected && <Check size={12} color="#fff" />}
                                </Pressable>

                                <Text style={s.allocDate}>{a.puzzle_date}</Text>
                                <Text style={s.allocAnswer}>{a.answer_date}</Text>
                                <Text style={s.allocTitle} numberOfLines={1}>{a.event_title}</Text>
                                <Text style={s.allocCat} numberOfLines={1}>{a.category_name}</Text>

                                {/* Stats */}
                                <Text style={s.allocStat}>{a.play_count}</Text>
                                <Text style={s.allocStat}>{a.win_count}</Text>

                                {a.is_played && <BadgeTag text="Played" color="#16a34a" />}
                            </Pressable>
                        );
                    }}
                    ListEmptyComponent={<Text style={s.emptyText}>No allocations found.</Text>}
                />
            )}
        </>
    );

    // ── Unallocated Masters List ──────────────────────────────

    const renderUnallocatedList = () => (
        <>
            <View style={s.allocHeaderRow}>
                <Text style={[s.allocHeaderText, { flex: 1 }]}>Event Title</Text>
                <Text style={[s.allocHeaderText, { width: 80 }]}>Answer</Text>
                <Text style={[s.allocHeaderText, { width: 30 }]}>Q</Text>
                <Text style={[s.allocHeaderText, { width: 30 }]}>A</Text>
            </View>

            {allocs.unallocatedLoading && allocs.unallocatedMasters.length === 0 ? (
                <ActivityIndicator style={{ marginTop: 40 }} color="#f59e0b" />
            ) : (
                <FlatList
                    data={allocs.unallocatedMasters}
                    keyExtractor={u => `unalloc_${u.question_id}`}
                    onEndReached={() => allocs.unallocatedHasMore && allocs.loadMoreUnallocated()}
                    onEndReachedThreshold={0.3}
                    renderItem={({ item: u }) => (
                        <Pressable
                            onPress={() => {
                                setSelectedUnalloc(u);
                                setSelectedAlloc(null);
                                setSelectedQuestion(null);
                            }}
                            style={[
                                s.allocRow,
                                selectedUnalloc?.question_id === u.question_id && s.listRowSelected,
                                u.quality_score !== null && u.quality_score < 3 && s.blockedRow,
                            ]}
                        >
                            <Text style={s.allocTitle} numberOfLines={1}>{u.event_title}</Text>
                            <Text style={s.allocAnswer}>{u.answer_date}</Text>
                            <Text style={[s.allocStat, u.quality_score !== null && u.quality_score < 3 && { color: '#dc2626' }]}>
                                {u.quality_score ?? '—'}
                            </Text>
                            <Text style={s.allocStat}>{u.accuracy_score ?? '—'}</Text>
                        </Pressable>
                    )}
                    ListEmptyComponent={<Text style={s.emptyText}>No unallocated masters found.</Text>}
                />
            )}
        </>
    );

    // ════════════════════════════════════════════════════════════
    // ── RENDER: Detail Panel ───────────────────────────────────
    // ════════════════════════════════════════════════════════════

    const renderDetailPanel = () => {
        if (!selectedQuestion && !selectedAlloc && !selectedUnalloc) {
            return (
                <View style={s.emptyDetail}>
                    <BookOpen size={40} color="#e2e8f0" />
                    <Text style={s.emptyDetailText}>Select an item to view details</Text>
                </View>
            );
        }

        // If unallocated master is selected
        if (selectedUnalloc) return renderUnallocDetail();

        // If allocation is selected, show allocation detail
        if (selectedAlloc) return renderAllocDetail();

        // Otherwise, show master question detail
        return renderQuestionDetail();
    };

    // ── Master Question Detail ────────────────────────────────

    const renderQuestionDetail = () => {
        if (!selectedQuestion) return null;
        const q = selectedQuestion;

        const editableFields: { label: string; field: string; value: any }[] = [
            { label: 'Event Title', field: 'event_title', value: q.event_title },
            { label: 'Event Description', field: 'event_description', value: q.event_description },
            { label: 'Event Origin', field: 'event_origin', value: q.event_origin },
            { label: 'Answer Date', field: 'answer_date_canonical', value: q.answer_date_canonical },
            { label: 'Question Kind', field: 'question_kind', value: q.question_kind || '' },
            { label: 'Accuracy Score', field: 'accuracy_score', value: q.accuracy_score ?? '' },
            { label: 'Quality Score', field: 'quality_score', value: q.quality_score ?? '' },
        ];

        // Resolve category IDs to names for display
        const catIds: number[] = Array.isArray(q.categories) ? q.categories : [];
        const catNames = catIds.map(id => categoryMap[id] || `#${id}`).join(', ');
        const questionKindDisplay = q.question_kind
            ? `${q.question_kind}${catNames ? ' — ' + catNames : ''}`
            : catNames || '—';

        return (
            <ScrollView style={s.detailScroll} contentContainerStyle={s.detailContent}>
                {/* Mobile back button */}
                {!isWide && (
                    <Pressable onPress={() => { setSelectedQuestion(null); setSelectedAlloc(null); }} style={s.detailBackBtn}>
                        <ChevronLeft size={18} color="#3b82f6" />
                        <Text style={s.detailBackText}>Back to list</Text>
                    </Pressable>
                )}

                {/* Title card */}
                <View style={s.detailCard}>
                    <Text style={s.detailId}>ID: {q.id} ({master.mode})</Text>
                    <Text style={s.detailTitle}>
                        {activeTab === 'QA Audit' ? highlightDigits(q.event_title) : q.event_title}
                    </Text>
                    <Text style={s.detailDesc}>{q.event_description}</Text>

                    <View style={s.detailMetaRow}>
                        <BadgeTag text={q.answer_date_canonical} color="#3b82f6" />
                        <BadgeTag text={`${q.allocation_count} allocs`} color="#8b5cf6" />
                        {q.is_approved
                            ? <BadgeTag text="Approved" color="#16a34a" />
                            : <BadgeTag text="Unapproved" color="#f59e0b" />
                        }
                    </View>
                </View>

                {/* QA Approve button */}
                {!q.is_approved && (
                    <Pressable style={s.approveBtn} onPress={() => {
                        setModalError(null);
                        setModal({ type: 'approve' });
                    }}>
                        <Check size={16} color="#fff" />
                        <Text style={s.approveBtnText}>Approve Question</Text>
                    </Pressable>
                )}

                {/* Editable fields */}
                <Text style={s.sectionTitle}>Edit Fields</Text>
                {editableFields.map(f => {
                    const displayVal = f.field === 'question_kind' ? questionKindDisplay : (String(f.value) || '—');
                    return (
                        <Pressable key={f.field} style={s.editRow} onPress={() => {
                            setModalValue(String(f.value));
                            setModalError(null);
                            setModal({ type: 'editField', data: { field: f.field, label: f.label, oldValue: f.value } });
                        }}>
                            <View style={{ flex: 1 }}>
                                <Text style={s.editLabel}>{f.label}</Text>
                                <Text style={s.editValue} numberOfLines={2}>{displayVal}</Text>
                            </View>
                            <Pencil size={14} color="#94a3b8" />
                        </Pressable>
                    );
                })}

                {/* Extra info */}
                <Text style={s.sectionTitle}>Metadata</Text>
                <View style={s.metaCard}>
                    <Text style={s.metaLine}>Regions: {JSON.stringify(q.regions)}</Text>
                    <Text style={s.metaLine}>Categories: {catNames || JSON.stringify(q.categories)}</Text>
                    <Text style={s.metaLine}>AI Model: {q.ai_model_used || '—'}</Text>
                    <Text style={s.metaLine}>Created: {q.created_at || '—'}</Text>
                    <Text style={s.metaLine}>Earliest Alloc: {q.earliest_allocation_date || '—'}</Text>
                </View>
            </ScrollView>
        );
    };

    // ── Allocation Detail ─────────────────────────────────────

    const renderAllocDetail = () => {
        if (!selectedAlloc) return null;
        const a = selectedAlloc;

        return (
            <ScrollView style={s.detailScroll} contentContainerStyle={s.detailContent}>
                {/* Mobile back button */}
                {!isWide && (
                    <Pressable onPress={() => { setSelectedQuestion(null); setSelectedAlloc(null); }} style={s.detailBackBtn}>
                        <ChevronLeft size={18} color="#3b82f6" />
                        <Text style={s.detailBackText}>Back to list</Text>
                    </Pressable>
                )}

                {/* Header card */}
                <View style={s.detailCard}>
                    <Text style={s.detailId}>Allocation #{a.alloc_id} — Q#{a.question_id}</Text>
                    <Text style={s.detailTitle}>{a.event_title}</Text>
                    <Text style={s.detailDesc}>{a.event_description}</Text>

                    <View style={s.detailMetaRow}>
                        <BadgeTag text={`Puzzle: ${a.puzzle_date}`} color="#3b82f6" />
                        <BadgeTag text={`Answer: ${a.answer_date}`} color="#8b5cf6" />
                        <BadgeTag text={a.category_name} color="#0ea5e9" />
                        {a.is_played
                            ? <BadgeTag text="Played" color="#16a34a" />
                            : <BadgeTag text="Unplayed" color="#94a3b8" />
                        }
                    </View>
                </View>

                {/* Stats */}
                <View style={s.allocStatsGrid}>
                    <View style={s.statCard}>
                        <Text style={s.statValue}>{a.play_count}</Text>
                        <Text style={s.statLabel}>Plays</Text>
                    </View>
                    <View style={s.statCard}>
                        <Text style={s.statValue}>{a.win_count}</Text>
                        <Text style={s.statLabel}>Wins</Text>
                    </View>
                    <View style={s.statCard}>
                        <Text style={s.statValue}>{a.avg_guesses ?? '—'}</Text>
                        <Text style={s.statLabel}>Avg G</Text>
                    </View>
                </View>

                {/* Actions — only for unplayed */}
                {!a.is_played && (
                    <>
                        <Text style={s.sectionTitle}>Actions</Text>

                        {/* Unallocate */}
                        <Pressable style={s.actionBtn} onPress={() => {
                            setModalError(null);
                            setModal({ type: 'unallocate' });
                        }}>
                            <Trash2 size={14} color="#dc2626" />
                            <Text style={[s.actionBtnText, { color: '#dc2626' }]}>Unallocate</Text>
                        </Pressable>

                        {/* Re-date */}
                        <Pressable style={s.actionBtn} onPress={async () => {
                            setModalError(null);
                            setModalValue('');
                            await allocs.fetchGapDates();
                            setModal({ type: 'redate' });
                        }}>
                            <Calendar size={14} color="#3b82f6" />
                            <Text style={s.actionBtnText}>Change Puzzle Date</Text>
                        </Pressable>
                    </>
                )}

                {a.is_played && (
                    <View style={s.lockedNotice}>
                        <Text style={s.lockedText}>🔒 This puzzle has been played — modifications are locked.</Text>
                    </View>
                )}

                {/* Edit master fields */}
                <Text style={s.sectionTitle}>Edit Master Question</Text>
                {(['event_title', 'event_description', 'answer_date_canonical'] as const).map(field => {
                    const val = field === 'answer_date_canonical' ? a.answer_date : (a as any)[field];
                    return (
                        <Pressable key={field} style={s.editRow} onPress={() => {
                            setModalValue(String(val || ''));
                            setModalError(null);
                            setModal({
                                type: 'editField',
                                data: { field, label: field.replace(/_/g, ' '), oldValue: val, questionId: a.question_id },
                            });
                        }}>
                            <View style={{ flex: 1 }}>
                                <Text style={s.editLabel}>{field.replace(/_/g, ' ')}</Text>
                                <Text style={s.editValue} numberOfLines={2}>{String(val || '—')}</Text>
                            </View>
                            <Pencil size={14} color="#94a3b8" />
                        </Pressable>
                    );
                })}
            </ScrollView>
        );
    };

    // ── Unallocated Master Detail ──────────────────────────────

    const renderUnallocDetail = () => {
        if (!selectedUnalloc) return null;
        const u = selectedUnalloc;
        const isBlocked = u.quality_score !== null && u.quality_score < 3;

        return (
            <ScrollView style={s.detailScroll} contentContainerStyle={s.detailContent}>
                {!isWide && (
                    <Pressable onPress={() => { setSelectedUnalloc(null); }} style={s.detailBackBtn}>
                        <ChevronLeft size={18} color="#3b82f6" />
                        <Text style={s.detailBackText}>Back to list</Text>
                    </Pressable>
                )}

                <View style={s.detailCard}>
                    <Text style={s.detailId}>Master Q#{u.question_id} (unallocated)</Text>
                    <Text style={s.detailTitle}>{u.event_title}</Text>
                    <Text style={s.detailDesc}>{u.event_description}</Text>

                    <View style={s.detailMetaRow}>
                        <BadgeTag text={u.answer_date} color="#3b82f6" />
                        <BadgeTag text={u.question_kind || '—'} color="#8b5cf6" />
                        {isBlocked
                            ? <BadgeTag text="Blocked (Q≤2)" color="#dc2626" />
                            : <BadgeTag text="Eligible" color="#16a34a" />
                        }
                    </View>
                </View>

                {/* Scores */}
                <View style={s.allocStatsGrid}>
                    <View style={[s.statCard, isBlocked && { borderColor: '#fca5a5' }]}>
                        <Text style={[s.statValue, isBlocked && { color: '#dc2626' }]}>{u.quality_score ?? '—'}</Text>
                        <Text style={s.statLabel}>Quality</Text>
                    </View>
                    <View style={s.statCard}>
                        <Text style={s.statValue}>{u.accuracy_score ?? '—'}</Text>
                        <Text style={s.statLabel}>Accuracy</Text>
                    </View>
                </View>

                {/* Block / Unblock */}
                {!isBlocked ? (
                    <Pressable style={[s.actionBtn, { borderColor: '#fca5a5' }]} onPress={() => {
                        setModalError(null);
                        setModal({ type: 'block', data: { questionId: u.question_id, currentScore: u.quality_score } });
                    }}>
                        <ShieldOff size={14} color="#dc2626" />
                        <Text style={[s.actionBtnText, { color: '#dc2626' }]}>Block from Allocation</Text>
                    </Pressable>
                ) : (
                    <Pressable style={s.actionBtn} onPress={() => {
                        setModalValue('4');
                        setModalError(null);
                        setModal({
                            type: 'editField',
                            data: { field: 'quality_score', label: 'Quality Score', oldValue: u.quality_score, questionId: u.question_id },
                        });
                    }}>
                        <Check size={14} color="#16a34a" />
                        <Text style={[s.actionBtnText, { color: '#16a34a' }]}>Restore to Eligible (set score)</Text>
                    </Pressable>
                )}

                {/* Allocate to date */}
                <Pressable style={s.actionBtn} onPress={async () => {
                    setModalError(null);
                    setModalValue('');
                    await allocs.fetchGapDates();
                    setModal({ type: 'allocate', data: { questionId: u.question_id, categories: u.categories } });
                }}>
                    <Calendar size={14} color="#3b82f6" />
                    <Text style={s.actionBtnText}>Allocate to Date</Text>
                </Pressable>

                {/* Move to other table */}
                <Pressable style={s.actionBtn} onPress={() => {
                    setModalError(null);
                    const currentMode = activeTab === 'User Tracks' ? 'user' : 'region';
                    const targetLabel = currentMode === 'region' ? 'User Mode' : 'Region Mode';
                    setModal({ type: 'move', data: { questionId: u.question_id, fromTable: currentMode, targetLabel } });
                }}>
                    <ArrowRightLeft size={14} color="#8b5cf6" />
                    <Text style={[s.actionBtnText, { color: '#8b5cf6' }]}>Move to {activeTab === 'User Tracks' ? 'Region Mode' : 'User Mode'}</Text>
                </Pressable>

                {/* Editable scores */}
                <Text style={s.sectionTitle}>Edit Scores</Text>
                {(['quality_score', 'accuracy_score'] as const).map(field => {
                    const val = u[field];
                    return (
                        <Pressable key={field} style={s.editRow} onPress={() => {
                            setModalValue(String(val ?? ''));
                            setModalError(null);
                            setModal({
                                type: 'editField',
                                data: { field, label: field.replace(/_/g, ' '), oldValue: val, questionId: u.question_id },
                            });
                        }}>
                            <View style={{ flex: 1 }}>
                                <Text style={s.editLabel}>{field.replace(/_/g, ' ')}</Text>
                                <Text style={s.editValue}>{val ?? '—'}</Text>
                            </View>
                            <Pencil size={14} color="#94a3b8" />
                        </Pressable>
                    );
                })}

                {/* Edit text fields */}
                <Text style={s.sectionTitle}>Edit Question</Text>
                {(['event_title', 'event_description'] as const).map(field => {
                    const val = (u as any)[field];
                    return (
                        <Pressable key={field} style={s.editRow} onPress={() => {
                            setModalValue(String(val || ''));
                            setModalError(null);
                            setModal({
                                type: 'editField',
                                data: { field, label: field.replace(/_/g, ' '), oldValue: val, questionId: u.question_id },
                            });
                        }}>
                            <View style={{ flex: 1 }}>
                                <Text style={s.editLabel}>{field.replace(/_/g, ' ')}</Text>
                                <Text style={s.editValue} numberOfLines={2}>{String(val || '—')}</Text>
                            </View>
                            <Pencil size={14} color="#94a3b8" />
                        </Pressable>
                    );
                })}
            </ScrollView>
        );
    };

    // ════════════════════════════════════════════════════════════
    // ── RENDER: Modals ─────────────────────────────────────────
    // ════════════════════════════════════════════════════════════

    const renderModals = () => (
        <>
            {/* Edit Field Modal */}
            <ConfirmModal
                visible={modal?.type === 'editField'}
                title="Edit Field"
                message={`Change "${modal?.data?.label}" value:`}
                loading={modalLoading}
                validationError={modalError}
                onCancel={() => setModal(null)}
                onConfirm={async () => {
                    if (modal?.data?.questionId) {
                        // Editing from allocation detail — use questionId directly
                        setModalLoading(true);
                        setModalError(null);
                        const result = await mutations.editMasterField(
                            allocs.trackMode, modal.data.questionId,
                            modal.data.field, modal.data.oldValue, modalValue,
                        );
                        setModalLoading(false);
                        if (!result.success) {
                            setModalError(result.error || 'Update failed');
                            return;
                        }
                        setModal(null);
                        allocs.refresh();
                    } else {
                        handleEditField();
                    }
                }}
            >
                <TextInput
                    style={s.modalInput}
                    value={modalValue}
                    onChangeText={setModalValue}
                    multiline
                    autoFocus
                />
            </ConfirmModal>

            {/* Approve Modal */}
            <ConfirmModal
                visible={modal?.type === 'approve'}
                title="Approve Question"
                message={`Approve "${selectedQuestion?.event_title}"? This confirms the event title does not leak the answer.`}
                loading={modalLoading}
                validationError={modalError}
                confirmLabel="Approve"
                onCancel={() => setModal(null)}
                onConfirm={handleApprove}
            />

            {/* Unallocate Modal */}
            <ConfirmModal
                visible={modal?.type === 'unallocate'}
                title="Unallocate Question"
                message={`Remove allocation #${selectedAlloc?.alloc_id} (puzzle date: ${selectedAlloc?.puzzle_date})? This will remove it from the track.`}
                loading={modalLoading}
                validationError={modalError}
                confirmLabel="Unallocate"
                destructive
                onCancel={() => setModal(null)}
                onConfirm={handleUnallocate}
            />

            {/* Re-date Modal */}
            <ConfirmModal
                visible={modal?.type === 'redate'}
                title="Change Puzzle Date"
                message={`Current date: ${selectedAlloc?.puzzle_date}. Select a new date from available gaps:`}
                loading={modalLoading}
                validationError={modalError || (!modalValue ? 'Select a date to continue' : null)}
                confirmLabel="Change Date"
                onCancel={() => setModal(null)}
                onConfirm={handleRedate}
            >
                {allocs.gapLoading ? (
                    <ActivityIndicator color="#3b82f6" />
                ) : (
                    <ScrollView style={s.gapDateList}>
                        {allocs.gapDates.map(d => (
                            <Pressable key={d}
                                style={[s.gapDateItem, modalValue === d && s.gapDateItemActive]}
                                onPress={() => setModalValue(d)}>
                                <Text style={[s.gapDateText, modalValue === d && s.gapDateTextActive]}>{d}</Text>
                                {modalValue === d && <Check size={14} color="#3b82f6" />}
                            </Pressable>
                        ))}
                        {allocs.gapDates.length === 0 && (
                            <Text style={s.emptyText}>No available gap dates found.</Text>
                        )}
                    </ScrollView>
                )}
            </ConfirmModal>

            {/* Swap Modal */}
            <ConfirmModal
                visible={modal?.type === 'swap'}
                title="Swap Puzzle Dates"
                message={(() => {
                    const [idA, idB] = allocs.selectedForSwap;
                    const a = allocs.allocations.find(x => x.alloc_id === idA);
                    const b = allocs.allocations.find(x => x.alloc_id === idB);
                    return `Swap dates between:\n• #${idA} (${a?.puzzle_date}) — ${a?.event_title}\n• #${idB} (${b?.puzzle_date}) — ${b?.event_title}`;
                })()}
                loading={modalLoading}
                validationError={modalError}
                confirmLabel="Swap"
                onCancel={() => setModal(null)}
                onConfirm={handleSwap}
            />

            {/* Block from Allocation Modal */}
            <ConfirmModal
                visible={modal?.type === 'block'}
                title="Block from Allocation"
                message={`Set quality_score to 1 for question #${modal?.data?.questionId}?\n\nThis will prevent the allocator from picking this question in future runs (threshold ≥ 3).`}
                loading={modalLoading}
                validationError={modalError}
                confirmLabel="Block"
                onCancel={() => setModal(null)}
                onConfirm={async () => {
                    setModalLoading(true);
                    const trackPrefix = activeTab === 'User Tracks' ? 'user' : 'region';
                    const result = await mutations.blockFromAllocation(
                        trackPrefix as 'region' | 'user',
                        modal!.data.questionId,
                        modal!.data.currentScore,
                    );
                    setModalLoading(false);
                    if (result.success) {
                        setModal(null);
                        allocs.refresh();
                        if (allocs.showUnallocated) allocs.fetchUnallocatedMasters(0, false);
                        if (selectedUnalloc) setSelectedUnalloc({ ...selectedUnalloc, quality_score: 1 });
                    } else {
                        setModalError(result.error || 'Failed');
                    }
                }}
            />

            {/* Allocate to Date Modal */}
            <ConfirmModal
                visible={modal?.type === 'allocate'}
                title="Allocate to Date"
                message={`Pick a gap date to allocate question #${modal?.data?.questionId}:`}
                loading={modalLoading}
                validationError={modalError}
                confirmLabel="Allocate"
                onCancel={() => setModal(null)}
                onConfirm={async () => {
                    if (!modalValue) { setModalError('Select a date'); return; }
                    setModalLoading(true);
                    const mode = (activeTab === 'User Tracks' ? 'user' : 'region') as TrackMode;
                    const cats = modal!.data.categories;
                    const primaryCat = Array.isArray(cats) && cats.length > 0 ? cats[0] : 999;
                    const result = await mutations.allocateQuestion(
                        mode, modal!.data.questionId, modalValue, allocs.filterValue, primaryCat,
                    );
                    setModalLoading(false);
                    if (result.success) {
                        setModal(null);
                        setSelectedUnalloc(null);
                        allocs.refresh();
                        allocs.fetchUnallocatedMasters(0, false);
                    } else {
                        setModalError(result.error || 'Failed');
                    }
                }}
            >
                <ScrollView style={{ maxHeight: 200 }}>
                    {allocs.gapLoading ? (
                        <ActivityIndicator color="#3b82f6" />
                    ) : allocs.gapDates.length === 0 ? (
                        <Text style={s.emptyText}>No gap dates found.</Text>
                    ) : (
                        allocs.gapDates.map(d => (
                            <Pressable key={d} onPress={() => setModalValue(d)}
                                style={[s.gapDateItem, modalValue === d && s.gapDateItemActive]}>
                                <Text style={[s.gapDateText, modalValue === d && s.gapDateTextActive]}>{d}</Text>
                            </Pressable>
                        ))
                    )}
                </ScrollView>
            </ConfirmModal>

            {/* Move Question Modal */}
            <ConfirmModal
                visible={modal?.type === 'move'}
                title={`Move to ${modal?.data?.targetLabel}`}
                message={`Move question #${modal?.data?.questionId} from ${modal?.data?.fromTable} → ${modal?.data?.targetLabel}?\n\nThe question will be deleted from the source table and created in the target with a new ID. Must have zero allocations.`}
                loading={modalLoading}
                validationError={modalError}
                confirmLabel="Move"
                onCancel={() => setModal(null)}
                onConfirm={async () => {
                    setModalLoading(true);
                    const result = await mutations.moveQuestion(
                        modal!.data.fromTable,
                        modal!.data.questionId,
                    );
                    setModalLoading(false);
                    if (result.success) {
                        setModal(null);
                        setSelectedUnalloc(null);
                        allocs.fetchUnallocatedMasters(0, false);
                    } else {
                        setModalError(result.error || 'Move failed');
                    }
                }}
            />
        </>
    );

    // ════════════════════════════════════════════════════════════
    // ── RENDER: Main Layout ────────────────────────────────────
    // ════════════════════════════════════════════════════════════

    // Mobile: show detail or list
    if (!isWide) {
        return (
            <View style={s.container}>
                {(selectedQuestion || selectedAlloc || selectedUnalloc) ? (
                    <View style={{ flex: 1 }}>{renderDetailPanel()}</View>
                ) : (
                    renderMasterPane()
                )}
                {renderModals()}
            </View>
        );
    }

    // Desktop: split pane
    return (
        <View style={s.container}>
            <View style={s.splitLayout}>
                {renderMasterPane()}
                <View style={s.detailPane}>
                    {renderDetailPanel()}
                </View>
            </View>
            {renderModals()}
        </View>
    );
}

// ════════════════════════════════════════════════════════════════
// ── Styles ─────────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    splitLayout: { flex: 1, flexDirection: 'row' },

    // ── Master Pane ──
    masterPane: { flex: 1, maxWidth: 480, borderRightWidth: 1, borderRightColor: '#e2e8f0', backgroundColor: '#fff' },
    masterHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
    backBtn: { padding: 4 },
    headerTitle: { fontFamily: 'Nunito_700Bold', fontSize: 20, color: '#0f172a' },

    // ── Tabs ──
    tabBar: { paddingHorizontal: 12, marginBottom: 8, maxHeight: 40 },
    tab: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, marginRight: 4, backgroundColor: '#f1f5f9' },
    tabActive: { backgroundColor: '#eff6ff' },
    tabText: { fontFamily: 'Nunito_600SemiBold', fontSize: 12, color: '#94a3b8' },
    tabTextActive: { color: '#3b82f6' },

    // ── Mode toggle ──
    modeToggleRow: { flexDirection: 'row', gap: 4, marginHorizontal: 12, marginBottom: 8, backgroundColor: '#f1f5f9', borderRadius: 10, padding: 3 },
    modeBtn: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 8 },
    modeBtnActive: { backgroundColor: '#3b82f6' },
    modeBtnText: { fontFamily: 'Nunito_600SemiBold', fontSize: 12, color: '#64748b' },
    modeBtnTextActive: { color: '#fff' },

    // ── Search ──
    searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 12, marginBottom: 8, backgroundColor: '#f1f5f9', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
    searchInput: { flex: 1, fontFamily: 'Nunito_500Medium', fontSize: 14, color: '#0f172a', padding: 0 },

    // ── Filter chips ──
    filterRow: { paddingHorizontal: 12, marginBottom: 8, maxHeight: 36 },
    filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f1f5f9', marginRight: 6 },
    filterChipActive: { backgroundColor: '#3b82f6' },
    filterChipText: { fontFamily: 'Nunito_600SemiBold', fontSize: 12, color: '#64748b' },
    filterChipTextActive: { color: '#fff' },

    // ── Column headers ──
    colHeaderRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 4, borderBottomWidth: 2, borderBottomColor: '#e2e8f0' },
    colHeader: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    colHeaderText: { fontFamily: 'Nunito_700Bold', fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 },
    colHeaderActive: { color: '#3b82f6' },

    // ── List items ──
    listWrap: { flex: 1 },
    listRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    listRowSelected: { backgroundColor: '#eff6ff' },
    listRowMain: { flex: 1, gap: 2 },
    listTitle: { fontFamily: 'Nunito_600SemiBold', fontSize: 13, color: '#0f172a' },
    listRowMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    listMeta: { fontFamily: 'Nunito_400Regular', fontSize: 11, color: '#64748b' },
    listMetaCount: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: '#8b5cf6' },
    unapprovedDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#f59e0b', marginLeft: 8 },
    inlineApproveBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#16a34a', alignItems: 'center', justifyContent: 'center', marginLeft: 8 },

    // ── Status filter chips ──
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    statusChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff' },
    statusChipActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
    statusChipText: { fontFamily: 'Nunito_600SemiBold', fontSize: 11, color: '#64748b' },
    statusChipTextActive: { color: '#fff' },
    statusChipUnalloc: { backgroundColor: '#fffbeb', borderColor: '#f59e0b' },
    blockedRow: { backgroundColor: '#fef2f2' },

    // ── Allocation rows ──
    allocHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 5, borderBottomWidth: 2, borderBottomColor: '#e2e8f0' },
    allocHeaderText: { fontFamily: 'Nunito_700Bold', fontSize: 10, color: '#94a3b8', textTransform: 'uppercase' },
    allocRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    allocRowSwapSelected: { backgroundColor: '#fef3c7' },
    allocDate: { fontFamily: 'Nunito_500Medium', fontSize: 11, color: '#0f172a', width: 80 },
    allocAnswer: { fontFamily: 'Nunito_400Regular', fontSize: 11, color: '#64748b', width: 80 },
    allocTitle: { fontFamily: 'Nunito_500Medium', fontSize: 11, color: '#334155', flex: 1 },
    allocCat: { fontFamily: 'Nunito_400Regular', fontSize: 10, color: '#64748b', width: 60 },
    allocStat: { fontFamily: 'Nunito_600SemiBold', fontSize: 11, color: '#475569', width: 30, textAlign: 'center' },

    // ── Swap ──
    swapCheckbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center' },
    swapCheckboxActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
    swapToolbar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fef9c3', borderBottomWidth: 1, borderBottomColor: '#fde68a' },
    swapToolbarText: { fontFamily: 'Nunito_600SemiBold', fontSize: 12, color: '#92400e', flex: 1 },
    swapBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#3b82f6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
    swapBtnText: { fontFamily: 'Nunito_600SemiBold', fontSize: 12, color: '#fff' },

    // ── Badge ──
    badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
    badgeText: { fontFamily: 'Nunito_600SemiBold', fontSize: 11 },

    // ── User dropdown ──
    userDropdown: { marginHorizontal: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, marginBottom: 8, maxHeight: 200 },
    userDropdownItem: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    userDropdownText: { fontFamily: 'Nunito_500Medium', fontSize: 13, color: '#334155' },

    // ── Detail Panel ──
    detailPane: { flex: 1, backgroundColor: '#f8fafc' },
    emptyDetail: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
    emptyDetailText: { fontFamily: 'Nunito_500Medium', fontSize: 16, color: '#94a3b8', marginTop: 12 },
    detailScroll: { flex: 1 },
    detailContent: { padding: 16, paddingBottom: 80 },
    detailBackBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 },
    detailBackText: { fontFamily: 'Nunito_600SemiBold', fontSize: 14, color: '#3b82f6' },

    detailCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12 },
    detailId: { fontFamily: 'Nunito_500Medium', fontSize: 11, color: '#94a3b8', marginBottom: 4 },
    detailTitle: { fontFamily: 'Nunito_700Bold', fontSize: 16, color: '#0f172a', marginBottom: 6 },
    detailDesc: { fontFamily: 'Nunito_400Regular', fontSize: 13, color: '#475569', lineHeight: 20, marginBottom: 10 },
    detailMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },

    // ── Stats grid ──
    allocStatsGrid: { flexDirection: 'row', gap: 8, marginBottom: 16 },
    statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
    statValue: { fontFamily: 'Nunito_700Bold', fontSize: 20, color: '#0f172a' },
    statLabel: { fontFamily: 'Nunito_500Medium', fontSize: 11, color: '#64748b', marginTop: 2 },

    // ── Actions ──
    sectionTitle: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginTop: 12 },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 8 },
    actionBtnText: { fontFamily: 'Nunito_600SemiBold', fontSize: 13, color: '#3b82f6' },

    approveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#16a34a', paddingVertical: 12, borderRadius: 10, marginBottom: 12 },
    approveBtnText: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: '#fff' },

    lockedNotice: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 10, padding: 12, marginTop: 8, marginBottom: 8 },
    lockedText: { fontFamily: 'Nunito_500Medium', fontSize: 13, color: '#dc2626' },

    // ── Edit rows ──
    editRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 6 },
    editLabel: { fontFamily: 'Nunito_600SemiBold', fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 },
    editValue: { fontFamily: 'Nunito_500Medium', fontSize: 13, color: '#0f172a', marginTop: 2 },

    // ── Metadata ──
    metaCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#e2e8f0' },
    metaLine: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: '#475569', marginBottom: 4 },

    // ── Digit highlight ──
    digitHighlight: { fontFamily: 'Nunito_700Bold', color: '#dc2626', backgroundColor: '#fef2f2' },

    // ── Modal input ──
    modalInput: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, fontFamily: 'Nunito_500Medium', fontSize: 14, color: '#0f172a', minHeight: 60, textAlignVertical: 'top' },

    // ── Gap dates ──
    gapDateList: { maxHeight: 200, marginTop: 8 },
    gapDateItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    gapDateItemActive: { backgroundColor: '#eff6ff' },
    gapDateText: { fontFamily: 'Nunito_500Medium', fontSize: 14, color: '#334155' },
    gapDateTextActive: { color: '#3b82f6', fontFamily: 'Nunito_700Bold' },

    // ── Empty state ──
    emptyText: { fontFamily: 'Nunito_400Regular', fontSize: 13, color: '#94a3b8', textAlign: 'center', marginTop: 40 },
});
