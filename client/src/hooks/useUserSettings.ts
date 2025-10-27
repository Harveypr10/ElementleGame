import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAuth } from "./useAuth";
import { apiRequest } from "@/lib/queryClient";
import type { UserSettings } from "@shared/schema";
import { setCachedDigitPreference, setCachedUseRegionDefault, setCachedDateFormatPreference } from "@/lib/formatCache";

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

  // Sync settings to localStorage cache when they load/change
  useEffect(() => {
    if (settings) {
      if (settings.digitPreference) {
        setCachedDigitPreference(settings.digitPreference as '6' | '8');
      }
      if (settings.useRegionDefault !== null && settings.useRegionDefault !== undefined) {
        setCachedUseRegionDefault(settings.useRegionDefault);
      }
      if (settings.dateFormatPreference) {
        setCachedDateFormatPreference(settings.dateFormatPreference);
      }
    }
  }, [settings?.digitPreference, settings?.useRegionDefault, settings?.dateFormatPreference]);

  // Update user settings
  const updateSettings = useMutation({
    mutationFn: async (data: UpdateUserSettingsData) => {
      const response = await apiRequest("POST", "/api/settings", data);
      return await response.json();
    },
    onSuccess: (data) => {
      // Update cache immediately with new settings
      if (data.digitPreference) {
        setCachedDigitPreference(data.digitPreference as '6' | '8');
      }
      if (data.useRegionDefault !== null && data.useRegionDefault !== undefined) {
        setCachedUseRegionDefault(data.useRegionDefault);
      }
      if (data.dateFormatPreference) {
        setCachedDateFormatPreference(data.dateFormatPreference);
      }
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
