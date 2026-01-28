import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert } from 'react-native';
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
const StyledTextInput = styled(TextInput);

export default function BugReportScreen() {
    const router = useRouter();
    const { textScale } = useOptions();
    const [description, setDescription] = useState('');

    const backgroundColor = useThemeColor({}, 'background');
    const surfaceColor = useThemeColor({}, 'surface');
    const borderColor = useThemeColor({}, 'border');
    const textColor = useThemeColor({}, 'text');
    const iconColor = useThemeColor({}, 'icon');
    const secondaryTextColor = iconColor;

    const handleSubmit = () => {
        if (!description.trim()) {
            Alert.alert('Error', 'Please describe the bug');
            return;
        }
        // TODO: Submit bug report
        Alert.alert('Thank You!', 'Your bug report has been submitted. We\'ll investigate it soon.');
        router.back();
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
                        className="w-10 h-10 items-center justify-center"
                    >
                        <ChevronLeft size={28} color={iconColor} />
                    </StyledTouchableOpacity>
                    <ThemedText baseSize={20} className="font-n-bold">Report a Bug</ThemedText>
                    <StyledView className="w-10" />
                </StyledView>
            </SafeAreaView>

            <StyledScrollView className="flex-1 px-4 py-4">
                <StyledView
                    className="rounded-2xl p-4 mb-3 border"
                    style={{ backgroundColor: surfaceColor, borderColor: borderColor }}
                >
                    <ThemedText baseSize={14} className="font-n-bold mb-2 opacity-60">Describe the Bug</ThemedText>
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
                    className="bg-blue-500 rounded-2xl py-3 px-4 mb-3"
                >
                    <ThemedText baseSize={16} className="text-center font-n-bold text-white">Submit Report</ThemedText>
                </StyledTouchableOpacity>
            </StyledScrollView>
        </ThemedView>
    );
}
