import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useBugReportLogic } from '../hooks/useBugReportLogic';

export default function BugReportWeb() {
    const router = useRouter();
    const {
        description,
        setDescription,
        isSubmitting,
        submitBugReport,
        userEmail,
        colors
    } = useBugReportLogic();

    const [backHover, setBackHover] = useState(false);
    const [submitHover, setSubmitHover] = useState(false);

    const handleSubmit = async () => {
        const result = await submitBugReport();
        if (!result.success && result.error) {
            // Using Alert on Web is native-like, acceptable for now
            Alert.alert('Error', result.error);
        } else if (result.success && result.message) {
            Alert.alert('Opening Mail', result.message);
            // Optional: Clear form or go back?
            // Legacy cleared and went back after 2s.
            // We can just leave it or go back.
            setTimeout(() => {
                setDescription('');
                router.back();
            }, 2000);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.contentWrapper}>

                {/* Header */}
                <View style={styles.header}>
                    <Pressable
                        onPress={() => router.back()}
                        onHoverIn={() => setBackHover(true)}
                        onHoverOut={() => setBackHover(false)}
                        style={[styles.backButton, backHover && styles.backButtonHover]}
                    >
                        <ChevronLeft size={24} color="#374151" />
                    </Pressable>
                    <Text style={styles.title}>Report a Bug</Text>
                    <View style={{ width: 44 }} />
                </View>

                {/* Card */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <Text style={styles.cardTitle}>Thank you!</Text>
                        <Text style={styles.cardDescription}>
                            Your feedback helps us quickly fix issues — please describe what happened
                        </Text>
                    </View>

                    <View style={styles.formGroup}>
                        <Text style={styles.label}>Your Email</Text>
                        <TextInput
                            value={userEmail}
                            editable={false}
                            style={[styles.input, styles.inputDisabled]}
                        />
                    </View>

                    <View style={styles.formGroup}>
                        <Text style={styles.label}>Describe the bug</Text>
                        <TextInput
                            value={description}
                            onChangeText={setDescription}
                            style={[styles.input, styles.textArea]}
                            placeholder="What happened? What did you expect to happen?"
                            placeholderTextColor="#9ca3af"
                            multiline
                            textAlignVertical="top"
                        />
                    </View>

                    <Pressable
                        onPress={handleSubmit}
                        disabled={isSubmitting}
                        onHoverIn={() => setSubmitHover(true)}
                        onHoverOut={() => setSubmitHover(false)}
                        style={[
                            styles.submitButton,
                            submitHover && styles.submitButtonHover,
                            isSubmitting && styles.submitButtonDisabled
                        ]}
                    >
                        {isSubmitting ? (
                            <Text style={styles.submitButtonText}>Sending...</Text>
                        ) : (
                            <Text style={styles.submitButtonText}>Send Bug Report</Text>
                        )}
                    </Pressable>

                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        paddingTop: 32,
        paddingBottom: 40,
        paddingHorizontal: 16,
        minHeight: '100vh' as any,
    },
    contentWrapper: {
        width: '100%',
        maxWidth: 448, // max-w-md
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
    },
    backButtonHover: {
        backgroundColor: '#f3f4f6',
    },
    title: {
        fontFamily: 'Nunito_700Bold',
        fontSize: 32, // text-4xl equivalent roughly
        color: '#000',
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    cardHeader: {
        marginBottom: 24,
    },
    cardTitle: {
        fontFamily: 'Nunito_600SemiBold',
        fontSize: 24,
        color: '#0f172a',
        marginBottom: 6,
    },
    cardDescription: {
        fontFamily: 'Nunito_400Regular',
        fontSize: 14,
        color: '#64748b',
    },
    formGroup: {
        marginBottom: 16,
    },
    label: {
        fontFamily: 'Nunito_500Medium',
        fontSize: 14,
        color: '#0f172a',
        marginBottom: 8,
    },
    input: {
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        fontFamily: 'Nunito_400Regular',
        fontSize: 14,
        color: '#0f172a',
        backgroundColor: '#fff',
        height: 40,
    },
    inputDisabled: {
        backgroundColor: '#f1f5f9', // muted
        color: '#64748b',
    },
    textArea: {
        minHeight: 150,
        paddingVertical: 12,
        height: 'auto' as any,
    },
    submitButton: {
        backgroundColor: '#0f172a', // primary
        borderRadius: 6,
        paddingVertical: 10,
        paddingHorizontal: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    submitButtonHover: {
        opacity: 0.9,
    },
    submitButtonDisabled: {
        opacity: 0.5,
    },
    submitButtonText: {
        fontFamily: 'Nunito_500Medium',
        fontSize: 14,
        color: '#ffffff',
    },
});
