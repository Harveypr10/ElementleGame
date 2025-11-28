import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { apiRequest } from "@/lib/queryClient";

export interface StreakSaverAllowances {
  streakSaversPerMonth: number;
  holidaySaversPerYear: number;
  holidaysUsedThisYear: number;
  holidayDurationDays: number;
  isPro: boolean;
}

export interface StreakSaverStatus {
  region: {
    currentStreak: number;
    streakSaversUsedMonth: number;
    missedYesterdayFlag: boolean;
  } | null;
  user: {
    currentStreak: number;
    streakSaversUsedMonth: number;
    holidayActive: boolean;
    holidayStartDate: string | null;
    holidayEndDate: string | null;
    missedYesterdayFlag: boolean;
  } | null;
  allowances: StreakSaverAllowances | null;
}

export function useStreakSaverStatus() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const { data: status, isLoading, refetch } = useQuery<StreakSaverStatus>({
    queryKey: ["/api/streak-saver/status"],
    enabled: isAuthenticated,
    staleTime: 30000,
  });

  const useStreakSaverMutation = useMutation({
    mutationFn: async (gameType: "region" | "user") => {
      const response = await apiRequest("POST", "/api/streak-saver/use", { gameType });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/streak-saver/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/stats"] });
    },
  });

  const declineStreakSaverMutation = useMutation({
    mutationFn: async (gameType: "region" | "user") => {
      const response = await apiRequest("POST", "/api/streak-saver/decline", { gameType });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/streak-saver/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/stats"] });
    },
  });

  const startHolidayMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/holiday/start");
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/streak-saver/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/stats"] });
    },
  });

  const endHolidayMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/holiday/end");
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/streak-saver/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/stats"] });
    },
  });

  const hasMissedRegion = status?.region?.missedYesterdayFlag ?? false;
  const hasMissedUser = status?.user?.missedYesterdayFlag ?? false;
  const hasMissedAny = hasMissedRegion || hasMissedUser;
  
  const holidayActive = status?.user?.holidayActive ?? false;
  const holidayEndDate = status?.user?.holidayEndDate ?? null;
  
  const regionStreakSaversRemaining = status?.allowances 
    ? status.allowances.streakSaversPerMonth - (status?.region?.streakSaversUsedMonth ?? 0)
    : 0;
  const userStreakSaversRemaining = status?.allowances 
    ? status.allowances.streakSaversPerMonth - (status?.user?.streakSaversUsedMonth ?? 0)
    : 0;
    
  const holidaysRemaining = status?.allowances
    ? status.allowances.holidaySaversPerYear - status.allowances.holidaysUsedThisYear
    : 0;

  return {
    status,
    isLoading,
    refetch,
    hasMissedRegion,
    hasMissedUser,
    hasMissedAny,
    holidayActive,
    holidayEndDate,
    regionStreakSaversRemaining,
    userStreakSaversRemaining,
    holidaysRemaining,
    isPro: status?.allowances?.isPro ?? false,
    holidayDurationDays: status?.allowances?.holidayDurationDays ?? 0,
    useStreakSaver: useStreakSaverMutation.mutateAsync,
    isUsingStreakSaver: useStreakSaverMutation.isPending,
    declineStreakSaver: declineStreakSaverMutation.mutateAsync,
    isDeclining: declineStreakSaverMutation.isPending,
    startHoliday: startHolidayMutation.mutateAsync,
    isStartingHoliday: startHolidayMutation.isPending,
    endHoliday: endHolidayMutation.mutateAsync,
    isEndingHoliday: endHolidayMutation.isPending,
  };
}
