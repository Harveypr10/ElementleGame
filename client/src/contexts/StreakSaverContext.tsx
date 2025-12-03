import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface StreakSaverSession {
  gameType: 'region' | 'user';
  puzzleDate: string; // Yesterday's date in YYYY-MM-DD format
  originalStreak: number;
}

interface StreakSaverContextValue {
  isInStreakSaverMode: boolean;
  session: StreakSaverSession | null;
  startStreakSaverSession: (gameType: 'region' | 'user', puzzleDate: string, originalStreak: number) => void;
  completeStreakSaverSession: (won: boolean) => void;
  cancelStreakSaverSession: () => void;
  onSessionComplete?: (result: { won: boolean; gameType: 'region' | 'user' }) => void;
  onSessionCancelled?: (gameType: 'region' | 'user') => void;
  setOnSessionComplete: (callback: ((result: { won: boolean; gameType: 'region' | 'user' }) => void) | undefined) => void;
  setOnSessionCancelled: (callback: ((gameType: 'region' | 'user') => void) | undefined) => void;
}

const StreakSaverContext = createContext<StreakSaverContextValue | null>(null);

export function StreakSaverProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StreakSaverSession | null>(null);
  const [onSessionComplete, setOnSessionComplete] = useState<((result: { won: boolean; gameType: 'region' | 'user' }) => void) | undefined>();
  const [onSessionCancelled, setOnSessionCancelled] = useState<((gameType: 'region' | 'user') => void) | undefined>();

  const startStreakSaverSession = useCallback((
    gameType: 'region' | 'user',
    puzzleDate: string,
    originalStreak: number
  ) => {
    console.log('[StreakSaverContext] Starting session:', { gameType, puzzleDate, originalStreak });
    setSession({ gameType, puzzleDate, originalStreak });
  }, []);

  const completeStreakSaverSession = useCallback((won: boolean) => {
    if (!session) return;
    console.log('[StreakSaverContext] Completing session:', { won, session });
    const gameType = session.gameType;
    setSession(null);
    onSessionComplete?.({ won, gameType });
  }, [session, onSessionComplete]);

  const cancelStreakSaverSession = useCallback(() => {
    if (!session) return;
    console.log('[StreakSaverContext] Cancelling session:', session);
    const gameType = session.gameType;
    setSession(null);
    onSessionCancelled?.(gameType);
  }, [session, onSessionCancelled]);

  return (
    <StreakSaverContext.Provider
      value={{
        isInStreakSaverMode: session !== null,
        session,
        startStreakSaverSession,
        completeStreakSaverSession,
        cancelStreakSaverSession,
        onSessionComplete,
        onSessionCancelled,
        setOnSessionComplete,
        setOnSessionCancelled,
      }}
    >
      {children}
    </StreakSaverContext.Provider>
  );
}

export function useStreakSaver() {
  const context = useContext(StreakSaverContext);
  if (!context) {
    throw new Error('useStreakSaver must be used within a StreakSaverProvider');
  }
  return context;
}
