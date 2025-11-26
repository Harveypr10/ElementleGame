import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAuth } from "./useAuth";
import { getSupabaseClient } from "@/lib/supabaseClient";
import type { UserProfile } from "@shared/schema";
import { setCachedRegion } from "@/lib/formatCache";

// Helper to PATCH profile
async function patchProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
  const supabase = await getSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.access_token) {
    console.error("[patchProfile] No valid session");
    throw new Error("Not authenticated");
  }

  console.log("[patchProfile] Sending PATCH with body:", updates);
  
  const res = await fetch("/api/auth/profile", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(updates),
  });
  
  console.log("[patchProfile] Response status:", res.status);
  
  if (!res.ok) {
    const errorText = await res.text();
    console.error("[patchProfile] Request failed:", res.status, errorText);
    throw new Error("Failed to update profile");
  }
  
  const data = await res.json();
  console.log("[patchProfile] Response body:", data);
  return data;
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

  // Sync region to localStorage cache when it loads/changes
  useEffect(() => {
    if (profile?.region) {
      setCachedRegion(profile.region);
    }
  }, [profile?.region]);

  // Mutation for updates
  const mutation = useMutation({
    mutationFn: patchProfile,
    onSuccess: (data) => {
      // Update cache immediately with new region
      if (data.region) {
        setCachedRegion(data.region);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/auth/profile"] });
    },
  });

  return {
    profile,
    isLoading,
    updateProfile: mutation.mutateAsync, // ✅ now available
  };
}
