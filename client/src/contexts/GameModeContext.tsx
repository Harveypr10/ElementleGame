import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type GameMode = 'global' | 'local';

interface GameModeContextType {
  gameMode: GameMode;
  setGameMode: (mode: GameMode) => void;
  isGlobalMode: boolean;
  isLocalMode: boolean;
}

const GameModeContext = createContext<GameModeContextType | undefined>(undefined);

const GAME_MODE_STORAGE_KEY = 'elementle_game_mode';

interface GameModeProviderProps {
  children: ReactNode;
}

export function GameModeProvider({ children }: GameModeProviderProps) {
  const [gameMode, setGameModeState] = useState<GameMode>(() => {
    // Initialize from localStorage or default to 'global'
    const stored = localStorage.getItem(GAME_MODE_STORAGE_KEY);
    return (stored === 'local' || stored === 'global') ? stored : 'global';
  });

  const setGameMode = (mode: GameMode) => {
    setGameModeState(mode);
    localStorage.setItem(GAME_MODE_STORAGE_KEY, mode);
  };

  const value: GameModeContextType = {
    gameMode,
    setGameMode,
    isGlobalMode: gameMode === 'global',
    isLocalMode: gameMode === 'local',
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
