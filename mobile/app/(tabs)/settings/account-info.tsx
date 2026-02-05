import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Switch, Modal, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { styled } from 'nativewind';
import { ChevronLeft, Mail, Key, Save, ChevronDown, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/auth';
import { useProfile } from '../../../hooks/useProfile';
import { PostcodeAutocomplete } from '../../../components/PostcodeAutocomplete';
import { ThemedView } from '../../../components/ThemedView';
import { ThemedText } from '../../../components/ThemedText';
import { useThemeColor } from '../../../hooks/useThemeColor';
import {
    linkAppleAccount,
    isAppleSignInAvailable,
    configureGoogleSignIn,
} from '../../../lib/socialAuth';
import { disableIdentity, enableIdentity, unlinkIdentity } from '../../../lib/supabase';
import { Info } from 'lucide-react-native';

// Conditionally import native-only modules to prevent web build failures
const GoogleSignin = Platform.OS !== 'web'
    ? require('@react-native-google-signin/google-signin').GoogleSignin
    : null;
const AppleAuthentication = Platform.OS !== 'web'
    ? require('expo-apple-authentication')
    : null;

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTextInput = styled(TextInput);
const StyledTouchableOpacity = styled(TouchableOpacity);

interface Region {
    code: string;
    name: string;
}

export default function AccountInfoPage() {
    const router = useRouter();
    const { user } = useAuth();

    const { profile, updateProfile } = useProfile();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [regions, setRegions] = useState<Region[]>([]);
    const [regionModalVisible, setRegionModalVisible] = useState(false);

    // Original values for change detection
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
    const [googleInfoModalVisible, setGoogleInfoModalVisible] = useState(false);
    const [disablingApple, setDisablingApple] = useState(false);
    const [enablingApple, setEnablingApple] = useState(false);
    const [unlinkingApple, setUnlinkingApple] = useState(false);
    const [appleAvailable, setAppleAvailable] = useState(false);
    const [appleInfoModalVisible, setAppleInfoModalVisible] = useState(false);
    // Track if accounts were previously linked but disabled (for showing Enable vs Link)
    const [isGoogleDisabled, setIsGoogleDisabled] = useState(false);
    const [isAppleDisabled, setIsAppleDisabled] = useState(false);

    // Confirmation modals
    const [emailConfirmModal, setEmailConfirmModal] = useState(false);
    const [regionConfirmModal, setRegionConfirmModal] = useState(false);
    const [postcodeConfirmModal, setPostcodeConfirmModal] = useState(false);
    const [restrictionModal, setRestrictionModal] = useState(false);
    const [restrictionMessage, setRestrictionMessage] = useState('');

    const [restrictionDays, setRestrictionDays] = useState(14);

    useEffect(() => {
        fetchRegions();
        fetchRestrictionSettings();
        isAppleSignInAvailable().then(setAppleAvailable);
    }, []);

    useEffect(() => {
        if (profile) {
            const fname = profile.first_name || '';
            const lname = profile.last_name || '';
            const emailVal = user?.email || ''; // Profile might not have email field locally if not selected, fallback to auth user
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

            // Check for disabled linked identities (to show Enable vs Link)
            if (user) {
                // Use IIFE to handle async in useEffect
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

            // ToDo: map these fields if they exist in UserProfile interface
            // setMagicLinkEnabled(profile.magic_link !== false);

            setLoading(false);
        }
    }, [profile, user]);

    const fetchRestrictionSettings = async () => {
        try {
            const { data, error } = await supabase
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

    const handleSave = async () => {
        console.log('[AccountInfo] handleSave triggered');
        const emailChanged = email !== originalEmail;
        const regionChanged = region !== originalRegion;
        const postcodeChanged = postcode !== originalPostcode;

        console.log('[AccountInfo] Changes detected:', {
            emailChanged,
            regionChanged,
            postcodeChanged,
            currentPostcode: postcode,
            originalPostcode: originalPostcode
        });

        // Email change requires confirmation
        if (emailChanged) {
            setEmailConfirmModal(true);
            return;
        }

        // Region change requires warning
        if (regionChanged) {
            setRegionConfirmModal(true);
            return;
        }

        // Postcode change requires warning
        if (postcodeChanged) {
            setPostcodeConfirmModal(true);
            return;
        }

        // No sensitive changes, proceed with save
        await performSave();
    };

    const performSave = async () => {
        console.log('[AccountInfo] performSave starting');
        setSaving(true);
        try {
            const regionChanged = region !== originalRegion;
            const postcodeChanged = postcode !== originalPostcode;

            console.log('[AccountInfo] Performing update with:', { region, postcode });

            await updateProfile({
                first_name: firstName,
                last_name: lastName,
                // email, // Email updates often require auth.updateUser, not just profile table
                region,
                postcode: postcode || null,
            });

            console.log('[AccountInfo] updateProfile returned successfully');

            // Update original values
            setOriginalFirstName(firstName);
            setOriginalLastName(lastName);
            setOriginalEmail(email);
            setOriginalRegion(region);
            setOriginalPostcode(postcode);

            // If location changed, redirect to generation
            if (regionChanged || postcodeChanged) {
                console.log('[AccountInfo] Location changed, showing success alert and redirecting');
                Alert.alert(
                    'Success',
                    'Profile updated. Generating new questions...',
                    [
                        {
                            text: 'OK',
                            onPress: () => {
                                console.log('[AccountInfo] Redirecting to generating-questions');
                                router.push('/(auth)/generating-questions');
                            }
                        }
                    ]
                );
            } else {
                Alert.alert('Success', 'Profile updated successfully');
            }
        } catch (error: any) {
            console.error('[AccountInfo] Error saving:', error);
            // If it's a restriction error, show it nicely
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

        // Check if user has another way to log in
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
        setEnablingGoogle(true);
        try {
            // Configure Google Sign-in
            configureGoogleSignIn();
            await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

            // Sign out first to ensure fresh account selection
            try {
                await GoogleSignin.signOut();
            } catch (e) {
                // Ignore signout errors
            }

            // Re-authenticate with Google to verify ownership
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

        setEnablingApple(true);
        try {
            // Re-authenticate with Apple to verify ownership
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

    const backgroundColor = useThemeColor({}, 'background');
    const surfaceColor = useThemeColor({}, 'surface');
    const borderColor = useThemeColor({}, 'border');
    const textColor = useThemeColor({}, 'text');

    if (loading) {
        return (
            <ThemedView className="flex-1 items-center justify-center">
                <ActivityIndicator size="large" color="#7DAAE8" />
            </ThemedView>
        );
    }

    return (
        <ThemedView className="flex-1">
            <SafeAreaView edges={['top']} className="flex-1" style={{ backgroundColor: surfaceColor }}>
                {/* Header */}
                <StyledView
                    className="px-4 py-3"
                    style={{ backgroundColor: surfaceColor }}
                >
                    <StyledView className="flex-row items-center justify-center relative">
                        <StyledTouchableOpacity
                            onPress={() => router.replace('/(tabs)/settings')}
                            className="absolute left-0"
                        >
                            <ChevronLeft size={28} color={textColor} />
                        </StyledTouchableOpacity>
                        <ThemedText size="2xl" className="font-n-bold">
                            Account Info
                        </ThemedText>
                    </StyledView>
                </StyledView>

                <KeyboardAvoidingView
                    className="flex-1"
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0} // Reduced to 0 to remove gap
                    style={{ backgroundColor: surfaceColor }}
                >
                    <ScrollView
                        className="flex-1 px-4 py-4"
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Profile Section - Added zIndex for dropdown visibility */}
                        <StyledView
                            className="rounded-2xl p-4 mb-4 border relative"
                            style={{ backgroundColor: surfaceColor, borderColor: borderColor, zIndex: 10 }}
                        >
                            <ThemedText size="sm" className="font-n-bold uppercase tracking-wide mb-3 opacity-60">
                                Profile
                            </ThemedText>

                            <StyledView className="mb-4">
                                <ThemedText size="sm" className="font-n-semibold mb-2 opacity-80">
                                    First Name
                                </ThemedText>
                                <StyledTextInput
                                    value={firstName}
                                    onChangeText={setFirstName}
                                    placeholder="Enter first name"
                                    placeholderTextColor="#94a3b8"
                                    className="border rounded-lg px-4 py-3 font-n-medium"
                                    style={{
                                        backgroundColor: backgroundColor,
                                        borderColor: borderColor,
                                        color: textColor
                                    }}
                                />
                            </StyledView>

                            <StyledView className="mb-4">
                                <ThemedText size="sm" className="font-n-semibold mb-2 opacity-80">
                                    Last Name
                                </ThemedText>
                                <StyledTextInput
                                    value={lastName}
                                    onChangeText={setLastName}
                                    placeholder="Enter last name"
                                    placeholderTextColor="#94a3b8"
                                    className="border rounded-lg px-4 py-3 font-n-medium"
                                    style={{
                                        backgroundColor: backgroundColor,
                                        borderColor: borderColor,
                                        color: textColor
                                    }}
                                />
                            </StyledView>

                            <StyledView className="mb-4">
                                <ThemedText size="sm" className="font-n-semibold mb-2 opacity-80">
                                    Email
                                </ThemedText>
                                <StyledTextInput
                                    value={email}
                                    onChangeText={setEmail}
                                    placeholder="Enter email"
                                    placeholderTextColor="#94a3b8"
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    className="border rounded-lg px-4 py-3 font-n-medium"
                                    style={{
                                        backgroundColor: backgroundColor,
                                        borderColor: borderColor,
                                        color: textColor
                                    }}
                                />
                            </StyledView>

                            <StyledView className="mb-4">
                                <ThemedText size="sm" className="font-n-semibold mb-2 opacity-80">
                                    Region
                                </ThemedText>
                                <StyledTouchableOpacity
                                    onPress={handleRegionPress}
                                    className="border rounded-lg px-4 py-3 flex-row items-center justify-between"
                                    style={{ backgroundColor: backgroundColor, borderColor: borderColor }}
                                >
                                    <ThemedText className="font-n-medium">
                                        {getRegionName(region)}
                                    </ThemedText>
                                    <ChevronDown size={20} color={textColor} style={{ opacity: 0.5 }} />
                                </StyledTouchableOpacity>
                            </StyledView>

                            <StyledView className="mb-4">
                                <ThemedText size="sm" className="font-n-semibold mb-2 opacity-80">
                                    Postcode
                                </ThemedText>
                                {/* We wrap the Autocomplete in a View to intercept touches if restricted */}
                                <TouchableOpacity
                                    activeOpacity={1}
                                    onPress={() => {
                                        handlePostcodePress();
                                    }}
                                    className="relative"
                                    style={{ zIndex: 20 }}
                                >
                                    <PostcodeAutocomplete
                                        value={postcode}
                                        onChange={(value) => setPostcode(value)}
                                    />
                                    {checkRestriction().restricted && (
                                        <TouchableOpacity
                                            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                                            onPress={handlePostcodePress}
                                        />
                                    )}
                                </TouchableOpacity>
                            </StyledView>

                            {/* Save Button */}
                            <StyledTouchableOpacity
                                onPress={handleSave}
                                disabled={saving}
                                className="bg-blue-500 rounded-lg py-3 flex-row items-center justify-center mt-2"
                            >
                                {saving ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <>
                                        <Save size={18} color="#fff" />
                                        <StyledText className="text-white font-n-bold ml-2">Save Changes</StyledText>
                                    </>
                                )}
                            </StyledTouchableOpacity>
                        </StyledView>

                        {/* Account Section */}
                        <StyledView
                            className="rounded-2xl p-4 mb-4 border"
                            style={{ backgroundColor: surfaceColor, borderColor: borderColor }}
                        >
                            <ThemedText size="sm" className="font-n-bold uppercase tracking-wide mb-3 opacity-60">
                                Account
                            </ThemedText>

                            <StyledTouchableOpacity
                                onPress={() => router.push({
                                    pathname: '/(auth)/set-new-password',
                                    params: { mode: hasPassword ? 'change' : 'create' }
                                })}
                                className="flex-row items-center py-3 border-b"
                                style={{ borderColor: borderColor }}
                            >
                                <Key size={20} color={textColor} style={{ marginRight: 12 }} />
                                <StyledView className="flex-1">
                                    <ThemedText className="text-sm font-n-semibold">
                                        {hasPassword ? 'Change Password' : 'Create password for login'}
                                    </ThemedText>
                                    <ThemedText className="text-sm mt-1 opacity-60">
                                        {hasPassword ? 'Update your current password' : 'Enable email login with a password'}
                                    </ThemedText>
                                </StyledView>
                            </StyledTouchableOpacity>

                            {/* Magic Link Toggle */}
                            <StyledView className="flex-row items-center justify-between py-3">
                                <StyledView className="flex-1 pr-3">
                                    <ThemedText className="text-sm font-n-semibold">
                                        Enable Magic Link
                                    </ThemedText>
                                    <ThemedText className="text-sm mt-1 opacity-60">
                                        {hasPassword
                                            ? 'Sign in with email links'
                                            : 'Set a password to enable Magic Link'}
                                    </ThemedText>
                                </StyledView>
                                <Switch
                                    value={hasPassword ? magicLinkEnabled : false}
                                    onValueChange={handleToggleMagicLink}
                                    disabled={togglingMagicLink || !hasPassword}
                                    trackColor={{ false: borderColor, true: '#3b82f6' }}
                                    thumbColor={'#ffffff'}
                                    ios_backgroundColor={borderColor}
                                    style={{ opacity: hasPassword ? 1 : 0.5 }}
                                />
                            </StyledView>
                        </StyledView>

                        {/* Connected Accounts Section */}
                        <StyledView
                            className="rounded-2xl p-4 mb-4 border"
                            style={{ backgroundColor: surfaceColor, borderColor: borderColor }}
                        >
                            <ThemedText size="sm" className="font-n-bold uppercase tracking-wide mb-3 opacity-60">
                                Connected Accounts
                            </ThemedText>

                            {/* Google */}
                            <StyledView
                                className="flex-row items-center justify-between py-3 border-b"
                                style={{ borderColor: borderColor }}
                            >
                                <StyledView className="flex-row items-center flex-1">
                                    <StyledView className="flex-1">
                                        <ThemedText className="text-sm font-n-semibold">
                                            Google
                                        </ThemedText>
                                        <ThemedText className="text-sm mt-1 opacity-60">
                                            {isGoogleConnected ? 'Connected' : 'Not connected'}
                                        </ThemedText>
                                    </StyledView>
                                    {(isGoogleConnected || isGoogleDisabled) && (
                                        <StyledTouchableOpacity
                                            onPress={() => setGoogleInfoModalVisible(true)}
                                            className="p-2"
                                        >
                                            <Info size={18} color="#7DAAE8" />
                                        </StyledTouchableOpacity>
                                    )}
                                </StyledView>
                                {linkingGoogle || disablingGoogle || enablingGoogle || unlinkingGoogle ? (
                                    <ActivityIndicator size="small" color="#7DAAE8" />
                                ) : isGoogleConnected || isGoogleDisabled ? (
                                    <StyledView className="items-end">
                                        <StyledText className="text-green-600 text-sm font-n-medium">
                                            ✓ Linked
                                        </StyledText>
                                        <StyledView className="flex-row gap-2 mt-2">
                                            {/* Only show Unlink if user has another login method */}
                                            {(hasPassword || isAppleConnected || isAppleDisabled) && (
                                                <StyledTouchableOpacity
                                                    onPress={handleUnlinkGoogle}
                                                    className="bg-red-100 px-3 py-1.5 rounded-lg"
                                                >
                                                    <StyledText className="text-red-600 text-xs font-n-medium">
                                                        Unlink
                                                    </StyledText>
                                                </StyledTouchableOpacity>
                                            )}
                                            {isGoogleConnected ? (
                                                <StyledTouchableOpacity
                                                    onPress={handleDisableGoogle}
                                                    className="bg-orange-100 px-3 py-1.5 rounded-lg"
                                                >
                                                    <StyledText className="text-orange-600 text-xs font-n-medium">
                                                        Disable
                                                    </StyledText>
                                                </StyledTouchableOpacity>
                                            ) : (
                                                <StyledTouchableOpacity
                                                    onPress={handleEnableGoogle}
                                                    className="bg-blue-100 px-3 py-1.5 rounded-lg"
                                                >
                                                    <StyledText className="text-blue-600 text-xs font-n-medium">
                                                        Enable
                                                    </StyledText>
                                                </StyledTouchableOpacity>
                                            )}
                                        </StyledView>
                                    </StyledView>
                                ) : (
                                    <StyledTouchableOpacity
                                        onPress={handleEnableGoogle}
                                        className="bg-blue-100 px-4 py-2 rounded-lg"
                                    >
                                        <StyledText className="text-blue-600 text-sm font-n-medium">
                                            Link →
                                        </StyledText>
                                    </StyledTouchableOpacity>
                                )}
                            </StyledView>

                            {/* Apple */}
                            <StyledView
                                className="flex-row items-center justify-between py-3"
                                style={{ opacity: appleAvailable ? 1 : 0.5 }}
                            >
                                <StyledView className="flex-row items-center flex-1">
                                    <StyledView className="flex-1">
                                        <ThemedText className="text-sm font-n-semibold">
                                            Apple
                                        </ThemedText>
                                        <ThemedText className="text-sm mt-1 opacity-60">
                                            {!appleAvailable
                                                ? 'iOS only'
                                                : isAppleConnected
                                                    ? 'Connected'
                                                    : 'Not connected'}
                                        </ThemedText>
                                    </StyledView>
                                    {(isAppleConnected || isAppleDisabled) && appleAvailable && (
                                        <StyledTouchableOpacity
                                            onPress={() => setAppleInfoModalVisible(true)}
                                            className="p-2"
                                        >
                                            <Info size={18} color="#7DAAE8" />
                                        </StyledTouchableOpacity>
                                    )}
                                </StyledView>
                                {linkingApple || disablingApple || enablingApple || unlinkingApple ? (
                                    <ActivityIndicator size="small" color="#7DAAE8" />
                                ) : isAppleConnected || isAppleDisabled ? (
                                    <StyledView className="items-end">
                                        <StyledText className="text-green-600 text-sm font-n-medium">
                                            ✓ Linked
                                        </StyledText>
                                        <StyledView className="flex-row gap-2 mt-2">
                                            {/* Only show Unlink if user has another login method */}
                                            {(hasPassword || isGoogleConnected || isGoogleDisabled) && (
                                                <StyledTouchableOpacity
                                                    onPress={handleUnlinkApple}
                                                    className="bg-red-100 px-3 py-1.5 rounded-lg"
                                                >
                                                    <StyledText className="text-red-600 text-xs font-n-medium">
                                                        Unlink
                                                    </StyledText>
                                                </StyledTouchableOpacity>
                                            )}
                                            {isAppleConnected ? (
                                                <StyledTouchableOpacity
                                                    onPress={handleDisableApple}
                                                    className="bg-orange-100 px-3 py-1.5 rounded-lg"
                                                >
                                                    <StyledText className="text-orange-600 text-xs font-n-medium">
                                                        Disable
                                                    </StyledText>
                                                </StyledTouchableOpacity>
                                            ) : (
                                                <StyledTouchableOpacity
                                                    onPress={handleEnableApple}
                                                    className="bg-blue-100 px-3 py-1.5 rounded-lg"
                                                    disabled={!appleAvailable}
                                                >
                                                    <StyledText className="text-blue-600 text-xs font-n-medium">
                                                        Enable
                                                    </StyledText>
                                                </StyledTouchableOpacity>
                                            )}
                                        </StyledView>
                                    </StyledView>
                                ) : (
                                    <StyledTouchableOpacity
                                        onPress={handleLinkApple}
                                        disabled={!appleAvailable}
                                        className="bg-blue-100 px-4 py-2 rounded-lg"
                                        style={{ opacity: appleAvailable ? 1 : 0.5 }}
                                    >
                                        <StyledText
                                            className="text-sm font-n-medium"
                                            style={{ color: appleAvailable ? '#2563eb' : '#999' }}
                                        >
                                            {appleAvailable ? 'Link →' : 'iOS Only'}
                                        </StyledText>
                                    </StyledTouchableOpacity>
                                )}
                            </StyledView>
                        </StyledView>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>

            {/* Email Change Confirmation Modal */}
            <Modal
                visible={emailConfirmModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setEmailConfirmModal(false)}
            >
                <StyledView className="flex-1 bg-black/50 justify-center items-center px-6">
                    <StyledView
                        className="rounded-2xl p-6 w-full max-w-sm"
                        style={{ backgroundColor: surfaceColor }}
                    >
                        <ThemedText size="xl" className="font-n-bold mb-4">
                            Confirm Email Change
                        </ThemedText>
                        <ThemedText className="mb-2 opacity-80">
                            You are changing your email from:
                        </ThemedText>
                        <ThemedText className="font-n-bold mb-2">
                            {originalEmail}
                        </ThemedText>
                        <ThemedText className="mb-2 opacity-80">
                            to:
                        </ThemedText>
                        <ThemedText className="font-n-bold mb-6">
                            {email}
                        </ThemedText>
                        <StyledView className="flex-row gap-3">
                            <StyledTouchableOpacity
                                onPress={() => {
                                    setEmail(originalEmail);
                                    setEmailConfirmModal(false);
                                }}
                                className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-lg py-3"
                            >
                                <ThemedText className="text-slate-900 dark:text-white font-n-bold text-center">
                                    Cancel
                                </ThemedText>
                            </StyledTouchableOpacity>
                            <StyledTouchableOpacity
                                onPress={handleEmailConfirm}
                                className="flex-1 bg-blue-500 rounded-lg py-3"
                            >
                                <StyledText className="text-white font-n-bold text-center">
                                    Confirm
                                </StyledText>
                            </StyledTouchableOpacity>
                        </StyledView>
                    </StyledView>
                </StyledView>
            </Modal>

            {/* Region Change Warning Modal */}
            <Modal
                visible={regionConfirmModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setRegionConfirmModal(false)}
            >
                <StyledView className="flex-1 bg-black/50 justify-center items-center px-6">
                    <StyledView
                        className="rounded-2xl p-6 w-full max-w-sm"
                        style={{ backgroundColor: surfaceColor }}
                    >
                        <ThemedText size="xl" className="font-n-bold mb-4">
                            Change Region?
                        </ThemedText>
                        <ThemedText className="mb-4 opacity-80">
                            Changing from <ThemedText className="font-n-bold">{getRegionName(originalRegion)}</ThemedText> to <ThemedText className="font-n-bold">{getRegionName(region)}</ThemedText> will change the questions you receive.
                        </ThemedText>
                        <ThemedText className="text-sm mb-6 opacity-60">
                            Note: You can only change your region once every few days.
                        </ThemedText>
                        <StyledView className="flex-row gap-3">
                            <StyledTouchableOpacity
                                onPress={() => {
                                    setRegion(originalRegion);
                                    setRegionConfirmModal(false);
                                }}
                                className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-lg py-3"
                            >
                                <ThemedText className="text-slate-900 dark:text-white font-n-bold text-center">
                                    Cancel
                                </ThemedText>
                            </StyledTouchableOpacity>
                            <StyledTouchableOpacity
                                onPress={handleRegionConfirm}
                                className="flex-1 bg-blue-500 rounded-lg py-3"
                            >
                                <StyledText className="text-white font-n-bold text-center">
                                    Confirm
                                </StyledText>
                            </StyledTouchableOpacity>
                        </StyledView>
                    </StyledView>
                </StyledView>
            </Modal>

            {/* Postcode Change Warning Modal */}
            <Modal
                visible={postcodeConfirmModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setPostcodeConfirmModal(false)}
            >
                <StyledView className="flex-1 bg-black/50 justify-center items-center px-6">
                    <StyledView
                        className="rounded-2xl p-6 w-full max-w-sm"
                        style={{ backgroundColor: surfaceColor }}
                    >
                        <ThemedText size="xl" className="font-n-bold mb-4">
                            Change Postcode?
                        </ThemedText>
                        <ThemedText className="mb-4 opacity-80">
                            Changing your postcode will update the location-based questions you receive in the personal edition of the game.
                        </ThemedText>
                        <ThemedText className="text-sm mb-6 opacity-60">
                            Note: You can only change your postcode once every few days.
                        </ThemedText>
                        <StyledView className="flex-row gap-3">
                            <StyledTouchableOpacity
                                onPress={() => {
                                    setPostcode(originalPostcode);
                                    setPostcodeConfirmModal(false);
                                }}
                                className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-lg py-3"
                            >
                                <ThemedText className="text-slate-900 dark:text-white font-n-bold text-center">
                                    Cancel
                                </ThemedText>
                            </StyledTouchableOpacity>
                            <StyledTouchableOpacity
                                onPress={handlePostcodeConfirm}
                                className="flex-1 bg-blue-500 rounded-lg py-3"
                            >
                                <StyledText className="text-white font-n-bold text-center">
                                    Confirm
                                </StyledText>
                            </StyledTouchableOpacity>
                        </StyledView>
                    </StyledView>
                </StyledView>
            </Modal>

            {/* Restriction/Cooldown Error Modal */}
            <Modal
                visible={restrictionModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setRestrictionModal(false)}
            >
                <StyledView className="flex-1 bg-black/50 justify-center items-center px-6">
                    <StyledView
                        className="rounded-2xl p-6 w-full max-w-sm"
                        style={{ backgroundColor: surfaceColor }}
                    >
                        <StyledText className="text-xl font-n-bold text-red-600 dark:text-red-400 mb-4">
                            Change Restricted
                        </StyledText>
                        <ThemedText className="mb-6 opacity-80">
                            {restrictionMessage}
                        </ThemedText>
                        <StyledTouchableOpacity
                            onPress={() => setRestrictionModal(false)}
                            className="bg-blue-500 rounded-lg py-3"
                        >
                            <StyledText className="text-white font-n-bold text-center">
                                OK
                            </StyledText>
                        </StyledTouchableOpacity>
                    </StyledView>
                </StyledView>
            </Modal>

            {/* Region Selection Modal */}
            <Modal
                visible={regionModalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setRegionModalVisible(false)}
            >
                <StyledView className="flex-1 bg-black/50" onTouchEnd={() => setRegionModalVisible(false)}>
                    <StyledView className="flex-1 justify-end">
                        <StyledView
                            className="rounded-t-3xl max-h-[70%]"
                            style={{ backgroundColor: surfaceColor }}
                        >
                            <StyledView
                                className="p-4 border-b"
                                style={{ borderColor: borderColor }}
                            >
                                <ThemedText size="xl" className="font-n-bold text-center">
                                    Select Region
                                </ThemedText>
                            </StyledView>
                            <FlatList
                                data={regions}
                                keyExtractor={(item) => item.code}
                                renderItem={({ item }) => (
                                    <StyledTouchableOpacity
                                        onPress={() => {
                                            setRegion(item.code);
                                            setRegionModalVisible(false);
                                        }}
                                        className="px-4 py-4 border-b"
                                        style={{ borderColor: borderColor }}
                                    >
                                        <ThemedText className={`font-n-medium ${region === item.code ? 'text-blue-600' : ''}`}>
                                            {item.name}
                                        </ThemedText>
                                    </StyledTouchableOpacity>
                                )}
                            />
                        </StyledView>
                    </StyledView>
                </StyledView>
            </Modal>

            {/* Google Unlink Info Modal */}
            <Modal
                visible={googleInfoModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setGoogleInfoModalVisible(false)}
            >
                <StyledView className="flex-1 bg-black/50 justify-center items-center px-6">
                    <StyledView
                        className="rounded-2xl p-6 w-full max-w-sm"
                        style={{ backgroundColor: surfaceColor }}
                    >
                        <ThemedText size="xl" className="font-n-bold mb-4">
                            About Google Sign-In
                        </ThemedText>
                        <ThemedText className="mb-4 opacity-80 leading-5">
                            Google Sign-In can be <ThemedText className="font-n-bold">disabled</ThemedText> in Elementle, but to fully unlink it from your account you need to revoke access from your Google Account.
                        </ThemedText>
                        <ThemedText className="mb-4 opacity-80 leading-5">
                            To fully unlink:
                        </ThemedText>
                        <ThemedText className="mb-2 opacity-80 leading-5">
                            1. Go to <ThemedText className="font-n-bold">myaccount.google.com</ThemedText>
                        </ThemedText>
                        <ThemedText className="mb-2 opacity-80 leading-5">
                            2. Tap <ThemedText className="font-n-bold">Security</ThemedText>
                        </ThemedText>
                        <ThemedText className="mb-2 opacity-80 leading-5">
                            3. Under "Your connections to third-party apps & services", tap <ThemedText className="font-n-bold">See all connections</ThemedText>
                        </ThemedText>
                        <ThemedText className="mb-2 opacity-80 leading-5">
                            4. Select <ThemedText className="font-n-bold">Elementle</ThemedText>
                        </ThemedText>
                        <ThemedText className="mb-4 opacity-80 leading-5">
                            5. Tap <ThemedText className="font-n-bold text-red-500">Delete all connections</ThemedText>
                        </ThemedText>
                        <ThemedText className="mb-4 opacity-60 text-sm leading-5">
                            After doing this, return here and disable Google Sign-In to complete the unlinking process.
                        </ThemedText>
                        <StyledTouchableOpacity
                            className="bg-blue-600 py-3 rounded-xl"
                            onPress={() => setGoogleInfoModalVisible(false)}
                        >
                            <StyledText className="text-white text-center font-n-bold">
                                Got it
                            </StyledText>
                        </StyledTouchableOpacity>
                    </StyledView>
                </StyledView>
            </Modal>

            {/* Apple Unlink Info Modal */}
            <Modal
                visible={appleInfoModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setAppleInfoModalVisible(false)}
            >
                <StyledView className="flex-1 bg-black/50 justify-center items-center px-6">
                    <StyledView
                        className="rounded-2xl p-6 w-full max-w-sm"
                        style={{ backgroundColor: surfaceColor }}
                    >
                        <ThemedText size="xl" className="font-n-bold mb-4">
                            About Apple Sign-In
                        </ThemedText>
                        <ThemedText className="mb-4 opacity-80 leading-5">
                            Apple Sign-In can be <ThemedText className="font-n-bold">disabled</ThemedText> in Elementle, but to fully unlink it from your account you need to revoke access from your iPhone.
                        </ThemedText>
                        <ThemedText className="mb-4 opacity-80 leading-5">
                            To fully unlink:
                        </ThemedText>
                        <ThemedText className="mb-2 opacity-80 leading-5">
                            1. Open <ThemedText className="font-n-bold">Settings</ThemedText> on your iPhone
                        </ThemedText>
                        <ThemedText className="mb-2 opacity-80 leading-5">
                            2. Tap your name at the top
                        </ThemedText>
                        <ThemedText className="mb-2 opacity-80 leading-5">
                            3. Tap <ThemedText className="font-n-bold">Sign-In & Security</ThemedText>
                        </ThemedText>
                        <ThemedText className="mb-2 opacity-80 leading-5">
                            4. Tap <ThemedText className="font-n-bold">Sign in with Apple</ThemedText>
                        </ThemedText>
                        <ThemedText className="mb-2 opacity-80 leading-5">
                            5. Select <ThemedText className="font-n-bold">Elementle</ThemedText>
                        </ThemedText>
                        <ThemedText className="mb-4 opacity-80 leading-5">
                            6. Tap <ThemedText className="font-n-bold text-red-500">Stop Using Apple ID</ThemedText>
                        </ThemedText>
                        <ThemedText className="mb-4 opacity-60 text-sm leading-5">
                            After doing this, return here and disable Apple Sign-In to complete the unlinking process.
                        </ThemedText>
                        <StyledTouchableOpacity
                            className="bg-blue-600 py-3 rounded-xl"
                            onPress={() => setAppleInfoModalVisible(false)}
                        >
                            <StyledText className="text-white text-center font-n-bold">
                                Got it
                            </StyledText>
                        </StyledTouchableOpacity>
                    </StyledView>
                </StyledView>
            </Modal>
        </ThemedView>
    );
}
