import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAuth } from "./useAuth";
import type { UserProfile } from "@shared/schema";

// Helper to PATCH profile
async function patchProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
  const res = await fetch("/api/auth/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    throw new Error("Failed to update profile");
  }
  return res.json();
}

export function useProfile() {
  const { isAuthenticated } = useAuth();
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

  // Mutation for updates
  const mutation = useMutation({
    mutationFn: patchProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/profile"] });
    },
  });

  return {
    profile,
    isLoading,
    updateProfile: mutation.mutateAsync, // ✅ now available
  };
}
