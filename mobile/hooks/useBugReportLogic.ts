import { useState, useCallback } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { useAuth } from '../lib/auth';
import { useThemeColor } from './useThemeColor';
import { useOptions } from '../lib/options';
import { supabase } from '../lib/supabase';

interface SubmitResult {
    success: boolean;
    error?: string;
    message?: string;
}

export const useBugReportLogic = () => {
    const router = useRouter();
    const { user } = useAuth();
    const { textScale } = useOptions();

    const [description, setDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);

    // Optional email for guests
    const [guestEmail, setGuestEmail] = useState('');
    const [showEmailPrompt, setShowEmailPrompt] = useState(false);

    // Theme Colors
    const backgroundColor = useThemeColor({}, 'background');
    const surfaceColor = useThemeColor({}, 'surface');
    const borderColor = useThemeColor({}, 'border');
    const textColor = useThemeColor({}, 'text');
    const iconColor = useThemeColor({}, 'icon');

    let appVersion = Constants.expoConfig?.version || '1.0.0';
    try {
        const Application = require('expo-application');
        if (Application.nativeApplicationVersion) {
            appVersion = Application.nativeApplicationVersion;
        }
    } catch { }
    const deviceOs = `${Platform.OS} ${Platform.Version}`;

    const hasAuthEmail = !!user?.email;

    /**
     * Called when user taps Submit.
     * If guest with no email, show the email prompt first.
     */
    const handleSubmitPress = useCallback((): 'needs_email' | 'submitting' => {
        if (!description.trim()) {
            return 'needs_email';
        }

        if (!hasAuthEmail && !showEmailPrompt) {
            setShowEmailPrompt(true);
            return 'needs_email';
        }

        return 'submitting';
    }, [description, hasAuthEmail, showEmailPrompt]);

    const submitBugReport = async (): Promise<SubmitResult> => {
        if (!description.trim()) {
            return { success: false, error: 'Please describe the bug.' };
        }

        setIsSubmitting(true);
        try {
            const resolvedEmail = user?.email || guestEmail.trim() || null;

            const { error } = await supabase.from('user_feedback').insert({
                user_id: user?.id || null,
                email: resolvedEmail,
                type: 'bug',
                message: description.trim(),
                rating: null,
                app_version: appVersion,
                device_os: deviceOs,
            });

            if (error) {
                console.error('[BugReport] Supabase insert error:', error);
                return { success: false, error: 'Failed to submit report. Please try again.' };
            }

            setIsSubmitted(true);
            return { success: true, message: 'Thank you! Your bug report has been submitted.' };
        } catch (error: any) {
            console.error('[BugReport] Submit error:', error);
            return { success: false, error: 'Something went wrong. Please try again.' };
        } finally {
            setIsSubmitting(false);
        }
    };

    const skipEmail = useCallback(() => {
        setGuestEmail('');
    }, []);

    const goBack = () => {
        router.back();
    };

    return {
        description,
        setDescription,
        isSubmitting,
        isSubmitted,
        submitBugReport,
        handleSubmitPress,
        goBack,
        textScale,
        userEmail: user?.email || '',
        hasAuthEmail,
        showEmailPrompt,
        guestEmail,
        setGuestEmail,
        skipEmail,
        colors: {
            background: backgroundColor,
            surface: surfaceColor,
            border: borderColor,
            text: textColor,
            icon: iconColor
        }
    };
};
