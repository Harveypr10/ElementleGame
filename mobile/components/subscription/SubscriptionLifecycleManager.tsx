import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Purchases from 'react-native-purchases';
import { supabase } from '../../lib/supabase';
import { RenewalReminderModal } from './RenewalReminderModal';
import { WinBackModal } from './WinBackModal';

// ============================================================================
// AsyncStorage keys for deduplication
// ============================================================================
const RETENTION_REMINDER_DATE_KEY = 'last_retention_reminder_date';
const WINBACK_SHOWN_KEY = 'winback_shown_for';

// Days before expiration that trigger a retention reminder
const REMINDER_DAYS = [10, 3, 1];

// Minimum interval between lifecycle checks (ms) — prevents rapid-fire on
// quick background→foreground transitions
const CHECK_DEBOUNCE_MS = 60_000;

// ============================================================================
// Types
// ============================================================================
interface LifecycleState {
    showRenewalReminder: boolean;
    showWinBack: boolean;
    daysRemaining: number;
    managementURL: string | null;
}

const INITIAL_STATE: LifecycleState = {
    showRenewalReminder: false,
    showWinBack: false,
    daysRemaining: 0,
    managementURL: null,
};

/**
 * Headless component — mount once in _layout.tsx.
 *
 * On mount and app resume, queries RevenueCat for the user's subscription
 * lifecycle stage and shows the appropriate modal:
 *
 * A) **Churn Risk**: Active Pro, auto-renew OFF, 10/3/1 days until expiry
 *    → RenewalReminderModal (links to App Store subscription settings)
 *
 * B) **Win-Back**: Pro expired within last 24 hours
 *    → WinBackModal (opens Paywall for immediate re-subscription)
 *
 * NOTE: Uses supabase.auth directly (not useAuth) to avoid require cycles
 * through _layout.tsx → lib/auth.tsx → guestMigration → _layout.tsx.
 */
export function SubscriptionLifecycleManager() {
    const [userId, setUserId] = useState<string | null>(null);
    const [state, setState] = useState<LifecycleState>(INITIAL_STATE);
    const lastCheckRef = useRef<number>(0);
    const appStateRef = useRef<AppStateStatus>(AppState.currentState);

    // ------------------------------------------------------------------
    // Track auth state via supabase directly (avoids lib/auth cycle)
    // ------------------------------------------------------------------
    useEffect(() => {
        // Initial session check
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUserId(session?.user?.id ?? null);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUserId(session?.user?.id ?? null);
        });

        return () => subscription.unsubscribe();
    }, []);

    // ------------------------------------------------------------------
    // Core check: query RevenueCat and determine what (if anything) to show
    // ------------------------------------------------------------------
    const performCheck = useCallback(async () => {
        if (!userId) return;

        // Debounce — skip if checked less than 60s ago
        const now = Date.now();
        if (now - lastCheckRef.current < CHECK_DEBOUNCE_MS) {
            console.log('[SubscriptionLifecycle] Debounced — skipping check');
            return;
        }
        lastCheckRef.current = now;

        try {
            const customerInfo = await Purchases.getCustomerInfo();
            const proEntitlement = customerInfo.entitlements.active['pro'];
            const today = new Date().toISOString().split('T')[0];

            // ----- Check A: Churn Risk -----
            if (proEntitlement) {
                const willRenew = (customerInfo as any).willRenew;

                if (willRenew === false) {
                    const expirationDateStr = proEntitlement.expirationDate;

                    if (expirationDateStr) {
                        const expirationDate = new Date(expirationDateStr);
                        const nowDate = new Date();
                        const diffMs = expirationDate.getTime() - nowDate.getTime();
                        const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

                        if (REMINDER_DAYS.includes(daysUntil)) {
                            // Check deduplication — only show once per day
                            const lastShown = await AsyncStorage.getItem(RETENTION_REMINDER_DATE_KEY);
                            if (lastShown !== today) {
                                console.log(`[SubscriptionLifecycle] Churn risk — ${daysUntil} days until expiry, showing reminder`);
                                setState({
                                    showRenewalReminder: true,
                                    showWinBack: false,
                                    daysRemaining: daysUntil,
                                    managementURL: (customerInfo as any).managementURL ?? null,
                                });
                                return;
                            } else {
                                console.log('[SubscriptionLifecycle] Churn risk — already reminded today');
                            }
                        } else {
                            console.log(`[SubscriptionLifecycle] Active Pro, auto-renew off, but ${daysUntil} days remaining — not a reminder day`);
                        }
                    }
                } else {
                    console.log('[SubscriptionLifecycle] Active Pro with auto-renew on — no action');
                }
                return;
            }

            // ----- Check B: Win-Back -----
            const latestExpiration = (customerInfo as any).latestExpirationDate;

            if (latestExpiration) {
                const expirationDate = new Date(latestExpiration);
                const nowDate = new Date();
                const hoursSinceExpiry = (nowDate.getTime() - expirationDate.getTime()) / (1000 * 60 * 60);

                if (hoursSinceExpiry > 0 && hoursSinceExpiry <= 24) {
                    // Expired within last 24 hours — check deduplication
                    const shownFor = await AsyncStorage.getItem(WINBACK_SHOWN_KEY);
                    const expirationKey = expirationDate.toISOString();

                    if (shownFor !== expirationKey) {
                        console.log(`[SubscriptionLifecycle] Win-back — expired ${hoursSinceExpiry.toFixed(1)}h ago, showing offer`);
                        setState({
                            showRenewalReminder: false,
                            showWinBack: true,
                            daysRemaining: 0,
                            managementURL: null,
                        });
                        return;
                    } else {
                        console.log('[SubscriptionLifecycle] Win-back — already shown for this expiration');
                    }
                } else {
                    console.log(`[SubscriptionLifecycle] No pro entitlement, expiry was ${hoursSinceExpiry.toFixed(1)}h ago — outside 24h window`);
                }
            } else {
                console.log('[SubscriptionLifecycle] No pro entitlement and no expiration history — free user, no action');
            }
        } catch (error) {
            console.error('[SubscriptionLifecycle] Check failed:', error);
        }
    }, [userId]);

    // ------------------------------------------------------------------
    // Run on mount
    // ------------------------------------------------------------------
    useEffect(() => {
        // Small delay to let the app settle after launch
        const timer = setTimeout(() => {
            performCheck();
        }, 3000);

        return () => clearTimeout(timer);
    }, [performCheck]);

    // ------------------------------------------------------------------
    // Run on app resume (background → foreground)
    // ------------------------------------------------------------------
    useEffect(() => {
        const handleAppStateChange = (nextState: AppStateStatus) => {
            if (
                appStateRef.current.match(/inactive|background/) &&
                nextState === 'active'
            ) {
                console.log('[SubscriptionLifecycle] App resumed — running check');
                performCheck();
            }
            appStateRef.current = nextState;
        };

        const subscription = AppState.addEventListener('change', handleAppStateChange);
        return () => subscription.remove();
    }, [performCheck]);

    // ------------------------------------------------------------------
    // Dismiss handlers — persist deduplication flags
    // ------------------------------------------------------------------
    const handleRenewalReminderDismiss = useCallback(async () => {
        const today = new Date().toISOString().split('T')[0];
        await AsyncStorage.setItem(RETENTION_REMINDER_DATE_KEY, today);
        setState(INITIAL_STATE);
    }, []);

    const handleWinBackDismiss = useCallback(async () => {
        try {
            const customerInfo = await Purchases.getCustomerInfo();
            const latestExpiration = (customerInfo as any).latestExpirationDate;
            if (latestExpiration) {
                await AsyncStorage.setItem(WINBACK_SHOWN_KEY, new Date(latestExpiration).toISOString());
            }
        } catch {
            // Fallback: store today's date
            await AsyncStorage.setItem(WINBACK_SHOWN_KEY, new Date().toISOString());
        }
        setState(INITIAL_STATE);
    }, []);

    const handleResubscribed = useCallback(() => {
        console.log('[SubscriptionLifecycle] User re-subscribed via win-back');
        setState(INITIAL_STATE);
    }, []);

    // ------------------------------------------------------------------
    // Render modals (or nothing)
    // ------------------------------------------------------------------
    if (!userId) return null;

    // Skip on web — RevenueCat is native-only
    if (Platform.OS === 'web') return null;

    return (
        <>
            <RenewalReminderModal
                visible={state.showRenewalReminder}
                daysRemaining={state.daysRemaining}
                managementURL={state.managementURL}
                onDismiss={handleRenewalReminderDismiss}
            />
            <WinBackModal
                visible={state.showWinBack}
                onDismiss={handleWinBackDismiss}
                onResubscribed={handleResubscribed}
            />
        </>
    );
}
