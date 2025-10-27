import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { apiRequest } from "@/lib/queryClient";
import type { UserSettings } from "@shared/schema";

interface UpdateUserSettingsData {
  textSize?: string;
  soundsEnabled?: boolean;
  darkMode?: boolean;
  cluesEnabled?: boolean;
  dateFormatPreference?: string;
  useRegionDefault?: boolean;
  digitPreference?: string;
  categoryPreferences?: any;
}

export function useUserSettings() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  // Get user settings
  const { data: settings, isLoading } = useQuery<UserSettings>({
    queryKey: ["/api/settings"],
    enabled: isAuthenticated,
  });

  // Update user settings
  const updateSettings = useMutation({
    mutationFn: async (data: UpdateUserSettingsData) => {
      const response = await apiRequest("POST", "/api/settings", data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
    },
  });

  return {
    settings,
    isLoading,
    updateSettings: updateSettings.mutateAsync,
    isUpdating: updateSettings.isPending,
  };
}
