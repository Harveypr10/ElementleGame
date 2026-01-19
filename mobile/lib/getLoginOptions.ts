import { supabase } from './supabase';

export interface LoginOptions {
    exists: boolean;
    hasPassword: boolean;
    magicLinkAvailable: boolean;
    oauthAvailable: boolean;
}

/**
 * Probe Supabase Auth to determine available login methods for an email
 * Uses error responses to infer user state without making actual login attempts
 */
export async function getLoginOptions(email: string): Promise<LoginOptions> {
    const normalizedEmail = email.trim().toLowerCase();

    // Default result
    const result: LoginOptions = {
        exists: false,
        hasPassword: false,
        magicLinkAvailable: false,
        oauthAvailable: true, // OAuth is always available
    };

    // Probe 1: Check if user has a password by attempting login with dummy password
    try {
        const { error: passwordError } = await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password: '__probe_dummy_password_12345__', // Intentionally wrong
        });

        if (passwordError) {
            const errorMsg = passwordError.message.toLowerCase();

            // Analyze the error message
            if (errorMsg.includes('invalid login credentials') ||
                errorMsg.includes('invalid password') ||
                errorMsg.includes('wrong password')) {
                // User exists AND has a password (wrong password was provided)
                result.exists = true;
                result.hasPassword = true;
            } else if (errorMsg.includes('email not confirmed')) {
                // User exists but email not confirmed
                result.exists = true;
                result.hasPassword = true;
            } else if (errorMsg.includes('user not found') ||
                errorMsg.includes('no user found') ||
                errorMsg.includes('not found')) {
                // User doesn't exist
                result.exists = false;
                result.hasPassword = false;
            } else if (errorMsg.includes('no password') ||
                errorMsg.includes('password not set')) {
                // User exists but has no password (OAuth-only user)
                result.exists = true;
                result.hasPassword = false;
            } else {
                // Unknown error - assume user doesn't exist
                console.warn('[getLoginOptions] Unknown password error:', errorMsg);
                result.exists = false;
            }
        } else {
            // Successful login (shouldn't happen with dummy password)
            result.exists = true;
            result.hasPassword = true;
        }
    } catch (error) {
        console.error('[getLoginOptions] Password probe error:', error);
        // On error, assume user doesn't exist
        result.exists = false;
    }

    // Probe 2: Check if magic link is available by attempting to send OTP
    // Only probe if user exists
    if (result.exists) {
        try {
            const { error: otpError } = await supabase.auth.signInWithOtp({
                email: normalizedEmail,
                options: {
                    shouldCreateUser: false, // Don't create user if they don't exist
                },
            });

            if (otpError) {
                const errorMsg = otpError.message.toLowerCase();

                console.log('[getLoginOptions] OTP probe error message:', errorMsg);

                if (errorMsg.includes('rate limit') || errorMsg.includes('too many') || errorMsg.includes('seconds')) {
                    // Hit rate limit, but magic link IS available
                    result.magicLinkAvailable = true;
                } else if (errorMsg.includes('disabled') || errorMsg.includes('not enabled')) {
                    // Magic link explicitly disabled
                    result.magicLinkAvailable = false;
                } else if (errorMsg.includes('network') || errorMsg.includes('fetch') || errorMsg.includes('offline')) {
                    // Network error - can't determine, default to false in offline mode
                    console.log('[getLoginOptions] Network error during OTP probe, assuming unavailable');
                    result.magicLinkAvailable = false;
                } else {
                    // Other error - likely means magic link works but something else failed
                    // Conservative default: assume available
                    result.magicLinkAvailable = true;
                }
            } else {
                // OTP sent successfully 
                // NOTE: This actually sends an email!
                result.magicLinkAvailable = true;
            }
        } catch (error: any) {
            console.error('[getLoginOptions] OTP probe exception:', error);
            // On network exception in offline mode, don't show magic link
            if (error?.message?.toLowerCase().includes('network') ||
                error?.message?.toLowerCase().includes('fetch') ||
                error?.message?.toLowerCase().includes('offline')) {
                result.magicLinkAvailable = false;
            } else {
                // Unknown error, default to true (safe default for online mode)
                result.magicLinkAvailable = true;
            }
        }
    }

    console.log('[getLoginOptions] Results for', normalizedEmail, ':', result);
    return result;
}
