import { useState } from 'react';
import { Alert, ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../lib/auth';
import { useProfile } from '../hooks/useProfile';
import { useSubscription } from '../hooks/useSubscription';
import { useOptions } from '../lib/options';
import { useRestrictions } from '../hooks/useRestrictions';
import { useThemeColor } from '../hooks/useThemeColor';

export function useSettingsScreenLogic() {
    const router = useRouter();
    const { user, isAuthenticated, signOut } = useAuth();
    const { profile, isAdmin } = useProfile();
    const { isPro, tierName, tierType } = useSubscription();
    const { textScale } = useOptions();
    const { checkCategories } = useRestrictions();

    const [signingOut, setSigningOut] = useState(false);

    // Theme Colors
    const backgroundColor = useThemeColor({}, 'background');
    const surfaceColor = useThemeColor({}, 'surface');
    const borderColor = useThemeColor({}, 'border');
    const textColor = useThemeColor({}, 'text');
    const iconColor = useThemeColor({}, 'icon');
    const secondaryTextColor = iconColor;
    const goProBgColor = useThemeColor({ light: '#fffbeb', dark: '#451a03' }, 'background');

    const handleSignOut = async () => {
        Alert.alert(
            'Sign Out',
            'Are you sure you want to sign out?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Sign Out',
                    style: 'destructive',
                    onPress: async () => {
                        setSigningOut(true);
                        try {
                            // Race between signOut and a 6-second timeout
                            const timeoutPromise = new Promise<never>((_, reject) => {
                                setTimeout(() => reject(new Error('timeout')), 6000);
                            });

                            await Promise.race([signOut(), timeoutPromise]);
                            router.replace('/(auth)/onboarding');
                        } catch (error: any) {
                            console.error('[Settings] Sign out error:', error);
                            if (error?.message === 'timeout') {
                                Alert.alert('Sign Out Failed', 'The request timed out. Please try again.');
                            } else {
                                Alert.alert('Error', 'Failed to sign out. Please try again.');
                            }
                        } finally {
                            setSigningOut(false);
                        }
                    },
                },
            ]
        );
    };

    const handleAccountInfo = () => {
        if (!isAuthenticated) {
            Alert.alert('Sign In Required', 'Please sign in to view account information.');
            return;
        }
        router.push('/settings/account-info');
    };

    const handleProManage = () => {
        router.push('/manage-subscription');
    };

    const handleGoProClick = () => {
        router.push('/subscription');
    };

    const handleCategories = () => {
        const { canChange, nextChangeDate } = checkCategories();

        if (!canChange && nextChangeDate) {
            Alert.alert(
                'Restrictions Apply',
                `You recently changed your category preferences. You can change them again on ${nextChangeDate}.`,
                [{ text: 'OK', style: 'default' }]
            );
            return;
        }

        router.push('/category-selection');
    };

    const handleStreakSaver = () => {
        router.push('/manage-subscription');
    };

    const handleOptions = () => {
        router.push('/(tabs)/options');
    };

    const handleBugReport = () => {
        router.push('/bug-report');
    };

    const handleFeedback = () => {
        router.push('/feedback');
    };

    const handleAbout = () => {
        router.push('/about');
    };

    const handlePrivacy = () => {
        router.push('/privacy');
    };

    const handleTerms = () => {
        router.push('/terms');
    };

    const handleAdmin = () => {
        router.push('/settings/admin');
    };

    return {
        // State
        user,
        isAuthenticated,
        profile,
        isAdmin,
        isPro,
        tierName,
        tierType,
        textScale,
        signingOut,

        // Actions
        handleSignOut,
        handleAccountInfo,
        handleProManage,
        handleGoProClick,
        handleCategories,
        handleStreakSaver,
        handleOptions,
        handleBugReport,
        handleFeedback,
        handleAbout,
        handlePrivacy,
        handleTerms,
        handleAdmin,
        router,

        // Styles
        colors: {
            background: backgroundColor,
            surface: surfaceColor,
            border: borderColor,
            text: textColor,
            icon: iconColor,
            secondaryText: secondaryTextColor,
            goProBg: goProBgColor
        }
    };
}
