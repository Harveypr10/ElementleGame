import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { ChevronLeft, CheckCircle } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useBugReportLogic } from '../hooks/useBugReportLogic';

export default function BugReportWeb() {
    const router = useRouter();
    const {
        description,
        setDescription,
        isSubmitting,
        isSubmitted,
        submitBugReport,
        handleSubmitPress,
        hasAuthEmail,
        showEmailPrompt,
        guestEmail,
        setGuestEmail,
        userEmail,
    } = useBugReportLogic();

    const [backHover, setBackHover] = useState(false);
    const [submitHover, setSubmitHover] = useState(false);

    const handleSubmit = async () => {
        if (!description.trim()) {
            Alert.alert('Required', 'Please describe the bug.');
            return;
        }

        const status = handleSubmitPress();
        if (status === 'needs_email') return;

        const result = await submitBugReport();
        if (!result.success && result.error) {
            Alert.alert('Error', result.error);
        }
    };

    if (isSubmitted) {
        return (
            <View style={styles.container}>
                <View style={styles.contentWrapper}>
                    <View style={styles.header}>
                        <View style={{ width: 44 }} />
                        <Text style={styles.title}>Report a Bug</Text>
                        <View style={{ width: 44 }} />
                    </View>
                    <View style={[styles.card, { alignItems: 'center', paddingVertical: 48 }]}>
                        <CheckCircle size={56} color="#22c55e" />
                        <Text style={[styles.cardTitle, { marginTop: 16, textAlign: 'center' }]}>Report Submitted</Text>
                        <Text style={[styles.cardDescription, { textAlign: 'center' }]}>
                            Thank you! We'll investigate this issue.
                        </Text>
                    </View>
                </View>
            </View>
        );
    }

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

                    {userEmail ? (
                        <View style={styles.formGroup}>
                            <Text style={styles.label}>Your Email</Text>
                            <TextInput
                                value={userEmail}
                                editable={false}
                                style={[styles.input, styles.inputDisabled]}
                            />
                        </View>
                    ) : null}

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

                    {/* Guest Email Prompt */}
                    {showEmailPrompt && !hasAuthEmail && (
                        <View style={styles.formGroup}>
                            <Text style={styles.label}>Would you like a response? (optional)</Text>
                            <TextInput
                                value={guestEmail}
                                onChangeText={setGuestEmail}
                                style={styles.input}
                                placeholder="your@email.com"
                                placeholderTextColor="#9ca3af"
                                keyboardType="email-address"
                                autoCapitalize="none"
                            />
                        </View>
                    )}

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
                        <Text style={styles.submitButtonText}>
                            {isSubmitting ? 'Submitting...' : 'Send Bug Report'}
                        </Text>
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
        maxWidth: 448,
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
        fontSize: 32,
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
        backgroundColor: '#f1f5f9',
        color: '#64748b',
    },
    textArea: {
        minHeight: 150,
        paddingVertical: 12,
        height: 'auto' as any,
    },
    submitButton: {
        backgroundColor: '#0f172a',
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
