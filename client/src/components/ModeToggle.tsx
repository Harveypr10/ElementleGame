import { motion } from 'framer-motion';
import { useGameMode, type GameMode } from '@/contexts/GameModeContext';

interface ModeToggleProps {
  onModeChange?: (mode: GameMode) => void;
}

export function ModeToggle({ onModeChange }: ModeToggleProps) {
  const { gameMode, setGameMode, isGlobalMode } = useGameMode();

  const handleToggle = (mode: GameMode) => {
    setGameMode(mode);
    onModeChange?.(mode);
  };

  return (
    <div 
      className="relative inline-flex items-center rounded-full bg-muted p-1 w-48 h-10"
      data-testid="toggle-mode"
    >
      {/* Animated slider background */}
      <motion.div
        className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full bg-background shadow-sm"
        initial={false}
        animate={{
          left: isGlobalMode ? '4px' : 'calc(50% + 0px)',
        }}
        transition={{
          type: 'spring',
          stiffness: 400,
          damping: 30,
        }}
        data-testid="toggle-slider"
      />

      {/* Global button */}
      <button
        onClick={() => handleToggle('global')}
        className={`
          relative z-10 flex-1 text-sm font-medium transition-colors duration-200
          ${isGlobalMode ? 'text-foreground' : 'text-muted-foreground'}
        `}
        data-testid="button-mode-global"
      >
        Global
      </button>

      {/* Local button */}
      <button
        onClick={() => handleToggle('local')}
        className={`
          relative z-10 flex-1 text-sm font-medium transition-colors duration-200
          ${!isGlobalMode ? 'text-foreground' : 'text-muted-foreground'}
        `}
        data-testid="button-mode-local"
      >
        Local
      </button>
    </div>
  );
}
