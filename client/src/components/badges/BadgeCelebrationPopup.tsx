import { useEffect, useRef } from "react";
import { soundManager } from "@/lib/sounds";
import { motion } from "framer-motion";
import { pageVariants, pageTransition } from "@/lib/pageAnimations";
import { Target, Flame, Percent } from "lucide-react";
import type { UserBadgeWithDetails } from "@shared/schema";
import badgePlaceholder from "@assets/Signup-Hamster-Cutout.png";

import Streak_Hamster_Black from "@assets/Streak-Hamster-Black.svg";

interface LottieAnimation {
  destroy: () => void;
  play: () => void;
  stop: () => void;
  pause: () => void;
  setSpeed: (speed: number) => void;
  goToAndStop: (value: number, isFrame: boolean) => void;
  goToAndPlay: (value: number, isFrame: boolean) => void;
  getDuration: (inFrames?: boolean) => number;
  addEventListener: (event: string, cb: () => void) => void;
  removeEventListener: (event: string, cb: () => void) => void;
}

declare global {
  interface Window {
    lottie: {
      loadAnimation: (options: {
        container: HTMLElement | null;
        renderer: string;
        loop: boolean | number;
        autoplay: boolean;
        path: string;
      }) => LottieAnimation;
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
      const animation = window.lottie.loadAnimation({
        container: containerRef.current,
        renderer: "svg",
        loop: 1,          // loop exactly twice
        autoplay: false,
        path: "/assets/Trophy.json",
      });

      // store reference
      animationRef.current = animation;

      // freeze on last frame when finished
      animation.addEventListener("complete", () => {
        const lastFrame = animation.getDuration(true); // total frames
        animation.goToAndStop(lastFrame, true);
      });
      // 👇 start after 500ms
      setTimeout(() => {
        animation.play();
      }, 500);
    }

    // increase the timeout (8s instead of 5s)
    const timer = setTimeout(() => {
      onDismiss();
    }, 8000);

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
        return `You've won ${threshold} days in a row!`;
      case 'percentile':
        return `You're in the top ${threshold}% of players this month!`;
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black backdrop-blur-sm"
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
            src={Streak_Hamster_Black} 
            alt="Badge" 
            className="w-20 h-20 object-contain"
            data-testid="badge-image"
          />
          
          {badge.badgeCount && badge.badgeCount > 1 && (
            <span 
              className="text-lg font-bold text-white/90"
              data-testid="text-badge-count"
            >
              x{badge.badgeCount}
            </span>
          )}
          
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
