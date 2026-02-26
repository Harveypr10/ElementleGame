import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// ─── Types ──────────────────────────────────────────────────

export interface MasterQuestion {
    id: number;
    event_title: string;
    event_description: string;
    event_origin: string;
    answer_date_canonical: string;
    question_kind: string | null;
    accuracy_score: number | null;
    quality_score: number | null;
    is_approved: boolean;
    regions: any;
    categories: any;
    populated_place_id: string | null;
    ai_model_used: string | null;
    created_at: string | null;
    allocation_count: number;
    earliest_allocation_date: string | null;
}

export type QuestionMode = 'region' | 'user';
export type SortField = 'answer_date_canonical' | 'allocation_count' | 'earliest_allocation_date' | 'event_title' | 'created_at';

// ─── Hook ────────────────────────────────────────────────────

export function useAdminQuestions() {
    const [mode, setMode] = useState<QuestionMode>('region');
    const [questions, setQuestions] = useState<MasterQuestion[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [page, setPage] = useState(0);
    const [sortField, setSortField] = useState<SortField>('answer_date_canonical');
    const [sortAsc, setSortAsc] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // QA Audit mode
    const [qaMode, setQaMode] = useState(false);

    const PAGE_SIZE = 50;

    const fetchQuestions = useCallback(async (
        pageNum: number,
        append = false,
        overrideMode?: QuestionMode,
        overrideQa?: boolean,
        overrideSort?: SortField,
        overrideSortAsc?: boolean,
        overrideSearch?: string,
    ) => {
        setLoading(true);
        setError(null);

        const currentMode = overrideMode ?? mode;
        const currentQa = overrideQa ?? qaMode;
        const currentSort = overrideSort ?? sortField;
        const currentSortAsc = overrideSortAsc ?? sortAsc;
        const currentSearch = overrideSearch ?? searchQuery;

        const table = currentMode === 'region'
            ? 'v_questions_master_region_stats'
            : 'v_questions_master_user_stats';

        try {
            let query = supabase
                .from(table)
                .select('*')
                .order(currentSort, { ascending: currentSortAsc })
                .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);

            // QA audit filter: unapproved + contains digits in event_title
            if (currentQa) {
                query = query.eq('is_approved', false);
            }

            // Search filter
            if (currentSearch) {
                query = query.or(`event_title.ilike.%${currentSearch}%,event_description.ilike.%${currentSearch}%`);
            }

            const { data, error: fetchErr } = await query;

            if (fetchErr) {
                console.error('[AdminQuestions] Fetch error:', fetchErr);
                setError('Failed to load questions.');
                return;
            }

            const mapped: MasterQuestion[] = (data || []).map((row: any) => ({
                id: row.id,
                event_title: row.event_title,
                event_description: row.event_description,
                event_origin: row.event_origin,
                answer_date_canonical: row.answer_date_canonical,
                question_kind: row.question_kind,
                accuracy_score: row.accuracy_score,
                quality_score: row.quality_score,
                is_approved: row.is_approved ?? false,
                regions: row.regions,
                categories: row.categories,
                populated_place_id: row.populated_place_id,
                ai_model_used: row.ai_model_used,
                created_at: row.created_at,
                allocation_count: row.allocation_count || 0,
                earliest_allocation_date: row.earliest_allocation_date || null,
            }));

            // Client-side filter for QA: only show rows where event_title contains a digit
            const finalList = currentQa
                ? mapped.filter(q => /[0-9]/.test(q.event_title))
                : mapped;

            setHasMore(mapped.length === PAGE_SIZE);

            if (append) {
                setQuestions(prev => [...prev, ...finalList]);
            } else {
                setQuestions(finalList);
            }
        } catch (err) {
            console.error('[AdminQuestions] Error:', err);
            setError('Something went wrong.');
        } finally {
            setLoading(false);
        }
    }, [mode, qaMode, sortField, sortAsc, searchQuery]);

    const refresh = useCallback((overrideMode?: QuestionMode, overrideQa?: boolean) => {
        setPage(0);
        fetchQuestions(0, false, overrideMode, overrideQa);
    }, [fetchQuestions]);

    const loadMore = useCallback(() => {
        const next = page + 1;
        setPage(next);
        fetchQuestions(next, true);
    }, [page, fetchQuestions]);

    const changeMode = useCallback((newMode: QuestionMode) => {
        setMode(newMode);
        setPage(0);
        fetchQuestions(0, false, newMode);
    }, [fetchQuestions]);

    const toggleQaMode = useCallback((enabled: boolean) => {
        setQaMode(enabled);
        setPage(0);
        fetchQuestions(0, false, undefined, enabled);
    }, [fetchQuestions]);

    const changeSort = useCallback((field: SortField) => {
        const newAsc = field === sortField ? !sortAsc : false;
        setSortField(field);
        setSortAsc(newAsc);
        setPage(0);
        fetchQuestions(0, false, undefined, undefined, field, newAsc);
    }, [sortField, sortAsc, fetchQuestions]);

    const search = useCallback((query: string) => {
        setSearchQuery(query);
        setPage(0);
        fetchQuestions(0, false, undefined, undefined, undefined, undefined, query);
    }, [fetchQuestions]);

    return {
        mode,
        questions,
        loading,
        error,
        hasMore,
        qaMode,
        sortField,
        sortAsc,
        searchQuery,
        changeMode,
        toggleQaMode,
        changeSort,
        search,
        refresh,
        loadMore,
        fetchQuestions,
    };
}
