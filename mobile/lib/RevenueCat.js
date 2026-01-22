import Purchases from 'react-native-purchases';

/**
 * Initialize RevenueCat SDK
 * Call this once when your app starts (e.g., in App.tsx or _layout.tsx)
 */
export const initializeRevenueCat = async () => {
    try {
        // iOS API Key - Production
        const apiKey = 'appl_wTWxcJekLEpXGFFtChkZMcSaTAJ';

        // Configure SDK for iOS only
        Purchases.configure({ apiKey });

        console.log('[RevenueCat] SDK initialized successfully');
    } catch (error) {
        console.error('[RevenueCat] Initialization error:', error);
    }
};

/**
 * CRITICAL: Log in the user to RevenueCat with Supabase user ID
 * This links the anonymous RevenueCat ID to the Supabase user
 * @param {string} supabaseUserId - The Supabase user ID
 */
export const logInRevenueCat = async (supabaseUserId) => {
    try {
        console.log('[RevenueCat] Logging in user:', supabaseUserId);
        const { customerInfo } = await Purchases.logIn(supabaseUserId);
        console.log('[RevenueCat] User logged in successfully');
        const isPro = customerInfo.entitlements.active['pro'] !== undefined;
        console.log('[RevenueCat] Pro status after login:', isPro);
        return { success: true, isPro, customerInfo };
    } catch (error) {
        console.error('[RevenueCat] Login error:', error);
        return { success: false, error };
    }
};

/**
 * Log out the current RevenueCat user
 */
export const logOutRevenueCat = async () => {
    try {
        console.log('[RevenueCat] Logging out user');
        const { customerInfo } = await Purchases.logOut();
        console.log('[RevenueCat] User logged out successfully');
        return { success: true, customerInfo };
    } catch (error) {
        // Ignore error if user is already anonymous
        if (error.message && error.message.includes('anonymous')) {
            console.log('[RevenueCat] User already anonymous, skipping logout');
            return { success: true, customerInfo: null };
        }
        console.error('[RevenueCat] Logout error:', error);
        return { success: false, error };
    }
};

/**
 * Check if the user has an active Pro subscription
 * @returns {Promise<boolean>} True if user has 'pro' entitlement
 */
export const checkProSubscription = async () => {
    try {
        const customerInfo = await Purchases.getCustomerInfo();

        // Check for the 'pro' entitlement
        const isPro = customerInfo.entitlements.active['pro'] !== undefined;

        console.log('[RevenueCat] Pro status:', isPro);
        console.log('[RevenueCat] Active entitlements:', Object.keys(customerInfo.entitlements.active));

        return isPro;
    } catch (error) {
        console.error('[RevenueCat] Error checking subscription:', error);
        return false;
    }
};

/**
 * Get current subscription offerings
 * @returns {Promise<Offerings>} Available subscription packages
 */
export const getOfferings = async () => {
    try {
        const offerings = await Purchases.getOfferings();
        console.log('[RevenueCat] Offerings loaded:', offerings.current?.identifier);
        console.log('[RevenueCat] Available packages:', offerings.current?.availablePackages.length);
        return offerings;
    } catch (error) {
        console.error('[RevenueCat] Error fetching offerings:', error);
        return null;
    }
};

/**
 * Purchase a subscription package
 * @param {Package} package - The package to purchase
 * @returns {Promise<{customerInfo, productIdentifier}>} Purchase result
 */
export const purchasePackage = async (packageToPurchase) => {
    try {
        const { customerInfo, productIdentifier } = await Purchases.purchasePackage(packageToPurchase);

        // Log full customerInfo for debugging
        console.log('[RevenueCat] Purchase completed for product:', productIdentifier);
        console.log('[RevenueCat] Active entitlements:', Object.keys(customerInfo.entitlements.active));

        // Check if user now has pro entitlement
        const isPro = customerInfo.entitlements.active['pro'] !== undefined;

        console.log('[RevenueCat] Purchase successful. Pro status:', isPro);

        if (!isPro) {
            console.warn('[RevenueCat] ⚠️ Purchase succeeded but no "pro" entitlement found!');
            console.warn('[RevenueCat] Check that product is linked to "pro" entitlement in dashboard');
        }

        return { success: true, customerInfo, productIdentifier, isPro };
    } catch (error) {
        if (error.code === Purchases.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
            console.log('[RevenueCat] Purchase cancelled by user');
            return { success: false, cancelled: true };
        } else {
            console.error('[RevenueCat] Purchase error:', error);
            return { success: false, error };
        }
    }
};

/**
 * Restore previous purchases and check for active subscriptions
 * @returns {Promise<{customerInfo}>} Restore result
 */
export const restorePurchases = async () => {
    try {
        console.log('[RevenueCat] Restoring purchases...');
        const customerInfo = await Purchases.restorePurchases();

        // Check if user has pro entitlement (either from restore or existing subscription)
        const isPro = customerInfo.entitlements.active['pro'] !== undefined;

        console.log('[RevenueCat] Restore complete. Pro status:', isPro);
        console.log('[RevenueCat] Active entitlements:', Object.keys(customerInfo.entitlements.active));

        if (isPro) {
            console.log('[RevenueCat] ✅ Active Pro subscription found');
        } else {
            console.log('[RevenueCat] No active Pro subscription found');
        }

        return { success: true, customerInfo, isPro };
    } catch (error) {
        console.error('[RevenueCat] Restore error:', error);
        return { success: false, error };
    }
};

/**
 * Get customer info (useful for checking subscription status, expiration, etc.)
 * @returns {Promise<CustomerInfo>} Customer information
 */
export const getCustomerInfo = async () => {
    try {
        const customerInfo = await Purchases.getCustomerInfo();
        const isPro = customerInfo.entitlements.active['pro'] !== undefined;
        console.log('[RevenueCat] Customer info retrieved. Pro status:', isPro);
        return customerInfo;
    } catch (error) {
        console.error('[RevenueCat] Error getting customer info:', error);
        return null;
    }
};

/**
 * Helper function to wait/delay
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Sync subscription to Supabase database (server-side verification)
 * Calls Edge Function which verifies entitlement status via RevenueCat API
 * Includes retry logic to handle "Fetch token is currently being ingested" error
 * @param {SupabaseClient} supabase - Supabase client instance
 * @returns {Promise<{success, data}>} Sync result
 */
export const syncSubscriptionToDatabase = async (supabase) => {
    try {
        console.log('[RevenueCat] Syncing subscription to database...');

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !session) {
            throw new Error('No active session found');
        }

        // RETRY LOGIC: Handle race condition in sandbox environment
        // RevenueCat needs time to process receipt before we can query
        let lastError = null;

        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                console.log(`[RevenueCat] Sync attempt ${attempt}/2`);

                // Call Edge Function - passes ONLY userId (extracted from session)
                // Edge Function will verify entitlement server-side via RevenueCat API
                const { data, error } = await supabase.functions.invoke(
                    'sync-revenuecat-subscription',
                    {
                        headers: {
                            Authorization: `Bearer ${session.access_token}`
                        }
                    }
                );

                if (error) {
                    throw error;
                }

                console.log('[RevenueCat] Synced to database:', data);
                return { success: true, data };

            } catch (error) {
                lastError = error;
                console.warn(`[RevenueCat] Sync attempt ${attempt} failed:`, error.message);

                // If this is the first attempt and we got a receipt processing error, retry
                if (attempt === 1 && (
                    error.message?.includes('7746') ||
                    error.message?.includes('being ingested') ||
                    error.message?.includes('No Pro entitlement')
                )) {
                    console.log('[RevenueCat] Waiting 2 seconds before retry...');
                    await delay(2000);
                    continue;
                }

                // Otherwise, throw immediately
                throw error;
            }
        }

        // If we exhausted retries, throw the last error
        throw lastError;

    } catch (error) {
        console.error('[RevenueCat] Sync error:', error);
        return { success: false, error: error.message || String(error) };
    }
};

export default {
    initializeRevenueCat,
    logInRevenueCat,
    logOutRevenueCat,
    checkProSubscription,
    getOfferings,
    purchasePackage,
    restorePurchases,
    getCustomerInfo,
    syncSubscriptionToDatabase,
};
