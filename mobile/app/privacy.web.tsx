import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Linking } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../lib/auth';

export default function PrivacyWeb() {
    const router = useRouter();
    const { user } = useAuth();
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
                    <Text style={styles.title}>Privacy Policy</Text>
                    <View style={{ width: 44 }} />
                </View>

                {/* Card */}
                <View style={styles.card}>
                    <ScrollView style={styles.scrollContent}>
                        <View style={{ marginBottom: 24 }}>
                            <Text style={styles.cardTitle}>Privacy Policy for Elementle</Text>
                            <Text style={styles.cardSubtitle}>Last updated: February 2026</Text>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.subHeader}>1. Information We Collect</Text>
                            <Text style={styles.paragraph}>
                                When you create an account, we collect the following information:
                            </Text>
                            <View style={styles.list}>
                                <Text style={styles.listItem}>• Email address (for login and account recovery)</Text>
                                <Text style={styles.listItem}>• First and last name (for personalisation)</Text>
                                <Text style={styles.listItem}>• Postcode or location data (to provide local puzzles relevant to your area)</Text>
                                <Text style={styles.listItem}>• Game progress data (guesses, streaks, statistics, and badges)</Text>
                                <Text style={styles.listItem}>• Subscription and purchase information (to manage your Pro subscription)</Text>
                            </View>
                            <Text style={styles.paragraph}>
                                We also automatically collect:
                            </Text>
                            <View style={styles.list}>
                                <Text style={styles.listItem}>• Device identifiers (for analytics, ad serving, and fraud prevention)</Text>
                                <Text style={styles.listItem}>• Crash reports and performance data (to improve app stability)</Text>
                                <Text style={styles.listItem}>• Usage data (how you interact with features, screens, and settings)</Text>
                            </View>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.subHeader}>2. How We Use Your Information</Text>
                            <Text style={styles.paragraph}>We use your information to:</Text>
                            <View style={styles.list}>
                                <Text style={styles.listItem}>• Provide and maintain the Elementle game service</Text>
                                <Text style={styles.listItem}>• Track your game progress, streaks, badges, and statistics</Text>
                                <Text style={styles.listItem}>• Process and manage subscriptions</Text>
                                <Text style={styles.listItem}>• Serve advertisements (personalised if you consent, contextual otherwise)</Text>
                                <Text style={styles.listItem}>• Monitor app performance and fix crashes</Text>
                                <Text style={styles.listItem}>• Send important service updates (e.g. account or security notifications)</Text>
                            </View>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.subHeader}>3. Data Storage</Text>
                            <Text style={styles.paragraph}>
                                Your data is securely stored using Supabase, a hosted database platform. We retain your account data for as long as your account is active. If you delete your account, your personal data will be removed within 30 days, except where we are required by law to retain it.
                            </Text>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.subHeader}>4. Third-Party Services</Text>
                            <Text style={styles.paragraph}>
                                We use the following third-party services that may collect data:
                            </Text>
                            <View style={styles.list}>
                                <Text style={styles.listItem}>• Google AdMob & AppLovin — Serve advertisements. May collect device identifiers (IDFA), location data, and interaction data for ad targeting and measurement.</Text>
                                <Text style={styles.listItem}>• RevenueCat — Manages subscriptions and in-app purchases. Collects purchase receipts and a user identifier.</Text>
                                <Text style={styles.listItem}>• Sentry — Monitors app crashes and performance. Collects crash logs, device information, and performance metrics. This data is not linked to your identity.</Text>
                                <Text style={styles.listItem}>• Supabase — Stores your account and game data securely.</Text>
                            </View>
                            <Text style={styles.paragraph}>
                                When you grant App Tracking Transparency permission, advertising partners may use your data across apps and websites for targeted advertising.
                            </Text>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.subHeader}>5. Optional Data Use (Consent-Based)</Text>
                            <Text style={styles.paragraph}>
                                With your explicit consent, we may share your data with advertising partners to tailor ads to your interests. If you do not consent, you will still see ads, but they will not be personalised. You can change your consent at any time in the Privacy section of Settings.
                            </Text>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.subHeader}>6. Data Sharing</Text>
                            <Text style={styles.paragraph}>
                                We do not sell your personal information. We share data only with the third-party services listed in Section 4, solely for the purposes described. Your game statistics may be aggregated and anonymised for leaderboards. We may also disclose information if required by law.
                            </Text>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.subHeader}>7. Your Rights</Text>
                            <Text style={styles.paragraph}>Under GDPR and UK GDPR, you have the right to:</Text>
                            <View style={styles.list}>
                                <Text style={styles.listItem}>• Access your personal data</Text>
                                <Text style={styles.listItem}>• Request correction of inaccurate data</Text>
                                <Text style={styles.listItem}>• Request deletion of your account and associated data</Text>
                                <Text style={styles.listItem}>• Withdraw consent for optional data uses at any time</Text>
                            </View>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.subHeader}>8. Account Deletion</Text>
                            <Text style={styles.paragraph}>
                                You can delete your account at any time from Settings {'>'} Account Info {'>'} Delete Account. When you delete your account, we will permanently remove your personal data, game progress, and subscription records within 30 days. Some anonymised, aggregated data (e.g. leaderboard contributions) may be retained.
                            </Text>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.subHeader}>9. Children's Privacy</Text>
                            <Text style={styles.paragraph}>
                                Elementle is rated for users aged 13+ and does not knowingly collect personal information from children under 13 (or the minimum age required in your jurisdiction) without parental consent. If you believe a child has provided us with personal data, please contact us and we will delete it promptly.
                            </Text>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.subHeader}>10. Contact Us</Text>
                            <Text style={styles.paragraph}>
                                If you have questions about this Privacy Policy or wish to exercise your data rights, please contact us at:
                            </Text>
                            <Text style={styles.paragraph}>
                                Email: privacy@dobl.tech
                            </Text>
                            <Text style={styles.paragraph}>
                                Or through the Feedback section in the app's Settings.
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
    bold: {
        fontFamily: 'Nunito_700Bold',
        color: '#0f172a',
    },
});
