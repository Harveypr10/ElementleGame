/**
 * Social Authentication Module - Web Platform
 * 
 * On web, we use Supabase OAuth redirects instead of native SDKs.
 * This file is automatically used by Metro/Expo on web platform.
 */

import { supabase } from './supabase';

// ============================================================
// Types
// ============================================================

export interface SocialAuthResult {
    success: boolean;
    error?: string;
    isNewUser?: boolean;
}

// ============================================================
// Configuration (no-op on web)
// ============================================================

export function configureGoogleSignIn() {
    console.log('[SocialAuth Web] Google Sign-In configuration not needed on web');
}

// ============================================================
// Google Sign-In - OAuth Redirect Flow
// ============================================================

/**
 * Sign in with Google using OAuth browser redirect
 */
export async function signInWithGoogle(): Promise<SocialAuthResult> {
    try {
        console.log('[SocialAuth Web] Starting Google OAuth flow...');

        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
            }
        });

        if (error) {
            console.error('[SocialAuth Web] Google OAuth error:', error);
            return { success: false, error: error.message };
        }

        // OAuth redirects away, so this won't return immediately
        return { success: true };
    } catch (error: any) {
        console.error('[SocialAuth Web] Google sign-in error:', error);
        return { success: false, error: error.message || 'Failed to sign in with Google' };
    }
}

// ============================================================
// Apple Sign-In - OAuth Redirect Flow
// ============================================================

/**
 * Check if Apple Sign-In is available (always true on web via OAuth)
 */
export async function isAppleSignInAvailable(): Promise<boolean> {
    return true; // OAuth is always available on web
}

/**
 * Sign in with Apple using OAuth browser redirect
 */
export async function signInWithApple(): Promise<SocialAuthResult> {
    try {
        console.log('[SocialAuth Web] Starting Apple OAuth flow...');

        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'apple',
            options: {
                redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
            }
        });

        if (error) {
            console.error('[SocialAuth Web] Apple OAuth error:', error);
            return { success: false, error: error.message };
        }

        // OAuth redirects away, so this won't return immediately
        return { success: true };
    } catch (error: any) {
        console.error('[SocialAuth Web] Apple sign-in error:', error);
        return { success: false, error: error.message || 'Failed to sign in with Apple' };
    }
}

// ============================================================
// Provider Management
// ============================================================

/**
 * Unlink a provider from the current user's account
 * This uses the Supabase Edge Function, same as mobile
 */
export async function unlinkProvider(provider: 'google' | 'apple'): Promise<{ success: boolean; error?: string }> {
    try {
        console.log(`[SocialAuth Web] Unlinking ${provider} account...`);

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            return { success: false, error: 'Not authenticated' };
        }

        const { data, error } = await supabase.functions.invoke('link-social-identity', {
            body: { provider, action: 'unlink' }
        });

        if (error) {
            console.error(`[SocialAuth Web] Failed to unlink ${provider}:`, error);
            return { success: false, error: error.message };
        }

        console.log(`[SocialAuth Web] Successfully unlinked ${provider}`);
        return { success: true };
    } catch (error: any) {
        console.error(`[SocialAuth Web] Unlink ${provider} error:`, error);
        return { success: false, error: error.message || `Failed to unlink ${provider}` };
    }
}

/**
 * Disable a provider (keeps the link but prevents sign-in)
 */
export async function disableProvider(provider: 'google' | 'apple'): Promise<{ success: boolean; error?: string }> {
    try {
        console.log(`[SocialAuth Web] Disabling ${provider} account...`);

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            return { success: false, error: 'Not authenticated' };
        }

        const { data, error } = await supabase.functions.invoke('link-social-identity', {
            body: { provider, action: 'disable' }
        });

        if (error) {
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message || `Failed to disable ${provider}` };
    }
}

/**
 * Enable provider not supported on web (requires native token)
 */
export async function enableProvider(_provider: 'google' | 'apple'): Promise<{ success: boolean; error?: string }> {
    console.log('[SocialAuth Web] Provider enable requires native authentication');
    return { success: false, error: 'Enabling providers requires the mobile app for secure re-authentication' };
}

/**
 * Link Google account using OAuth redirect flow
 */
export async function linkGoogleAccount(): Promise<{ success: boolean; error?: string }> {
    try {
        console.log('[SocialAuth Web] Starting Google link OAuth flow...');

        const { error } = await supabase.auth.linkIdentity({
            provider: 'google',
            options: {
                redirectTo: typeof window !== 'undefined' ? window.location.origin + '/settings/account-info' : undefined,
            }
        });

        if (error) {
            console.error('[SocialAuth Web] Google link error:', error);
            return { success: false, error: error.message };
        }

        // OAuth redirects away, so this won't return immediately
        return { success: true };
    } catch (error: any) {
        console.error('[SocialAuth Web] Link Google error:', error);
        return { success: false, error: error.message || 'Failed to link Google account' };
    }
}

/**
 * Link Apple account using OAuth redirect flow
 */
export async function linkAppleAccount(): Promise<{ success: boolean; error?: string }> {
    try {
        console.log('[SocialAuth Web] Starting Apple link OAuth flow...');

        const { error } = await supabase.auth.linkIdentity({
            provider: 'apple',
            options: {
                redirectTo: typeof window !== 'undefined' ? window.location.origin + '/settings/account-info' : undefined,
            }
        });

        if (error) {
            console.error('[SocialAuth Web] Apple link error:', error);
            return { success: false, error: error.message };
        }

        // OAuth redirects away, so this won't return immediately
        return { success: true };
    } catch (error: any) {
        console.error('[SocialAuth Web] Link Apple error:', error);
        return { success: false, error: error.message || 'Failed to link Apple account' };
    }
}

