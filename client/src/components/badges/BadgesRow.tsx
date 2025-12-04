import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { BadgeSlot } from "./BadgeSlot";
import { Card } from "@/components/ui/card";
import { Trophy } from "lucide-react";
import type { UserBadgeWithDetails } from "@shared/schema";

interface BadgesRowProps {
  gameType: 'USER' | 'REGION';
}

type HighestBadges = Record<'elementle' | 'streak' | 'percentile', UserBadgeWithDetails | null>;

export function BadgesRow({ gameType }: BadgesRowProps) {
  const { isAuthenticated } = useAuth();
  
  const endpoint = gameType === 'USER' 
    ? '/api/user/badges/earned' 
    : '/api/badges/earned';
  
  const { data: badges, isLoading } = useQuery<HighestBadges>({
    queryKey: [endpoint],
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) {
    return null;
  }

  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-bold text-muted-foreground">Badges</span>
          </div>
        </div>
        <div className="flex justify-center gap-3">
          <div className="w-24 h-32 bg-muted animate-pulse rounded" />
          <div className="w-24 h-32 bg-muted animate-pulse rounded" />
          <div className="w-24 h-32 bg-muted animate-pulse rounded" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4" data-testid="badges-row-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm font-bold text-muted-foreground">Badges</span>
        </div>
      </div>
      <div className="flex justify-center gap-3">
        <BadgeSlot 
          category="elementle" 
          badge={badges?.elementle || null} 
        />
        <BadgeSlot 
          category="streak" 
          badge={badges?.streak || null} 
        />
        <BadgeSlot 
          category="percentile" 
          badge={badges?.percentile || null} 
        />
      </div>
    </Card>
  );
}
