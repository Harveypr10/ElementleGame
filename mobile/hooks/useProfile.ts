import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';

export interface UserProfile {
    id: string;
    first_name: string | null;
    last_name: string | null;
    region: string | null;
    postcode: string | null;
    is_admin: boolean;
    categories_last_changed_at: string | null;
    postcode_last_changed_at: string | null;
    ads_consent: boolean;
}

export function useProfile() {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const { data: profile, isLoading, error } = useQuery({
        queryKey: ['user-profile', user?.id],
        queryFn: async () => {
            if (!user) return null;

            const { data, error } = await supabase
                .from('user_profiles')
                .select('id, first_name, last_name, region, postcode, is_admin, categories_last_changed_at, postcode_last_changed_at, ads_consent')
                .eq('id', user.id)
                .single();

            if (error) {
                console.error('[useProfile] Error fetching profile:', error);
                throw error;
            }

            return data as UserProfile;
        },
        enabled: !!user,
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    });

    const updateProfileMutation = useMutation({
        mutationFn: async (updates: Partial<UserProfile>) => {
            if (!user) throw new Error('Not authenticated');

            // --- RESTRICTION CHECKS ---

            // Check Location Restriction (Postcode or Region change)
            if (updates.postcode !== undefined || updates.region !== undefined) {
                const isPostcodeChange = updates.postcode !== undefined && updates.postcode !== profile?.postcode;
                const isRegionChange = updates.region !== undefined && updates.region !== profile?.region;

                if (isPostcodeChange || isRegionChange) {
                    // Fetch restriction setting
                    const { data: settingData } = await supabase
                        .from('admin_settings')
                        .select('value')
                        .eq('key', 'postcode_restriction_days')
                        .single();

                    const restrictionDays = settingData ? parseInt(settingData.value, 10) : 14;

                    if (restrictionDays > 0 && profile?.postcode_last_changed_at) {
                        const lastChanged = new Date(profile.postcode_last_changed_at);
                        const allowedAfter = new Date(lastChanged);
                        allowedAfter.setDate(allowedAfter.getDate() + restrictionDays);

                        const now = new Date();
                        if (now < allowedAfter) {
                            throw new Error(`You can update your postcode or region once every ${restrictionDays} days.`);
                        }
                    }
                }
            }

            // Check Category Restriction (if applicable later, logic would go here)
            // if (updates.categories...) { ... }

            // --- END RESTRICTION CHECKS ---

            const { data, error } = await supabase
                .from('user_profiles')
                .update(updates)
                .eq('id', user.id)
                .select()
                .single();

            if (error) throw error;
            return data as UserProfile;
        },
        onSuccess: (updatedProfile) => {
            queryClient.setQueryData(['user-profile', user?.id], updatedProfile);
        },
    });

    return {
        profile,
        isLoading,
        error,
        isAdmin: profile?.is_admin === true,
        fullName: profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : null,
        adsConsent: profile?.ads_consent ?? false,
        updateProfile: updateProfileMutation.mutateAsync,
        isUpdating: updateProfileMutation.isPending,
    };
}
