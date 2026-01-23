import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';

export interface UserProfile {
    id: string;
    first_name: string | null;
    last_name: string | null;
    region: string | null;
    is_admin: boolean;
    categories_last_changed_at: string | null;
    postcode_last_changed_at: string | null;
}

export function useProfile() {
    const { user } = useAuth();

    const { data: profile, isLoading, error } = useQuery({
        queryKey: ['user-profile', user?.id],
        queryFn: async () => {
            if (!user) return null;

            const { data, error } = await supabase
                .from('user_profiles')
                .select('id, first_name, last_name, region, is_admin, categories_last_changed_at, postcode_last_changed_at')
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

    return {
        profile,
        isLoading,
        error,
        isAdmin: profile?.is_admin === true,
        fullName: profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : null,
    };
}
