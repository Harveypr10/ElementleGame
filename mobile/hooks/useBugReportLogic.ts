import { useState } from 'react';
import { Linking, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../lib/auth';
import { useThemeColor } from './useThemeColor';
import { useOptions } from '../lib/options';

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

    // Theme Colors
    const backgroundColor = useThemeColor({}, 'background');
    const surfaceColor = useThemeColor({}, 'surface');
    const borderColor = useThemeColor({}, 'border');
    const textColor = useThemeColor({}, 'text');
    const iconColor = useThemeColor({}, 'icon');

    const submitBugReport = async (): Promise<SubmitResult> => {
        if (!description.trim()) {
            return { success: false, error: 'Please describe the bug.' };
        }

        setIsSubmitting(true);
        try {
            const userEmail = user?.email || 'Anonymous';
            const subject = 'Bug Report - Elementle';
            const body = `Report from: ${userEmail}\n\nDescription:\n${description}`;
            const mailtoUrl = `mailto:no-reply@dobl.uk?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

            // On Web, Linking.canOpenURL might return false for mailto depending on browser, 
            // but Linking.openURL usually works or window.location.href.
            // React Native Web's Linking.openURL maps to window.open or window.location.

            // We'll try openURL directly.
            await Linking.openURL(mailtoUrl);

            // We assume success if openURL didn't throw. 
            // (Email clients don't return "success" callback easily).
            return { success: true, message: 'Opening your email client...' };

        } catch (error: any) {
            console.error('Error opening email:', error);
            return { success: false, error: 'Could not open email client. Please email us at no-reply@dobl.uk' };
        } finally {
            setIsSubmitting(false);
        }
    };

    const goBack = () => {
        router.back();
    };

    return {
        description,
        setDescription,
        isSubmitting,
        submitBugReport,
        goBack,
        textScale,
        userEmail: user?.email || '',
        colors: {
            background: backgroundColor,
            surface: surfaceColor,
            border: borderColor,
            text: textColor,
            icon: iconColor
        }
    };
};
