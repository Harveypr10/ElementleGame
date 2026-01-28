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
    isJustCompleted: (gameType: 'REGION' | 'USER') => boolean;
    acknowledgeCompletion: (gameType: 'REGION' | 'USER') => void;
}

const StreakSaverContext = createContext<StreakSaverContextType | null>(null);

export function StreakSaverProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<StreakSaverSession | null>(null);
    const [justCompletedRegion, setJustCompletedRegion] = useState(false);
    const [justCompletedUser, setJustCompletedUser] = useState(false);

    const startStreakSaverSession = (gameType: 'REGION' | 'USER', date: string, streak: number) => {
        console.log('[StreakSaver] Starting session:', { gameType, date, streak });
        setSession({ gameType, puzzleDate: date, previousStreak: streak });
    };

    const completeStreakSaverSession = (won: boolean) => {
        console.log('[StreakSaver] Completing session:', { won, session });

        if (session) {
            // Mark this game type as "just completed" to suppress popup until API confirms flag is cleared
            if (session.gameType === 'REGION') {
                setJustCompletedRegion(true);
            } else {
                setJustCompletedUser(true);
            }
        }

        setSession(null);
    };

    const isJustCompleted = (gameType: 'REGION' | 'USER') => {
        return gameType === 'REGION' ? justCompletedRegion : justCompletedUser;
    };

    const acknowledgeCompletion = (gameType: 'REGION' | 'USER') => {
        if (gameType === 'REGION') {
            setJustCompletedRegion(false);
        } else {
            setJustCompletedUser(false);
        }
    };

    return (
        <StreakSaverContext.Provider
            value={{
                isInStreakSaverMode: !!session,
                streakSaverSession: session,
                startStreakSaverSession,
                completeStreakSaverSession,
                isJustCompleted,
                acknowledgeCompletion,
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
