/**
 * Platform-Specific Features
 * 
 * iOS and Android specific functionality
 */

import { Platform, Linking } from 'react-native';
import * as StoreReview from 'expo-store-review';

/**
 * Request app store review
 */
export async function requestReview(): Promise<boolean> {
    try {
        const isAvailable = await StoreReview.isAvailableAsync();

        if (isAvailable) {
            await StoreReview.requestReview();
            return true;
        }

        return false;
    } catch (error) {
        console.error('[Platform] Error requesting review:', error);
        return false;
    }
}

/**
 * Open app store page
 */
export async function openStorePage(): Promise<void> {
    try {
        if (Platform.OS === 'ios') {
            // Replace with actual App Store ID when available
            await Linking.openURL('https://apps.apple.com/app/idXXXXXXXXXX');
        } else if (Platform.OS === 'android') {
            // Replace with actual package name
            await Linking.openURL('market://details?id=com.elementle.app');
        }
    } catch (error) {
        console.error('[Platform] Error opening store page:', error);
    }
}

/**
 * Handle deep links
 */
export function setupDeepLinking(callback: (url: string) => void): () => void {
    const handleUrl = ({ url }: { url: string }) => {
        callback(url);
    };

    // Listen for app opened from deep link
    const subscription = Linking.addEventListener('url', handleUrl);

    // Check if app was opened from a deep link
    Linking.getInitialURL().then(url => {
        if (url) {
            callback(url);
        }
    });

    // Return cleanup function
    return () => {
        subscription.remove();
    };
}

/**
 * Parse deep link URL
 */
export function parseDeepLink(url: string): {
    type: 'game' | 'archive' | 'stats' | 'unknown';
    params?: Record<string, string>;
} {
    try {
        // Example URLs:
        // elementle://game/REGION/12345
        // elementle://archive
        // elementle://stats?mode=USER

        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/').filter(Boolean);

        if (pathParts[0] === 'game') {
            return {
                type: 'game',
                params: {
                    mode: pathParts[1] || 'REGION',
                    puzzleId: pathParts[2] || 'today',
                },
            };
        }

        if (pathParts[0] === 'archive') {
            return { type: 'archive' };
        }

        if (pathParts[0] === 'stats') {
            const searchParams = new URLSearchParams(urlObj.search);
            return {
                type: 'stats',
                params: {
                    mode: searchParams.get('mode') || 'USER',
                },
            };
        }

        return { type: 'unknown' };
    } catch (error) {
        console.error('[Platform] Error parsing deep link:', error);
        return { type: 'unknown' };
    }
}

/**
 * Check if can open URL (for external links)
 */
export async function canOpenURL(url: string): Promise<boolean> {
    try {
        return await Linking.canOpenURL(url);
    } catch (error) {
        console.error('[Platform] Error checking URL:', error);
        return false;
    }
}

/**
 * Open external URL
 */
export async function openURL(url: string): Promise<void> {
    try {
        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
            await Linking.openURL(url);
        }
    } catch (error) {
        console.error('[Platform] Error opening URL:', error);
    }
}
