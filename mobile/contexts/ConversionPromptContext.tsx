import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '../lib/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ConversionPromptContextType {
    shouldShowPrompt: boolean;
    dismissPrompt: () => void;
    incrementInteraction: () => void;
    resetPromptState: () => void;
}

const ConversionPromptContext = createContext<ConversionPromptContextType | null>(null);

const INTERACTION_THRESHOLD = 5; // Show prompt after 5 interactions
const STORAGE_KEY = 'guest_interactions_count';
const DISMISSED_KEY = 'guest_prompt_dismissed';

export function ConversionPromptProvider({ children }: { children: ReactNode }) {
    const { isGuest } = useAuth();
    const [interactionCount, setInteractionCount] = useState(0);
    const [dismissed, setDismissed] = useState(false);
    const [shouldShowPrompt, setShouldShowPrompt] = useState(false);

    // Load state on mount
    useEffect(() => {
        const loadState = async () => {
            try {
                const [countStr, dismissedStr] = await Promise.all([
                    AsyncStorage.getItem(STORAGE_KEY),
                    AsyncStorage.getItem(DISMISSED_KEY),
                ]);

                const count = countStr ? parseInt(countStr, 10) : 0;
                const wasDismissed = dismissedStr === 'true';

                setInteractionCount(count);
                setDismissed(wasDismissed);

                // Show prompt if guest, threshold reached, and not dismissed
                if (isGuest && count >= INTERACTION_THRESHOLD && !wasDismissed) {
                    setShouldShowPrompt(true);
                }
            } catch (error) {
                console.error('[ConversionPrompt] Error loading state:', error);
            }
        };

        loadState();
    }, [isGuest]);

    // Reset state when user logs in
    useEffect(() => {
        if (!isGuest) {
            resetPromptState();
        }
    }, [isGuest]);

    const incrementInteraction = async () => {
        if (!isGuest || dismissed) return;

        const newCount = interactionCount + 1;
        setInteractionCount(newCount);

        try {
            await AsyncStorage.setItem(STORAGE_KEY, newCount.toString());

            if (newCount >= INTERACTION_THRESHOLD) {
                setShouldShowPrompt(true);
            }
        } catch (error) {
            console.error('[ConversionPrompt] Error saving interaction count:', error);
        }
    };

    const dismissPrompt = async () => {
        setShouldShowPrompt(false);
        setDismissed(true);

        try {
            await AsyncStorage.setItem(DISMISSED_KEY, 'true');
        } catch (error) {
            console.error('[ConversionPrompt] Error saving dismissed state:', error);
        }
    };

    const resetPromptState = async () => {
        setInteractionCount(0);
        setDismissed(false);
        setShouldShowPrompt(false);

        try {
            await Promise.all([
                AsyncStorage.removeItem(STORAGE_KEY),
                AsyncStorage.removeItem(DISMISSED_KEY),
            ]);
        } catch (error) {
            console.error('[ConversionPrompt] Error resetting state:', error);
        }
    };

    return (
        <ConversionPromptContext.Provider
            value={{
                shouldShowPrompt: isGuest && shouldShowPrompt,
                dismissPrompt,
                incrementInteraction,
                resetPromptState,
            }}
        >
            {children}
        </ConversionPromptContext.Provider>
    );
}

export const useConversionPrompt = () => {
    const context = useContext(ConversionPromptContext);
    if (!context) {
        throw new Error('useConversionPrompt must be used within ConversionPromptProvider');
    }
    return context;
};
