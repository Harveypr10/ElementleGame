import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';

export type FeedbackStatus = 'new' | 'investigating' | 'resolved' | 'closed';
export type FeedbackType = 'feedback' | 'bug' | 'support';

export interface UserFeedback {
    id: string;
    user_id: string | null;
    email: string | null;
    type: FeedbackType;
    message: string;
    rating: number | null;
    status: FeedbackStatus;
    app_version: string | null;
    device_os: string | null;
    created_at: string;
    updated_at: string;
}

export interface FeedbackNote {
    id: string;
    feedback_id: string;
    admin_user_id: string;
    note: string;
    created_at: string;
}

interface Filters {
    status: FeedbackStatus | 'all';
    type: FeedbackType | 'all';
    sortBy: 'created_at' | 'updated_at';
    sortOrder: 'asc' | 'desc';
}

export function useAdminCases() {
    const { user } = useAuth();

    const [cases, setCases] = useState<UserFeedback[]>([]);
    const [notes, setNotes] = useState<Record<string, FeedbackNote[]>>({});
    const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [filters, setFilters] = useState<Filters>({
        status: 'all',
        type: 'all',
        sortBy: 'created_at',
        sortOrder: 'desc',
    });

    const selectedCase = cases.find(c => c.id === selectedCaseId) || null;
    const selectedNotes = selectedCaseId ? notes[selectedCaseId] || [] : [];

    // Fetch cases
    const fetchCases = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            let query = supabase
                .from('user_feedback')
                .select('*')
                .order(filters.sortBy, { ascending: filters.sortOrder === 'asc' });

            if (filters.status !== 'all') {
                query = query.eq('status', filters.status);
            }
            if (filters.type !== 'all') {
                query = query.eq('type', filters.type);
            }

            const { data, error: fetchError } = await query;

            if (fetchError) {
                console.error('[AdminCases] Fetch error:', fetchError);
                setError('Failed to load cases.');
                return;
            }

            setCases((data as UserFeedback[]) || []);
        } catch (err) {
            console.error('[AdminCases] Fetch error:', err);
            setError('Something went wrong.');
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        fetchCases();
    }, [fetchCases]);

    // Update status
    const updateStatus = useCallback(async (caseId: string, newStatus: FeedbackStatus) => {
        const { error: updateError } = await supabase
            .from('user_feedback')
            .update({ status: newStatus })
            .eq('id', caseId);

        if (updateError) {
            console.error('[AdminCases] Update status error:', updateError);
            return false;
        }

        // Optimistic update
        setCases(prev => prev.map(c =>
            c.id === caseId ? { ...c, status: newStatus, updated_at: new Date().toISOString() } : c
        ));
        return true;
    }, []);

    // Fetch notes for a case
    const fetchNotes = useCallback(async (feedbackId: string) => {
        const { data, error: fetchError } = await supabase
            .from('feedback_notes')
            .select('*')
            .eq('feedback_id', feedbackId)
            .order('created_at', { ascending: true });

        if (fetchError) {
            console.error('[AdminCases] Fetch notes error:', fetchError);
            return;
        }

        setNotes(prev => ({
            ...prev,
            [feedbackId]: (data as FeedbackNote[]) || [],
        }));
    }, []);

    // Add a note
    const addNote = useCallback(async (feedbackId: string, noteText: string) => {
        if (!noteText.trim() || !user?.id) return false;

        const { data, error: insertError } = await supabase
            .from('feedback_notes')
            .insert({
                feedback_id: feedbackId,
                admin_user_id: user.id,
                note: noteText.trim(),
            })
            .select()
            .single();

        if (insertError) {
            console.error('[AdminCases] Add note error:', insertError);
            return false;
        }

        // Optimistic append
        setNotes(prev => ({
            ...prev,
            [feedbackId]: [...(prev[feedbackId] || []), data as FeedbackNote],
        }));
        return true;
    }, [user?.id]);

    // Select a case and load its notes
    const selectCase = useCallback((caseId: string | null) => {
        setSelectedCaseId(caseId);
        if (caseId && !notes[caseId]) {
            fetchNotes(caseId);
        }
    }, [notes, fetchNotes]);

    // Update filters
    const setFilter = useCallback(<K extends keyof Filters>(key: K, value: Filters[K]) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    }, []);

    return {
        cases,
        loading,
        error,
        filters,
        setFilter,
        selectedCase,
        selectedCaseId,
        selectCase,
        selectedNotes,
        updateStatus,
        addNote,
        fetchNotes,
        refetch: fetchCases,
    };
}
