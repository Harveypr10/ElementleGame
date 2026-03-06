import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { styled } from 'nativewind';
import { ChevronLeft } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useOptions } from '../lib/options';
import { useProfile } from '../hooks/useProfile';
import { supabase } from '../lib/supabase';

import { ThemedText } from '../components/ThemedText';
import { ThemedView } from '../components/ThemedView';
import { useThemeColor } from '../hooks/useThemeColor';

const StyledView = styled(View);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledScrollView = styled(ScrollView);

export default function PrivacyScreen() {
    const router = useRouter();
    const { textScale } = useOptions();
    const { profile } = useProfile();

    // Dynamic privacy content state
    const [legislationName, setLegislationName] = useState('Data Protection Laws');
    const [rightsContent, setRightsContent] = useState('Loading your rights...');

    const surfaceColor = useThemeColor({}, 'surface');
    const borderColor = useThemeColor({}, 'border');
    const iconColor = useThemeColor({}, 'icon');
    const secondaryTextColor = useThemeColor({ light: '#64748b', dark: '#94a3b8' }, 'text');
    useEffect(() => {
        const fetchPrivacyContent = async () => {
            const regionCode = profile?.region || 'UK'; // Default to UK
            const { data, error } = await supabase
                .from('regions')
                .select('privacy_legislation, privacy_content')
                .eq('code', regionCode)
                .single();

            if (data && !error) {
                if (data.privacy_legislation) setLegislationName(data.privacy_legislation);
                if (data.privacy_content) setRightsContent(data.privacy_content);
            }
        };
        fetchPrivacyContent();
    }, [profile?.region]);

    const sections = [
        {
            title: "1. Information We Collect",
            content: "When you create an account, we collect the following information:\n\n• Email address (for login and account recovery)\n• First and last name (for personalisation)\n• Postcode or location data (to provide local puzzles relevant to your area)\n• Game progress data (guesses, streaks, statistics, and badges)\n• Subscription and purchase information (to manage your Pro subscription)\n\nWe also automatically collect:\n\n• Device identifiers (for analytics, ad serving, and fraud prevention)\n• Crash reports and performance data (to improve app stability)\n• Usage data (how you interact with features, screens, and settings)"
        },
        {
            title: "2. How We Use Your Information",
            content: "We use your information to:\n\n• Provide and maintain the Elementle game service\n• Track your game progress, streaks, badges, and statistics\n• Process and manage subscriptions\n• Serve advertisements (personalised if you consent, contextual otherwise)\n• Monitor app performance and fix crashes\n• Send important service updates (e.g. account or security notifications)"
        },
        {
            title: "3. Data Storage",
            content: "Your data is securely stored using Supabase, a hosted database platform. We retain your account data for as long as your account is active. If you delete your account, your personal data will be removed within 30 days, except where we are required by law to retain it."
        },
        {
            title: "4. Third-Party Services",
            content: "We use the following third-party services that may collect data:\n\n• Google AdMob & AppLovin — Serve advertisements. May collect device identifiers (IDFA), location data, and interaction data for ad targeting and measurement.\n• RevenueCat — Manages subscriptions and in-app purchases. Collects purchase receipts and a user identifier.\n• Sentry — Monitors app crashes and performance. Collects crash logs, device information, and performance metrics. This data is not linked to your identity.\n• Supabase — Stores your account and game data securely.\n\nWhen you grant App Tracking Transparency permission, advertising partners may use your data across apps and websites for targeted advertising."
        },
        {
            title: "5. Optional Data Use (Consent-Based)",
            content: "With your explicit consent, we may share your data with advertising partners to tailor ads to your interests. If you do not consent, you will still see ads, but they will not be personalised. You can change your consent at any time in the Privacy section of Settings."
        },
        {
            title: "6. Data Sharing",
            content: "We do not sell your personal information. We share data only with the third-party services listed in Section 4, solely for the purposes described. Your game statistics may be aggregated and anonymised for leaderboards. We may also disclose information if required by law."
        },
        {
            title: `7. Your Rights (${legislationName})`,
            content: rightsContent
        },
        {
            title: "8. Account Deletion",
            content: "You can delete your account at any time from Settings > Account Info > Delete Account. When you delete your account, we will permanently remove your personal data, game progress, and subscription records within 30 days. Some anonymised, aggregated data (e.g. leaderboard contributions) may be retained."
        },
        {
            title: "9. Children's Privacy",
            content: "Elementle is rated for users aged 13+ and does not knowingly collect personal information from children under 13 (or 16 in the EEA/UK) without parental consent. If you believe a child has provided us with personal data, please contact us and we will delete it promptly."
        },
        {
            title: "10. Contact Us",
            content: "If you have questions about this Privacy Policy or wish to exercise your data rights, please contact us at:\n\nEmail: privacy@dobl.tech\n\nOr through the Feedback section in the app's Settings."
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
                    <ThemedText size="2xl" className="font-n-bold">Privacy Policy</ThemedText>
                    <StyledView className="w-10" />
                </StyledView>
            </SafeAreaView>

            <StyledScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16, paddingBottom: 60 }}>
                <StyledView className="w-full max-w-3xl self-center">
                    {/* Last Updated */}
                    <ThemedText size="sm" style={{ color: secondaryTextColor }} className="mb-6 text-center">
                        Last updated: February 2026
                    </ThemedText>

                    {/* Policy Sections */}
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
