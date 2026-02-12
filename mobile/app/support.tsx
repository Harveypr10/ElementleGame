import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, Linking } from 'react-native';
import { styled } from 'nativewind';
import { ChevronLeft } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { ThemedText } from '../components/ThemedText';
import { ThemedView } from '../components/ThemedView';
import { useThemeColor } from '../hooks/useThemeColor';
import { useOptions } from '../lib/options';
import { useAuth } from '../lib/auth';

const StyledView = styled(View);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledScrollView = styled(ScrollView);
const StyledTextInput = styled(TextInput);

export default function SupportScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const { textScale } = useOptions();

    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const surfaceColor = useThemeColor({}, 'surface');
    const borderColor = useThemeColor({}, 'border');
    const backgroundColor = useThemeColor({}, 'background');
    const textColor = useThemeColor({}, 'text');
    const iconColor = useThemeColor({}, 'icon');

    const handleSubmit = async () => {
        if (!message.trim()) {
            Alert.alert('Required', 'Please describe how we can help.');
            return;
        }

        setIsSubmitting(true);
        try {
            const userEmail = user?.email || 'Not logged in';
            const subject = 'Elementle Support';
            const body = `From: ${userEmail}\n\n${message}`;
            const mailtoUrl = `mailto:support@dobl.uk?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

            await Linking.openURL(mailtoUrl);
        } catch (error: any) {
            console.error('Error opening email:', error);
            Alert.alert('Error', 'Could not open email client. Please email us at support@dobl.uk');
        } finally {
            setIsSubmitting(false);
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
                    <ThemedText size="2xl" className="font-n-bold">Support</ThemedText>
                    <StyledView className="w-10" />
                </StyledView>
            </SafeAreaView>

            <StyledScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16 }}>
                <StyledView className="w-full max-w-3xl self-center">
                    {/* Message */}
                    <StyledView
                        className="rounded-2xl p-4 mb-4 border"
                        style={{ backgroundColor: surfaceColor, borderColor }}
                    >
                        <ThemedText size="base" className="font-n-bold mb-2 opacity-60">How can we help?</ThemedText>
                        <StyledTextInput
                            style={{
                                fontSize: 16 * textScale,
                                backgroundColor,
                                color: textColor
                            }}
                            className="rounded-xl px-3 py-3 min-h-[120px]"
                            placeholder="Describe your issue or question..."
                            placeholderTextColor="#94a3b8"
                            value={message}
                            onChangeText={setMessage}
                            multiline
                            textAlignVertical="top"
                        />
                    </StyledView>

                    <StyledTouchableOpacity
                        onPress={handleSubmit}
                        disabled={isSubmitting}
                        className={`bg-blue-500 rounded-2xl py-3 px-4 shadow-sm ${isSubmitting ? 'opacity-70' : ''}`}
                    >
                        <ThemedText size="lg" className="text-center font-n-bold text-white">
                            {isSubmitting ? 'Opening Email...' : 'Contact Support'}
                        </ThemedText>
                    </StyledTouchableOpacity>

                    <ThemedText size="sm" className="text-center mt-4 opacity-50">
                        This will open your default email app.
                    </ThemedText>
                </StyledView>
            </StyledScrollView>
        </ThemedView>
    );
}
