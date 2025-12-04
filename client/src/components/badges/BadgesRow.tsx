import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { BadgeSlot } from "./BadgeSlot";
import { AllBadgesPopup } from "./AllBadgesPopup";
import { Card } from "@/components/ui/card";
import { Trophy } from "lucide-react";
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
  
  const endpoint = gameType === 'USER' 
    ? '/api/user/badges/earned' 
    : '/api/badges/earned';
  
  const { data: badges, isLoading, isFetching } = useQuery<HighestBadges>({
    queryKey: [endpoint],
    enabled: isAuthenticated,
    // Force refetch to get fresh data when navigating with newly awarded badge
    refetchOnMount: newlyAwardedBadge ? 'always' : true,
  });

  if (!isAuthenticated) {
    return null;
  }

  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="font-bold text-sm mb-2 flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Badges
        </div>
        <div className="flex justify-center gap-8">
          <div className="w-24 h-32 bg-muted animate-pulse rounded" />
          <div className="w-24 h-32 bg-muted animate-pulse rounded" />
          <div className="w-24 h-32 bg-muted animate-pulse rounded" />
        </div>
      </Card>
    );
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
            onClick={() => setShowAllBadges(true)}
            className="text-sm text-primary hover:underline font-normal"
            data-testid="button-see-all-badges"
          >
            See all
          </button>
        </div>
        <div className="flex justify-center gap-8">
          <BadgeSlot 
            category="elementle" 
            badge={badges?.elementle || null}
            isAnimating={animatingCategory === 'elementle'}
            onAnimationComplete={animatingCategory === 'elementle' ? onAnimationComplete : undefined}
          />
          <BadgeSlot 
            category="streak" 
            badge={badges?.streak || null}
            isAnimating={animatingCategory === 'streak'}
            onAnimationComplete={animatingCategory === 'streak' ? onAnimationComplete : undefined}
          />
          <BadgeSlot 
            category="percentile" 
            badge={badges?.percentile || null}
            isAnimating={animatingCategory === 'percentile'}
            onAnimationComplete={animatingCategory === 'percentile' ? onAnimationComplete : undefined}
          />
        </div>
      </Card>

      {showAllBadges && (
        <AllBadgesPopup
          gameType={gameType}
          earnedBadges={badges}
          onClose={() => setShowAllBadges(false)}
        />
      )}
    </>
  );
}
