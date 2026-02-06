import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';

export default function TermsWeb() {
    const router = useRouter();
    const [backHover, setBackHover] = useState(false);

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
                    <Text style={styles.title}>Terms of Use</Text>
                    <View style={{ width: 44 }} />
                </View>

                {/* Card */}
                <View style={styles.card}>
                    <ScrollView style={styles.scrollContent}>
                        <View style={{ marginBottom: 24 }}>
                            <Text style={styles.cardTitle}>Terms of Use for Elementle</Text>
                            <Text style={styles.cardSubtitle}>Last updated: October 2025</Text>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.subHeader}>1. Acceptance of Terms</Text>
                            <Text style={styles.paragraph}>
                                By accessing and using Elementle, you accept and agree to be bound by these Terms of Use. If you do not agree to these terms, please do not use the service.
                            </Text>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.subHeader}>2. Use of Service</Text>
                            <Text style={styles.paragraph}>Elementle is a daily historical date-guessing puzzle game. You may:</Text>
                            <View style={styles.list}>
                                <Text style={styles.listItem}>• Play as a guest with local storage only</Text>
                                <Text style={styles.listItem}>• Create an account to save progress permanently</Text>
                                <Text style={styles.listItem}>• Access daily puzzles and archived puzzles</Text>
                            </View>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.subHeader}>3. User Accounts</Text>
                            <Text style={styles.paragraph}>
                                When creating an account, you agree to provide accurate information and maintain the security of your password. You are responsible for all activities under your account.
                            </Text>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.subHeader}>4. Intellectual Property</Text>
                            <Text style={styles.paragraph}>
                                All content, including puzzles, design, and code, is owned by the service provider. You may not reproduce, distribute, or create derivative works without permission.
                            </Text>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.subHeader}>5. User Conduct</Text>
                            <Text style={styles.paragraph}>You agree not to:</Text>
                            <View style={styles.list}>
                                <Text style={styles.listItem}>• Use automated tools or bots to play the game</Text>
                                <Text style={styles.listItem}>• Attempt to hack or disrupt the service</Text>
                                <Text style={styles.listItem}>• Share solutions publicly before the daily puzzle expires</Text>
                            </View>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.subHeader}>6. Limitation of Liability</Text>
                            <Text style={styles.paragraph}>
                                The service is provided "as is" without warranties of any kind. We are not liable for any damages arising from your use of the service.
                            </Text>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.subHeader}>7. Changes to Terms</Text>
                            <Text style={styles.paragraph}>
                                We reserve the right to modify these terms at any time. Continued use of the service constitutes acceptance of any changes.
                            </Text>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.subHeader}>8. Contact</Text>
                            <Text style={styles.paragraph}>
                                For questions about these Terms of Use, please contact us through the Support section in Settings.
                            </Text>
                        </View>

                    </ScrollView>
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
        maxWidth: 896, // max-w-4xl
        flex: 1,
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
        flex: 1,
    },
    scrollContent: {
        flex: 1,
    },
    section: {
        marginBottom: 24,
    },
    cardTitle: {
        fontFamily: 'Nunito_600SemiBold',
        fontSize: 24,
        color: '#0f172a',
        marginBottom: 4,
    },
    cardSubtitle: {
        fontFamily: 'Nunito_400Regular',
        fontSize: 14,
        color: '#64748b',
    },
    subHeader: {
        fontFamily: 'Nunito_600SemiBold',
        fontSize: 20,
        color: '#0f172a',
        marginBottom: 8,
    },
    paragraph: {
        fontFamily: 'Nunito_400Regular',
        fontSize: 16,
        color: '#334155',
        lineHeight: 24,
        marginBottom: 8,
    },
    list: {
        paddingLeft: 16,
        marginBottom: 8,
    },
    listItem: {
        fontFamily: 'Nunito_400Regular',
        fontSize: 16,
        color: '#334155',
        lineHeight: 24,
        marginBottom: 4,
    },
});
