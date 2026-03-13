import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { styled } from 'nativewind';
import { ChevronLeft } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useOptions } from '../lib/options';

import { ThemedText } from '../components/ThemedText';
import { ThemedView } from '../components/ThemedView';
import { useThemeColor } from '../hooks/useThemeColor';

const StyledView = styled(View);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledScrollView = styled(ScrollView);

export default function TermsScreen() {
    const router = useRouter();
    const { textScale } = useOptions();

    const surfaceColor = useThemeColor({}, 'surface');
    const borderColor = useThemeColor({}, 'border');
    const iconColor = useThemeColor({}, 'icon');
    const secondaryTextColor = useThemeColor({ light: '#64748b', dark: '#94a3b8' }, 'text');

    const sections = [
        {
            title: "1. Acceptance of Terms",
            content: "By accessing and using Elementle, you accept and agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the service."
        },
        {
            title: "2. Use of Service",
            content: "Elementle is a daily historical date-guessing puzzle game. You may:\n\u2022 Play as a guest with local storage only\n\u2022 Create an account to save progress permanently\n\u2022 Access daily puzzles and archived puzzles\n\nThe service is intended for users aged 13 and over (or the minimum age required in your jurisdiction). By using the service, you confirm you meet this age requirement."
        },
        {
            title: "3. User Accounts",
            content: "When creating an account, you agree to provide accurate information and maintain the security of your login credentials. You are responsible for all activities under your account. We reserve the right to suspend or terminate accounts that violate these terms."
        },
        {
            title: "4. Subscriptions & In-App Purchases",
            content: "Elementle offers optional paid subscriptions (\"Elementle Pro\") with the following terms:\n\n• Subscriptions are billed on a recurring basis (monthly, quarterly, or annual) at the price displayed at the time of purchase.\n• Payment is charged to your Apple ID or Google Play account upon confirmation of purchase.\n• Subscriptions automatically renew unless auto-renewal is turned off at least 24 hours before the end of the current billing period.\n• You can manage or cancel your subscription at any time through your device's subscription settings (Apple: Settings > Apple ID > Subscriptions; Google: Play Store > Subscriptions).\n• No refunds are provided for the unused portion of a subscription period, except as required by applicable law or the policies of Apple or Google.\n• Prices may change from time to time. Any price changes will take effect at the start of the next billing period following notice."
        },
        {
            title: "5. Intellectual Property",
            content: "All content, including puzzles, design, artwork, and code, is owned by Dobl Ltd or its licensors. You may not reproduce, distribute, or create derivative works without prior written permission."
        },
        {
            title: "6. AI-Generated Content",
            content: "The historical events, dates, and related information presented in Elementle puzzles are generated and curated with the assistance of artificial intelligence. While reasonable care is taken to validate and verify this information through multiple sources, Dobl Ltd does not warrant the accuracy, completeness, or reliability of any AI-generated content.\n\nThe information provided is for entertainment and educational purposes only and should not be relied upon as a definitive historical source. Dobl Ltd accepts no liability for any errors, omissions, or inaccuracies in the content, nor for any loss, damage, or consequence arising from reliance on this information.\n\nIf you believe any content to be inaccurate, please contact us at support@dobl.tech."
        },
        {
            title: "7. User Conduct",
            content: "You agree not to:\n• Use automated tools or bots to play the game\n• Attempt to hack, reverse-engineer, or disrupt the service\n• Share solutions publicly before the daily puzzle expires\n• Use the service for any unlawful purpose"
        },
        {
            title: "8. Limitation of Liability",
            content: "To the fullest extent permitted by law, the service is provided \"as is\" and \"as available\" without warranties of any kind, whether express or implied. Dobl Ltd shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of data, profits, or goodwill, arising from your use of the service.\n\nNothing in these terms excludes or limits liability for death or personal injury caused by negligence, fraud, or any other liability that cannot be excluded or limited by law."
        },
        {
            title: "9. Indemnification",
            content: "You agree to indemnify and hold harmless Dobl Ltd, its officers, directors, and employees from any claims, damages, losses, or expenses (including reasonable legal fees) arising out of your use of the service, your violation of these terms, or your infringement of any third-party rights."
        },
        {
            title: "10. Termination",
            content: "We reserve the right to suspend or terminate your access to the service at any time, with or without notice, for conduct that we believe violates these terms or is harmful to other users, us, or third parties.\n\nYou may delete your account at any time from Settings > Account Info > Delete Account. Upon termination, your right to use the service ceases immediately."
        },
        {
            title: "11. Third-Party Terms",
            content: "If you access Elementle through the Apple App Store, you acknowledge that these Terms of Service are between you and Dobl Ltd, not Apple. Apple has no obligation to provide maintenance or support for the app. In the event of a conflict, Apple's Licensed Application End User Licence Agreement (https://www.apple.com/legal/internet-services/itunes/dev/stdeula/) applies as a minimum standard.\n\nIf you access Elementle through Google Play, Google Play's Terms of Service (https://play.google.com/about/play-terms/) also apply."
        },
        {
            title: "12. Governing Law",
            content: "These terms are governed by and construed in accordance with the laws of England and Wales. Any disputes arising from these terms or your use of the service shall be subject to the exclusive jurisdiction of the courts of England and Wales.\n\nFor users outside the UK, local consumer protection laws in your jurisdiction may also apply where they cannot be excluded by contract."
        },
        {
            title: "13. Dispute Resolution",
            content: "If you have a dispute with us, we encourage you to contact us first at support@dobl.tech so we can attempt to resolve it informally. If we are unable to resolve the dispute within 30 days, either party may pursue formal proceedings in accordance with Section 12."
        },
        {
            title: "14. Changes to Terms",
            content: "We reserve the right to modify these terms at any time. Material changes will be communicated through the app or via email. Continued use of the service after changes take effect constitutes acceptance of the revised terms."
        },
        {
            title: "15. Contact",
            content: "For questions about these Terms of Service, please contact us at:\n\nEmail: support@dobl.tech\n\nOr through the Support section in the app's Settings."
        }
    ];

    return (
        <ThemedView className="flex-1">
            <SafeAreaView edges={['top']} style={{ backgroundColor: surfaceColor }}>
                <StyledView
                    className="flex-row items-center justify-between px-4 py-3"
                    style={{ backgroundColor: surfaceColor }}
                >
                    <StyledTouchableOpacity
                        onPress={() => router.back()}
                        className="w-10 h-10 items-center justify-center p-2"
                        hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                    >
                        <ChevronLeft size={28} color={iconColor} />
                    </StyledTouchableOpacity>
                    <ThemedText size="2xl" className="font-n-bold">Terms of Service</ThemedText>
                    <StyledView className="w-10" />
                </StyledView>
            </SafeAreaView>

            <StyledScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16, paddingBottom: 40 }}>
                <StyledView className="w-full max-w-3xl self-center">
                    <ThemedText size="sm" style={{ color: secondaryTextColor }} className="mb-6 text-center">
                        Last updated: February 2026
                    </ThemedText>

                    <StyledView
                        className="rounded-2xl p-5 border mb-6"
                        style={{ backgroundColor: surfaceColor, borderColor: borderColor }}
                    >
                        {sections.map((section, index) => (
                            <StyledView key={index} className={`mb-6 ${index === sections.length - 1 ? 'mb-0' : ''}`}>
                                <ThemedText size="lg" className="font-n-bold mb-2">
                                    {section.title}
                                </ThemedText>
                                <ThemedText size="base" style={{ color: secondaryTextColor }} className="leading-6">
                                    {section.content}
                                </ThemedText>
                            </StyledView>
                        ))}
                    </StyledView>
                </StyledView>
            </StyledScrollView>
        </ThemedView>
    );
}
