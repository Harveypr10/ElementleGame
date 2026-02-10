import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { useThemeColor } from '../hooks/useThemeColor';

interface DeleteAccountModalProps {
    visible: boolean;
    onClose: () => void;
    onDelete: () => Promise<void>;
    email?: string;
    firstName?: string;
    lastName?: string;
    isDeleting: boolean;
}

/**
 * Two-step account deletion modal.
 * Step 1: Warning about permanent data loss + subscription reminder.
 * Step 2: Confirm identity (masked email or name).
 */
export function DeleteAccountModal({
    visible,
    onClose,
    onDelete,
    email,
    firstName,
    lastName,
    isDeleting,
}: DeleteAccountModalProps) {
    const [step, setStep] = useState<1 | 2>(1);
    const surfaceColor = useThemeColor({}, 'surface');
    const textColor = useThemeColor({}, 'text');

    const handleClose = () => {
        setStep(1);
        onClose();
    };

    const handleFirstConfirm = () => {
        setStep(2);
    };

    const handleFinalConfirm = async () => {
        await onDelete();
        // If onDelete succeeds, the component will unmount via signOut navigation
    };

    const identityLabel = email
        || [firstName, lastName].filter(Boolean).join(' ')
        || 'this account';

    const isWeb = Platform.OS === 'web';
    const subscriptionWarning = isWeb
        ? 'Note: This does NOT cancel your subscription. Please manage your subscription via the platform you signed up on.'
        : 'Note: This does NOT cancel your subscription. You must cancel it in your device settings to avoid future charges.';

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={handleClose}
        >
            <View style={styles.overlay}>
                <View style={[styles.card, { backgroundColor: surfaceColor }]}>
                    {step === 1 ? (
                        <>
                            <Text style={[styles.headline, { color: '#DC2626' }]}>
                                Delete Account?
                            </Text>
                            <Text style={[styles.body, { color: textColor }]}>
                                This action is permanent. All streaks, badges, and history will be lost.
                            </Text>
                            <Text style={[styles.warning, { color: textColor }]}>
                                {subscriptionWarning}
                            </Text>
                            <View style={styles.buttonRow}>
                                <TouchableOpacity
                                    style={styles.cancelButton}
                                    onPress={handleClose}
                                >
                                    <Text style={styles.cancelText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.deleteButton}
                                    onPress={handleFirstConfirm}
                                >
                                    <Text style={styles.deleteText}>Delete My Account</Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    ) : (
                        <>
                            <Text style={[styles.headline, { color: '#DC2626' }]}>
                                Are you sure?
                            </Text>
                            <Text style={[styles.body, { color: textColor }]}>
                                Confirm account deletion for:
                            </Text>
                            <Text style={[styles.identity, { color: textColor }]}>
                                {identityLabel}
                            </Text>
                            <View style={styles.buttonRow}>
                                <TouchableOpacity
                                    style={styles.cancelButton}
                                    onPress={handleClose}
                                    disabled={isDeleting}
                                >
                                    <Text style={styles.cancelText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.deleteButton, isDeleting && { opacity: 0.6 }]}
                                    onPress={handleFinalConfirm}
                                    disabled={isDeleting}
                                >
                                    {isDeleting ? (
                                        <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                        <Text style={styles.deleteText}>Confirm</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    card: {
        width: '100%',
        maxWidth: 380,
        borderRadius: 20,
        padding: 24,
    },
    headline: {
        fontFamily: 'Nunito_700Bold',
        fontSize: 22,
        marginBottom: 12,
    },
    body: {
        fontFamily: 'Nunito_500Medium',
        fontSize: 15,
        lineHeight: 22,
        opacity: 0.85,
        marginBottom: 12,
    },
    warning: {
        fontFamily: 'Nunito_600SemiBold',
        fontSize: 13,
        lineHeight: 20,
        opacity: 0.7,
        marginBottom: 24,
        fontStyle: 'italic',
    },
    identity: {
        fontFamily: 'Nunito_700Bold',
        fontSize: 16,
        marginBottom: 24,
        textAlign: 'center',
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 12,
    },
    cancelButton: {
        flex: 1,
        backgroundColor: '#E2E8F0',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    cancelText: {
        fontFamily: 'Nunito_700Bold',
        fontSize: 15,
        color: '#475569',
    },
    deleteButton: {
        flex: 1,
        backgroundColor: '#DC2626',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    deleteText: {
        fontFamily: 'Nunito_700Bold',
        fontSize: 15,
        color: '#FFFFFF',
    },
});
