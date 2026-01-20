/**
 * Ad Banner Component - PLACEHOLDER
 * 
 * Shows placeholder for ad banner at bottom of screen for non-Pro users
 * TODO: Replace with working ad solution (Google AdMob via react-native-google-mobile-ads)
 * 50px height, fixed to bottom
 */

import React from 'react';
import { View, Text } from 'react-native';
import { styled } from 'nativewind';
import { useAdBannerVisibility } from '../contexts/AdBannerContext';
import { useSubscription } from '../hooks/useSubscription';

const StyledView = styled(View);
const StyledText = styled(Text);

export function AdBanner() {
    const { isPro } = useSubscription();
    const shouldShowOnScreen = useAdBannerVisibility();

    // Don't render if Pro user or screen doesn't allow ads
    if (isPro || !shouldShowOnScreen) {
        return null;
    }

    // Placeholder until we implement proper ads
    return (
        <StyledView
            className="absolute bottom-0 left-0 right-0 bg-slate-100 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700"
            style={{ height: 50 }}
        >
            <StyledView className="flex-1 items-center justify-center">
                <StyledText className="text-xs text-slate-400 dark:text-slate-500">
                    Ad Space • Go Pro to remove ads
                </StyledText>
            </StyledView>
        </StyledView>
    );
}
