import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { BadgeSlot } from "./BadgeSlot";
import { AllBadgesPopup } from "./AllBadgesPopup";
import { Card } from "@/components/ui/card";
import { Trophy, Loader2, ChevronRight } from "lucide-react";
import type { UserBadgeWithDetails } from "@shared/schema";

interface BadgesRowProps {
  gameType: 'USER' | 'REGION';
  newlyAwardedBadge?: UserBadgeWithDetails | null;
  onAnimationComplete?: () => void;
}

type HighestBadges = Record<'elementle' | 'streak' | 'percentile', UserBadgeWithDetails | null>;

// Normalize category names to match our slot categories
function normalizeCategory(category: string): 'elementle' | 'streak' | 'percentile' {
  const lower = category.toLowerCase();
  if (lower === 'elementle in' || lower === 'elementle') return 'elementle';
  if (lower === 'streak') return 'streak';
  if (lower === 'percentile') return 'percentile';
  return 'elementle'; // Default fallback
}

export function BadgesRow({ gameType, newlyAwardedBadge, onAnimationComplete }: BadgesRowProps) {
  const { isAuthenticated } = useAuth();
  const [showAllBadges, setShowAllBadges] = useState(false);
  const [initialCategory, setInitialCategory] = useState<'elementle' | 'streak' | 'percentile'>('elementle');
  const [badgesReady, setBadgesReady] = useState(false);
  
  const endpoint = gameType === 'USER' 
    ? '/api/user/badges/earned' 
    : '/api/badges/earned';
  
  const { data: badges, isLoading, isFetching } = useQuery<HighestBadges>({
    queryKey: [endpoint],
    enabled: isAuthenticated,
    refetchOnMount: newlyAwardedBadge ? 'always' : true,
  });

  useEffect(() => {
    if (!isLoading && badges !== undefined) {
      const timer = setTimeout(() => {
        setBadgesReady(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isLoading, badges]);

  if (!isAuthenticated) {
    return null;
  }

  // Determine which category should animate
  // Only animate if:
  // 1. There's a newly awarded badge
  // 2. The badge data matches (confirming fresh data is loaded)
  // 3. Not currently refetching
  const animatingCategory = newlyAwardedBadge && !isFetching
    ? (() => {
        const category = normalizeCategory(newlyAwardedBadge.badge.category);
        const matchingBadge = badges?.[category];
        // Only animate if the badge in data matches the newly awarded one
        if (matchingBadge && matchingBadge.badgeId === newlyAwardedBadge.badgeId) {
          return category;
        }
        return null;
      })()
    : null;

  return (
    <>
      <Card className="p-4" data-testid="badges-row-card">
        <div className="font-bold text-sm mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Badges
          </div>
          <button
            onClick={() => {
              setInitialCategory('elementle');
              setShowAllBadges(true);
            }}
            className="text-sm text-primary hover:underline font-normal flex items-center gap-0.5"
            data-testid="button-see-all-badges"
          >
            View all
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        {/* Fixed height container to prevent layout shift */}
        <div className="relative h-[160px] flex items-center justify-center">
          {/* Spinner - fades out when badges are ready */}
          <div 
            className="absolute inset-0 flex items-center justify-center transition-opacity duration-300"
            style={{ opacity: badgesReady ? 0 : 1, pointerEvents: badgesReady ? 'none' : 'auto' }}
          >
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
          
          {/* Badges - fade in when ready */}
          <div 
            className="flex justify-center gap-3 transition-opacity duration-300"
            style={{ opacity: badgesReady ? 1 : 0 }}
          >
            <div 
              className="cursor-pointer"
              onClick={() => {
                setInitialCategory('elementle');
                setShowAllBadges(true);
              }}
            >
              <BadgeSlot 
                category="elementle" 
                badge={badges?.elementle || null}
                isAnimating={animatingCategory === 'elementle'}
                onAnimationComplete={animatingCategory === 'elementle' ? onAnimationComplete : undefined}
              />
            </div>
            <div 
              className="cursor-pointer"
              onClick={() => {
                setInitialCategory('streak');
                setShowAllBadges(true);
              }}
            >
              <BadgeSlot 
                category="streak" 
                badge={badges?.streak || null}
                isAnimating={animatingCategory === 'streak'}
                onAnimationComplete={animatingCategory === 'streak' ? onAnimationComplete : undefined}
              />
            </div>
            <div 
              className="cursor-pointer"
              onClick={() => {
                setInitialCategory('percentile');
                setShowAllBadges(true);
              }}
            >
              <BadgeSlot 
                category="percentile" 
                badge={badges?.percentile || null}
                isAnimating={animatingCategory === 'percentile'}
                onAnimationComplete={animatingCategory === 'percentile' ? onAnimationComplete : undefined}
              />
            </div>
          </div>
        </div>
      </Card>

      {showAllBadges && (
        <AllBadgesPopup
          gameType={gameType}
          earnedBadges={badges}
          initialCategory={initialCategory}
          onClose={() => setShowAllBadges(false)}
        />
      )}
    </>
  );
}
