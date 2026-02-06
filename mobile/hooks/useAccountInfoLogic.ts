import { useState, useEffect } from 'react';
import { Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { useProfile } from '../hooks/useProfile';
import { useThemeColor } from '../hooks/useThemeColor';
import {
    linkAppleAccount,
    isAppleSignInAvailable,
    configureGoogleSignIn,
} from '../lib/socialAuth';
import { disableIdentity, enableIdentity, unlinkIdentity } from '../lib/supabase';

// Conditionally import native-only modules
const GoogleSignin = Platform.OS !== 'web'
    ? require('@react-native-google-signin/google-signin').GoogleSignin
    : null;
const AppleAuthentication = Platform.OS !== 'web'
    ? require('expo-apple-authentication')
    : null;

export interface Region {
    code: string;
    name: string;
}

export const useAccountInfoLogic = () => {
    const router = useRouter();
    const { user } = useAuth();
    const { profile, updateProfile } = useProfile();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [regions, setRegions] = useState<Region[]>([]);

    // Original values
    const [originalFirstName, setOriginalFirstName] = useState('');
    const [originalLastName, setOriginalLastName] = useState('');
    const [originalEmail, setOriginalEmail] = useState('');
    const [originalRegion, setOriginalRegion] = useState('');
    const [originalPostcode, setOriginalPostcode] = useState('');

    // Form state
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [region, setRegion] = useState('');
    const [postcode, setPostcode] = useState('');

    // Connected accounts state
    const [hasPassword, setHasPassword] = useState(false);
    const [isGoogleConnected, setIsGoogleConnected] = useState(false);
    const [isAppleConnected, setIsAppleConnected] = useState(false);
    const [magicLinkEnabled, setMagicLinkEnabled] = useState(true);
    const [togglingMagicLink, setTogglingMagicLink] = useState(false);
    const [linkingGoogle, setLinkingGoogle] = useState(false);
    const [linkingApple, setLinkingApple] = useState(false);
    const [disablingGoogle, setDisablingGoogle] = useState(false);
    const [enablingGoogle, setEnablingGoogle] = useState(false);
    const [unlinkingGoogle, setUnlinkingGoogle] = useState(false);
    const [disablingApple, setDisablingApple] = useState(false);
    const [enablingApple, setEnablingApple] = useState(false);
    const [unlinkingApple, setUnlinkingApple] = useState(false);
    const [appleAvailable, setAppleAvailable] = useState(false);

    // Modals
    const [regionModalVisible, setRegionModalVisible] = useState(false);
    const [googleInfoModalVisible, setGoogleInfoModalVisible] = useState(false);
    const [appleInfoModalVisible, setAppleInfoModalVisible] = useState(false);
    const [emailConfirmModal, setEmailConfirmModal] = useState(false);
    const [regionConfirmModal, setRegionConfirmModal] = useState(false);
    const [postcodeConfirmModal, setPostcodeConfirmModal] = useState(false);
    const [restrictionModal, setRestrictionModal] = useState(false);

    const [restrictionMessage, setRestrictionMessage] = useState('');
    const [restrictionDays, setRestrictionDays] = useState(14);

    const [isGoogleDisabled, setIsGoogleDisabled] = useState(false);
    const [isAppleDisabled, setIsAppleDisabled] = useState(false);

    // Theme colors
    const backgroundColor = useThemeColor({}, 'background');
    const surfaceColor = useThemeColor({}, 'surface');
    const borderColor = useThemeColor({}, 'border');
    const textColor = useThemeColor({}, 'text');

    useEffect(() => {
        fetchRegions();
        fetchRestrictionSettings();
        isAppleSignInAvailable().then(setAppleAvailable);
    }, []);

    useEffect(() => {
        if (profile) {
            const fname = profile.first_name || '';
            const lname = profile.last_name || '';
            const emailVal = user?.email || '';
            const regionVal = profile.region || '';
            const postcodeVal = profile.postcode || '';

            setFirstName(fname);
            setLastName(lname);
            setEmail(emailVal);
            setRegion(regionVal);
            setPostcode(postcodeVal);

            setOriginalFirstName(fname);
            setOriginalLastName(lname);
            setOriginalEmail(emailVal);
            setOriginalRegion(regionVal);
            setOriginalPostcode(postcodeVal);

            setHasPassword(profile.password_created ?? false);
            setIsGoogleConnected(profile.google_linked ?? false);
            setIsAppleConnected(profile.apple_linked ?? false);

            if (user) {
                (async () => {
                    try {
                        const { data: linkedIdentities } = await supabase
                            .from('linked_identities' as any)
                            .select('provider, disabled_at')
                            .eq('user_id', user.id);

                        if (linkedIdentities) {
                            const googleEntry = (linkedIdentities as any[]).find((i: any) => i.provider === 'google');
                            const appleEntry = (linkedIdentities as any[]).find((i: any) => i.provider === 'apple');
                            setIsGoogleDisabled(!!(googleEntry?.disabled_at && !profile.google_linked));
                            setIsAppleDisabled(!!(appleEntry?.disabled_at && !profile.apple_linked));
                        }
                    } catch (e) {
                        console.error('[AccountInfo] Error checking linked identities:', e);
                    }
                })();
            }
            // setMagicLinkEnabled(profile.magic_link !== false); // Future
            setLoading(false);
        }
    }, [profile, user]);

    const fetchRestrictionSettings = async () => {
        try {
            const { data } = await supabase
                .from('admin_settings')
                .select('value')
                .eq('key', 'postcode_restriction_days')
                .single();

            if (data) {
                setRestrictionDays(parseInt(data.value, 10));
            }
        } catch (e) {
            console.error('Error fetching restriction settings:', e);
        }
    };

    const fetchRegions = async () => {
        try {
            const { data: regionsData, error: regionsError } = await supabase
                .from('regions')
                .select('*')
                .order('name');

            if (regionsError) throw regionsError;
            setRegions(regionsData);
        } catch (error: any) {
            console.error('[AccountInfo] Error fetching regions:', error);
        }
    };

    const getRegionName = (code: string) => {
        const selectedRegion = regions.find(r => r.code === code);
        return selectedRegion?.name || 'Select region';
    };

    const checkRestriction = (): { restricted: boolean; nextDate?: Date } => {
        if (!profile?.postcode_last_changed_at || restrictionDays <= 0) {
            return { restricted: false };
        }
        const lastChanged = new Date(profile.postcode_last_changed_at);
        const allowedAfter = new Date(lastChanged);
        allowedAfter.setDate(allowedAfter.getDate() + restrictionDays);
        const now = new Date();
        if (now < allowedAfter) {
            return { restricted: true, nextDate: allowedAfter };
        }
        return { restricted: false };
    };

    const handleRegionPress = () => {
        const { restricted, nextDate } = checkRestriction();
        if (restricted && nextDate) {
            Alert.alert(
                "Change Restricted",
                `You generally cannot change your region yet. You will be able to change it after ${nextDate.toLocaleDateString()}.`
            );
            return;
        }
        setRegionModalVisible(true);
    };

    const handlePostcodePress = () => {
        const { restricted, nextDate } = checkRestriction();
        if (restricted && nextDate) {
            Alert.alert(
                "Change Restricted",
                `You generally cannot change your postcode yet. You will be able to change it after ${nextDate.toLocaleDateString()}.`
            );
            return;
        }
    };

    const performSave = async () => {
        setSaving(true);
        try {
            const regionChanged = region !== originalRegion;
            const postcodeChanged = postcode !== originalPostcode;

            await updateProfile({
                first_name: firstName,
                last_name: lastName,
                // email, 
                region,
                postcode: postcode || null,
            });

            setOriginalFirstName(firstName);
            setOriginalLastName(lastName);
            setOriginalEmail(email);
            setOriginalRegion(region);
            setOriginalPostcode(postcode);

            if (regionChanged || postcodeChanged) {
                Alert.alert(
                    'Success',
                    'Profile updated. Generating new questions...',
                    [
                        {
                            text: 'OK',
                            onPress: () => {
                                router.push('/(auth)/generating-questions');
                            }
                        }
                    ]
                );
            } else {
                Alert.alert('Success', 'Profile updated successfully');
            }
        } catch (error: any) {
            if (error.message && error.message.includes('once every')) {
                setRestrictionMessage(error.message);
                setRestrictionModal(true);
            } else {
                Alert.alert('Error', 'Failed to update profile: ' + error.message);
            }
        } finally {
            setSaving(false);
        }
    };

    const handleSave = async () => {
        const emailChanged = email !== originalEmail;
        const regionChanged = region !== originalRegion;
        const postcodeChanged = postcode !== originalPostcode;

        if (emailChanged) {
            setEmailConfirmModal(true);
            return;
        }
        if (regionChanged) {
            setRegionConfirmModal(true);
            return;
        }
        if (postcodeChanged) {
            setPostcodeConfirmModal(true);
            return;
        }
        await performSave();
    };

    const handleEmailConfirm = async () => {
        setEmailConfirmModal(false);
        await performSave();
    };

    const handleRegionConfirm = async () => {
        setRegionConfirmModal(false);
        await performSave();
    };

    const handlePostcodeConfirm = async () => {
        setPostcodeConfirmModal(false);
        await performSave();
    };

    const handleToggleMagicLink = async (enabled: boolean) => {
        if (togglingMagicLink) return;
        if (!enabled && !hasPassword && !isGoogleConnected && !isAppleConnected) {
            Alert.alert(
                'Cannot Disable',
                'You need at least one login method. Please set up a password or connect a social account first.'
            );
            return;
        }
        if (!user) return;
        setTogglingMagicLink(true);
        try {
            const { error } = await supabase
                .from('user_profiles')
                .update({ magic_link: enabled })
                .eq('id', user.id);
            if (error) throw error;
            setMagicLinkEnabled(enabled);
            Alert.alert('Success', enabled ? 'Magic link enabled' : 'Magic link disabled');
        } catch (error: any) {
            Alert.alert('Error', 'Failed to update magic link setting');
        } finally {
            setTogglingMagicLink(false);
        }
    };

    const handleDisableGoogle = async () => {
        if (!isGoogleConnected) return;
        Alert.alert(
            'Disable Google Sign-In?',
            'You will no longer be able to sign in with Google until you re-enable it.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Disable',
                    style: 'destructive',
                    onPress: async () => {
                        setDisablingGoogle(true);
                        try {
                            const result = await disableIdentity('google');
                            if (result.success) {
                                setIsGoogleConnected(false);
                                setIsGoogleDisabled(true);
                                Alert.alert('Success', 'Google sign-in disabled. You can re-enable it anytime.');
                            } else {
                                Alert.alert('Error', result.error || 'Failed to disable Google');
                            }
                        } catch (error: any) {
                            Alert.alert('Error', error.message);
                        } finally {
                            setDisablingGoogle(false);
                        }
                    },
                },
            ]
        );
    };

    const handleEnableGoogle = async () => {
        if (Platform.OS === 'web') {
            // Web specific handling usually not required in mobile hook but safe to guard
            return;
        }
        setEnablingGoogle(true);
        try {
            configureGoogleSignIn();
            await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
            try { await GoogleSignin.signOut(); } catch (e) { }
            const userInfo = await GoogleSignin.signIn();

            if (!userInfo.data?.idToken) {
                Alert.alert('Error', 'No identity token returned from Google');
                return;
            }
            const result = await enableIdentity('google', userInfo.data.idToken);
            if (result.success) {
                setIsGoogleConnected(true);
                setIsGoogleDisabled(false);
                Alert.alert('Success', 'Google sign-in re-enabled');
            } else {
                Alert.alert('Error', result.error || 'Failed to enable Google');
            }
        } catch (error: any) {
            if (error.code !== 'SIGN_IN_CANCELLED') {
                Alert.alert('Error', error.message || 'Failed to enable Google');
            }
        } finally {
            setEnablingGoogle(false);
        }
    };

    const handleUnlinkGoogle = async () => {
        Alert.alert(
            'Unlink Google Account',
            'This will remove the link completely. You can then link to a different account or create a new account with your Google credentials.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Unlink',
                    style: 'destructive',
                    onPress: async () => {
                        setUnlinkingGoogle(true);
                        try {
                            const result = await unlinkIdentity('google');
                            if (result.success) {
                                setIsGoogleConnected(false);
                                setIsGoogleDisabled(false);
                                Alert.alert('Success', 'Google account unlinked completely.');
                            } else {
                                Alert.alert('Error', result.error || 'Failed to unlink Google');
                            }
                        } catch (error: any) {
                            Alert.alert('Error', error.message);
                        } finally {
                            setUnlinkingGoogle(false);
                        }
                    },
                },
            ]
        );
    };

    const handleLinkApple = async () => {
        if (isAppleConnected) return;
        if (!appleAvailable) {
            Alert.alert('Not Available', 'Apple Sign-In is only available on iOS devices');
            return;
        }
        setLinkingApple(true);
        try {
            const result = await linkAppleAccount();
            if (result.success) {
                setIsAppleConnected(true);
                Alert.alert('Success', 'Apple account linked successfully');
            } else if (result.error !== 'Linking cancelled') {
                Alert.alert('Linking Failed', result.error || 'Failed to link Apple account');
            }
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to link Apple account');
        } finally {
            setLinkingApple(false);
        }
    };

    const handleDisableApple = async () => {
        if (!isAppleConnected) return;
        Alert.alert(
            'Disable Apple Sign-In?',
            'You will no longer be able to sign in with Apple until you re-enable it.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Disable',
                    style: 'destructive',
                    onPress: async () => {
                        setDisablingApple(true);
                        try {
                            const result = await disableIdentity('apple');
                            if (result.success) {
                                setIsAppleConnected(false);
                                setIsAppleDisabled(true);
                                Alert.alert('Success', 'Apple sign-in disabled. You can re-enable it anytime.');
                            } else {
                                Alert.alert('Error', result.error || 'Failed to disable Apple');
                            }
                        } catch (error: any) {
                            Alert.alert('Error', error.message);
                        } finally {
                            setDisablingApple(false);
                        }
                    },
                },
            ]
        );
    };

    const handleEnableApple = async () => {
        if (!appleAvailable) {
            Alert.alert('Not Available', 'Apple Sign-In is only available on iOS devices');
            return;
        }
        if (Platform.OS === 'web') return;

        setEnablingApple(true);
        try {
            const credential = await AppleAuthentication.signInAsync({
                requestedScopes: [
                    AppleAuthentication.AppleAuthenticationScope.EMAIL,
                    AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                ],
            });

            if (!credential.identityToken) {
                Alert.alert('Error', 'No identity token returned from Apple');
                return;
            }
            const result = await enableIdentity('apple', credential.identityToken);
            if (result.success) {
                setIsAppleConnected(true);
                setIsAppleDisabled(false);
                Alert.alert('Success', 'Apple sign-in re-enabled');
            } else {
                Alert.alert('Error', result.error || 'Failed to enable Apple');
            }
        } catch (error: any) {
            if (error.code !== 'ERR_CANCELED') {
                Alert.alert('Error', error.message || 'Failed to enable Apple');
            }
        } finally {
            setEnablingApple(false);
        }
    };

    const handleUnlinkApple = async () => {
        Alert.alert(
            'Unlink Apple Account',
            'This will remove the link completely. You can then link to a different account or create a new account with your Apple credentials.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Unlink',
                    style: 'destructive',
                    onPress: async () => {
                        setUnlinkingApple(true);
                        try {
                            const result = await unlinkIdentity('apple');
                            if (result.success) {
                                setIsAppleConnected(false);
                                setIsAppleDisabled(false);
                                Alert.alert('Success', 'Apple account unlinked completely.');
                            } else {
                                Alert.alert('Error', result.error || 'Failed to unlink Apple');
                            }
                        } catch (error: any) {
                            Alert.alert('Error', error.message);
                        } finally {
                            setUnlinkingApple(false);
                        }
                    },
                },
            ]
        );
    };

    return {
        // State
        loading,
        saving,
        regions,
        firstName, setFirstName,
        lastName, setLastName,
        email, setEmail,
        region, setRegion,
        postcode, setPostcode,
        originalEmail,
        originalRegion,
        originalPostcode,

        // Auth State
        hasPassword,
        isGoogleConnected,
        isAppleConnected,
        magicLinkEnabled,
        isGoogleDisabled,
        isAppleDisabled,
        appleAvailable,

        // Loading States
        togglingMagicLink,
        linkingGoogle,
        linkingApple,
        disablingGoogle,
        disablingApple,
        enablingGoogle,
        enablingApple,
        unlinkingGoogle,
        unlinkingApple,

        // Modal States
        regionModalVisible, setRegionModalVisible,
        googleInfoModalVisible, setGoogleInfoModalVisible,
        appleInfoModalVisible, setAppleInfoModalVisible,
        emailConfirmModal, setEmailConfirmModal,
        regionConfirmModal, setRegionConfirmModal,
        postcodeConfirmModal, setPostcodeConfirmModal,
        restrictionModal, setRestrictionModal,
        restrictionMessage,

        // Handlers
        router,
        getRegionName,
        checkRestriction,
        handleRegionPress,
        handlePostcodePress,
        handleSave,
        handleEmailConfirm,
        handleRegionConfirm,
        handlePostcodeConfirm,

        // Auth Handlers
        handleToggleMagicLink,
        handleDisableGoogle,
        handleEnableGoogle,
        handleUnlinkGoogle,
        handleLinkApple,
        handleDisableApple,
        handleEnableApple,
        handleUnlinkApple,

        // Colors
        backgroundColor,
        surfaceColor,
        borderColor,
        textColor
    };
};
