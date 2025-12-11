import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence, useMotionValue, animate, PanInfo } from "framer-motion";
import { X, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Badge, UserBadgeWithDetails } from "@shared/schema";
import badgeImage from "@assets/Signup-Hamster-Transparent.png";
import { useAdBannerActive } from "@/components/AdBanner";

type CategoryType = 'elementle' | 'streak' | 'percentile';
type HighestBadges = Record<CategoryType, UserBadgeWithDetails | null>;

interface AllBadgesPopupProps {
  gameType: 'USER' | 'REGION';
  earnedBadges?: HighestBadges | null;
  initialCategory?: CategoryType;
  onClose: () => void;
}

interface BadgeItem {
  badge: Badge;
  isEarned: boolean;
  userBadge?: UserBadgeWithDetails;
}

const CATEGORIES: CategoryType[] = ['elementle', 'streak', 'percentile'];

const CATEGORY_CONFIG: Record<CategoryType, {
  title: string;
  getBadgeLabel: (threshold: number) => string;
  getBadgeDescription: (threshold: number) => string;
}> = {
  elementle: {
    title: 'Won In',
    getBadgeLabel: (t) => t === 1 ? '1 Guess' : '2 Guesses',
    getBadgeDescription: (t) => t === 1 
      ? 'Win the game on your first guess'
      : 'Win the game in just 2 guesses',
  },
  streak: {
    title: 'Streak',
    getBadgeLabel: (t) => `${t} Days`,
    getBadgeDescription: (t) => `Maintain a ${t} day winning streak`,
  },
  percentile: {
    title: 'Top %',
    getBadgeLabel: (t) => `Top ${t}%`,
    getBadgeDescription: (t) => `Rank in the top ${t}% of players`,
  },
};

function normalizeCategory(category: string): CategoryType {
  const lower = category.toLowerCase();
  if (lower === 'elementle in' || lower === 'elementle') return 'elementle';
  if (lower === 'streak') return 'streak';
  if (lower === 'percentile') return 'percentile';
  return 'elementle';
}

// Animation variants for category transitions
// When swiping UP or clicking DOWN arrow (going to NEXT category):
//   - Content scrolls UPWARD (exits to negative Y), new content enters from BELOW (positive Y)
// When swiping DOWN or clicking UP arrow (going to PREVIOUS category):
//   - Content scrolls DOWNWARD (exits to positive Y), new content enters from ABOVE (negative Y)
const categoryVariants = {
  enter: (direction: number) => ({
    opacity: 0,
    y: direction > 0 ? 100 : -100, // From below when going next, from above when going prev
  }),
  center: {
    opacity: 1,
    y: 0,
  },
  exit: (direction: number) => ({
    opacity: 0,
    y: direction > 0 ? -100 : 100, // Goes up when going next, goes down when going prev
  }),
};

export function AllBadgesPopup({ gameType, earnedBadges, initialCategory, onClose }: AllBadgesPopupProps) {
  const initialIndex = initialCategory ? CATEGORIES.indexOf(initialCategory) : 0;
  const [currentCategoryIndex, setCurrentCategoryIndex] = useState(initialIndex >= 0 ? initialIndex : 0);
  const [currentBadgeIndex, setCurrentBadgeIndex] = useState<Record<CategoryType, number>>({
    elementle: 0,
    streak: 0,
    percentile: 0,
  });
  // Track animation direction: 1 = going to next (higher index), -1 = going to prev (lower index)
  const [direction, setDirection] = useState(0);
  // Track locked scroll direction during a gesture
  const [lockedDirection, setLockedDirection] = useState<'horizontal' | 'vertical' | null>(null);
  // Track if we're currently animating a category change
  const [isAnimating, setIsAnimating] = useState(false);
  // Track if a category change was triggered (to prevent bounce back)
  const categoryChangeTriggered = useRef(false);
  
  // Motion values for drag tracking
  const dragY = useMotionValue(0);
  const dragX = useMotionValue(0);
  
  // Check if ad banner is active (Standard users)
  const adBannerActive = useAdBannerActive();

  const { data: allBadges } = useQuery<Badge[]>({
    queryKey: ['/api/badges'],
  });

  // Fetch ALL earned badges (not just highest) for exact ID matching
  const allEarnedEndpoint = gameType === 'USER' 
    ? '/api/user/badges/earned/all' 
    : '/api/badges/earned/all';
  
  const { data: allEarnedBadges } = useQuery<UserBadgeWithDetails[]>({
    queryKey: [allEarnedEndpoint],
  });

  // Create a set of earned badge IDs for O(1) lookup
  const earnedBadgeIds = useMemo(() => {
    if (!allEarnedBadges) return new Set<number>();
    return new Set(allEarnedBadges.map(ub => ub.badge.id));
  }, [allEarnedBadges]);

  const currentCategory = CATEGORIES[currentCategoryIndex];
  const config = CATEGORY_CONFIG[currentCategory];

  const getBadgesForCategory = (category: CategoryType): BadgeItem[] => {
    if (!allBadges) return [];

    const categoryBadges = allBadges
      .filter(b => normalizeCategory(b.category) === category)
      .sort((a, b) => a.id - b.id);

    const earnedBadge = earnedBadges?.[category];
    const earnedThreshold = earnedBadge?.badge?.threshold ?? -1;

    return categoryBadges.map(badge => {
      let isEarned: boolean;
      
      if (category === 'elementle') {
        // Elementle badges are INDEPENDENT - check exact badge ID match
        // A user can have "Elementle in 1", "Elementle in 2", both, or neither
        isEarned = earnedBadgeIds.has(badge.id);
      } else if (category === 'percentile') {
        // Percentile badges cascade: lower is better (Top 1% implies Top 5%, 10%, etc.)
        isEarned = earnedThreshold !== -1 && badge.threshold >= earnedThreshold;
      } else {
        // Streak badges cascade: higher is better (30-day streak implies 7-day, 14-day)
        isEarned = earnedThreshold !== -1 && badge.threshold <= earnedThreshold;
      }
      
      // Find the matching user badge for this specific badge if earned
      const matchingUserBadge = allEarnedBadges?.find(ub => ub.badge.id === badge.id);
      
      return {
        badge,
        isEarned,
        userBadge: matchingUserBadge,
      };
    });
  };

  const categoryBadges = getBadgesForCategory(currentCategory);

  useEffect(() => {
    if (categoryBadges.length === 0) return;

    const earnedBadge = earnedBadges?.[currentCategory];
    if (earnedBadge) {
      const earnedIndex = categoryBadges.findIndex(
        b => b.badge.id === earnedBadge.badge.id
      );
      if (earnedIndex !== -1) {
        setCurrentBadgeIndex(prev => ({
          ...prev,
          [currentCategory]: earnedIndex,
        }));
        return;
      }
    }
    setCurrentBadgeIndex(prev => ({
      ...prev,
      [currentCategory]: 0,
    }));
  }, [currentCategory, categoryBadges.length, earnedBadges]);

  const handleBadgeSwipe = (swipeDirection: number) => {
    const badges = getBadgesForCategory(currentCategory);
    const currentIndex = currentBadgeIndex[currentCategory];
    const newIndex = Math.max(0, Math.min(badges.length - 1, currentIndex + swipeDirection));
    
    setCurrentBadgeIndex(prev => ({
      ...prev,
      [currentCategory]: newIndex,
    }));
  };

  const handleCategoryChange = (newIndex: number) => {
    if (newIndex === currentCategoryIndex) return;
    if (newIndex < 0 || newIndex >= CATEGORIES.length) return;
    if (isAnimating) return;
    
    categoryChangeTriggered.current = true;
    // Set direction based on which way we're going
    // Positive direction = going to higher index (next category)
    // Negative direction = going to lower index (previous category)
    setDirection(newIndex > currentCategoryIndex ? 1 : -1);
    setIsAnimating(true);
    setCurrentCategoryIndex(newIndex);
  };

  const handleAnimationComplete = () => {
    setIsAnimating(false);
    categoryChangeTriggered.current = false;
  };

  const handlePanStart = () => {
    setLockedDirection(null);
    categoryChangeTriggered.current = false;
    dragY.set(0);
    dragX.set(0);
  };

  const handlePan = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const { offset } = info;
    
    // Lock direction on first significant movement
    if (lockedDirection === null) {
      const absX = Math.abs(offset.x);
      const absY = Math.abs(offset.y);
      const threshold = 10;
      
      if (absX > threshold || absY > threshold) {
        if (absY > absX) {
          setLockedDirection('vertical');
        } else {
          setLockedDirection('horizontal');
        }
      }
    }
    
    // Update motion values for visual feedback during drag
    if (lockedDirection === 'vertical') {
      dragY.set(offset.y * 0.3); // Damped movement
    } else if (lockedDirection === 'horizontal') {
      dragX.set(offset.x * 0.3);
    }
  };

  const handlePanEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const { offset, velocity } = info;
    const swipeThreshold = 50;
    const velocityThreshold = 500;

    if (lockedDirection === 'vertical') {
      const sufficientSwipe = Math.abs(offset.y) > swipeThreshold || Math.abs(velocity.y) > velocityThreshold;
      
      if (sufficientSwipe) {
        // Swipe up (negative offset.y) = go to next category (higher index)
        // Swipe down (positive offset.y) = go to previous category (lower index)
        const swipeDir = offset.y < 0 ? 1 : -1;
        const newIndex = currentCategoryIndex + swipeDir;
        
        // Only change if valid index
        if (newIndex >= 0 && newIndex < CATEGORIES.length) {
          handleCategoryChange(newIndex);
        }
      }
    } else if (lockedDirection === 'horizontal') {
      if (Math.abs(offset.x) > swipeThreshold || Math.abs(velocity.x) > velocityThreshold) {
        handleBadgeSwipe(offset.x < 0 ? 1 : -1);
      }
    }
    
    // Always animate both dragX and dragY back to center for smooth snap-back
    // The category transition animation is separate from the drag feedback
    animate(dragX, 0, { type: "spring", stiffness: 300, damping: 30 });
    animate(dragY, 0, { type: "spring", stiffness: 300, damping: 30 });
    
    setLockedDirection(null);
  };

  const activeBadgeIndex = currentBadgeIndex[currentCategory];
  const activeBadge = categoryBadges[activeBadgeIndex];

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const arrowButtonColor = "#7DAAE8";

  // Badge sizes increased by 20%: 
  // Original: non-center w-20 h-20 (80px), center w-24 h-24 (96px)
  // New: non-center w-24 h-24 (96px), center approximately 115px
  const badgeSizeNormal = "w-24 h-24"; // 96px (was 80px)
  const badgeSizeCenter = "w-[115px] h-[115px]"; // ~115px (was 96px)

  return (
    <motion.div
      className="fixed inset-0 z-50 bg-background flex flex-col touch-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      data-testid="all-badges-popup"
      onTouchMove={(e) => e.preventDefault()}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-30 p-2 text-muted-foreground hover:text-foreground transition-colors"
        data-testid="button-close-all-badges"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Top section with UP arrow icon (goes to next category) - fixed at top */}
      <div className="relative z-20 pt-8 pb-2 flex justify-center">
        {/* Background overlay to hide content animating behind */}
        <div className="absolute inset-0 bg-background" />
        <div className="relative z-10">
          {currentCategoryIndex < CATEGORIES.length - 1 ? (
            <button
              onClick={() => handleCategoryChange(currentCategoryIndex + 1)}
              className="w-14 h-14 flex items-center justify-center rounded-full transition-opacity hover:opacity-80"
              style={{ backgroundColor: arrowButtonColor }}
              data-testid="button-category-next"
            >
              <ChevronUp className="h-10 w-10 text-white" />
            </button>
          ) : (
            <div className="w-14 h-14" /> 
          )}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col items-center justify-center overflow-hidden touch-none">
        <AnimatePresence mode="wait" custom={direction} initial={false} onExitComplete={handleAnimationComplete}>
          <motion.div
            key={currentCategory}
            custom={direction}
            variants={categoryVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ 
              duration: 0.3,
              ease: "easeOut"
            }}
            className="flex flex-col items-center w-full"
          >
            {/* Title without icon */}
            <div className="flex items-center justify-center text-foreground mb-6">
              <h2 className="text-xl font-bold">{config.title}</h2>
            </div>

            {/* Badge carousel with pan gestures */}
            <motion.div
              className="relative w-full flex items-center justify-center touch-none cursor-grab active:cursor-grabbing overflow-hidden"
              style={{ height: '220px', y: dragY }}
              onPanStart={handlePanStart}
              onPan={handlePan}
              onPanEnd={handlePanEnd}
            >
              <motion.div 
                className="relative flex items-center justify-center" 
                style={{ width: '100%', height: '100%', x: dragX }}
              >
                {categoryBadges.map((item, index) => {
                  const offset = index - activeBadgeIndex;
                  const isCenter = offset === 0;
                  const xPosition = offset * 130; // Increased spacing for larger badges

                  return (
                    <motion.div
                      key={item.badge.id}
                      className="absolute flex flex-col items-center cursor-pointer"
                      initial={false}
                      animate={{
                        x: xPosition,
                        scale: isCenter ? 1 : 0.7,
                        opacity: isCenter ? 1 : (item.isEarned ? 0.7 : 0.3),
                        zIndex: isCenter ? 10 : 1,
                      }}
                      transition={{ 
                        type: "spring", 
                        stiffness: 300, 
                        damping: 30 
                      }}
                      onClick={() => {
                        setCurrentBadgeIndex(prev => ({
                          ...prev,
                          [currentCategory]: index,
                        }));
                      }}
                      data-testid={`badge-item-${item.badge.id}`}
                    >
                      <div className={cn(
                        "relative",
                        !item.isEarned && "opacity-30"
                      )}>
                        <img
                          src={badgeImage}
                          alt={item.badge.name}
                          className={cn(
                            "object-contain transition-all duration-300",
                            isCenter ? badgeSizeCenter : badgeSizeNormal
                          )}
                        />
                      </div>
                      <span className={cn(
                        "mt-2 text-sm font-medium whitespace-nowrap",
                        item.isEarned ? "text-foreground" : "text-muted-foreground"
                      )}>
                        {config.getBadgeLabel(item.badge.threshold)}
                      </span>
                    </motion.div>
                  );
                })}
              </motion.div>
            </motion.div>

            {/* Description and Earned text */}
            <div className="mt-4 text-center px-8 h-[72px] flex flex-col justify-start">
              {activeBadge && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <p className={cn(
                    "text-lg",
                    activeBadge.isEarned ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {config.getBadgeDescription(activeBadge.badge.threshold)}
                  </p>
                </motion.div>
              )}
              <div className="h-16 mt-2 flex items-center justify-center">
                {activeBadge?.isEarned && (
                  <span 
                    className="px-6 py-2 text-white rounded-full text-lg font-semibold"
                    style={{ backgroundColor: gameType === 'USER' ? '#93cd78' : '#A4DB57' }}
                  >
                    Earned!
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom section with toggle and DOWN arrow icon (goes to previous category) - fixed at bottom */}
      <div className={cn(
        "relative z-20 flex flex-col items-center",
        adBannerActive ? "pb-20" : "pb-8"
      )}>
        {/* Background overlay to hide content animating behind */}
        <div className="absolute inset-0 bg-background" />
        
        <div className="relative z-10 flex flex-col items-center">
          {/* Category toggle indicators - positioned with proper spacing */}
          <div className="flex gap-2 py-3 mb-6">
            {CATEGORIES.map((cat, index) => (
              <button
                key={cat}
                onClick={() => handleCategoryChange(index)}
                className={cn(
                  "w-2 h-2 rounded-full transition-all",
                  index === currentCategoryIndex 
                    ? "bg-foreground w-6" 
                    : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                )}
                data-testid={`category-indicator-${cat}`}
              />
            ))}
          </div>

          {/* Down Arrow icon (goes to previous category) */}
          {currentCategoryIndex > 0 ? (
            <button
              onClick={() => handleCategoryChange(currentCategoryIndex - 1)}
              className="w-14 h-14 flex items-center justify-center rounded-full transition-opacity hover:opacity-80"
              style={{ backgroundColor: arrowButtonColor }}
              data-testid="button-category-prev"
            >
              <ChevronDown className="h-10 w-10 text-white" />
            </button>
          ) : (
            <div className="w-14 h-14" />
          )}
        </div>
      </div>
    </motion.div>
  );
}
