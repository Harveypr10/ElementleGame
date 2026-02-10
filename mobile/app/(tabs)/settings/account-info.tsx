import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Switch, Modal, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { styled } from 'nativewind';
import { ChevronLeft, Key, Mail, Save, ChevronDown, Info } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PostcodeAutocomplete } from '../../../components/PostcodeAutocomplete';
import { ThemedView } from '../../../components/ThemedView';
import { ThemedText } from '../../../components/ThemedText';
import { useAccountInfoLogic } from '../../../hooks/useAccountInfoLogic';
import { DeleteAccountModal } from '../../../components/DeleteAccountModal';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTextInput = styled(TextInput);
const StyledTouchableOpacity = styled(TouchableOpacity);

export default function AccountInfoPage() {
    const {
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

        hasPassword,
        isGoogleConnected,
        isAppleConnected,
        magicLinkEnabled,
        isGoogleDisabled,
        isAppleDisabled,
        appleAvailable,

        togglingMagicLink,
        linkingGoogle,
        linkingApple,
        disablingGoogle,
        disablingApple,
        enablingGoogle,
        enablingApple,
        unlinkingGoogle,
        unlinkingApple,

        regionModalVisible, setRegionModalVisible,
        googleInfoModalVisible, setGoogleInfoModalVisible,
        appleInfoModalVisible, setAppleInfoModalVisible,
        emailConfirmModal, setEmailConfirmModal,
        regionConfirmModal, setRegionConfirmModal,
        postcodeConfirmModal, setPostcodeConfirmModal,
        restrictionModal, setRestrictionModal,
        restrictionMessage,

        router,
        getRegionName,
        checkRestriction,
        handleRegionPress,
        handlePostcodePress,
        handleSave,
        handleEmailConfirm,
        handleRegionConfirm,
        handlePostcodeConfirm,

        handleToggleMagicLink,
        handleDisableGoogle,
        handleEnableGoogle,
        handleUnlinkGoogle,
        handleLinkApple,
        handleDisableApple,
        handleEnableApple,
        handleUnlinkApple,
        handleDeleteAccount,
        deleteModalVisible, setDeleteModalVisible,
        deletingAccount,

        backgroundColor,
        surfaceColor,
        borderColor,
        textColor
    } = useAccountInfoLogic();

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
                            style={{ position: 'absolute', left: 0 }}
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
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
                    style={{ backgroundColor: surfaceColor }}
                >
                    <ScrollView
                        className="flex-1"
                        style={{ paddingHorizontal: 16, paddingVertical: 16 }}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Profile Section */}
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
                                        color: textColor,
                                        paddingLeft: 16
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
                                        color: textColor,
                                        paddingLeft: 16
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
                                        color: textColor,
                                        paddingLeft: 16
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
                                    style={{ backgroundColor: backgroundColor, borderColor: borderColor, paddingLeft: 16, paddingVertical: 12 }}
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

                        {/* Delete Account Section */}
                        <StyledView
                            className="rounded-2xl p-4 mb-4 border"
                            style={{ backgroundColor: surfaceColor, borderColor: borderColor }}
                        >
                            <StyledTouchableOpacity
                                onPress={() => setDeleteModalVisible(true)}
                                className="py-2"
                            >
                                <StyledText className="text-red-500 font-n-bold text-base">
                                    Delete Account
                                </StyledText>
                                <StyledText className="text-red-400 text-xs mt-1 font-n-medium">
                                    All game history and associated data will be lost
                                </StyledText>
                            </StyledTouchableOpacity>
                        </StyledView>
                    </ScrollView>
                </KeyboardAvoidingView>

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

                {/* Delete Account Modal */}
                <DeleteAccountModal
                    visible={deleteModalVisible}
                    onClose={() => setDeleteModalVisible(false)}
                    onDelete={handleDeleteAccount}
                    email={email}
                    firstName={firstName}
                    lastName={lastName}
                    isDeleting={deletingAccount}
                />
            </SafeAreaView>
        </ThemedView>
    );
}
