import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { styled } from 'nativewind';
import { ChevronLeft } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useOptions } from '../lib/options';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledScrollView = styled(ScrollView);
const StyledTextInput = styled(TextInput);

export default function BugReportScreen() {
    const router = useRouter();
    const { textScale } = useOptions();
    const [description, setDescription] = useState('');

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
        <StyledView className="flex-1 bg-white dark:bg-slate-900">
            <SafeAreaView edges={['top']} className="bg-white dark:bg-slate-900">
                <StyledView className="flex-row items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                    <StyledTouchableOpacity
                        onPress={() => router.back()}
                        className="w-10 h-10 items-center justify-center"
                    >
                        <ChevronLeft size={28} color="#1e293b" />
                    </StyledTouchableOpacity>
                    <StyledText style={{ fontSize: 20 * textScale }} className="font-n-bold text-slate-900 dark:text-white">Report a Bug</StyledText>
                    <StyledView className="w-10" />
                </StyledView>
            </SafeAreaView>

            <StyledScrollView className="flex-1 px-4 py-4">
                <StyledView className="bg-white dark:bg-slate-800 rounded-2xl p-4 mb-3 border border-slate-100 dark:border-slate-700">
                    <StyledText style={{ fontSize: 14 * textScale }} className="font-n-bold text-slate-500 mb-2">Describe the Bug</StyledText>
                    <StyledTextInput
                        style={{ fontSize: 16 * textScale }}
                        className="bg-slate-50 dark:bg-slate-700 rounded-xl px-3 py-3 text-slate-900 dark:text-white min-h-[120px]"
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
                    <StyledText style={{ fontSize: 16 * textScale }} className="text-center font-n-bold text-white">Submit Report</StyledText>
                </StyledTouchableOpacity>
            </StyledScrollView>
        </StyledView>
    );
}
