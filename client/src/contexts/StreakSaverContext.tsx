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
  isJustCompleted: (gameType: 'region' | 'user') => boolean;
  acknowledgeCompletion: (gameType: 'region' | 'user') => void;
}

const StreakSaverContext = createContext<StreakSaverContextValue | null>(null);

export function StreakSaverProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StreakSaverSession | null>(null);
  const [onSessionComplete, setOnSessionComplete] = useState<((result: { won: boolean; gameType: 'region' | 'user' }) => void) | undefined>();
  const [onSessionCancelled, setOnSessionCancelled] = useState<((gameType: 'region' | 'user') => void) | undefined>();
  
  // Track which game types have just been completed (to prevent popup re-appearing during cache update)
  const [justCompletedRegion, setJustCompletedRegion] = useState(false);
  const [justCompletedUser, setJustCompletedUser] = useState(false);

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
    const { gameType } = session;
    
    // Mark this game type as "just completed" to suppress popup until API confirms flag is cleared
    if (gameType === 'region') {
      setJustCompletedRegion(true);
    } else {
      setJustCompletedUser(true);
    }
    
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

  // Check if a streak saver was just completed for this game type
  // Used to prevent popup from re-appearing due to stale API cache
  const isJustCompleted = useCallback((gameType: 'region' | 'user'): boolean => {
    return gameType === 'region' ? justCompletedRegion : justCompletedUser;
  }, [justCompletedRegion, justCompletedUser]);

  // Called when the API confirms the missed flag is cleared (hasMissed becomes false)
  // This clears the "just completed" state so future misses can trigger the popup
  const acknowledgeCompletion = useCallback((gameType: 'region' | 'user') => {
    console.log('[StreakSaverContext] Acknowledging completion for:', gameType);
    if (gameType === 'region') {
      setJustCompletedRegion(false);
    } else {
      setJustCompletedUser(false);
    }
  }, []);

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
        isJustCompleted,
        acknowledgeCompletion,
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
