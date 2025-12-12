import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Target, Flame, Percent } from "lucide-react";
import { motion } from "framer-motion";
import type { UserBadgeWithDetails } from "@shared/schema";
import badgeImage from "@assets/Signup-Hamster-Cutout.png";

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
  
  const imageSizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-16 h-16',
  };

  const emptyCircleSizeClasses = {
    sm: 'w-12 h-10',
    md: 'w-16 h-14',
    lg: 'w-24 h-20',
    xl: 'w-24 h-20',
  };
  
  const iconSizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
    xl: 'w-5 h-5',
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

  const getBadgeTextColor = () => {
    if (!badge) return 'text-gray-400';
    
    const threshold = badge.badge.threshold;
    
    switch (category) {
      case 'elementle':
        return threshold === 1 ? 'text-amber-500' : 'text-emerald-500';
      case 'streak':
        if (threshold >= 365) return 'text-purple-500';
        if (threshold >= 100) return 'text-amber-500';
        if (threshold >= 30) return 'text-cyan-500';
        return 'text-emerald-500';
      case 'percentile':
        if (threshold <= 1) return 'text-purple-500';
        if (threshold <= 5) return 'text-amber-500';
        if (threshold <= 10) return 'text-cyan-500';
        return 'text-emerald-500';
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
    <div className="relative flex flex-col items-center justify-center w-full h-full">
      {isEmpty ? (
        <div className={cn(
          "flex flex-col items-center justify-center w-full h-full",
          "text-gray-400 dark:text-gray-500"
        )}>
          <div className={cn(
            emptyCircleSizeClasses[size],
            "bg-gray-300 dark:bg-gray-600 flex items-center justify-center"
          )}
          style={{
            clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)'
          }}>
          </div>
        </div>
      ) : (
        <>
          <img 
            src={badgeImage} 
            alt={badge.badge.name}
            className={cn(imageSizeClasses[size], "object-contain")}
          />
          <div className={cn(
            "flex items-center gap-1 mt-1",
            getBadgeTextColor()
          )}>
            {getCategoryIcon()}
            <span className={cn(valueTextClasses[size], "leading-none")}>
              {getBadgeValue()}
            </span>
          </div>
        </>
      )}
    </div>
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
