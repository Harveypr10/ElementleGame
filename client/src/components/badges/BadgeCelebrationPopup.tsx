import { useEffect, useRef } from "react";
import { soundManager } from "@/lib/sounds";
import { motion } from "framer-motion";
import { pageVariants, pageTransition } from "@/lib/pageAnimations";
import { Target, Flame, Percent } from "lucide-react";
import type { UserBadgeWithDetails } from "@shared/schema";
import badgePlaceholder from "@assets/Signup-Hamster-Transparent.png";

declare global {
  interface Window {
    lottie: {
      loadAnimation: (options: {
        container: HTMLElement | null;
        renderer: string;
        loop: boolean;
        autoplay: boolean;
        path: string;
      }) => {
        destroy: () => void;
      };
    };
  }
}

interface BadgeCelebrationPopupProps {
  badge: UserBadgeWithDetails;
  onDismiss: () => void;
}

export function BadgeCelebrationPopup({ badge, onDismiss }: BadgeCelebrationPopupProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<{ destroy: () => void } | null>(null);

  useEffect(() => {
    soundManager.playStreak();
    
    if (containerRef.current && window.lottie) {
      animationRef.current = window.lottie.loadAnimation({
        container: containerRef.current,
        renderer: 'svg',
        loop: true,
        autoplay: true,
        path: '/assets/Trophy.json',
      });
    }

    const timer = setTimeout(() => {
      onDismiss();
    }, 5000);

    return () => {
      clearTimeout(timer);
      if (animationRef.current) {
        animationRef.current.destroy();
      }
    };
  }, [onDismiss]);

  const normalizeCategory = (cat: string): 'elementle' | 'streak' | 'percentile' | null => {
    const lower = cat.toLowerCase();
    if (lower.includes('elementle')) return 'elementle';
    if (lower.includes('streak')) return 'streak';
    if (lower.includes('percentile')) return 'percentile';
    return null;
  };

  const getCategoryIcon = () => {
    const category = normalizeCategory(badge.badge.category);
    const iconClass = "w-6 h-6";
    
    switch (category) {
      case 'elementle':
        return <Target className={iconClass} />;
      case 'streak':
        return <Flame className={iconClass} />;
      case 'percentile':
        return <Percent className={iconClass} />;
      default:
        return null;
    }
  };

  const getBadgeTitle = () => {
    const category = normalizeCategory(badge.badge.category);
    const threshold = badge.badge.threshold;
    
    switch (category) {
      case 'elementle':
        return threshold === 1 ? 'Perfect Guess!' : 'Elementle In 2!';
      case 'streak':
        if (threshold >= 365) return `${threshold} Day Legend!`;
        if (threshold >= 100) return `${threshold} Day Master!`;
        if (threshold >= 30) return `${threshold} Day Champion!`;
        return `${threshold} Day Streak!`;
      case 'percentile':
        return `Top ${threshold}% Player!`;
      default:
        return 'Badge Earned!';
    }
  };

  const getBadgeDescription = () => {
    const category = normalizeCategory(badge.badge.category);
    const threshold = badge.badge.threshold;
    
    switch (category) {
      case 'elementle':
        return threshold === 1 
          ? "You guessed correctly on your first try!" 
          : "You guessed correctly in just 2 attempts!";
      case 'streak':
        return `You've played ${threshold} days in a row!`;
      case 'percentile':
        return `You're in the top ${threshold}% of players!`;
      default:
        return "Congratulations on your achievement!";
    }
  };

  const getBadgeColor = () => {
    const category = normalizeCategory(badge.badge.category);
    const threshold = badge.badge.threshold;
    
    switch (category) {
      case 'elementle':
        return threshold === 1 ? 'text-amber-400' : 'text-emerald-400';
      case 'streak':
        if (threshold >= 365) return 'text-purple-400';
        if (threshold >= 100) return 'text-amber-400';
        if (threshold >= 30) return 'text-cyan-400';
        return 'text-emerald-400';
      case 'percentile':
        if (threshold <= 1) return 'text-purple-400';
        if (threshold <= 5) return 'text-amber-400';
        if (threshold <= 10) return 'text-cyan-400';
        return 'text-emerald-400';
      default:
        return 'text-amber-400';
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onDismiss}
      data-testid="badge-celebration-overlay"
      initial={pageVariants.fadeIn.initial}
      animate={pageVariants.fadeIn.animate}
      exit={pageVariants.fadeIn.exit}
      transition={pageTransition}
    >
      <div
        className="cursor-pointer p-8 max-w-sm w-full mx-4 text-center"
        onClick={onDismiss}
        data-testid="badge-celebration-card"
      >
        <div className="flex flex-col items-center gap-4">
          <div 
            ref={containerRef}
            className="w-48 h-48"
            data-testid="trophy-animation"
          />
          
          <img 
            src={badgePlaceholder} 
            alt="Badge" 
            className="w-20 h-20 object-contain"
            data-testid="badge-image"
          />
          
          <div className={`flex items-center gap-2 ${getBadgeColor()}`}>
            {getCategoryIcon()}
            <h3 
              className="text-2xl font-bold"
              data-testid="text-badge-title"
            >
              {getBadgeTitle()}
            </h3>
          </div>
          
          <p 
            className="text-lg text-white/80"
            data-testid="text-badge-description"
          >
            {getBadgeDescription()}
          </p>

          <div className="flex items-center gap-2 mt-2">
            <span className="text-sm text-white/60">
              Badge Earned
            </span>
          </div>

          <p className="text-sm text-white/40 mt-4">
            Click anywhere to dismiss
          </p>
        </div>
      </div>
    </motion.div>
  );
}
