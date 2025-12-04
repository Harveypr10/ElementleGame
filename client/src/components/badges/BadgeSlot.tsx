import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Hexagon, Target, Flame, Percent } from "lucide-react";
import { motion } from "framer-motion";
import type { UserBadgeWithDetails } from "@shared/schema";

interface BadgeSlotProps {
  category: 'elementle' | 'streak' | 'percentile';
  badge: UserBadgeWithDetails | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isAnimating?: boolean;
  onAnimationComplete?: () => void;
}

export function BadgeSlot({ category, badge, size = 'xl', isAnimating = false, onAnimationComplete }: BadgeSlotProps) {
  const isEmpty = !badge;
  
  const sizeClasses = {
    sm: 'w-12 h-14',
    md: 'w-16 h-20',
    lg: 'w-20 h-24',
    xl: 'w-24 h-32',
  };
  
  const iconSizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
    xl: 'w-7 h-7',
  };
  
  const categoryLabelClasses = {
    sm: 'text-[10px]',
    md: 'text-xs',
    lg: 'text-sm',
    xl: 'text-sm',
  };
  
  const valueTextClasses = {
    sm: 'text-sm font-bold',
    md: 'text-base font-bold',
    lg: 'text-lg font-bold',
    xl: 'text-base font-bold',
  };
  
  const badgeNameClasses = {
    sm: 'text-[8px]',
    md: 'text-[10px]',
    lg: 'text-xs',
    xl: 'text-[10px]',
  };

  const getCategoryIcon = () => {
    switch (category) {
      case 'elementle':
        return <Target className={iconSizeClasses[size]} />;
      case 'streak':
        return <Flame className={iconSizeClasses[size]} />;
      case 'percentile':
        return <Percent className={iconSizeClasses[size]} />;
    }
  };

  const getCategoryLabel = () => {
    switch (category) {
      case 'elementle':
        return 'Won In';
      case 'streak':
        return 'Streak';
      case 'percentile':
        return 'Top %';
    }
  };

  const getBadgeValue = () => {
    if (!badge) return null;
    const threshold = badge.badge.threshold;
    
    switch (category) {
      case 'elementle':
        return threshold === 1 ? '1' : '2';
      case 'streak':
        return threshold.toString();
      case 'percentile':
        return `${threshold}%`;
    }
  };

  const getBadgeColor = () => {
    if (!badge) return 'from-gray-300 to-gray-400 dark:from-gray-600 dark:to-gray-700';
    
    const threshold = badge.badge.threshold;
    
    switch (category) {
      case 'elementle':
        return threshold === 1 
          ? 'from-amber-400 to-amber-600' 
          : 'from-emerald-400 to-emerald-600';
      case 'streak':
        if (threshold >= 365) return 'from-purple-500 to-purple-700';
        if (threshold >= 100) return 'from-amber-400 to-amber-600';
        if (threshold >= 30) return 'from-cyan-400 to-cyan-600';
        return 'from-emerald-400 to-emerald-600';
      case 'percentile':
        if (threshold <= 1) return 'from-purple-500 to-purple-700';
        if (threshold <= 5) return 'from-amber-400 to-amber-600';
        if (threshold <= 10) return 'from-cyan-400 to-cyan-600';
        return 'from-emerald-400 to-emerald-600';
    }
  };

  // Animation state for newly awarded badges
  const [hasAnimated, setHasAnimated] = useState(false);
  
  // Reset animation state when badge changes (e.g., new threshold in same category)
  useEffect(() => {
    if (isAnimating) {
      setHasAnimated(false);
    }
  }, [badge?.badge?.id, isAnimating]);
  
  // Handle animation completion via framer-motion callback
  const handleAnimationComplete = () => {
    setHasAnimated(true);
    if (onAnimationComplete) {
      onAnimationComplete();
    }
  };

  // Badge content to render (with or without animation)
  const badgeContent = (
    <>
      <Hexagon 
        className={cn(
          "w-full h-full drop-shadow-md",
          isEmpty 
            ? "text-gray-300 dark:text-gray-600" 
            : `text-transparent fill-current bg-gradient-to-b ${getBadgeColor()}`
        )}
        style={!isEmpty ? {
          background: `linear-gradient(to bottom, var(--tw-gradient-from), var(--tw-gradient-to))`,
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
        } : undefined}
        fill={isEmpty ? 'currentColor' : 'url(#badgeGradient)'}
        strokeWidth={1.5}
      />
      
      {!isEmpty && (
        <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
          <defs>
            <linearGradient id={`badgeGradient-${category}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style={{ stopColor: 'rgb(251, 191, 36)' }} />
              <stop offset="100%" style={{ stopColor: 'rgb(217, 119, 6)' }} />
            </linearGradient>
          </defs>
        </svg>
      )}
      
      <div className={cn(
        "absolute inset-0 flex flex-col items-center justify-center",
        isEmpty ? "text-gray-400 dark:text-gray-500" : "text-white"
      )}>
        {isEmpty ? (
          <span className={cn(valueTextClasses[size], "opacity-50")}>?</span>
        ) : (
          <>
            {getCategoryIcon()}
            <span className={cn(valueTextClasses[size], "leading-none mt-1")}>
              {getBadgeValue()}
            </span>
          </>
        )}
      </div>
    </>
  );

  return (
    <div className="flex flex-col items-center gap-1">
      {/* Category title - top */}
      <span className={cn(
        categoryLabelClasses[size],
        "text-center text-muted-foreground font-bold whitespace-nowrap"
      )}>
        {getCategoryLabel()}
      </span>
      
      {/* Badge hexagon - middle (with animation if newly awarded) */}
      {isAnimating && !hasAnimated ? (
        <motion.div 
          className={cn(
            "relative flex items-center justify-center",
            sizeClasses[size]
          )}
          data-testid={`badge-slot-${category}`}
          initial={{ opacity: 0, scale: 0.1 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ 
            duration: 0.6, 
            ease: [0.34, 1.56, 0.64, 1], // Bouncy ease
            delay: 0.1
          }}
          onAnimationComplete={handleAnimationComplete}
        >
          {badgeContent}
        </motion.div>
      ) : (
        <div 
          className={cn(
            "relative flex items-center justify-center",
            "transition-all duration-300",
            sizeClasses[size]
          )}
          data-testid={`badge-slot-${category}`}
        >
          {badgeContent}
        </div>
      )}
      
      {/* Badge name - bottom (only show when earned) */}
      {!isEmpty && (
        <motion.span 
          className={cn(
            badgeNameClasses[size],
            "text-center text-muted-foreground leading-tight line-clamp-2 max-w-[14rem]"
          )}
          initial={isAnimating && !hasAnimated ? { opacity: 0, y: 10 } : false}
          animate={isAnimating && !hasAnimated ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: 0.3, delay: 0.5 }}
        >
          {badge.badge.name}
        </motion.span>
      )}
    </div>
  );
}
