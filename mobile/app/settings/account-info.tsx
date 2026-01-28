import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Switch, Modal, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { styled } from 'nativewind';
import { ChevronLeft, Mail, Key, Save, ChevronDown, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { PostcodeAutocomplete } from '../../components/PostcodeAutocomplete';
import { ThemedView } from '../../components/ThemedView';
import { ThemedText } from '../../components/ThemedText';
import { useThemeColor } from '../../hooks/useThemeColor';

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

    // Confirmation modals
    const [emailConfirmModal, setEmailConfirmModal] = useState(false);
    const [regionConfirmModal, setRegionConfirmModal] = useState(false);
    const [postcodeConfirmModal, setPostcodeConfirmModal] = useState(false);
    const [restrictionModal, setRestrictionModal] = useState(false);
    const [restrictionMessage, setRestrictionMessage] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch profile
            const { data: profileData, error: profileError } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('id', user?.id)
                .single();

            if (profileError) throw profileError;

            const fname = profileData.first_name || '';
            const lname = profileData.last_name || '';
            const emailVal = profileData.email || user?.email || '';
            const regionVal = profileData.region || '';
            const postcodeVal = profileData.postcode || '';

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

            setHasPassword(profileData.password_created || false);
            setIsGoogleConnected(profileData.google_linked || false);
            setIsAppleConnected(profileData.apple_linked || false);
            setMagicLinkEnabled(profileData.magic_link !== false);

            // Fetch regions
            const { data: regionsData, error: regionsError } = await supabase
                .from('regions')
                .select('*')
                .order('name');

            if (regionsError) throw regionsError;
            setRegions(regionsData);
        } catch (error: any) {
            console.error('[AccountInfo] Error:', error);
            Alert.alert('Error', 'Failed to load account information');
        } finally {
            setLoading(false);
        }
    };

    const getRegionName = (code: string) => {
        const selectedRegion = regions.find(r => r.code === code);
        return selectedRegion?.name || 'Select region';
    };

    const handleSave = async () => {
        const emailChanged = email !== originalEmail;
        const regionChanged = region !== originalRegion;
        const postcodeChanged = postcode !== originalPostcode;

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
        setSaving(true);
        try {
            const { data, error } = await supabase
                .from('user_profiles')
                .update({
                    first_name: firstName,
                    last_name: lastName,
                    email,
                    region,
                    postcode: postcode || null,
                })
                .eq('id', user?.id)
                .select()
                .single();

            if (error) {
                // Check for cooldown error
                if (error.message?.includes('cooldown') || error.message?.includes('LOCATION_COOLDOWN')) {
                    setRestrictionMessage('You can only update your location once every few days. Please try again later.');
                    setRestrictionModal(true);
                    return;
                }
                throw error;
            }

            // Check for restriction in response
            if (data && (data as any)._restrictionBlocked) {
                setRestrictionMessage((data as any)._restrictionMessage || 'Location change restricted');
                setRestrictionModal(true);
                return;
            }

            // Update original values
            setOriginalFirstName(firstName);
            setOriginalLastName(lastName);
            setOriginalEmail(email);
            setOriginalRegion(region);
            setOriginalPostcode(postcode);

            Alert.alert('Success', 'Profile updated successfully');
        } catch (error: any) {
            console.error('[AccountInfo] Error saving:', error);
            Alert.alert('Error', 'Failed to update profile');
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

        setTogglingMagicLink(true);
        try {
            const { error } = await supabase
                .from('user_profiles')
                .update({ magic_link: enabled })
                .eq('id', user?.id);

            if (error) throw error;
            setMagicLinkEnabled(enabled);
            Alert.alert('Success', enabled ? 'Magic link enabled' : 'Magic link disabled');
        } catch (error: any) {
            Alert.alert('Error', 'Failed to update magic link setting');
        } finally {
            setTogglingMagicLink(false);
        }
    };

    const handleLinkGoogle = async () => {
        if (isGoogleConnected) return;

        try {
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/settings/account-info`,
                },
            });

            if (error) throw error;
        } catch (error: any) {
            Alert.alert('Error', 'Failed to link Google account');
        }
    };

    const handleLinkApple = async () => {
        if (isAppleConnected) return;

        try {
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'apple',
                options: {
                    redirectTo: `${window.location.origin}/settings/account-info`,
                },
            });

            if (error) throw error;
        } catch (error: any) {
            Alert.alert('Error', 'Failed to link Apple account');
        }
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
                            onPress={() => router.back()}
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
                    keyboardVerticalOffset={100}
                >
                    <ScrollView
                        className="flex-1 px-4 py-4"
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Profile Section */}
                        <StyledView
                            className="rounded-2xl p-4 mb-4 border"
                            style={{ backgroundColor: surfaceColor, borderColor: borderColor }}
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
                                    onPress={() => setRegionModalVisible(true)}
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
                                <PostcodeAutocomplete
                                    value={postcode}
                                    onChange={(value) => setPostcode(value)}
                                />
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
                                onPress={() => Alert.alert('Password', hasPassword ? 'Change password feature coming soon' : 'Create password feature coming soon')}
                                className="flex-row items-center py-3 border-b"
                                style={{ borderColor: borderColor }}
                            >
                                <Key size={20} color={textColor} style={{ marginRight: 12 }} />
                                <StyledView className="flex-1">
                                    <ThemedText className="text-sm font-n-semibold">
                                        Password
                                    </ThemedText>
                                    <ThemedText className="text-sm mt-1 opacity-60">
                                        {hasPassword ? 'Change password' : 'Create password'}
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
                                        Sign in with email links
                                    </ThemedText>
                                </StyledView>
                                <Switch
                                    value={magicLinkEnabled}
                                    onValueChange={handleToggleMagicLink}
                                    disabled={togglingMagicLink}
                                    trackColor={{ false: borderColor, true: '#3b82f6' }}
                                    thumbColor={'#ffffff'}
                                    ios_backgroundColor={borderColor}
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
                            <StyledTouchableOpacity
                                onPress={handleLinkGoogle}
                                disabled={isGoogleConnected}
                                className="flex-row items-center justify-between py-3 border-b"
                                style={{ borderColor: borderColor }}
                            >
                                <StyledView className="flex-1">
                                    <ThemedText className="text-sm font-n-semibold">
                                        Google
                                    </ThemedText>
                                    <ThemedText className="text-sm mt-1 opacity-60">
                                        {isGoogleConnected ? 'Connected' : 'Tap to connect'}
                                    </ThemedText>
                                </StyledView>
                                {isGoogleConnected ? (
                                    <StyledText className="text-green-600 text-sm font-n-medium">
                                        ✓ Linked
                                    </StyledText>
                                ) : (
                                    <StyledText className="text-blue-600 text-sm font-n-medium">
                                        Link →
                                    </StyledText>
                                )}
                            </StyledTouchableOpacity>

                            {/* Apple */}
                            <StyledTouchableOpacity
                                onPress={handleLinkApple}
                                disabled={isAppleConnected}
                                className="flex-row items-center justify-between py-3"
                            >
                                <StyledView className="flex-1">
                                    <ThemedText className="text-sm font-n-semibold">
                                        Apple
                                    </ThemedText>
                                    <ThemedText className="text-sm mt-1 opacity-60">
                                        {isAppleConnected ? 'Connected' : 'Tap to connect'}
                                    </ThemedText>
                                </StyledView>
                                {isAppleConnected ? (
                                    <StyledText className="text-green-600 text-sm font-n-medium">
                                        ✓ Linked
                                    </StyledText>
                                ) : (
                                    <StyledText className="text-blue-600 text-sm font-n-medium">
                                        Link →
                                    </StyledText>
                                )}
                            </StyledTouchableOpacity>
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
        </ThemedView>
    );
}
