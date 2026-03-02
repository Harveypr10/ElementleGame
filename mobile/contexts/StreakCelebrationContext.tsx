import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { StreakCelebration } from '../components/game/StreakCelebration';

interface StreakCelebrationContextType {
    /**
     * Schedule a streak celebration to appear after a delay.
     * The celebration will persist even if the user navigates to another screen.
     */
    scheduleCelebration: (streak: number, delayMs?: number) => void;
    /** Register a callback to be invoked once the celebration modal closes */
    onCelebrationClosed: (callback: () => void) => void;
    /** The current streak value being celebrated (0 if none) */
    celebrationStreak: number;
}

const StreakCelebrationContext = createContext<StreakCelebrationContextType>({
    scheduleCelebration: () => { },
    onCelebrationClosed: () => { },
    celebrationStreak: 0,
});

export const useStreakCelebration = () => useContext(StreakCelebrationContext);

export function StreakCelebrationProvider({ children }: { children: React.ReactNode }) {
    const [visible, setVisible] = useState(false);
    const [streak, setStreak] = useState(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const scheduledRef = useRef(false); // Prevent duplicate scheduling
    const closedCallbackRef = useRef<(() => void) | null>(null);

    const scheduleCelebration = useCallback((streakCount: number, delayMs: number = 6000) => {
        // Prevent duplicate scheduling within the same session
        if (scheduledRef.current) {
            console.log('[StreakCelebrationContext] Already scheduled, ignoring duplicate');
            return;
        }
        scheduledRef.current = true;

        console.log(`[StreakCelebrationContext] Scheduling celebration for streak ${streakCount} in ${delayMs}ms`);

        // Clear any existing timer
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }

        setStreak(streakCount);

        timerRef.current = setTimeout(() => {
            console.log('[StreakCelebrationContext] Showing celebration now');
            setVisible(true);
            timerRef.current = null;
        }, delayMs);
    }, []);

    const onCelebrationClosed = useCallback((callback: () => void) => {
        closedCallbackRef.current = callback;
    }, []);

    const handleClose = useCallback(() => {
        setVisible(false);
        // Reset scheduled ref so a new game can trigger a new celebration
        scheduledRef.current = false;
        // Fire the onClosed callback if registered
        if (closedCallbackRef.current) {
            console.log('[StreakCelebrationContext] Firing onCelebrationClosed callback');
            const callback = closedCallbackRef.current;
            closedCallbackRef.current = null; // Clear after firing (one-shot)
            // Small delay to let modal animation complete before triggering next modal
            setTimeout(callback, 300);
        }
    }, []);

    return (
        <StreakCelebrationContext.Provider value={{ scheduleCelebration, onCelebrationClosed, celebrationStreak: streak }}>
            {children}
            <StreakCelebration
                visible={visible}
                streak={streak}
                onClose={handleClose}
            />
        </StreakCelebrationContext.Provider>
    );
}
