import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type GameMode = 'global' | 'local';

interface GameModeContextType {
  gameMode: GameMode;
  setGameMode: (mode: GameMode) => void;
  isGlobalMode: boolean;
  isLocalMode: boolean;
  forceGlobalMode: () => void;
}

const GameModeContext = createContext<GameModeContextType | undefined>(undefined);

const GAME_MODE_STORAGE_KEY = 'elementle_game_mode';

interface GameModeProviderProps {
  children: ReactNode;
}

export function GameModeProvider({ children }: GameModeProviderProps) {
  const [gameMode, setGameModeState] = useState<GameMode>(() => {
    // Always initialize to 'global' - guests should see Global mode
    // Authenticated users will have their preference applied after auth check
    return 'global';
  });

  const setGameMode = (mode: GameMode) => {
    setGameModeState(mode);
    localStorage.setItem(GAME_MODE_STORAGE_KEY, mode);
  };

  // Force global mode (used when user logs out or for guests)
  const forceGlobalMode = () => {
    setGameModeState('global');
    localStorage.setItem(GAME_MODE_STORAGE_KEY, 'global');
  };

  const value: GameModeContextType = {
    gameMode,
    setGameMode,
    isGlobalMode: gameMode === 'global',
    isLocalMode: gameMode === 'local',
    forceGlobalMode,
  };

  return (
    <GameModeContext.Provider value={value}>
      {children}
    </GameModeContext.Provider>
  );
}

export function useGameMode() {
  const context = useContext(GameModeContext);
  if (context === undefined) {
    throw new Error('useGameMode must be used within a GameModeProvider');
  }
  return context;
}
