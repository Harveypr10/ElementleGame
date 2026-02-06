import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Modal, FlatList, Switch } from 'react-native';
import { ChevronLeft, Key, Save, Check, X, ChevronDown, Info } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAccountInfoLogic } from '../../../hooks/useAccountInfoLogic';
import { PostcodeAutocomplete } from '../../../components/PostcodeAutocomplete';

// Web implementation using standard React Native web-compatible primitives
export default function AccountInfoWeb() {
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

        togglingMagicLink,
        linkingGoogle,
        disablingGoogle,
        enablingGoogle,
        unlinkingGoogle,
        // Apple logic omitted/disabled for web usually, or handled if 'Sign in with Apple JS' is used
        // But for now we just show status

        regionModalVisible, setRegionModalVisible,
        googleInfoModalVisible, setGoogleInfoModalVisible,
        emailConfirmModal, setEmailConfirmModal,
        regionConfirmModal, setRegionConfirmModal,
        postcodeConfirmModal, setPostcodeConfirmModal,
        restrictionModal, setRestrictionModal,
        restrictionMessage,

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

        backgroundColor,
        surfaceColor,
        borderColor,
        textColor
    } = useAccountInfoLogic();

    const router = useRouter();

    // Hover states
    const [backHover, setBackHover] = useState(false);
    const [saveHover, setSaveHover] = useState(false);
    const [regionHover, setRegionHover] = useState(false);

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3b82f6" />
            </View>
        );
    }

    // Helper to render Sections
    const renderSectionHeader = (title: string) => (
        <Text style={styles.sectionHeader}>{title}</Text>
    );

    return (
        <View style={styles.container}>
            <View style={styles.contentWrapper}>

                {/* Header */}
                <View style={styles.header}>
                    <Pressable
                        onPress={() => router.replace('/(tabs)/settings')}
                        onHoverIn={() => setBackHover(true)}
                        onHoverOut={() => setBackHover(false)}
                        style={[styles.backButton, backHover && styles.backButtonHover]}
                    >
                        <ChevronLeft size={24} color="#334155" />
                        <Text style={styles.backButtonText}>Settings</Text>
                    </Pressable>
                    <Text style={styles.title}>Account Info</Text>
                    <View style={{ width: 80 }} />
                </View>

                {/* Main Card */}
                <View style={styles.card}>

                    {/* Profile Section */}
                    <View style={styles.section}>
                        {renderSectionHeader('Profile')}

                        <View style={styles.row}>
                            <View style={styles.col}>
                                <Text style={styles.label}>First Name</Text>
                                <TextInput
                                    value={firstName}
                                    onChangeText={setFirstName}
                                    style={styles.input}
                                    placeholder="First Name"
                                    placeholderTextColor="#94a3b8"
                                />
                            </View>
                            <View style={styles.col}>
                                <Text style={styles.label}>Last Name</Text>
                                <TextInput
                                    value={lastName}
                                    onChangeText={setLastName}
                                    style={styles.input}
                                    placeholder="Last Name"
                                    placeholderTextColor="#94a3b8"
                                />
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Email</Text>
                            <TextInput
                                value={email}
                                onChangeText={setEmail}
                                style={styles.input}
                                placeholder="Email Address"
                                placeholderTextColor="#94a3b8"
                                keyboardType="email-address"
                            />
                        </View>

                        <View style={styles.row}>
                            <View style={styles.col}>
                                <Text style={styles.label}>Region</Text>
                                <Pressable
                                    onPress={handleRegionPress}
                                    onHoverIn={() => setRegionHover(true)}
                                    onHoverOut={() => setRegionHover(false)}
                                    style={[styles.selectButton, regionHover && styles.selectButtonHover]}
                                >
                                    <Text style={styles.selectButtonText}>{getRegionName(region)}</Text>
                                    <ChevronDown size={20} color="#64748b" />
                                </Pressable>
                            </View>
                            <View style={styles.col}>
                                <Text style={styles.label}>Postcode</Text>
                                <View style={{ position: 'relative', zIndex: 10 }}>
                                    <PostcodeAutocomplete
                                        value={postcode}
                                        onChange={setPostcode}
                                        style={styles.input} // Pass style to inner input if supported, strictly speaking PostcodeAutocomplete might need tweaking or accepts style
                                    />
                                    {checkRestriction().restricted && (
                                        <Pressable
                                            style={StyleSheet.absoluteFill}
                                            onPress={handlePostcodePress}
                                        />
                                    )}
                                </View>
                            </View>
                        </View>

                        <Pressable
                            onPress={handleSave}
                            disabled={saving}
                            onHoverIn={() => setSaveHover(true)}
                            onHoverOut={() => setSaveHover(false)}
                            style={[
                                styles.saveButton,
                                saveHover && styles.saveButtonHover,
                                saving && styles.saveButtonDisabled
                            ]}
                        >
                            {saving ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <>
                                    <Save size={18} color="#fff" style={{ marginRight: 8 }} />
                                    <Text style={styles.saveButtonText}>Save Changes</Text>
                                </>
                            )}
                        </Pressable>
                    </View>

                    <View style={styles.divider} />

                    {/* Account Security Section */}
                    <View style={styles.section}>
                        {renderSectionHeader('Account Security')}

                        <Pressable
                            style={styles.menuItem}
                            onPress={() => router.push({
                                pathname: '/(auth)/set-new-password',
                                params: { mode: hasPassword ? 'change' : 'create' }
                            })}
                        >
                            <View style={styles.menuIconContainer}>
                                <Key size={20} color="#334155" />
                            </View>
                            <View style={styles.menuTextContainer}>
                                <Text style={styles.menuTitle}>
                                    {hasPassword ? 'Change Password' : 'Create Password'}
                                </Text>
                                <Text style={styles.menuSubtitle}>
                                    {hasPassword ? 'Update your current password' : 'Enable email login with a password'}
                                </Text>
                            </View>
                            <ChevronLeft size={20} color="#94a3b8" style={{ transform: [{ rotate: '180deg' }] }} />
                        </Pressable>

                        <View style={styles.menuItem}>
                            <View style={styles.menuIconContainer}>
                                <Mail size={20} color="#334155" />
                            </View>
                            <View style={styles.menuTextContainer}>
                                <Text style={styles.menuTitle}>Magic Link</Text>
                                <Text style={styles.menuSubtitle}>
                                    Sign in with email links
                                </Text>
                            </View>
                            <Switch
                                value={hasPassword ? magicLinkEnabled : false}
                                onValueChange={handleToggleMagicLink}
                                disabled={togglingMagicLink || !hasPassword}
                                trackColor={{ false: '#e2e8f0', true: '#3b82f6' }}
                                thumbColor={'#ffffff'}
                                activeThumbColor={'#ffffff'}
                            />
                        </View>
                    </View>

                    <View style={styles.divider} />

                    {/* Connected Accounts Section */}
                    <View style={styles.section}>
                        {renderSectionHeader('Connected Accounts')}

                        {/* Google */}
                        <View style={styles.accountRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.accountName}>Google</Text>
                                <Text style={styles.accountStatus}>
                                    {isGoogleConnected ? 'Connected' : 'Not connected'}
                                </Text>
                            </View>

                            {linkingGoogle || disablingGoogle || enablingGoogle || unlinkingGoogle ? (
                                <ActivityIndicator size="small" color="#3b82f6" />
                            ) : isGoogleConnected || isGoogleDisabled ? (
                                <View style={{ alignItems: 'flex-end' }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                        <Check size={14} color="#16a34a" />
                                        <Text style={styles.linkedText}>Linked</Text>
                                        <Pressable
                                            onPress={() => setGoogleInfoModalVisible(true)}
                                            style={{ marginLeft: 6 }}
                                        >
                                            <Info size={14} color="#94a3b8" />
                                        </Pressable>
                                    </View>
                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                        <Pressable
                                            onPress={handleUnlinkGoogle}
                                            style={styles.actionButtonDanger}
                                        >
                                            <Text style={styles.actionButtonDangerText}>Unlink</Text>
                                        </Pressable>
                                        {isGoogleConnected ? (
                                            <Pressable
                                                onPress={handleDisableGoogle}
                                                style={styles.actionButtonWarning}
                                            >
                                                <Text style={styles.actionButtonWarningText}>Disable</Text>
                                            </Pressable>
                                        ) : (
                                            <Pressable
                                                onPress={handleEnableGoogle}
                                                style={styles.actionButton}
                                            >
                                                <Text style={styles.actionButtonText}>Enable</Text>
                                            </Pressable>
                                        )}
                                    </View>
                                </View>
                            ) : (
                                <Pressable
                                    onPress={handleEnableGoogle} // Note: Google Sign In on Web is tricky with RN modules, usually needs distinct web implementation.
                                    // For now we assume handleEnableGoogle has a web guard or we should disable it for web if not implemented.
                                    // The hook has a web guard.
                                    style={styles.linkButton}
                                >
                                    <Text style={styles.linkButtonText}>Link</Text>
                                </Pressable>
                            )}
                        </View>

                        {/* Apple - Mostly read-only on web unless configured for JS Sign in with Apple */}
                        <View style={[styles.accountRow, { borderBottomWidth: 0 }]}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.accountName}>Apple</Text>
                                <Text style={styles.accountStatus}>
                                    {isAppleConnected ? 'Connected' : 'iOS Only (Web view)'}
                                </Text>
                            </View>
                            {isAppleConnected && (
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Check size={14} color="#16a34a" />
                                    <Text style={styles.linkedText}>Linked</Text>
                                </View>
                            )}
                        </View>
                    </View>

                </View>
            </View>

            {/* Modals - Using simple Web-compatible Overlay */}
            <WebModal
                visible={regionModalVisible}
                onClose={() => setRegionModalVisible(false)}
                title="Select Region"
            >
                <FlatList
                    data={regions}
                    keyExtractor={(item) => item.code}
                    style={{ maxHeight: 300 }}
                    renderItem={({ item }) => (
                        <Pressable
                            onPress={() => {
                                setRegion(item.code);
                                setRegionModalVisible(false);
                            }}
                            style={styles.modalItem}
                        >
                            <Text style={[styles.modalItemText, region === item.code && styles.modalItemTextSelected]}>
                                {item.name}
                            </Text>
                            {region === item.code && <Check size={16} color="#3b82f6" />}
                        </Pressable>
                    )}
                />
            </WebModal>

            <WebMessageModal
                visible={emailConfirmModal}
                title="Confirm Email Change"
                message={`Change email from ${originalEmail} to ${email}?`}
                onCancel={() => {
                    setEmail(originalEmail);
                    setEmailConfirmModal(false);
                }}
                onConfirm={handleEmailConfirm}
            />

            <WebMessageModal
                visible={regionConfirmModal}
                title="Change Region?"
                message={`Changing region will update your questions. You can only do this once every few days.`}
                onCancel={() => {
                    setRegion(originalRegion);
                    setRegionConfirmModal(false);
                }}
                onConfirm={handleRegionConfirm}
            />

            <WebMessageModal
                visible={postcodeConfirmModal}
                title="Change Postcode?"
                message={`Changing postcode will update your location-based questions. You can only do this once every few days.`}
                onCancel={() => {
                    setPostcode(originalPostcode);
                    setPostcodeConfirmModal(false);
                }}
                onConfirm={handlePostcodeConfirm}
            />

            <WebMessageModal
                visible={restrictionModal}
                title="Change Restricted"
                message={restrictionMessage}
                onConfirm={() => setRestrictionModal(false)}
                singleButton
            />

            <WebMessageModal
                visible={googleInfoModalVisible}
                title="About Google Sign-In"
                message="To fully unlink, revoke access in your Google Account settings."
                onConfirm={() => setGoogleInfoModalVisible(false)}
                singleButton
            />

        </View>
    );
}

// Simple Web Modal Component
const WebModal = ({ visible, onClose, title, children }: any) => {
    if (!visible) return null;
    return (
        <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>{title}</Text>
                    <Pressable onPress={onClose}>
                        <X size={24} color="#64748b" />
                    </Pressable>
                </View>
                {children}
            </View>
        </View>
    );
};

const WebMessageModal = ({ visible, title, message, onCancel, onConfirm, singleButton }: any) => {
    if (!visible) return null;
    return (
        <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxWidth: 400 }]}>
                <Text style={styles.modalTitle}>{title}</Text>
                <Text style={styles.modalMessage}>{message}</Text>
                <View style={styles.modalActions}>
                    {!singleButton && (
                        <Pressable onPress={onCancel} style={styles.modalCancelButton}>
                            <Text style={styles.modalCancelText}>Cancel</Text>
                        </Pressable>
                    )}
                    <Pressable onPress={onConfirm} style={styles.modalConfirmButton}>
                        <Text style={styles.modalConfirmText}>{singleButton ? 'OK' : 'Confirm'}</Text>
                    </Pressable>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
        alignItems: 'center',
        paddingTop: 40,
        paddingBottom: 40,
        minHeight: '100vh' as any, // Web compat
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
    },
    contentWrapper: {
        width: '100%',
        maxWidth: 680,
        paddingHorizontal: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
        borderRadius: 8,
        backgroundColor: 'transparent',
    },
    backButtonHover: {
        backgroundColor: '#E2E8F0',
    },
    backButtonText: {
        fontFamily: 'Nunito_600SemiBold',
        color: '#334155',
        fontSize: 16,
        marginLeft: 4,
    },
    title: {
        fontFamily: 'Nunito_700Bold',
        fontSize: 24,
        color: '#0f172a',
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 32,
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 4,
    },
    section: {
        marginBottom: 8,
    },
    sectionHeader: {
        fontFamily: 'Nunito_700Bold',
        fontSize: 12,
        color: '#94a3b8',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 16,
    },
    row: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 16,
    },
    col: {
        flex: 1,
    },
    label: {
        fontFamily: 'Nunito_600SemiBold',
        fontSize: 14,
        color: '#475569',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontFamily: 'Nunito_600SemiBold',
        fontSize: 15,
        color: '#334155',
        height: 48,
    },
    inputGroup: {
        marginBottom: 16,
    },
    selectButton: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 12,
        paddingHorizontal: 16,
        height: 48,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    selectButtonHover: {
        borderColor: '#94a3b8',
    },
    selectButtonText: {
        fontFamily: 'Nunito_600SemiBold',
        fontSize: 15,
        color: '#334155',
    },
    saveButton: {
        backgroundColor: '#3b82f6',
        borderRadius: 12,
        paddingVertical: 14,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 8,
    },
    saveButtonHover: {
        backgroundColor: '#2563eb',
    },
    saveButtonDisabled: {
        opacity: 0.7,
    },
    saveButtonText: {
        fontFamily: 'Nunito_700Bold',
        fontSize: 16,
        color: '#fff',
    },
    divider: {
        height: 1,
        backgroundColor: '#E2E8F0',
        marginVertical: 24,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        cursor: 'pointer' as any,
    },
    menuIconContainer: {
        width: 40,
        alignItems: 'center',
    },
    menuTextContainer: {
        flex: 1,
    },
    menuTitle: {
        fontFamily: 'Nunito_700Bold',
        fontSize: 16,
        color: '#334155',
    },
    menuSubtitle: {
        fontFamily: 'Nunito_500Medium',
        fontSize: 13,
        color: '#64748b',
        marginTop: 2,
    },
    accountRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    accountName: {
        fontFamily: 'Nunito_700Bold',
        fontSize: 16,
        color: '#334155',
    },
    accountStatus: {
        fontFamily: 'Nunito_500Medium',
        fontSize: 13,
        color: '#64748b',
    },
    linkedText: {
        fontFamily: 'Nunito_600SemiBold',
        fontSize: 14,
        color: '#16a34a',
        marginLeft: 4,
    },
    actionButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: '#DBEAFE',
        borderRadius: 8,
    },
    actionButtonText: {
        fontSize: 12,
        fontFamily: 'Nunito_700Bold',
        color: '#2563eb',
    },
    actionButtonWarning: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: '#FFEDD5',
        borderRadius: 8,
    },
    actionButtonWarningText: {
        fontSize: 12,
        fontFamily: 'Nunito_700Bold',
        color: '#EA580C',
    },
    actionButtonDanger: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: '#FEE2E2',
        borderRadius: 8,
    },
    actionButtonDangerText: {
        fontSize: 12,
        fontFamily: 'Nunito_700Bold',
        color: '#DC2626',
    },
    linkButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: '#Eeffff', // Slight blue tint or transparent
        borderWidth: 1,
        borderColor: '#3b82f6',
        borderRadius: 8,
    },
    linkButtonText: {
        fontFamily: 'Nunito_700Bold',
        color: '#3b82f6',
    },
    modalOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
        minHeight: '100vh' as any,
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 16,
        width: '90%',
        maxWidth: 500,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    modalTitle: {
        fontFamily: 'Nunito_700Bold',
        fontSize: 20,
        color: '#0f172a',
    },
    modalItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    modalItemText: {
        fontFamily: 'Nunito_500Medium',
        fontSize: 16,
        color: '#334155',
    },
    modalItemTextSelected: {
        color: '#3b82f6',
        fontFamily: 'Nunito_700Bold',
    },
    modalMessage: {
        fontFamily: 'Nunito_500Medium',
        fontSize: 16,
        color: '#475569',
        marginBottom: 24,
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
    },
    modalCancelButton: {
        flex: 1,
        paddingVertical: 12,
        backgroundColor: '#f1f5f9',
        borderRadius: 8,
        alignItems: 'center',
    },
    modalCancelText: {
        fontFamily: 'Nunito_700Bold',
        color: '#475569',
    },
    modalConfirmButton: {
        flex: 1,
        paddingVertical: 12,
        backgroundColor: '#3b82f6',
        borderRadius: 8,
        alignItems: 'center',
    },
    modalConfirmText: {
        fontFamily: 'Nunito_700Bold',
        color: '#fff',
    },
});
