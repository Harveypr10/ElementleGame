import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { styled } from 'nativewind';
import { ChevronLeft, Square, CheckSquare } from 'lucide-react-native';
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
    const { profile, adsConsent, updateProfile, isUpdating } = useProfile();
    const [toggling, setToggling] = useState(false);

    // Dynamic privacy content state
    const [legislationName, setLegislationName] = useState('Data Protection Laws');
    const [rightsContent, setRightsContent] = useState('Loading your rights...');

    const surfaceColor = useThemeColor({}, 'surface');
    const borderColor = useThemeColor({}, 'border');
    const iconColor = useThemeColor({}, 'icon');
    const secondaryTextColor = useThemeColor({ light: '#64748b', dark: '#94a3b8' }, 'text');
    const tintColor = useThemeColor({}, 'tint');

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

    const handleToggleConsent = async () => {
        setToggling(true);
        try {
            await updateProfile({ ads_consent: !adsConsent });
        } catch (error) {
            console.error('Failed to update ads consent', error);
            Alert.alert('Error', 'Failed to update settings. Please try again.');
        } finally {
            setToggling(false);
        }
    };

    const sections = [
        {
            title: "1. Information We Collect",
            content: "When you create an account, we collect the following information as part of providing the game service:\n• Email address\n• First and last name\n• Postcode (used to create questions relevant to your local area)\n• Game progress and guess data"
        },
        {
            title: "2. How We Use Your Information",
            content: "We use your information to:\n• Provide and maintain the Elementle game service\n• Track your game progress, guesses, and statistics to power features such as streaks and leaderboards\n• Send important service updates (e.g. account or security notifications)"
        },
        {
            title: "3. Data Storage",
            content: "Your data is securely stored using Supabase, a trusted database platform. We retain your data only as long as necessary to provide the service or comply with legal obligations."
        },
        {
            title: "4. Optional Data Use",
            content: "With your explicit consent, we may also use your data to tailor advertising and promotional content to your interests. This consent is optional and not required to play the game."
        },
        {
            title: "5. Data Sharing",
            content: "We do not sell, trade, or otherwise transfer your personal information to third parties. Your game statistics may be aggregated and anonymised for global leaderboards. Advertising partners will only receive data if you have explicitly opted in."
        },
        {
            title: `6. Your Rights (${legislationName})`,
            content: rightsContent
        },
        {
            title: "7. Contact Us",
            content: "If you have questions about this Privacy Policy or your data rights, please contact us through the Feedback section in Settings."
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
                        Last updated: October 2025
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

                    {/* Consent Checkbox (Subtle at bottom) */}
                    <StyledTouchableOpacity
                        onPress={handleToggleConsent}
                        disabled={toggling || isUpdating}
                        className="flex-row items-start px-2 mb-8 opacity-80 active:opacity-100"
                    >
                        <StyledView className="mr-3 mt-1">
                            {adsConsent ? (
                                <CheckSquare size={24} color={tintColor} />
                            ) : (
                                <Square size={24} color={secondaryTextColor} />
                            )}
                        </StyledView>
                        <StyledView className="flex-1">
                            <ThemedText size="sm" style={{ color: secondaryTextColor }} className="leading-5">
                                I consent to my data being used to tailor ads. <ThemedText className="font-n-bold" size="sm">If you do not consent, your ads will not be tailored.</ThemedText>
                            </ThemedText>
                        </StyledView>
                    </StyledTouchableOpacity>

                </StyledView>

            </StyledScrollView>
        </ThemedView>
    );
}
