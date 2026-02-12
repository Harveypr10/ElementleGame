/**
 * Root-level route for `/reset-password`.
 * 
 * Supabase sends password reset links to `elementle.tech/reset-password#access_token=...`.
 * Without this file, expo-router shows an "Unmatched Route" screen before the
 * deep link handler in _layout.tsx can redirect. This route catches the URL
 * immediately, extracts the Supabase token from the fragment, sets the session,
 * and redirects to the Set New Password screen.
 */
import React, { useEffect } from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useThemeColor } from '../hooks/useThemeColor';

export default function ResetPasswordRedirect() {
    const router = useRouter();
    const backgroundColor = useThemeColor({}, 'background');

    useEffect(() => {
        const processResetLink = async () => {
            try {
                // On web, the fragment (#access_token=...) is in window.location.hash
                if (Platform.OS === 'web' && typeof window !== 'undefined') {
                    const hash = window.location.hash;
                    if (hash) {
                        // Parse fragment: #access_token=...&refresh_token=...&type=recovery
                        const params = new URLSearchParams(hash.substring(1));
                        const accessToken = params.get('access_token');
                        const refreshToken = params.get('refresh_token');

                        if (accessToken && refreshToken) {
                            console.log('[ResetPassword] Setting session from fragment tokens');
                            const { error } = await supabase.auth.setSession({
                                access_token: accessToken,
                                refresh_token: refreshToken,
                            });
                            if (error) {
                                console.error('[ResetPassword] Session set error:', error);
                            }
                        }
                    }
                }

                // Navigate to set-new-password screen
                // Small delay to let session propagate through auth state change
                setTimeout(() => {
                    router.replace({
                        pathname: '/(auth)/set-new-password',
                        params: { mode: 'reset' },
                    });
                }, 300);
            } catch (e) {
                console.error('[ResetPassword] Error processing reset link:', e);
                // Still navigate even on error
                router.replace({
                    pathname: '/(auth)/set-new-password',
                    params: { mode: 'reset' },
                });
            }
        };

        processResetLink();
    }, []);

    // Show a loading spinner while redirecting (no flash of "unmatched route")
    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor }}>
            <ActivityIndicator size="large" color="#3b82f6" />
        </View>
    );
}
