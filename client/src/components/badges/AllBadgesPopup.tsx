import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { X, Target, Flame, Percent, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Badge, UserBadgeWithDetails } from "@shared/schema";
import badgeImage from "@assets/Signup-Hamster-Transparent.png";

type CategoryType = 'elementle' | 'streak' | 'percentile';
type HighestBadges = Record<CategoryType, UserBadgeWithDetails | null>;

interface AllBadgesPopupProps {
  gameType: 'USER' | 'REGION';
  earnedBadges?: HighestBadges | null;
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
  icon: typeof Target;
  getBadgeLabel: (threshold: number) => string;
  getBadgeDescription: (threshold: number) => string;
}> = {
  elementle: {
    title: 'Won In',
    icon: Target,
    getBadgeLabel: (t) => t === 1 ? '1 Guess' : '2 Guesses',
    getBadgeDescription: (t) => t === 1 
      ? 'Win the game on your first guess'
      : 'Win the game in just 2 guesses',
  },
  streak: {
    title: 'Streak',
    icon: Flame,
    getBadgeLabel: (t) => `${t} Days`,
    getBadgeDescription: (t) => `Maintain a ${t} day winning streak`,
  },
  percentile: {
    title: 'Top %',
    icon: Percent,
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

export function AllBadgesPopup({ gameType, earnedBadges, onClose }: AllBadgesPopupProps) {
  const [currentCategoryIndex, setCurrentCategoryIndex] = useState(0);
  const [currentBadgeIndex, setCurrentBadgeIndex] = useState<Record<CategoryType, number>>({
    elementle: 0,
    streak: 0,
    percentile: 0,
  });
  const [isVerticalSwiping, setIsVerticalSwiping] = useState(false);

  const { data: allBadges } = useQuery<Badge[]>({
    queryKey: ['/api/badges'],
  });

  const currentCategory = CATEGORIES[currentCategoryIndex];
  const config = CATEGORY_CONFIG[currentCategory];
  const CategoryIcon = config.icon;

  const getBadgesForCategory = (category: CategoryType): BadgeItem[] => {
    if (!allBadges) return [];

    const categoryBadges = allBadges
      .filter(b => normalizeCategory(b.category) === category)
      .sort((a, b) => {
        if (category === 'percentile') {
          return b.threshold - a.threshold;
        }
        return a.threshold - b.threshold;
      });

    const earnedBadge = earnedBadges?.[category];
    const earnedThreshold = earnedBadge?.badge?.threshold ?? -1;

    return categoryBadges.map(badge => ({
      badge,
      isEarned: category === 'percentile' 
        ? (earnedThreshold !== -1 && badge.threshold >= earnedThreshold)
        : (earnedThreshold !== -1 && badge.threshold <= earnedThreshold),
      userBadge: earnedBadge?.badge?.id === badge.id ? earnedBadge : undefined,
    }));
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
      }
    }
  }, [currentCategory, categoryBadges.length, earnedBadges]);

  const handleBadgeSwipe = (direction: number) => {
    const badges = getBadgesForCategory(currentCategory);
    const currentIndex = currentBadgeIndex[currentCategory];
    const newIndex = Math.max(0, Math.min(badges.length - 1, currentIndex + direction));
    
    setCurrentBadgeIndex(prev => ({
      ...prev,
      [currentCategory]: newIndex,
    }));
  };

  const handleCategorySwipe = (direction: number) => {
    const newIndex = Math.max(0, Math.min(CATEGORIES.length - 1, currentCategoryIndex + direction));
    setCurrentCategoryIndex(newIndex);
  };

  const handlePanEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const { offset, velocity } = info;
    const swipeThreshold = 50;
    const velocityThreshold = 500;

    if (Math.abs(offset.y) > Math.abs(offset.x) && (Math.abs(offset.y) > swipeThreshold || Math.abs(velocity.y) > velocityThreshold)) {
      handleCategorySwipe(offset.y < 0 ? 1 : -1);
    } else if (Math.abs(offset.x) > swipeThreshold || Math.abs(velocity.x) > velocityThreshold) {
      handleBadgeSwipe(offset.x < 0 ? 1 : -1);
    }
  };

  const activeBadgeIndex = currentBadgeIndex[currentCategory];
  const activeBadge = categoryBadges[activeBadgeIndex];

  return (
    <motion.div
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      data-testid="all-badges-popup"
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 text-white/70 hover:text-white transition-colors"
        data-testid="button-close-all-badges"
      >
        <X className="w-6 h-6" />
      </button>

      <div className="flex-1 flex flex-col items-center justify-center overflow-hidden">
        <div className="text-white/50 mb-2 flex items-center gap-1">
          {currentCategoryIndex > 0 && <ChevronUp className="w-4 h-4 animate-bounce" />}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentCategory}
            className="flex flex-col items-center w-full"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-center gap-2 text-white mb-6">
              <CategoryIcon className="w-6 h-6" />
              <h2 className="text-xl font-bold">{config.title}</h2>
            </div>

            <motion.div
              className="relative w-full flex items-center justify-center"
              style={{ height: '200px' }}
              onPanEnd={handlePanEnd}
            >
              <div className="flex items-center gap-4 overflow-visible">
                {categoryBadges.map((item, index) => {
                  const offset = index - activeBadgeIndex;
                  const isCenter = offset === 0;
                  const isLeft = offset < 0;
                  const isRight = offset > 0;

                  return (
                    <motion.div
                      key={item.badge.id}
                      className={cn(
                        "flex flex-col items-center shrink-0 cursor-pointer",
                        "transition-all duration-300"
                      )}
                      style={{
                        transform: `translateX(${offset * 100}px) scale(${isCenter ? 1 : 0.7})`,
                        opacity: isCenter ? 1 : (item.isEarned ? 0.7 : 0.3),
                        zIndex: isCenter ? 10 : 1,
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
                            "w-20 h-20 object-contain",
                            isCenter && "w-24 h-24"
                          )}
                        />
                        {!item.isEarned && (
                          <div className="absolute inset-0 bg-black/30 rounded-full" />
                        )}
                      </div>
                      <span className={cn(
                        "mt-2 text-sm font-medium",
                        item.isEarned ? "text-white" : "text-white/40"
                      )}>
                        {config.getBadgeLabel(item.badge.threshold)}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>

            {activeBadge && (
              <motion.div
                className="mt-6 text-center px-8"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <p className={cn(
                  "text-lg",
                  activeBadge.isEarned ? "text-white" : "text-white/50"
                )}>
                  {config.getBadgeDescription(activeBadge.badge.threshold)}
                </p>
                {activeBadge.isEarned && (
                  <span className="inline-block mt-2 px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-sm">
                    Earned!
                  </span>
                )}
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="text-white/50 mt-4 flex items-center gap-1">
          {currentCategoryIndex < CATEGORIES.length - 1 && (
            <ChevronDown className="w-4 h-4 animate-bounce" />
          )}
        </div>

        <div className="flex gap-2 mt-4">
          {CATEGORIES.map((cat, index) => (
            <button
              key={cat}
              onClick={() => setCurrentCategoryIndex(index)}
              className={cn(
                "w-2 h-2 rounded-full transition-all",
                index === currentCategoryIndex 
                  ? "bg-white w-6" 
                  : "bg-white/30 hover:bg-white/50"
              )}
              data-testid={`category-indicator-${cat}`}
            />
          ))}
        </div>
      </div>

      <div className="pb-8 text-center text-white/40 text-sm">
        Swipe left/right to browse badges, up/down to change category
      </div>
    </motion.div>
  );
}
