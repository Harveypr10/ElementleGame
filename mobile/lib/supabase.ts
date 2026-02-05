import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './supabase-types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false, // React Native handles deep links differently
    },
});

// ============================================================
// Identity Linking Edge Function Helpers
// ============================================================

interface CheckIdentityResponse {
    found: boolean;
    userId?: string;
    email?: string;
}

interface LinkIdentityResponse {
    success: boolean;
    error?: string;
}

/**
 * Check if a social identity is already linked to an account
 */
export async function checkLinkedIdentity(
    provider: 'google' | 'apple',
    idToken: string
): Promise<CheckIdentityResponse> {
    try {
        const { data, error } = await supabase.functions.invoke('link-social-identity', {
            body: { provider, idToken, action: 'check' }
        });

        if (error) {
            console.error('[Supabase] checkLinkedIdentity error:', error);
            return { found: false };
        }

        return data as CheckIdentityResponse;
    } catch (error) {
        console.error('[Supabase] checkLinkedIdentity exception:', error);
        return { found: false };
    }
}

/**
 * Link a social identity to the current user
 */
export async function linkIdentityToUser(
    provider: 'google' | 'apple',
    idToken: string
): Promise<LinkIdentityResponse> {
    try {
        const { data, error } = await supabase.functions.invoke('link-social-identity', {
            body: { provider, idToken, action: 'link' }
        });

        if (error) {
            console.error('[Supabase] linkIdentityToUser error:', error);
            return { success: false, error: error.message };
        }

        return data as LinkIdentityResponse;
    } catch (error: any) {
        console.error('[Supabase] linkIdentityToUser exception:', error);
        return { success: false, error: error.message || 'Failed to link identity' };
    }
}

interface SignInWithLinkedIdentityResponse {
    success: boolean;
    error?: string;
    isNewUser?: boolean;
    isDisabled?: boolean;  // True if identity is disabled
    userId?: string;
}

/**
 * Sign in using a linked social identity
 * This calls the Edge Function which looks up the linked identity
 * and generates a session for that user
 */
export async function signInWithLinkedIdentity(
    provider: 'google' | 'apple',
    idToken: string
): Promise<SignInWithLinkedIdentityResponse> {
    try {
        console.log(`[Supabase] signInWithLinkedIdentity: provider=${provider}`);

        const { data, error } = await supabase.functions.invoke('link-social-identity', {
            body: { provider, idToken, action: 'signin' }
        });

        if (error) {
            console.error('[Supabase] signInWithLinkedIdentity error:', error);
            return { success: false, error: error.message };
        }

        const response = data as {
            success: boolean;
            error?: string;
            isNewUser?: boolean;
            isDisabled?: boolean;
            userId?: string;
            accessToken?: string;
            refreshToken?: string;
        };

        if (!response.success) {
            // Include isDisabled in the error case so caller can show appropriate message
            return { success: false, error: response.error, isDisabled: response.isDisabled };
        }

        // If this is for a new user, let caller know to use signInWithIdToken instead
        if (response.isNewUser) {
            console.log('[Supabase] signInWithLinkedIdentity: No linked identity, new user flow needed');
            return { success: true, isNewUser: true };
        }

        // We have session tokens - set the session
        if (response.accessToken && response.refreshToken) {
            console.log(`[Supabase] signInWithLinkedIdentity: Setting session for user ${response.userId}`);

            const { error: sessionError } = await supabase.auth.setSession({
                access_token: response.accessToken,
                refresh_token: response.refreshToken
            });

            if (sessionError) {
                console.error('[Supabase] Failed to set session:', sessionError);
                return { success: false, error: 'Failed to set session' };
            }

            return { success: true, isNewUser: false, userId: response.userId };
        }

        return { success: false, error: 'No session tokens received' };
    } catch (error: any) {
        console.error('[Supabase] signInWithLinkedIdentity exception:', error);
        return { success: false, error: error.message || 'Failed to sign in' };
    }
}

interface DisableEnableResponse {
    success: boolean;
    error?: string;
}

/**
 * Disable a linked social identity (does not delete, just sets disabled_at)
 */
export async function disableIdentity(
    provider: 'google' | 'apple'
): Promise<DisableEnableResponse> {
    try {
        console.log(`[Supabase] disableIdentity: provider=${provider}`);

        const { data, error } = await supabase.functions.invoke('link-social-identity', {
            body: { provider, action: 'disable' }
        });

        if (error) {
            console.error('[Supabase] disableIdentity error:', error);
            return { success: false, error: error.message };
        }

        return data as DisableEnableResponse;
    } catch (error: any) {
        console.error('[Supabase] disableIdentity exception:', error);
        return { success: false, error: error.message || 'Failed to disable identity' };
    }
}

/**
 * Enable a previously disabled social identity
 * Requires re-authenticating with the provider to verify ownership
 */
export async function enableIdentity(
    provider: 'google' | 'apple',
    idToken: string
): Promise<DisableEnableResponse> {
    try {
        console.log(`[Supabase] enableIdentity: provider=${provider}`);

        const { data, error } = await supabase.functions.invoke('link-social-identity', {
            body: { provider, idToken, action: 'enable' }
        });

        if (error) {
            console.error('[Supabase] enableIdentity error:', error);
            return { success: false, error: error.message };
        }

        return data as DisableEnableResponse;
    } catch (error: any) {
        console.error('[Supabase] enableIdentity exception:', error);
        return { success: false, error: error.message || 'Failed to enable identity' };
    }
}

/**
 * Completely unlink a social identity (deletes from linked_identities table)
 * This removes the link entirely, allowing the user to link to a different account
 */
export async function unlinkIdentity(
    provider: 'google' | 'apple'
): Promise<DisableEnableResponse> {
    try {
        console.log(`[Supabase] unlinkIdentity: provider=${provider}`);

        const { data, error } = await supabase.functions.invoke('link-social-identity', {
            body: { provider, action: 'unlink' }
        });

        if (error) {
            console.error('[Supabase] unlinkIdentity error:', error);
            return { success: false, error: error.message };
        }

        return data as DisableEnableResponse;
    } catch (error: any) {
        console.error('[Supabase] unlinkIdentity exception:', error);
        return { success: false, error: error.message || 'Failed to unlink identity' };
    }
}
