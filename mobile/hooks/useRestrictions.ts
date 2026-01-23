import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useProfile } from './useProfile';
import { differenceInDays, addDays, parseISO, format } from 'date-fns';

interface RestrictionStatus {
    canChange: boolean;
    daysRemaining: number;
    nextChangeDate: string | null;
}

export function useRestrictions() {
    const { profile, isLoading: profileLoading } = useProfile();
    const [loading, setLoading] = useState(true);

    // Default restrictions (safe fallbacks)
    const [categoryLimitDays, setCategoryLimitDays] = useState(30);
    const [postcodeLimitDays, setPostcodeLimitDays] = useState(30);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const { data, error } = await supabase
                .from('admin_settings')
                .select('key, value')
                .in('key', ['category_restriction_days', 'postcode_restriction_days']);

            if (data) {
                const cat = data.find(s => s.key === 'category_restriction_days');
                const pc = data.find(s => s.key === 'postcode_restriction_days');

                if (cat) setCategoryLimitDays(parseInt(cat.value) || 30);
                if (pc) setPostcodeLimitDays(parseInt(pc.value) || 30);
            }
        } catch (err) {
            console.error('[useRestrictions] Error fetching settings:', err);
        } finally {
            setLoading(false);
        }
    };

    const checkRestriction = (lastChangedAt: string | null | undefined, limitDays: number): RestrictionStatus => {
        if (!lastChangedAt) {
            return { canChange: true, daysRemaining: 0, nextChangeDate: null };
        }

        const lastDate = parseISO(lastChangedAt);
        const nextDate = addDays(lastDate, limitDays);
        const now = new Date();

        // precise diff
        const diff = differenceInDays(nextDate, now);

        if (now >= nextDate) {
            return { canChange: true, daysRemaining: 0, nextChangeDate: null };
        }

        return {
            canChange: false,
            daysRemaining: Math.max(1, diff), // at least 1 day if not allowed
            nextChangeDate: format(nextDate, 'do MMMM yyyy')
        };
    };

    return {
        loading: loading || profileLoading,
        checkCategories: () => checkRestriction(profile?.categories_last_changed_at, categoryLimitDays),
        checkPostcode: () => checkRestriction(profile?.postcode_last_changed_at, postcodeLimitDays),
    };
}
