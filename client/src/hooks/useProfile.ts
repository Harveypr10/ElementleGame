import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAuth } from "./useAuth";
import type { UserProfile } from "@shared/schema";

export function useProfile() {
  const { isAuthenticated, user } = useAuth();
  const queryClient = useQueryClient();

  // Invalidate profile query when auth state changes
  useEffect(() => {
    if (!isAuthenticated) {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/profile"] });
      queryClient.removeQueries({ queryKey: ["/api/auth/profile"] });
    }
  }, [isAuthenticated, queryClient]);

  const { data: profile, isLoading } = useQuery<UserProfile>({
    queryKey: ["/api/auth/profile"],
    enabled: isAuthenticated,
  });

  return {
    profile,
    isLoading,
  };
}
