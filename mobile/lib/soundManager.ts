/**
 * Sound Manager
 * 
 * Manages game sound effects using React Native Sound.
 * Sounds are loaded once and played on demand.
 */

import { Audio } from 'expo-av';

type SoundType =
    | 'tap'              // Button/numpad tap
    | 'guess_entered'    // Successful guess submission
    | 'guess_failed'     // Invalid date entry
    | 'game_win'         // Correct answer
    | 'game_lose'        // Final incorrect guess
    | 'streak'           // Streak popup
    | 'badge_award';     // Badge award popup

class SoundManager {
    private static instance: SoundManager;
    private sounds: Map<SoundType, Audio.Sound> = new Map();
    private enabled: boolean = true;
    private isInitialized: boolean = false;

    private constructor() { }

    static getInstance(): SoundManager {
        if (!SoundManager.instance) {
            SoundManager.instance = new SoundManager();
        }
        return SoundManager.instance;
    }

    /**
     * Initialize and load all sound files
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        try {
            // Set audio mode for sound effects
            await Audio.setAudioModeAsync({
                playsInSilentModeIOS: true,
                staysActiveInBackground: false,
                shouldDuckAndroid: true,
            });

            // Load sound files
            const soundFiles: Record<SoundType, any> = {
                tap: require('../assets/sounds/tap.wav'),
                guess_entered: require('../assets/sounds/guess_entered.wav'),
                guess_failed: require('../assets/sounds/guess_failed.wav'),
                game_win: require('../assets/sounds/game_win.wav'),
                game_lose: require('../assets/sounds/game_lose.wav'),
                streak: require('../assets/sounds/streak.wav'),
                badge_award: require('../assets/sounds/badge_award.wav'),
            };

            for (const [type, file] of Object.entries(soundFiles)) {
                const { sound } = await Audio.Sound.createAsync(file, {
                    shouldPlay: false,
                    isLooping: false,
                });
                this.sounds.set(type as SoundType, sound);
            }

            this.isInitialized = true;
            console.log('[SoundManager] Initialized successfully with', this.sounds.size, 'sounds');
        } catch (error) {
            console.error('[SoundManager] Failed to initialize:', error);
        }
    }

    /**
     * Enable or disable sound playback
     */
    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
        console.log('[SoundManager] Sounds', enabled ? 'enabled' : 'disabled');
    }

    /**
     * Play a sound effect
     */
    async play(type: SoundType): Promise<void> {
        if (!this.enabled) {
            return;
        }

        const sound = this.sounds.get(type);
        if (!sound) {
            console.warn(`[SoundManager] Sound not loaded: ${type}`);
            return;
        }

        try {
            // Stop if already playing, reset to beginning, and play
            await sound.stopAsync();
            await sound.setPositionAsync(0);
            await sound.playAsync();
        } catch (error) {
            console.error(`[SoundManager] Error playing ${type}:`, error);
        }
    }

    /**
     * Cleanup
     */
    async cleanup(): Promise<void> {
        for (const sound of this.sounds.values()) {
            try {
                await sound.unloadAsync();
            } catch (error) {
                console.error('[SoundManager] Error unloading sound:', error);
            }
        }
        this.sounds.clear();
        this.isInitialized = false;
        console.log('[SoundManager] Cleaned up');
    }
}

// Export singleton instance
export const soundManager = SoundManager.getInstance();
export default soundManager;
