import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface AdminUser {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    region: string | null;
    user_tier_id: string | null;
    subscription_end_date: string | null;
    is_admin: boolean | null;
    created_at: string | null;
    // Joined from user_tier
    tier_name: string | null;   // e.g. "standard", "pro", "education"
    tier_type: string | null;   // e.g. "monthly", "quarterly", "annual", "lifetime"
    billing_period: string | null;
}

interface Filters {
    search: string;
    region: string;     // '' = all
    tierName: string;   // '' = all, or 'standard', 'pro', 'education'
    tierType: string;   // '' = all, or 'monthly', 'quarterly', 'annual', 'lifetime'
    sortBy: 'created_at' | 'email' | 'first_name';
    sortOrder: 'asc' | 'desc';
}

const PAGE_SIZE = 50;

export function useAdminUsers() {
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [page, setPage] = useState(0);
    const [regions, setRegions] = useState<{ code: string; name: string }[]>([]);
    // Distinct tier names and types for filters
    const [tierNames, setTierNames] = useState<string[]>([]);
    const [tierTypes, setTierTypes] = useState<string[]>([]);
    // ALL tiers (including inactive) for filter ID lookup
    const [allTiers, setAllTiers] = useState<{ id: string; tier: string; tier_type: string }[]>([]);

    const [filters, setFilters] = useState<Filters>({
        search: '',
        region: '',
        tierName: '',
        tierType: '',
        sortBy: 'created_at',
        sortOrder: 'desc',
    });

    // Load filter options on mount
    // Uses ALL user_tier rows (not just active) so every possible tier is filterable
    useEffect(() => {
        (async () => {
            const [regionsRes, tiersRes] = await Promise.all([
                supabase.from('regions').select('code, name').order('name'),
                // Fetch ALL tiers (active and inactive) — we need inactive ones too
                // because users may be assigned to them
                supabase.from('user_tier').select('id, tier, tier_type').order('sort_order'),
            ]);
            if (regionsRes.data) setRegions(regionsRes.data);
            if (tiersRes.data) {
                setAllTiers(tiersRes.data);
                // Deduplicate tier names & types — always include 'standard'
                const dbNames = [...new Set(tiersRes.data.map(t => t.tier))];
                const names = dbNames.includes('standard') ? dbNames : ['standard', ...dbNames];
                const types = [...new Set(tiersRes.data.map(t => t.tier_type))];
                setTierNames(names);
                setTierTypes(types);
            }
        })();
    }, []);

    // Fetch users
    const fetchUsers = useCallback(async (pageNum: number, append = false) => {
        setLoading(true);
        setError(null);
        try {
            let query = supabase
                .from('user_profiles')
                .select(`
                    id, email, first_name, last_name, region,
                    user_tier_id, subscription_end_date, is_admin, created_at,
                    user_tier ( tier, tier_type, billing_period )
                `)
                .order(filters.sortBy, { ascending: filters.sortOrder === 'asc' })
                .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);

            if (filters.region) {
                query = query.eq('region', filters.region);
            }

            // Tier filtering
            if (filters.tierName || filters.tierType) {
                // "Standard" tier means user_tier_id is null or maps to a standard row
                if (filters.tierName === 'standard') {
                    const standardIds = allTiers.filter(t => t.tier === 'standard').map(t => t.id);
                    if (standardIds.length > 0) {
                        query = query.or(`user_tier_id.is.null,user_tier_id.in.(${standardIds.join(',')})`);
                    } else {
                        query = query.is('user_tier_id', null);
                    }
                } else {
                    // Filter all matching tier IDs (including inactive rows)
                    let matchingIds = allTiers.map(t => t.id);
                    if (filters.tierName) {
                        matchingIds = matchingIds.filter(id => {
                            const t = allTiers.find(x => x.id === id);
                            return t && t.tier === filters.tierName;
                        });
                    }
                    if (filters.tierType) {
                        matchingIds = matchingIds.filter(id => {
                            const t = allTiers.find(x => x.id === id);
                            return t && t.tier_type === filters.tierType;
                        });
                    }
                    if (matchingIds.length > 0) {
                        query = query.in('user_tier_id', matchingIds);
                    } else {
                        setUsers(append ? users : []);
                        setHasMore(false);
                        setLoading(false);
                        return;
                    }
                }
            }

            if (filters.search) {
                query = query.or(`email.ilike.%${filters.search}%,first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%`);
            }

            const { data, error: fetchError } = await query;

            if (fetchError) {
                console.error('[AdminUsers] Fetch error:', fetchError);
                setError('Failed to load users.');
                return;
            }

            const mapped: AdminUser[] = (data || []).map((row: any) => ({
                id: row.id,
                email: row.email,
                first_name: row.first_name,
                last_name: row.last_name,
                region: row.region,
                user_tier_id: row.user_tier_id,
                subscription_end_date: row.subscription_end_date,
                is_admin: row.is_admin,
                created_at: row.created_at,
                tier_name: row.user_tier?.tier || null,
                tier_type: row.user_tier?.tier_type || null,
                billing_period: row.user_tier?.billing_period || null,
            }));

            setHasMore(mapped.length === PAGE_SIZE);

            if (append) {
                setUsers(prev => [...prev, ...mapped]);
            } else {
                setUsers(mapped);
            }
        } catch (err) {
            console.error('[AdminUsers] Error:', err);
            setError('Something went wrong.');
        } finally {
            setLoading(false);
        }
    }, [filters, allTiers]);

    // Initial fetch and on filter change
    useEffect(() => {
        setPage(0);
        fetchUsers(0, false);
    }, [fetchUsers]);

    const loadMore = useCallback(() => {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchUsers(nextPage, true);
    }, [page, fetchUsers]);

    const setFilter = useCallback(<K extends keyof Filters>(key: K, value: Filters[K]) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    }, []);

    const refetch = useCallback(() => {
        setPage(0);
        fetchUsers(0, false);
    }, [fetchUsers]);

    // Derive display tier string — correctly using tier_name value
    const getTierDisplay = useCallback((user: AdminUser): string => {
        if (!user.tier_name || user.tier_name === 'standard') return 'Standard';
        // Pro or Education
        const baseName = user.tier_name.charAt(0).toUpperCase() + user.tier_name.slice(1);
        if (user.tier_type === 'lifetime') return `Lifetime ${baseName}`;
        const typeLabel = user.tier_type
            ? user.tier_type.charAt(0).toUpperCase() + user.tier_type.slice(1)
            : '';
        return `${baseName} ${typeLabel}`.trim();
    }, []);

    return {
        users,
        loading,
        error,
        hasMore,
        filters,
        setFilter,
        loadMore,
        refetch,
        regions,
        tierNames,
        tierTypes,
        getTierDisplay,
    };
}
