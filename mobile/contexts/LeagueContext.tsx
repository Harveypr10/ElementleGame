/**
 * LeagueContext.tsx — League membership state + pending join code
 *
 * Provides:
 *  - pendingJoinCode: stored from a deep link, consumed after auth
 *  - selectedLeagueId: current league being viewed
 *  - selectedTimeframe: 'mtd' or 'ytd'
 *  - leagueTablesEnabled: whether league features are active
 *  - newlyJoinedLeagueId: triggers glow effect on the league screen
 *  - pendingLeagueInviteRegion/User: per-mode invitation tracking
 */

import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import type { Timeframe } from '../hooks/useLeagueData';

type LeagueContextType = {
    /** Join code from a deep link (elementle://league/join/XXXX) — consumed after auth. */
    pendingJoinCode: string | null;
    /** Store a pending join code from a deep link. */
    setPendingJoinCode: (code: string | null) => void;
    /** Consume the pending join code — returns the code and clears state. */
    consumePendingJoinCode: () => string | null;

    /** Currently selected league id in the league table view. */
    selectedLeagueId: string | null;
    setSelectedLeagueId: (id: string | null) => void;

    /** Currently selected timeframe. */
    selectedTimeframe: Timeframe;
    setSelectedTimeframe: (tf: Timeframe) => void;

    /** ID of league just joined — triggers glow effects on league screen. */
    newlyJoinedLeagueId: string | null;
    setNewlyJoinedLeagueId: (id: string | null) => void;
    /** Read and clear newlyJoinedLeagueId (one-shot). */
    consumeNewlyJoinedLeagueId: () => string | null;

    /** Per-mode invitation flags — true when user has a pending league invite for that mode. */
    pendingLeagueInviteRegion: boolean;
    pendingLeagueInviteUser: boolean;
    setPendingLeagueInviteRegion: (v: boolean) => void;
    setPendingLeagueInviteUser: (v: boolean) => void;
};

const LeagueContext = createContext<LeagueContextType>({
    pendingJoinCode: null,
    setPendingJoinCode: () => { },
    consumePendingJoinCode: () => null,
    selectedLeagueId: null,
    setSelectedLeagueId: () => { },
    selectedTimeframe: 'mtd',
    setSelectedTimeframe: () => { },
    newlyJoinedLeagueId: null,
    setNewlyJoinedLeagueId: () => { },
    consumeNewlyJoinedLeagueId: () => null,
    pendingLeagueInviteRegion: false,
    pendingLeagueInviteUser: false,
    setPendingLeagueInviteRegion: () => { },
    setPendingLeagueInviteUser: () => { },
});

export function LeagueProvider({ children }: { children: React.ReactNode }) {
    // Pending join code from deep link
    const [pendingJoinCode, setPendingJoinCodeState] = useState<string | null>(null);
    const pendingJoinCodeRef = useRef<string | null>(null);

    const setPendingJoinCode = useCallback((code: string | null) => {
        pendingJoinCodeRef.current = code;
        setPendingJoinCodeState(code);
    }, []);

    const consumePendingJoinCode = useCallback((): string | null => {
        const code = pendingJoinCodeRef.current;
        if (!code) return null;
        pendingJoinCodeRef.current = null;
        setPendingJoinCodeState(null);
        return code;
    }, []);

    // League table view state
    const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
    const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>('mtd');

    // Newly joined league — drives glow effect on league screen
    const [newlyJoinedLeagueId, setNewlyJoinedLeagueIdState] = useState<string | null>(null);
    const newlyJoinedLeagueIdRef = useRef<string | null>(null);

    const setNewlyJoinedLeagueId = useCallback((id: string | null) => {
        newlyJoinedLeagueIdRef.current = id;
        setNewlyJoinedLeagueIdState(id);
    }, []);

    const consumeNewlyJoinedLeagueId = useCallback((): string | null => {
        const id = newlyJoinedLeagueIdRef.current;
        if (!id) return null;
        newlyJoinedLeagueIdRef.current = null;
        setNewlyJoinedLeagueIdState(null);
        return id;
    }, []);

    // Per-mode invitation flags
    const [pendingLeagueInviteRegion, setPendingLeagueInviteRegion] = useState(false);
    const [pendingLeagueInviteUser, setPendingLeagueInviteUser] = useState(false);

    return (
        <LeagueContext.Provider
            value={{
                pendingJoinCode,
                setPendingJoinCode,
                consumePendingJoinCode,
                selectedLeagueId,
                setSelectedLeagueId,
                selectedTimeframe,
                setSelectedTimeframe,
                newlyJoinedLeagueId,
                setNewlyJoinedLeagueId,
                consumeNewlyJoinedLeagueId,
                pendingLeagueInviteRegion,
                pendingLeagueInviteUser,
                setPendingLeagueInviteRegion,
                setPendingLeagueInviteUser,
            }}
        >
            {children}
        </LeagueContext.Provider>
    );
}

export const useLeague = () => useContext(LeagueContext);
