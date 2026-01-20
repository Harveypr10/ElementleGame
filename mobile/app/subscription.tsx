/**
 * Subscription Page (Placeholder)
 * 
 * For now, redirect to settings/account
 * TODO: Implement full subscription flow with Stripe or in-app purchases
 */

import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function SubscriptionPage() {
    const router = useRouter();

    useEffect(() => {
        // Redirect to settings for now
        router.replace('/settings/account-info');
    }, []);

    return null;
}
