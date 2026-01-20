/**
 * Ad Banner Context
 * 
 * Controls ad visibility across different screens
 * Only shows for non-Pro users on designated screens
 */

import { createContext, useContext } from 'react';
import { useSubscription } from '../hooks/useSubscription';

// Context to track if ads should be shown on current screen
export const AdBannerContext = createContext<boolean>(true);

/**
 * Returns whether ads should show on the current screen
 * Respects screen-level context
 */
export function useAdBannerVisibility() {
    return useContext(AdBannerContext);
}

/**
 * Returns whether the ad banner is actually active/visible
 * Combines isPro status + screen context
 * Use this to add bottom padding to screens
 */
export function useAdBannerActive() {
    const { isPro } = useSubscription();
    const shouldShowOnScreen = useAdBannerVisibility();
    return !isPro && shouldShowOnScreen;
}
