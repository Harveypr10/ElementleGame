import { createContext, useContext, useState, ReactNode } from 'react';

interface StreakSaverSession {
    gameType: 'REGION' | 'USER';
    puzzleDate: string;
    previousStreak: number;
}

interface StreakSaverContextType {
    isInStreakSaverMode: boolean;
    streakSaverSession: StreakSaverSession | null;
    startStreakSaverSession: (gameType: 'REGION' | 'USER', date: string, streak: number) => void;
    completeStreakSaverSession: (won: boolean) => void;
}

const StreakSaverContext = createContext<StreakSaverContextType | null>(null);

export function StreakSaverProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<StreakSaverSession | null>(null);

    const startStreakSaverSession = (gameType: 'REGION' | 'USER', date: string, streak: number) => {
        console.log('[StreakSaver] Starting session:', { gameType, date, streak });
        setSession({ gameType, puzzleDate: date, previousStreak: streak });
    };

    const completeStreakSaverSession = (won: boolean) => {
        console.log('[StreakSaver] Completing session:', { won, session });
        setSession(null);
    };

    return (
        <StreakSaverContext.Provider
            value={{
                isInStreakSaverMode: !!session,
                streakSaverSession: session,
                startStreakSaverSession,
                completeStreakSaverSession,
            }}
        >
            {children}
        </StreakSaverContext.Provider>
    );
}

export const useStreakSaver = () => {
    const context = useContext(StreakSaverContext);
    if (!context) {
        throw new Error('useStreakSaver must be used within StreakSaverProvider');
    }
    return context;
};
