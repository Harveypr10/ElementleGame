import { useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useGameMode, type GameMode } from '@/contexts/GameModeContext';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { readLocal, CACHE_KEYS } from '@/lib/localCache';

interface ModeToggleProps {
  onModeChange?: (mode: GameMode) => void;
  onLocalClickGuest?: () => void;
  globalLabel?: string;
  localLabel?: string;
}

export function ModeToggle({ onModeChange, onLocalClickGuest, globalLabel, localLabel: externalLocalLabel }: ModeToggleProps) {
  const { gameMode, setGameMode, isGlobalMode } = useGameMode();
  const { isAuthenticated } = useAuth();
  const { profile } = useProfile();
  const toggleRef = useRef<HTMLDivElement>(null);

  // Get cached profile for instant display
  const cachedProfile = useMemo(() => readLocal(CACHE_KEYS.PROFILE), []);

  // Determine local label with name length check
  const localLabel = useMemo(() => {
    if (externalLocalLabel) return externalLocalLabel;
    
    const firstName = profile?.firstName || cachedProfile?.firstName;
    if (isAuthenticated && firstName) {
      // If name is 12+ characters, use "Personal" instead
      return firstName.length >= 12 ? 'Personal' : firstName;
    }
    return 'Personal';
  }, [isAuthenticated, profile?.firstName, cachedProfile?.firstName, externalLocalLabel]);

  // Calculate if we need a wider toggle (for longer names)
  const needsWiderToggle = useMemo(() => {
    const globalLen = (globalLabel || 'UK Edition').length;
    const localLen = localLabel.length;
    return globalLen > 10 || localLen > 8;
  }, [globalLabel, localLabel]);

  // Calculate if we need smaller text (to prevent overflow)
  const needsSmallerText = useMemo(() => {
    const globalLen = (globalLabel || 'UK Edition').length;
    const localLen = localLabel.length;
    return globalLen > 12 || localLen > 10;
  }, [globalLabel, localLabel]);

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

  const toggleWidth = needsWiderToggle ? 'w-56' : 'w-48';
  const textSize = needsSmallerText ? 'text-xs' : 'text-sm';

  return (
    <div 
      ref={toggleRef}
      className={`relative inline-flex items-center rounded-full bg-muted p-1 ${toggleWidth} h-10`}
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
          relative z-10 flex-1 ${textSize} font-medium transition-colors duration-200 truncate px-1
          ${isGlobalMode ? 'text-foreground' : 'text-muted-foreground'}
        `}
        data-testid="button-mode-global"
        role="tab"
        aria-selected={isGlobalMode}
        aria-controls="global-pane"
        tabIndex={isGlobalMode ? 0 : -1}
      >
        {globalLabel || 'UK Edition'}
      </button>

      {/* Local/Personal button */}
      <button
        onClick={() => handleToggle('local')}
        onKeyDown={(e) => handleKeyDown(e, 'local')}
        className={`
          relative z-10 flex-1 ${textSize} font-medium transition-colors duration-200 truncate px-1
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
