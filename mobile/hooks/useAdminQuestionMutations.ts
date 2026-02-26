import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';

// ─── Audit Log Helper (same pattern as useAdminMutations) ──

async function logAction(
    adminId: string,
    actionType: string,
    description: string,
    previousState?: any,
    newState?: any,
) {
    const { error } = await supabase.from('admin_action_logs').insert({
        admin_id: adminId,
        target_user_id: adminId,  // Question mutations have no target user — use admin
        action_type: actionType,
        description,
        previous_state: previousState || null,
        new_state: newState || null,
    });
    if (error) console.error('[AuditLog] Failed to log question action:', error);
}

// ─── Hook ────────────────────────────────────────────────────

export function useAdminQuestionMutations() {
    const { user } = useAuth();
    const adminId = user?.id || '';

    // ── Edit a master question field ────────────────────────
    const editMasterField = useCallback(async (
        mode: 'region' | 'user',
        questionId: number,
        field: string,
        oldValue: any,
        newValue: any,
    ): Promise<{ success: boolean; error?: string }> => {
        const table = mode === 'region' ? 'questions_master_region' : 'questions_master_user';

        const { error } = await supabase
            .from(table)
            .update({ [field]: newValue })
            .eq('id', questionId);

        if (error) {
            console.error('[QuestionMutations] editMasterField error:', error);
            return { success: false, error: error.message };
        }

        await logAction(
            adminId,
            `edit_question_${field}`,
            `Edited ${field} on ${table} #${questionId}`,
            { [field]: oldValue },
            { [field]: newValue },
        );

        return { success: true };
    }, [adminId]);

    // ── Approve a question (QA audit) ───────────────────────
    const approveQuestion = useCallback(async (
        mode: 'region' | 'user',
        questionId: number,
    ): Promise<{ success: boolean; error?: string }> => {
        const table = mode === 'region' ? 'questions_master_region' : 'questions_master_user';

        const { error } = await supabase
            .from(table)
            .update({ is_approved: true })
            .eq('id', questionId);

        if (error) {
            console.error('[QuestionMutations] approveQuestion error:', error);
            return { success: false, error: error.message };
        }

        await logAction(
            adminId,
            'approve_question',
            `Approved ${table} #${questionId}`,
            { is_approved: false },
            { is_approved: true },
        );

        return { success: true };
    }, [adminId]);

    // ── Unallocate (DELETE allocation row) ──────────────────
    const unallocate = useCallback(async (
        mode: 'region' | 'user',
        allocId: number,
        puzzleDate: string,
        questionId: number,
    ): Promise<{ success: boolean; error?: string }> => {
        const table = mode === 'region' ? 'questions_allocated_region' : 'questions_allocated_user';

        const { error } = await supabase
            .from(table)
            .delete()
            .eq('id', allocId);

        if (error) {
            console.error('[QuestionMutations] unallocate error:', error);
            return { success: false, error: error.message };
        }

        await logAction(
            adminId,
            'unallocate_question',
            `Unallocated ${table} #${allocId} (puzzle_date: ${puzzleDate}, question_id: ${questionId})`,
            { alloc_id: allocId, puzzle_date: puzzleDate, question_id: questionId },
            null,
        );

        return { success: true };
    }, [adminId]);

    // ── Re-date an allocation ───────────────────────────────
    const redateAllocation = useCallback(async (
        mode: 'region' | 'user',
        allocId: number,
        oldDate: string,
        newDate: string,
    ): Promise<{ success: boolean; error?: string }> => {
        const table = mode === 'region' ? 'questions_allocated_region' : 'questions_allocated_user';

        const { error } = await supabase
            .from(table)
            .update({ puzzle_date: newDate })
            .eq('id', allocId);

        if (error) {
            console.error('[QuestionMutations] redateAllocation error:', error);
            return { success: false, error: error.message };
        }

        await logAction(
            adminId,
            'redate_allocation',
            `Re-dated ${table} #${allocId} from ${oldDate} to ${newDate}`,
            { puzzle_date: oldDate },
            { puzzle_date: newDate },
        );

        return { success: true };
    }, [adminId]);

    // ── Swap puzzle dates (atomic RPC) ──────────────────────
    const swapDates = useCallback(async (
        mode: 'region' | 'user',
        allocIdA: number,
        allocIdB: number,
    ): Promise<{ success: boolean; error?: string }> => {
        const { data, error } = await supabase.rpc('admin_swap_puzzle_dates', {
            p_table: mode,
            p_alloc_id_a: allocIdA,
            p_alloc_id_b: allocIdB,
        });

        if (error) {
            console.error('[QuestionMutations] swapDates error:', error);
            return { success: false, error: error.message };
        }

        const result = data as any;
        if (!result?.success) {
            return { success: false, error: result?.error || 'Swap failed' };
        }

        await logAction(
            adminId,
            'swap_puzzle_dates',
            `Swapped dates for allocations #${allocIdA} ↔ #${allocIdB} in ${mode} mode`,
            { alloc_id_a: allocIdA, alloc_id_b: allocIdB },
            result.swapped,
        );

        return { success: true };
    }, [adminId]);

    // ── Block from allocation (set quality_score = 1) ───────
    const blockFromAllocation = useCallback(async (
        mode: 'region' | 'user',
        questionId: number,
        currentScore: number | null,
    ): Promise<{ success: boolean; error?: string }> => {
        const table = mode === 'region' ? 'questions_master_region' : 'questions_master_user';

        const { error } = await supabase
            .from(table)
            .update({ quality_score: 1 })
            .eq('id', questionId);

        if (error) {
            console.error('[QuestionMutations] blockFromAllocation error:', error);
            return { success: false, error: error.message };
        }

        await logAction(
            adminId,
            'block_from_allocation',
            `Blocked ${table} #${questionId} from allocation (quality_score → 1)`,
            { quality_score: currentScore },
            { quality_score: 1 },
        );

        return { success: true };
    }, [adminId]);

    // ── Allocate an unallocated master to a date ────────────
    const allocateQuestion = useCallback(async (
        mode: 'region' | 'user',
        questionId: number,
        puzzleDate: string,
        filterValue: string,   // region code or user_id
        categoryId: number,
    ): Promise<{ success: boolean; error?: string }> => {
        const table = mode === 'region' ? 'questions_allocated_region' : 'questions_allocated_user';

        const payload = mode === 'region'
            ? {
                puzzle_date: puzzleDate,
                question_id: questionId,
                region: filterValue,
                category_id: categoryId,
                slot_type: 'region' as const,
                trigger_reason: 'admin_manual',
                created_at: new Date().toISOString(),
            }
            : {
                puzzle_date: puzzleDate,
                question_id: questionId,
                user_id: filterValue,
                category_id: categoryId,
                slot_type: 'category' as const,
                trigger_reason: 'admin_manual',
                created_at: new Date().toISOString(),
            };

        const { error } = await supabase
            .from(table)
            .insert(payload as any);

        if (error) {
            console.error('[QuestionMutations] allocateQuestion error:', error);
            return { success: false, error: error.message };
        }

        const scopeCol = mode === 'region' ? 'region' : 'user_id';
        await logAction(
            adminId,
            'allocate_question',
            `Allocated ${table} question #${questionId} to ${scopeCol}=${filterValue} on ${puzzleDate}`,
            null,
            { question_id: questionId, puzzle_date: puzzleDate, [scopeCol]: filterValue, category_id: categoryId },
        );

        return { success: true };
    }, [adminId]);

    // ── Move question between region ↔ user tables ──────────
    const moveQuestion = useCallback(async (
        fromTable: 'region' | 'user',
        questionId: number,
    ): Promise<{ success: boolean; error?: string; newId?: number }> => {
        const { data, error } = await supabase.rpc('admin_move_question', {
            p_from_table: fromTable,
            p_question_id: questionId,
        });

        if (error) {
            console.error('[QuestionMutations] moveQuestion error:', error);
            return { success: false, error: error.message };
        }

        const result = data as any;
        if (!result?.success) {
            return { success: false, error: result?.error || 'Move failed' };
        }

        await logAction(
            adminId,
            'move_question',
            `Moved question #${questionId} from ${fromTable} → ${result.moved_to} (new ID: #${result.new_id})`,
            { from_table: fromTable, question_id: questionId },
            { moved_to: result.moved_to, new_id: result.new_id },
        );

        return { success: true, newId: result.new_id };
    }, [adminId]);

    return {
        editMasterField,
        approveQuestion,
        unallocate,
        redateAllocation,
        swapDates,
        blockFromAllocation,
        allocateQuestion,
        moveQuestion,
    };
}
