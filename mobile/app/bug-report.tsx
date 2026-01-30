import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { styled } from 'nativewind';
import { ChevronLeft } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useOptions } from '../lib/options';
import { useAuth } from '../lib/auth';

import { ThemedText } from '../components/ThemedText';
import { ThemedView } from '../components/ThemedView';
import { useThemeColor } from '../hooks/useThemeColor';

const StyledView = styled(View);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledScrollView = styled(ScrollView);
const StyledTextInput = styled(TextInput);

export default function BugReportScreen() {
    const router = useRouter();
    const { textScale } = useOptions();
    const { user } = useAuth();
    const [description, setDescription] = useState('');

    const backgroundColor = useThemeColor({}, 'background');
    const surfaceColor = useThemeColor({}, 'surface');
    const borderColor = useThemeColor({}, 'border');
    const textColor = useThemeColor({}, 'text');
    const iconColor = useThemeColor({}, 'icon');

    const handleSubmit = async () => {
        if (!description.trim()) {
            Alert.alert('Error', 'Please describe the bug');
            return;
        }

        const userEmail = user?.email || 'Anonymous';
        const subject = 'Bug Report - Elementle';
        const body = `Report from: ${userEmail}\n\nDescription:\n${description}`;
        const mailtoUrl = `mailto:no-reply@dobl.uk?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

        try {
            const canOpen = await Linking.canOpenURL(mailtoUrl);
            if (canOpen) {
                await Linking.openURL(mailtoUrl);
                Alert.alert('Opening Mail', 'Redirecting to your email app to send report.');
            } else {
                Alert.alert('Error', 'Could not open email client. Please email us at no-reply@dobl.uk');
            }
        } catch (error) {
            console.error('Error opening email:', error);
            Alert.alert('Error', 'An unexpected error occurred.');
        }
    };

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
                    <ThemedText size="2xl" className="font-n-bold">Report a Bug</ThemedText>
                    <StyledView className="w-10" />
                </StyledView>
            </SafeAreaView>

            <StyledScrollView className="flex-1 px-4 py-4">
                <StyledView
                    className="rounded-2xl p-4 mb-4 border"
                    style={{ backgroundColor: surfaceColor, borderColor: borderColor }}
                >
                    <ThemedText size="base" className="font-n-bold mb-2 opacity-60">Describe the Bug</ThemedText>
                    <StyledTextInput
                        style={{
                            fontSize: 16 * textScale,
                            backgroundColor: backgroundColor,
                            color: textColor
                        }}
                        className="rounded-xl px-3 py-3 min-h-[120px]"
                        placeholder="What went wrong? Please provide as much detail as possible..."
                        placeholderTextColor="#94a3b8"
                        value={description}
                        onChangeText={setDescription}
                        multiline
                        textAlignVertical="top"
                    />
                </StyledView>

                <StyledTouchableOpacity
                    onPress={handleSubmit}
                    className="bg-blue-500 rounded-2xl py-3 px-4 shadow-sm"
                >
                    <ThemedText size="lg" className="text-center font-n-bold text-white">Submit Report</ThemedText>
                </StyledTouchableOpacity>

                <ThemedText size="sm" className="text-center mt-4 opacity-50">
                    This will open your default email app.
                </ThemedText>
            </StyledScrollView>
        </ThemedView>
    );
}
