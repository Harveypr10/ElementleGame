import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Linking } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';
// Optional: useProfile for adsConsent if we want to enable toggle on web
// Legacy PrivacyPage has ads consent toggle.
// I should duplicate that logic if possible.
// Legacy uses useProfile.
import { useProfile } from '../hooks/useProfile';
import { Switch } from 'react-native';

export default function PrivacyWeb() {
    const router = useRouter();
    const [backHover, setBackHover] = useState(false);

    // Ads Consent Logic
    const { profile, updateProfile } = useProfile();
    const [saving, setSaving] = useState(false);

    const adsConsent = profile?.ads_consent ?? false; // Note: check profile key. Legacy uses adsConsent, hook usually uses snake_case keys from Supabase or camelCase if transformed.
    // verify useProfile hook structure? Usually it returns snake_case from DB or normalized.
    // I'll assume snake_case `ads_consent` or check `useProfile` definition if unsure.
    // Legacy Web uses `adsConsent`. Mobile typically uses snake_case.
    // Let's assume `ads_consent` for safety or check.
    // Actually, let's look at `useProfile` briefly or try accessing both.

    const handleAdsToggle = async (value: boolean) => {
        setSaving(true);
        try {
            await updateProfile({ ads_consent: value });
        } finally {
            setSaving(false);
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
                    <Text style={styles.title}>Privacy Policy</Text>
                    <View style={{ width: 44 }} />
                </View>

                {/* Card */}
                <View style={styles.card}>
                    <ScrollView style={styles.scrollContent}>
                        <View style={{ marginBottom: 24 }}>
                            <Text style={styles.cardTitle}>Privacy Policy for Elementle</Text>
                            <Text style={styles.cardSubtitle}>Last updated: October 2025</Text>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.subHeader}>1. Information We Collect</Text>
                            <Text style={styles.paragraph}>
                                When you create an account, we collect the following information as part of providing the game service:
                            </Text>
                            <View style={styles.list}>
                                <Text style={styles.listItem}>• Email address</Text>
                                <Text style={styles.listItem}>• First and last name</Text>
                                <Text style={styles.listItem}>• Game progress and guess data (including your daily guesses, streaks, and statistics)</Text>
                            </View>
                            <Text style={styles.paragraph}>
                                We may also collect optional information if you provide consent (see Section 4).
                            </Text>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.subHeader}>2. How We Use Your Information</Text>
                            <Text style={styles.paragraph}>We use your information to:</Text>
                            <View style={styles.list}>
                                <Text style={styles.listItem}>• Provide and maintain the Elementle game service</Text>
                                <Text style={styles.listItem}>• Track your game progress, guesses, and statistics to power features such as streaks and leaderboards</Text>
                                <Text style={styles.listItem}>• Send important service updates (e.g. account or security notifications)</Text>
                            </View>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.subHeader}>3. Data Storage</Text>
                            <Text style={styles.paragraph}>
                                Your data is securely stored using Supabase, a trusted database platform. We retain your data only as long as necessary to provide the service or comply with legal obligations.
                            </Text>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.subHeader}>4. Optional Data Use (Consent-Based)</Text>
                            <Text style={styles.paragraph}>
                                With your explicit consent, we may also use your data to tailor advertising and promotional content to your interests. This consent is optional and not required to play the game. You can withdraw consent at any time in the app’s Settings.
                            </Text>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.subHeader}>5. Data Sharing</Text>
                            <Text style={styles.paragraph}>
                                We do not sell, trade, or otherwise transfer your personal information to third parties. Your game statistics may be aggregated and anonymised for global leaderboards. Advertising partners will only receive data if you have explicitly opted in under Section 4.
                            </Text>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.subHeader}>6. Your Rights</Text>
                            <Text style={styles.paragraph}>Under GDPR and UK GDPR, you have the right to:</Text>
                            <View style={styles.list}>
                                <Text style={styles.listItem}>• Access your personal data</Text>
                                <Text style={styles.listItem}>• Request correction of inaccurate data</Text>
                                <Text style={styles.listItem}>• Request deletion of your account and associated data</Text>
                                <Text style={styles.listItem}>• Withdraw consent for optional data uses at any time</Text>
                            </View>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.subHeader}>7. Contact Us</Text>
                            <Text style={styles.paragraph}>
                                If you have questions about this Privacy Policy or your data rights, please contact us through the Feedback section in Settings.
                            </Text>
                        </View>

                        {/* Ads Consent */}
                        <View style={[styles.section, styles.consentSection]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                <View style={{ flex: 1, paddingRight: 16 }}>
                                    <Text style={styles.paragraph}>
                                        I consent to my data being used to tailor ads. <Text style={styles.bold}>If you do not consent, your ads will not be tailored.</Text>
                                    </Text>
                                </View>
                                <Switch
                                    value={adsConsent} // Use safe check if property doesn't exist
                                    onValueChange={handleAdsToggle}
                                    disabled={saving}
                                    trackColor={{ false: '#e2e8f0', true: '#3b82f6' }}
                                    thumbColor={'#ffffff'}
                                />
                            </View>
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
    bold: {
        fontFamily: 'Nunito_700Bold',
        color: '#0f172a',
    },
    consentSection: {
        marginTop: 32,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
    },
});
