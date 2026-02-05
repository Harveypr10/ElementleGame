/**
 * Social Authentication Module
 * 
 * Native Google and Apple sign-in for iOS and Android.
 * Uses native SDKs for true One Tap / FaceID experience (not browser redirects).
 * 
 * Prerequisites:
 * - Google: OAuth Client IDs configured in Google Cloud Console
 * - Apple: Sign in with Apple enabled in Apple Developer Portal
 * - Supabase: Both providers configured in Authentication settings
 */

import { Platform } from 'react-native';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase, checkLinkedIdentity, linkIdentityToUser } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * iOS Client ID from Google Cloud Console
 * Created for Bundle ID: com.dobl.elementlegame
 */
const GOOGLE_IOS_CLIENT_ID = '426763707720-m7cq94j06j16bsehf9fpnb3omcp503e8.apps.googleusercontent.com';

/**
 * Web Client ID from Google Cloud Console
 * Used for Supabase token exchange
 */
const GOOGLE_WEB_CLIENT_ID = '426763707720-lirc4tk6bo2onhlp10n2gfv6sjanr8q7.apps.googleusercontent.com';

// ============================================================
// Configuration
// ============================================================

let isGoogleConfigured = false;

/**
 * Configure Google Sign-In SDK
 * Must be called before attempting sign-in
 */
export function configureGoogleSignIn() {
    if (isGoogleConfigured) return;

    GoogleSignin.configure({
        iosClientId: GOOGLE_IOS_CLIENT_ID,
        webClientId: GOOGLE_WEB_CLIENT_ID, // Required for Supabase token exchange
        offlineAccess: true,
    });

    isGoogleConfigured = true;
    console.log('[SocialAuth] Google Sign-In configured');
}

// ============================================================
// Google Sign-In
// ============================================================

export interface SocialAuthResult {
    success: boolean;
    error?: string;
    isNewUser?: boolean;
}

/**
 * Sign in with Google using native One Tap flow
 * This creates/signs into a Supabase account AND records the link in linked_identities
 */
export async function signInWithGoogle(): Promise<SocialAuthResult> {
    try {
        configureGoogleSignIn();

        // Check if Google Play Services are available (Android)
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

        // Trigger the native Google Sign-In flow
        const userInfo = await GoogleSignin.signIn();

        if (!userInfo.data?.idToken) {
            return { success: false, error: 'No ID token returned from Google' };
        }

        console.log('[SocialAuth] Google sign-in successful, exchanging token with Supabase');

        // Exchange the Google ID token with Supabase
        const { data, error } = await supabase.auth.signInWithIdToken({
            provider: 'google',
            token: userInfo.data.idToken,
        });

        if (error) {
            console.error('[SocialAuth] Supabase token exchange failed:', error);
            return { success: false, error: error.message };
        }

        // Sync OAuth profile to database
        if (data.user) {
            await syncOAuthProfileToDatabase(data.user.id, 'google');

            // Also record in linked_identities table via Edge Function
            // This enables "Continue with Google" to find this user
            console.log('[SocialAuth] Recording Google link in linked_identities...');
            const linkResult = await linkIdentityToUser('google', userInfo.data.idToken);
            if (!linkResult.success) {
                console.warn('[SocialAuth] Failed to record Google link:', linkResult.error);
                // Don't fail the whole sign-in, just log the warning
            }
        }

        // Check if user needs to complete profile setup (better than last_sign_in_at)
        let needsProfileSetup = true;
        if (data.user) {
            const { data: profile } = await supabase
                .from('user_profiles')
                .select('first_name, region')
                .eq('id', data.user.id)
                .single();

            // User is "new" if they don't have first_name AND region set
            needsProfileSetup = !profile?.first_name || !profile?.region;
        }

        console.log('[SocialAuth] Google authentication complete, needsProfileSetup:', needsProfileSetup);
        return { success: true, isNewUser: needsProfileSetup };

    } catch (error: any) {
        console.error('[SocialAuth] Google sign-in error:', error);

        if (error.code === statusCodes.SIGN_IN_CANCELLED) {
            return { success: false, error: 'Sign in cancelled' };
        } else if (error.code === statusCodes.IN_PROGRESS) {
            return { success: false, error: 'Sign in already in progress' };
        } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
            return { success: false, error: 'Google Play Services not available' };
        }

        return { success: false, error: error.message || 'Google sign-in failed' };
    }
}

/**
 * Sign out of Google (clears cached credentials)
 */
export async function signOutGoogle(): Promise<void> {
    try {
        await GoogleSignin.signOut();
        console.log('[SocialAuth] Google sign-out complete');
    } catch (error) {
        console.error('[SocialAuth] Google sign-out error:', error);
    }
}

// ============================================================
// Apple Sign-In
// ============================================================

/**
 * Check if Apple Sign-In is available on this device
 */
export async function isAppleSignInAvailable(): Promise<boolean> {
    if (Platform.OS !== 'ios') {
        return false;
    }
    return await AppleAuthentication.isAvailableAsync();
}

/**
 * Sign in with Apple using native FaceID/TouchID flow
 */
export async function signInWithApple(): Promise<SocialAuthResult> {
    try {
        if (Platform.OS !== 'ios') {
            return { success: false, error: 'Apple Sign-In is only available on iOS' };
        }

        const isAvailable = await AppleAuthentication.isAvailableAsync();
        if (!isAvailable) {
            return { success: false, error: 'Apple Sign-In is not available on this device' };
        }

        // Trigger native Apple Sign-In
        const credential = await AppleAuthentication.signInAsync({
            requestedScopes: [
                AppleAuthentication.AppleAuthenticationScope.EMAIL,
                AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            ],
        });

        if (!credential.identityToken) {
            return { success: false, error: 'No identity token returned from Apple' };
        }

        console.log('[SocialAuth] Apple sign-in successful, exchanging token with Supabase');

        // Exchange the Apple identity token with Supabase
        const { data, error } = await supabase.auth.signInWithIdToken({
            provider: 'apple',
            token: credential.identityToken,
        });

        if (error) {
            console.error('[SocialAuth] Supabase token exchange failed:', error);
            return { success: false, error: error.message };
        }

        // Sync OAuth profile to database
        if (data.user) {
            await syncOAuthProfileToDatabase(data.user.id, 'apple');

            // Also record in linked_identities table via Edge Function
            // This enables "Continue with Apple" to find this user on subsequent sign-ins
            console.log('[SocialAuth] Recording Apple link in linked_identities...');
            const linkResult = await linkIdentityToUser('apple', credential.identityToken);
            if (!linkResult.success) {
                console.warn('[SocialAuth] Failed to record Apple link:', linkResult.error);
                // Don't fail the whole sign-in, just log the warning
            }

            // Apple only provides name on first sign-in, save it if available
            if (credential.fullName?.givenName) {
                await saveAppleUserName(data.user.id, credential.fullName);
            }
        }

        // Check if user needs to complete profile setup (better than last_sign_in_at)
        let needsProfileSetup = true;
        if (data.user) {
            const { data: profile } = await supabase
                .from('user_profiles')
                .select('first_name, region')
                .eq('id', data.user.id)
                .single();

            // User is "new" if they don't have first_name AND region set
            needsProfileSetup = !profile?.first_name || !profile?.region;
        }

        console.log('[SocialAuth] Apple authentication complete, needsProfileSetup:', needsProfileSetup);
        return { success: true, isNewUser: needsProfileSetup };

    } catch (error: any) {
        console.error('[SocialAuth] Apple sign-in error:', error);

        if (error.code === 'ERR_CANCELED') {
            return { success: false, error: 'Sign in cancelled' };
        }

        return { success: false, error: error.message || 'Apple sign-in failed' };
    }
}

/**
 * Link Google account to existing user
 * 
 * Uses Edge Function to properly record the identity link in linked_identities table.
 * This enables "Continue with Google" to find the correct user.
 */
export async function linkGoogleAccount(): Promise<SocialAuthResult> {
    try {
        configureGoogleSignIn();

        // Get current user before starting - we must preserve this session
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (!currentUser) {
            return { success: false, error: 'No user logged in' };
        }

        console.log('[SocialAuth] Starting Google linking for user:', currentUser.id);

        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

        // Sign out of Google first to ensure fresh account selection
        try {
            await GoogleSignin.signOut();
        } catch (e) {
            // Ignore signout errors
        }

        // Get the Google credential - DO NOT call signInWithIdToken!
        // That would switch the session to the Google user
        const userInfo = await GoogleSignin.signIn();

        if (!userInfo.data?.idToken) {
            return { success: false, error: 'No ID token returned from Google' };
        }

        console.log('[SocialAuth] Google credential obtained for linking');

        // Call Edge Function to link the identity
        const result = await linkIdentityToUser('google', userInfo.data.idToken);

        if (!result.success) {
            console.error('[SocialAuth] Edge Function link failed:', result.error);
            return { success: false, error: result.error || 'Failed to link Google account' };
        }

        console.log('[SocialAuth] Google account linked successfully via Edge Function');
        return { success: true };

    } catch (error: any) {
        console.error('[SocialAuth] Link Google error:', error);

        if (error.code === statusCodes.SIGN_IN_CANCELLED) {
            return { success: false, error: 'Linking cancelled' };
        }

        return { success: false, error: error.message || 'Failed to link Google account' };
    }
}


/**
 * Link Apple account to existing user
 * 
 * Uses Edge Function to properly record the identity link in linked_identities table.
 * This enables "Continue with Apple" to find the correct user.
 */
export async function linkAppleAccount(): Promise<SocialAuthResult> {
    try {
        if (Platform.OS !== 'ios') {
            return { success: false, error: 'Apple Sign-In is only available on iOS' };
        }

        // Get current user before starting - we must preserve this session
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (!currentUser) {
            return { success: false, error: 'No user logged in' };
        }

        console.log('[SocialAuth] Starting Apple linking for user:', currentUser.id);

        const isAvailable = await AppleAuthentication.isAvailableAsync();
        if (!isAvailable) {
            return { success: false, error: 'Apple Sign-In is not available on this device' };
        }

        // Get Apple credential (this proves ownership) - DO NOT call signInWithIdToken!
        const credential = await AppleAuthentication.signInAsync({
            requestedScopes: [
                AppleAuthentication.AppleAuthenticationScope.EMAIL,
                AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            ],
        });

        if (!credential.identityToken) {
            return { success: false, error: 'No identity token returned from Apple' };
        }

        console.log('[SocialAuth] Apple credential obtained for linking');

        // Call Edge Function to link the identity
        const result = await linkIdentityToUser('apple', credential.identityToken);

        if (!result.success) {
            console.error('[SocialAuth] Edge Function link failed:', result.error);
            return { success: false, error: result.error || 'Failed to link Apple account' };
        }

        // Save name if provided (Apple only gives this on first interaction)
        if (credential.fullName?.givenName) {
            await saveAppleUserName(currentUser.id, credential.fullName);
        }

        console.log('[SocialAuth] Apple account linked successfully via Edge Function');
        return { success: true };

    } catch (error: any) {
        console.error('[SocialAuth] Link Apple error:', error);

        if (error.code === 'ERR_CANCELED') {
            return { success: false, error: 'Linking cancelled' };
        }

        return { success: false, error: error.message || 'Failed to link Apple account' };
    }
}

/**
 * Unlink a social provider from the current user
 * Validates that user has at least one other login method
 * Uses Edge Function to properly remove the identity from Supabase auth.identities
 */
export async function unlinkProvider(provider: 'google' | 'apple'): Promise<SocialAuthResult> {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return { success: false, error: 'No user logged in' };
        }

        // Check user has another login method
        const { data: profile } = await supabase
            .from('user_profiles')
            .select('password_created, google_linked, apple_linked')
            .eq('id', user.id)
            .single();

        const profileData = profile as { password_created?: boolean; google_linked?: boolean; apple_linked?: boolean } | null;

        if (!profileData) {
            return { success: false, error: 'Could not verify account status' };
        }

        const hasPassword = profileData.password_created ?? false;
        const hasGoogle = profileData.google_linked ?? false;
        const hasApple = profileData.apple_linked ?? false;

        // Count remaining login methods after unlinking
        let remainingMethods = 0;
        if (hasPassword) remainingMethods++;
        if (hasGoogle && provider !== 'google') remainingMethods++;
        if (hasApple && provider !== 'apple') remainingMethods++;

        if (remainingMethods === 0) {
            return {
                success: false,
                error: 'You need at least one login method. Please set up a password first.'
            };
        }

        // Call Edge Function to unlink (uses admin API to bypass "Manual linking disabled")
        console.log(`[SocialAuth] Calling Edge Function to unlink ${provider}`);
        const { data, error: invokeError } = await supabase.functions.invoke('link-social-identity', {
            body: { provider, action: 'unlink' }
        });

        if (invokeError) {
            console.error('[SocialAuth] Edge Function error:', invokeError);
            return { success: false, error: invokeError.message };
        }

        // Log debug info from Edge Function
        if (data?.debug) {
            console.log('[SocialAuth] Edge Function debug:', JSON.stringify(data.debug));
        }

        if (!data?.success) {
            console.error('[SocialAuth] Edge Function unlink failed:', data?.error);
            return { success: false, error: data?.error || 'Failed to unlink identity' };
        }

        console.log(`[SocialAuth] ${provider} account unlinked successfully`);
        return { success: true };

    } catch (error: any) {
        return { success: false, error: error.message || `Failed to unlink ${provider} account` };
    }
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * Update user_profiles to mark OAuth provider as linked
 */
async function syncOAuthProfileToDatabase(userId: string, provider: 'google' | 'apple'): Promise<void> {
    try {
        const updateField = provider === 'google' ? 'google_linked' : 'apple_linked';

        await supabase
            .from('user_profiles')
            .update({ [updateField]: true })
            .eq('id', userId);

        console.log(`[SocialAuth] Updated ${updateField} = true for user ${userId}`);
    } catch (error) {
        console.error('[SocialAuth] Failed to sync OAuth profile:', error);
    }
}

/**
 * Save Apple user's name (only provided on first sign-in)
 */
async function saveAppleUserName(
    userId: string,
    fullName: AppleAuthentication.AppleAuthenticationFullName
): Promise<void> {
    try {
        const firstName = fullName.givenName || '';
        const lastName = fullName.familyName || '';

        if (firstName || lastName) {
            await supabase
                .from('user_profiles')
                .update({
                    first_name: firstName,
                    last_name: lastName,
                })
                .eq('id', userId);

            console.log('[SocialAuth] Saved Apple user name:', firstName, lastName);
        }
    } catch (error) {
        console.error('[SocialAuth] Failed to save Apple user name:', error);
    }
}

// ============================================================
// Exports
// ============================================================

export {
    GOOGLE_IOS_CLIENT_ID,
    GOOGLE_WEB_CLIENT_ID,
};
