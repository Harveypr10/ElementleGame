/**
 * useAdminDashboard.ts
 * Data hook for the Analytics Dashboard.
 * Supports bidirectional date editing — changing start/end dates
 * and having the other auto-calculate from the selected timeframe.
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';

// ── Types ─────────────────────────────────────────────────

export type TimeframeKey = '1d' | '7d' | '14d' | '30d' | '60d' | '90d' | '6m' | '12m' | '2y' | 'all';
export type GameMode = 'all' | 'region' | 'user';

export interface DashboardMetrics {
    players: { signups: number; unique_users: number; unique_guests: number };
    games: {
        total_region: number; total_user: number; total: number;
        avg_guesses: number; guess_distribution: Record<string, number>;
        badges_awarded: number; badge_breakdown: Record<string, number>;
    };
    ads: { total_watched: number };
    subscriptions: {
        pro_signups: number; active_pro: number;
        auto_renew_pct: number; distribution: Record<string, number>;
    };
    financial: {
        conversion_rate: number; mrr: number; ltv: number;
        ad_revenue: number; sub_revenue: number; total_revenue: number;
    };
}

export interface TimeseriesPoint { period: string; value: number }
export interface Region { code: string; name: string }

export type MetricKey =
    | 'signups' | 'games_played' | 'unique_players' | 'guests_played'
    | 'ads_watched' | 'pro_signups' | 'sub_revenue' | 'total_revenue'
    | 'avg_guesses' | 'badges_awarded';

export const METRIC_LABELS: Record<MetricKey, string> = {
    signups: 'Signups', games_played: 'Games Played', unique_players: 'Unique Players',
    guests_played: 'Guest Players', ads_watched: 'Ads Watched', pro_signups: 'Pro Signups',
    sub_revenue: 'Sub Revenue', total_revenue: 'Total Revenue', avg_guesses: 'Avg Guesses',
    badges_awarded: 'Badges',
};

export const ALL_METRICS: MetricKey[] = [
    'signups', 'games_played', 'unique_players', 'guests_played',
    'ads_watched', 'pro_signups', 'sub_revenue', 'total_revenue',
    'avg_guesses', 'badges_awarded',
];

// ── Date helpers ──────────────────────────────────────────

const TIMEFRAME_DAYS: Record<TimeframeKey, number | null> = {
    '1d': 1, '7d': 7, '14d': 14, '30d': 30,
    '60d': 60, '90d': 90, '6m': 180, '12m': 365, '2y': 730, 'all': null,
};

function addDays(dateStr: string, days: number): string {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return formatYMD(d);
}

function formatYMD(d: Date): string {
    return d.toISOString().split('T')[0];
}

/** Convert YYYY-MM-DD → DD/MM/YYYY for display */
export function toDisplayDate(ymd: string): string {
    const [y, m, d] = ymd.split('-');
    return `${d}/${m}/${y}`;
}

/** Convert DD/MM/YYYY → YYYY-MM-DD for internal use */
export function fromDisplayDate(dmy: string): string | null {
    const parts = dmy.split('/');
    if (parts.length !== 3) return null;
    const [d, m, y] = parts;
    if (d.length !== 2 || m.length !== 2 || y.length !== 4) return null;
    const result = `${y}-${m}-${d}`;
    if (isNaN(new Date(result + 'T00:00:00').getTime())) return null;
    return result;
}

// ── Hook ──────────────────────────────────────────────────

export function useAdminDashboard() {
    const yesterday = useMemo(() => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return formatYMD(d);
    }, []);

    // Filters
    const [timeframe, setTimeframe] = useState<TimeframeKey>('30d');
    const [startDate, setStartDateRaw] = useState<string>(() => addDays(yesterday, -30));
    const [endDate, setEndDateRaw] = useState<string>(yesterday);
    const [region, setRegion] = useState<string>('');
    const [gameMode, setGameMode] = useState<GameMode>('all');

    // Track which date was last manually changed: 'start' or 'end'
    const lastDateEdited = useRef<'start' | 'end'>('end');

    // Data
    const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
    const [timeseries, setTimeseries] = useState<{
        daily: TimeseriesPoint[]; weekly: TimeseriesPoint[]; monthly: TimeseriesPoint[];
    }>({ daily: [], weekly: [], monthly: [] });
    const [activeMetric, setActiveMetric] = useState<MetricKey | null>(null);
    const [regions, setRegions] = useState<Region[]>([]);
    const [loading, setLoading] = useState(false);
    const [timeseriesLoading, setTimeseriesLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch regions on mount
    useEffect(() => {
        supabase.from('regions').select('code, name').order('name').then(({ data }) => {
            if (data) setRegions(data as Region[]);
        });
    }, []);

    // ── Date setters ──────────────────────────────────────

    /** User manually changes start date → auto-compute end date from timeframe */
    const setStartDate = useCallback((ymd: string) => {
        lastDateEdited.current = 'start';
        setStartDateRaw(ymd);
        // Auto-compute end date from timeframe
        const days = TIMEFRAME_DAYS[timeframe];
        if (days !== null) {
            setEndDateRaw(addDays(ymd, days));
        }
    }, [timeframe]);

    /** User manually changes end date → auto-compute start date from timeframe */
    const setEndDate = useCallback((ymd: string) => {
        lastDateEdited.current = 'end';
        setEndDateRaw(ymd);
        // Auto-compute start date from timeframe
        const days = TIMEFRAME_DAYS[timeframe];
        if (days !== null) {
            setStartDateRaw(addDays(ymd, -days));
        }
    }, [timeframe]);

    /** User clicks a timeframe → compute based on lastDateEdited */
    const changeTimeframe = useCallback((tf: TimeframeKey) => {
        setTimeframe(tf);
        const days = TIMEFRAME_DAYS[tf];
        if (days === null) {
            // "All" — set start to earliest, keep end as is
            setStartDateRaw('2024-01-01');
            return;
        }
        if (lastDateEdited.current === 'start') {
            // Last changed start → compute end = start + days
            setEndDateRaw(prev => addDays(startDate, days));
        } else {
            // Last changed end (or default) → compute start = end - days
            setStartDateRaw(prev => addDays(endDate, -days));
        }
    }, [startDate, endDate]);

    // ── Fetch dashboard metrics ───────────────────────────
    const fetchMetrics = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            const { data, error: rpcError } = await supabase.rpc('admin_dashboard_metrics', {
                p_start: startDate, p_end: endDate,
                p_region: region || undefined, p_mode: gameMode,
            });
            if (rpcError) throw rpcError;
            setMetrics(data as unknown as DashboardMetrics);
        } catch (e: any) {
            setError(e.message || 'Failed to load metrics');
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate, region, gameMode]);

    // ── Fetch timeseries ──────────────────────────────────
    const fetchTimeseries = useCallback(async (metric: MetricKey) => {
        setTimeseriesLoading(true);
        try {
            const groups = ['day', 'week', 'month'] as const;
            const results = await Promise.all(
                groups.map(g => supabase.rpc('admin_timeseries_metric', {
                    p_metric: metric, p_start: startDate, p_end: endDate,
                    p_group: g, p_region: region || undefined, p_mode: gameMode,
                }))
            );
            const [daily, weekly, monthly] = results.map(r => (r.data || []) as TimeseriesPoint[]);
            setTimeseries({ daily, weekly, monthly });
        } catch (e: any) {
            console.error('Timeseries fetch error:', e);
        } finally {
            setTimeseriesLoading(false);
        }
    }, [startDate, endDate, region, gameMode]);

    useEffect(() => { fetchMetrics(); }, [fetchMetrics]);
    useEffect(() => { if (activeMetric) fetchTimeseries(activeMetric); }, [activeMetric, fetchTimeseries]);

    const refresh = useCallback(() => {
        fetchMetrics();
        if (activeMetric) fetchTimeseries(activeMetric);
    }, [fetchMetrics, fetchTimeseries, activeMetric]);

    const changeRegion = useCallback((code: string) => setRegion(code), []);
    const changeGameMode = useCallback((mode: GameMode) => setGameMode(mode), []);
    const selectMetric = useCallback((metric: MetricKey | null) => setActiveMetric(metric), []);

    return {
        metrics, timeseries, loading, timeseriesLoading, error,
        activeMetric, timeframe, startDate, endDate, region, regions, gameMode,
        changeTimeframe, setStartDate, setEndDate, changeRegion, changeGameMode,
        selectMetric, refresh,
    };
}
