import { useState, useCallback } from 'react';
import { Platform, Alert, Linking } from 'react-native';
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
    /** Whether the review prompt was triggered */
    reviewTriggered?: boolean;
}

export const useFeedbackLogic = () => {
    const router = useRouter();
    const { user } = useAuth();
    const { textScale } = useOptions();

    const [feedback, setFeedback] = useState('');
    const [rating, setRating] = useState(0);
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

    // Use expo-application in production builds, fall back to Constants in Expo Go
    let appVersion = Constants.expoConfig?.version || '1.0.0';
    try {
        const Application = require('expo-application');
        if (Application.nativeApplicationVersion) {
            appVersion = Application.nativeApplicationVersion;
        }
    } catch { }
    const deviceOs = `${Platform.OS} ${Platform.Version}`;

    /** Whether the user already has an email (via auth) */
    const hasAuthEmail = !!user?.email;

    /**
     * Called when user taps Submit.
     * If guest with no email, show the email prompt first.
     * Otherwise, proceed to submit.
     */
    const handleSubmitPress = useCallback((): 'needs_email' | 'submitting' => {
        if (!feedback.trim()) {
            return 'needs_email'; // will be caught by caller as validation error
        }

        if (!hasAuthEmail && !showEmailPrompt) {
            setShowEmailPrompt(true);
            return 'needs_email';
        }

        return 'submitting';
    }, [feedback, hasAuthEmail, showEmailPrompt]);

    /**
     * Submit the feedback payload to Supabase.
     */
    const submitFeedback = async (): Promise<SubmitResult> => {
        if (!feedback.trim()) {
            return { success: false, error: 'Please enter your feedback.' };
        }

        setIsSubmitting(true);
        try {
            const resolvedEmail = user?.email || guestEmail.trim() || null;

            const { error } = await supabase.from('user_feedback').insert({
                user_id: user?.id || null,
                email: resolvedEmail,
                type: 'feedback',
                message: feedback.trim(),
                rating: rating > 0 ? rating : null,
                app_version: appVersion,
                device_os: deviceOs,
            });

            if (error) {
                console.error('[Feedback] Supabase insert error:', error);
                return { success: false, error: 'Failed to send feedback. Please try again.' };
            }

            setIsSubmitted(true);

            // Review gating: 4 or 5 stars → trigger store review
            let reviewTriggered = false;
            if (rating >= 4 && Platform.OS !== 'web') {
                try {
                    const StoreReview = require('expo-store-review');
                    const isAvailable = await StoreReview.isAvailableAsync();
                    if (isAvailable) {
                        await StoreReview.requestReview();
                        reviewTriggered = true;
                    } else {
                        // Fallback: offer deep link to App Store
                        const storeUrl = Platform.select({
                            ios: 'https://apps.apple.com/app/elementle/id6740048498',
                            android: 'https://play.google.com/store/apps/details?id=com.dobl.elementlegame',
                        });
                        if (storeUrl) {
                            Alert.alert(
                                'Thank You! 🎉',
                                'We\'re glad you\'re enjoying Elementle! Would you mind leaving us a review on the App Store?',
                                [
                                    { text: 'Not Now', style: 'cancel' },
                                    { text: 'Leave a Review', onPress: () => Linking.openURL(storeUrl) },
                                ]
                            );
                            reviewTriggered = true;
                        }
                    }
                } catch (reviewError) {
                    console.error('[Feedback] Store review error:', reviewError);
                }
            }

            return {
                success: true,
                message: 'Thank you for your feedback!',
                reviewTriggered,
            };
        } catch (error: any) {
            console.error('[Feedback] Submit error:', error);
            return { success: false, error: 'Something went wrong. Please try again.' };
        } finally {
            setIsSubmitting(false);
        }
    };

    /** Skip the email prompt and submit without email */
    const skipEmail = useCallback(() => {
        setGuestEmail('');
    }, []);

    const goBack = () => {
        router.back();
    };

    return {
        feedback,
        setFeedback,
        rating,
        setRating,
        isSubmitting,
        isSubmitted,
        submitFeedback,
        handleSubmitPress,
        goBack,
        textScale,
        userEmail: user?.email || '',
        // Guest email prompt
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
