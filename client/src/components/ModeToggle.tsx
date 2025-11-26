import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useGameMode, type GameMode } from '@/contexts/GameModeContext';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';

interface ModeToggleProps {
  onModeChange?: (mode: GameMode) => void;
  onLocalClickGuest?: () => void;
  globalLabel?: string;
}

export function ModeToggle({ onModeChange, onLocalClickGuest, globalLabel }: ModeToggleProps) {
  const { gameMode, setGameMode, isGlobalMode } = useGameMode();
  const { isAuthenticated } = useAuth();
  const { profile } = useProfile();
  const toggleRef = useRef<HTMLDivElement>(null);

  const localLabel = isAuthenticated && profile?.firstName 
    ? profile.firstName 
    : 'Personal';

  const handleToggle = (mode: GameMode) => {
    if (mode === 'local' && !isAuthenticated && onLocalClickGuest) {
      onLocalClickGuest();
      return;
    }
    setGameMode(mode);
    onModeChange?.(mode);
  };

  const handleKeyDown = (e: React.KeyboardEvent, mode: GameMode) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleToggle(mode);
    } else if (e.key === 'ArrowLeft' && mode === 'local') {
      e.preventDefault();
      handleToggle('global');
    } else if (e.key === 'ArrowRight' && mode === 'global') {
      e.preventDefault();
      handleToggle('local');
    }
  };

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion && toggleRef.current) {
      toggleRef.current.style.transition = 'none';
    }
  }, []);

  return (
    <div 
      ref={toggleRef}
      className="relative inline-flex items-center rounded-full bg-muted p-1 w-48 h-10"
      data-testid="toggle-mode"
      role="tablist"
      aria-label="Game mode selection"
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
          stiffness: 300,
          damping: 30,
        }}
        data-testid="toggle-slider"
      />

      {/* Global button */}
      <button
        onClick={() => handleToggle('global')}
        onKeyDown={(e) => handleKeyDown(e, 'global')}
        className={`
          relative z-10 flex-1 text-sm font-medium transition-colors duration-200 truncate px-1
          ${isGlobalMode ? 'text-foreground' : 'text-muted-foreground'}
        `}
        data-testid="button-mode-global"
        role="tab"
        aria-selected={isGlobalMode}
        aria-controls="global-pane"
        tabIndex={isGlobalMode ? 0 : -1}
      >
        {globalLabel || 'Global'}
      </button>

      {/* Local/Personal button */}
      <button
        onClick={() => handleToggle('local')}
        onKeyDown={(e) => handleKeyDown(e, 'local')}
        className={`
          relative z-10 flex-1 text-sm font-medium transition-colors duration-200 truncate px-1
          ${!isGlobalMode ? 'text-foreground' : 'text-muted-foreground'}
        `}
        data-testid="button-mode-local"
        role="tab"
        aria-selected={!isGlobalMode}
        aria-controls="local-pane"
        tabIndex={!isGlobalMode ? 0 : -1}
      >
        {localLabel}
      </button>
    </div>
  );
}
