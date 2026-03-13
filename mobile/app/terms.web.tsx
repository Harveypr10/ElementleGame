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
                    <Text style={styles.title}>Terms of Service</Text>
                    <View style={{ width: 44 }} />
                </View>

                {/* Card */}
                <View style={styles.card}>
                    <ScrollView style={styles.scrollContent}>
                        <View style={{ marginBottom: 24 }}>
                            <Text style={styles.cardTitle}>Terms of Service for Elementle</Text>
                            <Text style={styles.cardSubtitle}>Last updated: February 2026</Text>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.subHeader}>1. Acceptance of Terms</Text>
                            <Text style={styles.paragraph}>
                                By accessing and using Elementle, you accept and agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the service.
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
                            <Text style={styles.paragraph}>The service is intended for users aged 13 and over (or the minimum age required in your jurisdiction). By using the service, you confirm you meet this age requirement.</Text>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.subHeader}>3. User Accounts</Text>
                            <Text style={styles.paragraph}>
                                When creating an account, you agree to provide accurate information and maintain the security of your login credentials. You are responsible for all activities under your account. We reserve the right to suspend or terminate accounts that violate these terms.
                            </Text>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.subHeader}>4. Subscriptions & In-App Purchases</Text>
                            <Text style={styles.paragraph}>Elementle offers optional paid subscriptions ("Elementle Pro") with the following terms:</Text>
                            <View style={styles.list}>
                                <Text style={styles.listItem}>• Subscriptions are billed on a recurring basis (monthly, quarterly, or annual) at the price displayed at the time of purchase.</Text>
                                <Text style={styles.listItem}>• Payment is charged to your Apple ID or Google Play account upon confirmation of purchase.</Text>
                                <Text style={styles.listItem}>• Subscriptions automatically renew unless auto-renewal is turned off at least 24 hours before the end of the current billing period.</Text>
                                <Text style={styles.listItem}>• You can manage or cancel your subscription at any time through your device's subscription settings.</Text>
                                <Text style={styles.listItem}>• No refunds are provided for the unused portion of a subscription period, except as required by applicable law or the policies of Apple or Google.</Text>
                                <Text style={styles.listItem}>• Prices may change from time to time. Any price changes will take effect at the start of the next billing period following notice.</Text>
                            </View>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.subHeader}>5. Intellectual Property</Text>
                            <Text style={styles.paragraph}>
                                All content, including puzzles, design, artwork, and code, is owned by Dobl Ltd or its licensors. You may not reproduce, distribute, or create derivative works without prior written permission.
                            </Text>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.subHeader}>6. AI-Generated Content</Text>
                            <Text style={styles.paragraph}>
                                The historical events, dates, and related information presented in Elementle puzzles are generated and curated with the assistance of artificial intelligence. While reasonable care is taken to validate and verify this information through multiple sources, Dobl Ltd does not warrant the accuracy, completeness, or reliability of any AI-generated content.
                            </Text>
                            <Text style={styles.paragraph}>
                                The information provided is for entertainment and educational purposes only and should not be relied upon as a definitive historical source. Dobl Ltd accepts no liability for any errors, omissions, or inaccuracies in the content, nor for any loss, damage, or consequence arising from reliance on this information.
                            </Text>
                            <Text style={styles.paragraph}>
                                If you believe any content to be inaccurate, please contact us at support@dobl.tech.
                            </Text>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.subHeader}>7. User Conduct</Text>
                            <Text style={styles.paragraph}>You agree not to:</Text>
                            <View style={styles.list}>
                                <Text style={styles.listItem}>• Use automated tools or bots to play the game</Text>
                                <Text style={styles.listItem}>• Attempt to hack, reverse-engineer, or disrupt the service</Text>
                                <Text style={styles.listItem}>• Share solutions publicly before the daily puzzle expires</Text>
                                <Text style={styles.listItem}>• Use the service for any unlawful purpose</Text>
                            </View>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.subHeader}>8. Limitation of Liability</Text>
                            <Text style={styles.paragraph}>
                                To the fullest extent permitted by law, the service is provided "as is" and "as available" without warranties of any kind, whether express or implied. Dobl Ltd shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of data, profits, or goodwill, arising from your use of the service.
                            </Text>
                            <Text style={styles.paragraph}>
                                Nothing in these terms excludes or limits liability for death or personal injury caused by negligence, fraud, or any other liability that cannot be excluded or limited by law.
                            </Text>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.subHeader}>9. Indemnification</Text>
                            <Text style={styles.paragraph}>
                                You agree to indemnify and hold harmless Dobl Ltd, its officers, directors, and employees from any claims, damages, losses, or expenses (including reasonable legal fees) arising out of your use of the service, your violation of these terms, or your infringement of any third-party rights.
                            </Text>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.subHeader}>10. Termination</Text>
                            <Text style={styles.paragraph}>
                                We reserve the right to suspend or terminate your access to the service at any time, with or without notice, for conduct that we believe violates these terms or is harmful to other users, us, or third parties.
                            </Text>
                            <Text style={styles.paragraph}>
                                You may delete your account at any time from Settings {'>'} Account Info {'>'} Delete Account. Upon termination, your right to use the service ceases immediately.
                            </Text>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.subHeader}>11. Third-Party Terms</Text>
                            <Text style={styles.paragraph}>
                                If you access Elementle through the Apple App Store, you acknowledge that these Terms of Service are between you and Dobl Ltd, not Apple. Apple has no obligation to provide maintenance or support for the app. In the event of a conflict, Apple's Licensed Application End User Licence Agreement applies as a minimum standard.
                            </Text>
                            <Text style={styles.paragraph}>
                                If you access Elementle through Google Play, Google Play's Terms of Service also apply.
                            </Text>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.subHeader}>12. Governing Law</Text>
                            <Text style={styles.paragraph}>
                                These terms are governed by and construed in accordance with the laws of England and Wales. Any disputes arising from these terms or your use of the service shall be subject to the exclusive jurisdiction of the courts of England and Wales.{"\n\n"}For users outside the UK, local consumer protection laws in your jurisdiction may also apply where they cannot be excluded by contract.
                            </Text>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.subHeader}>13. Dispute Resolution</Text>
                            <Text style={styles.paragraph}>
                                If you have a dispute with us, we encourage you to contact us first at support@dobl.tech so we can attempt to resolve it informally. If we are unable to resolve the dispute within 30 days, either party may pursue formal proceedings in accordance with Section 12.
                            </Text>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.subHeader}>14. Changes to Terms</Text>
                            <Text style={styles.paragraph}>
                                We reserve the right to modify these terms at any time. Material changes will be communicated through the app or via email. Continued use of the service after changes take effect constitutes acceptance of the revised terms.
                            </Text>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.subHeader}>15. Contact</Text>
                            <Text style={styles.paragraph}>
                                For questions about these Terms of Service, please contact us at support@dobl.tech or through the Support section in the app's Settings.
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
