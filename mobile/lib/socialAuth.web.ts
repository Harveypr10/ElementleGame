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
// Provider Management (Stubs for web - not supported)
// ============================================================

export async function unlinkProvider(_provider: 'google' | 'apple'): Promise<{ success: boolean; error?: string }> {
    console.log('[SocialAuth Web] Provider unlinking not supported on web');
    return { success: false, error: 'Provider management is only available in the mobile app' };
}

export async function disableProvider(_provider: 'google' | 'apple'): Promise<{ success: boolean; error?: string }> {
    console.log('[SocialAuth Web] Provider disable not supported on web');
    return { success: false, error: 'Provider management is only available in the mobile app' };
}

export async function enableProvider(_provider: 'google' | 'apple'): Promise<{ success: boolean; error?: string }> {
    console.log('[SocialAuth Web] Provider enable not supported on web');
    return { success: false, error: 'Provider management is only available in the mobile app' };
}

export async function linkGoogleAccount(): Promise<{ success: boolean; error?: string }> {
    console.log('[SocialAuth Web] Account linking not supported on web');
    return { success: false, error: 'Account linking is only available in the mobile app' };
}

export async function linkAppleAccount(): Promise<{ success: boolean; error?: string }> {
    console.log('[SocialAuth Web] Account linking not supported on web');
    return { success: false, error: 'Account linking is only available in the mobile app' };
}
