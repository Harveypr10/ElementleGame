/**
 * ConfirmModal.tsx
 * Reusable confirmation dialog with optional validation error display.
 */
import React from 'react';
import {
    Modal,
    View,
    Text,
    Pressable,
    StyleSheet,
    ActivityIndicator,
} from 'react-native';

interface ConfirmModalProps {
    visible: boolean;
    title?: string;
    message: string;
    validationError?: string | null;
    loading?: boolean;
    onCancel: () => void;
    onConfirm: () => void;
    confirmLabel?: string;
    destructive?: boolean;
    children?: React.ReactNode;
}

export default function ConfirmModal({
    visible,
    title = 'Confirm Action',
    message,
    validationError,
    loading = false,
    onCancel,
    onConfirm,
    confirmLabel = 'Confirm',
    destructive = false,
    children,
}: ConfirmModalProps) {
    return (
        <Modal
            transparent
            animationType="fade"
            visible={visible}
            onRequestClose={onCancel}
        >
            <View style={styles.overlay}>
                <View style={styles.modal}>
                    <Text style={styles.title}>⚠️ {title}</Text>

                    <Text style={styles.message}>{message}</Text>

                    {children && <View style={styles.childrenWrap}>{children}</View>}

                    {validationError ? (
                        <View style={styles.errorWrap}>
                            <Text style={styles.errorText}>{validationError}</Text>
                        </View>
                    ) : null}

                    <Text style={styles.warning}>This action is logged and may not be easily undone.</Text>

                    <View style={styles.actions}>
                        <Pressable
                            onPress={onCancel}
                            style={[styles.btn, styles.cancelBtn]}
                            disabled={loading}
                        >
                            <Text style={styles.cancelText}>Cancel</Text>
                        </Pressable>

                        <Pressable
                            onPress={onConfirm}
                            style={[
                                styles.btn,
                                destructive ? styles.destructiveBtn : styles.confirmBtn,
                                (loading || !!validationError) && styles.btnDisabled,
                            ]}
                            disabled={loading || !!validationError}
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Text style={styles.confirmText}>{confirmLabel}</Text>
                            )}
                        </Pressable>
                    </View>
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
        padding: 24,
    },
    modal: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 24,
        width: '100%',
        maxWidth: 420,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
        elevation: 8,
    },
    title: {
        fontFamily: 'Nunito_700Bold',
        fontSize: 18,
        color: '#0f172a',
        marginBottom: 12,
    },
    message: {
        fontFamily: 'Nunito_500Medium',
        fontSize: 15,
        color: '#334155',
        lineHeight: 22,
        marginBottom: 12,
    },
    childrenWrap: {
        marginBottom: 12,
    },
    errorWrap: {
        backgroundColor: '#fef2f2',
        borderWidth: 1,
        borderColor: '#fecaca',
        borderRadius: 8,
        padding: 10,
        marginBottom: 12,
    },
    errorText: {
        fontFamily: 'Nunito_600SemiBold',
        fontSize: 13,
        color: '#dc2626',
    },
    warning: {
        fontFamily: 'Nunito_400Regular',
        fontSize: 12,
        color: '#94a3b8',
        fontStyle: 'italic',
        marginBottom: 16,
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
    },
    btn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelBtn: {
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    confirmBtn: {
        backgroundColor: '#3b82f6',
    },
    destructiveBtn: {
        backgroundColor: '#dc2626',
    },
    btnDisabled: {
        opacity: 0.5,
    },
    cancelText: {
        fontFamily: 'Nunito_600SemiBold',
        fontSize: 15,
        color: '#475569',
    },
    confirmText: {
        fontFamily: 'Nunito_600SemiBold',
        fontSize: 15,
        color: '#fff',
    },
});
