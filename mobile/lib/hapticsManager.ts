/**
 * Haptics Manager
 * 
 * Manages haptic feedback throughout the app.
 * Provides consistent haptic responses for different interactions.
 */

import * as Haptics from 'expo-haptics';

class HapticsManager {
    private static instance: HapticsManager;
    private enabled: boolean = true;

    private constructor() { }

    static getInstance(): HapticsManager {
        if (!HapticsManager.instance) {
            HapticsManager.instance = new HapticsManager();
        }
        return HapticsManager.instance;
    }

    /**
     * Enable or disable haptic feedback
     */
    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
        console.log('[HapticsManager] Haptics', enabled ? 'enabled' : 'disabled');
    }

    /**
     * Light impact - for typing/button presses
     */
    async light(): Promise<void> {
        if (!this.enabled) return;
        try {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch (error) {
            console.error('[HapticsManager] Error with light haptic:', error);
        }
    }

    /**
     * Medium impact - for selections
     */
    async medium(): Promise<void> {
        if (!this.enabled) return;
        try {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } catch (error) {
            console.error('[HapticsManager] Error with medium haptic:', error);
        }
    }

    /**
     * Heavy impact - for important actions
     */
    async heavy(): Promise<void> {
        if (!this.enabled) return;
        try {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        } catch (error) {
            console.error('[HapticsManager] Error with heavy haptic:', error);
        }
    }

    /**
     * Success notification - for correct guesses
     */
    async success(): Promise<void> {
        if (!this.enabled) return;
        try {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error) {
            console.error('[HapticsManager] Error with success haptic:', error);
        }
    }

    /**
     * Error notification - for incorrect guesses
     */
    async error(): Promise<void> {
        if (!this.enabled) return;
        try {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } catch (error) {
            console.error('[HapticsManager] Error with error haptic:', error);
        }
    }

    /**
     * Warning notification
     */
    async warning(): Promise<void> {
        if (!this.enabled) return;
        try {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        } catch (error) {
            console.error('[HapticsManager] Error with warning haptic:', error);
        }
    }
}

// Export singleton instance
export const hapticsManager = HapticsManager.getInstance();
export default hapticsManager;
