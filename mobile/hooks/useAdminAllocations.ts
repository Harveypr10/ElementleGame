import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// ─── Types ──────────────────────────────────────────────────

export interface AllocationRow {
    alloc_id: number;
    puzzle_date: string;
    question_id: number;
    category_id: number;
    category_name: string;
    event_title: string;
    event_description: string;
    answer_date: string;
    question_kind: string | null;
    is_approved: boolean;
    play_count: number;
    win_count: number;
    avg_guesses: number | null;
    is_played: boolean;
}

export interface UnallocatedRow {
    question_id: number;
    event_title: string;
    event_description: string;
    answer_date: string;
    question_kind: string | null;
    quality_score: number | null;
    accuracy_score: number | null;
    is_approved: boolean;
    categories: any;
    created_at: string | null;
}

export type TrackMode = 'region' | 'user';
export type StatusFilter = 'all' | 'played' | 'unplayed';

// ─── Hook ────────────────────────────────────────────────────

export function useAdminAllocations() {
    const [trackMode, setTrackMode] = useState<TrackMode>('region');
    const [filterValue, setFilterValue] = useState('');
    const [allocations, setAllocations] = useState<AllocationRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [page, setPage] = useState(0);

    // Status filter: played / unplayed / all
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

    // Allocated vs unallocated toggle
    const [showUnallocated, setShowUnallocated] = useState(false);
    const [unallocatedMasters, setUnallocatedMasters] = useState<UnallocatedRow[]>([]);
    const [unallocatedLoading, setUnallocatedLoading] = useState(false);
    const [unallocatedHasMore, setUnallocatedHasMore] = useState(true);
    const [unallocatedPage, setUnallocatedPage] = useState(0);

    // Swap selection
    const [selectedForSwap, setSelectedForSwap] = useState<number[]>([]);

    // Date gaps
    const [gapDates, setGapDates] = useState<string[]>([]);
    const [gapLoading, setGapLoading] = useState(false);

    // Regions list
    const [regions, setRegions] = useState<{ code: string; name: string }[]>([]);

    const PAGE_SIZE = 100;

    // Load regions on mount
    const fetchRegions = useCallback(async () => {
        const { data } = await supabase.from('regions').select('code, name').order('name');
        if (data) setRegions(data);
    }, []);

    // Fetch allocations via RPC
    const fetchAllocations = useCallback(async (
        pageNum: number,
        append = false,
        overrideMode?: TrackMode,
        overrideFilter?: string,
    ) => {
        const currentMode = overrideMode ?? trackMode;
        const currentFilter = overrideFilter ?? filterValue;

        if (!currentFilter) {
            setAllocations([]);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const { data, error: rpcErr } = await supabase.rpc('admin_allocation_stats', {
                p_table: currentMode,
                p_filter_value: currentFilter,
                p_limit: PAGE_SIZE,
                p_offset: pageNum * PAGE_SIZE,
            });

            if (rpcErr) {
                console.error('[AdminAllocations] RPC error:', rpcErr);
                setError('Failed to load allocations.');
                return;
            }

            const rows: AllocationRow[] = (data || []).map((r: any) => ({
                alloc_id: r.alloc_id,
                puzzle_date: r.puzzle_date,
                question_id: r.question_id,
                category_id: r.category_id,
                category_name: r.category_name,
                event_title: r.event_title,
                event_description: r.event_description,
                answer_date: r.answer_date,
                question_kind: r.question_kind,
                is_approved: r.is_approved ?? false,
                play_count: r.play_count || 0,
                win_count: r.win_count || 0,
                avg_guesses: r.avg_guesses ?? null,
                is_played: r.is_played ?? false,
            }));

            setHasMore(rows.length === PAGE_SIZE);

            if (append) {
                setAllocations(prev => [...prev, ...rows]);
            } else {
                setAllocations(rows);
            }
        } catch (err) {
            console.error('[AdminAllocations] Error:', err);
            setError('Something went wrong.');
        } finally {
            setLoading(false);
        }
    }, [trackMode, filterValue]);

    // Fetch unallocated masters via RPC
    const fetchUnallocatedMasters = useCallback(async (
        pageNum: number,
        append = false,
        overrideMode?: TrackMode,
        overrideFilter?: string,
    ) => {
        const currentMode = overrideMode ?? trackMode;
        const currentFilter = overrideFilter ?? filterValue;

        if (!currentFilter) {
            setUnallocatedMasters([]);
            return;
        }

        setUnallocatedLoading(true);

        try {
            const { data, error: rpcErr } = await supabase.rpc('admin_unallocated_masters', {
                p_table: currentMode,
                p_filter_value: currentFilter,
                p_limit: PAGE_SIZE,
                p_offset: pageNum * PAGE_SIZE,
            });

            if (rpcErr) {
                console.error('[AdminAllocations] Unallocated RPC error:', rpcErr);
                return;
            }

            const rows: UnallocatedRow[] = (data || []).map((r: any) => ({
                question_id: r.question_id,
                event_title: r.event_title,
                event_description: r.event_description,
                answer_date: r.answer_date,
                question_kind: r.question_kind,
                quality_score: r.quality_score,
                accuracy_score: r.accuracy_score,
                is_approved: r.is_approved ?? false,
                categories: r.categories,
                created_at: r.created_at,
            }));

            setUnallocatedHasMore(rows.length === PAGE_SIZE);

            if (append) {
                setUnallocatedMasters(prev => [...prev, ...rows]);
            } else {
                setUnallocatedMasters(rows);
            }
        } catch (err) {
            console.error('[AdminAllocations] Unallocated error:', err);
        } finally {
            setUnallocatedLoading(false);
        }
    }, [trackMode, filterValue]);

    // Fetch date gaps via RPC
    const fetchGapDates = useCallback(async (overrideMode?: TrackMode, overrideFilter?: string) => {
        const currentMode = overrideMode ?? trackMode;
        const currentFilter = overrideFilter ?? filterValue;

        if (!currentFilter) return;

        setGapLoading(true);
        try {
            const { data, error: rpcErr } = await supabase.rpc('admin_find_date_gaps', {
                p_table: currentMode,
                p_filter_value: currentFilter,
                p_extend_days: 14,
            });

            if (rpcErr) {
                console.error('[AdminAllocations] Gap dates error:', rpcErr);
                return;
            }

            setGapDates((data || []).map((r: any) => r.gap_date));
        } catch (err) {
            console.error('[AdminAllocations] Gap dates error:', err);
        } finally {
            setGapLoading(false);
        }
    }, [trackMode, filterValue]);

    // Filtered allocations (client-side played/unplayed filter)
    const filteredAllocations = statusFilter === 'all'
        ? allocations
        : statusFilter === 'played'
            ? allocations.filter(a => a.is_played)
            : allocations.filter(a => !a.is_played);

    const refresh = useCallback((overrideMode?: TrackMode, overrideFilter?: string) => {
        setPage(0);
        setSelectedForSwap([]);
        fetchAllocations(0, false, overrideMode, overrideFilter);
        if (showUnallocated) {
            setUnallocatedPage(0);
            fetchUnallocatedMasters(0, false, overrideMode, overrideFilter);
        }
    }, [fetchAllocations, fetchUnallocatedMasters, showUnallocated]);

    const loadMore = useCallback(() => {
        const next = page + 1;
        setPage(next);
        fetchAllocations(next, true);
    }, [page, fetchAllocations]);

    const loadMoreUnallocated = useCallback(() => {
        const next = unallocatedPage + 1;
        setUnallocatedPage(next);
        fetchUnallocatedMasters(next, true);
    }, [unallocatedPage, fetchUnallocatedMasters]);

    const changeFilter = useCallback((mode: TrackMode, value: string) => {
        setTrackMode(mode);
        setFilterValue(value);
        setPage(0);
        setUnallocatedPage(0);
        setSelectedForSwap([]);
        setGapDates([]);
        fetchAllocations(0, false, mode, value);
        if (showUnallocated) {
            fetchUnallocatedMasters(0, false, mode, value);
        }
    }, [fetchAllocations, fetchUnallocatedMasters, showUnallocated]);

    const toggleUnallocated = useCallback((show: boolean) => {
        setShowUnallocated(show);
        if (show && filterValue) {
            setUnallocatedPage(0);
            fetchUnallocatedMasters(0, false);
        }
    }, [fetchUnallocatedMasters, filterValue]);

    const changeStatusFilter = useCallback((filter: StatusFilter) => {
        setStatusFilter(filter);
    }, []);

    // Toggle an allocation for swap selection (max 2)
    const toggleSwapSelection = useCallback((allocId: number) => {
        setSelectedForSwap(prev => {
            if (prev.includes(allocId)) {
                return prev.filter(id => id !== allocId);
            }
            if (prev.length >= 2) return prev;
            return [...prev, allocId];
        });
    }, []);

    const clearSwapSelection = useCallback(() => {
        setSelectedForSwap([]);
    }, []);

    return {
        trackMode,
        filterValue,
        allocations,
        filteredAllocations,
        loading,
        error,
        hasMore,
        statusFilter,
        showUnallocated,
        unallocatedMasters,
        unallocatedLoading,
        unallocatedHasMore,
        selectedForSwap,
        gapDates,
        gapLoading,
        regions,
        fetchRegions,
        fetchAllocations,
        fetchUnallocatedMasters,
        fetchGapDates,
        refresh,
        loadMore,
        loadMoreUnallocated,
        changeFilter,
        changeStatusFilter,
        toggleUnallocated,
        toggleSwapSelection,
        clearSwapSelection,
    };
}
