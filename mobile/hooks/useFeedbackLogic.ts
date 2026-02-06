import { useState } from 'react';
import { Linking, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../lib/auth';
import { useThemeColor } from './useThemeColor';
import { useOptions } from '../lib/options';

interface SubmitResult {
    success: boolean;
    error?: string;
    message?: string;
}

export const useFeedbackLogic = () => {
    const router = useRouter();
    const { user } = useAuth();
    const { textScale } = useOptions();

    const [feedback, setFeedback] = useState('');
    const [rating, setRating] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Theme Colors
    const backgroundColor = useThemeColor({}, 'background');
    const surfaceColor = useThemeColor({}, 'surface');
    const borderColor = useThemeColor({}, 'border');
    const textColor = useThemeColor({}, 'text');
    const iconColor = useThemeColor({}, 'icon');

    const submitFeedback = async (): Promise<SubmitResult> => {
        if (!feedback.trim()) {
            return { success: false, error: 'Please enter your feedback.' };
        }

        setIsSubmitting(true);
        try {
            const userEmail = user?.email || 'Anonymous';
            const subject = 'Feedback - Elementle';
            const ratingText = rating > 0 ? `Rating: ${rating}/5 stars\n\n` : '';
            const body = `Feedback from: ${userEmail}\n\n${ratingText}Feedback:\n${feedback}`;
            const mailtoUrl = `mailto:no-reply@dobl.uk?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

            await Linking.openURL(mailtoUrl);

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
        feedback,
        setFeedback,
        rating,
        setRating,
        isSubmitting,
        submitFeedback,
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
