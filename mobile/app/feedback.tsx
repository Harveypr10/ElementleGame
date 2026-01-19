import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { styled } from 'nativewind';
import { ChevronLeft } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledScrollView = styled(ScrollView);
const StyledTextInput = styled(TextInput);

export default function FeedbackScreen() {
    const router = useRouter();
    const [feedback, setFeedback] = useState('');
    const [selectedType, setSelectedType] = useState<'feature' | 'general' | 'praise'>('general');

    const handleSubmit = () => {
        if (!feedback.trim()) {
            Alert.alert('Error', 'Please enter your feedback');
            return;
        }
        // TODO: Submit feedback
        Alert.alert('Thank You!', 'Your feedback has been submitted. We appreciate your input!');
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
                        <ChevronLeft size={24} color="#1e293b" />
                    </StyledTouchableOpacity>
                    <StyledText className="text-xl font-n-bold text-slate-900 dark:text-white">Feedback</StyledText>
                    <StyledView className="w-10" />
                </StyledView>
            </SafeAreaView>

            <StyledScrollView className="flex-1 px-4 py-4">
                {/* Feedback Type */}
                <StyledView className="bg-white dark:bg-slate-800 rounded-2xl p-4 mb-3 border border-slate-100 dark:border-slate-700">
                    <StyledText className="text-sm font-n-bold text-slate-500 mb-2">Feedback Type</StyledText>
                    <StyledView className="flex-row gap-2">
                        {[
                            { value: 'feature' as const, label: 'Feature Request' },
                            { value: 'general' as const, label: 'General' },
                            { value: 'praise' as const, label: 'Praise' },
                        ].map((type) => (
                            <StyledTouchableOpacity
                                key={type.value}
                                onPress={() => setSelectedType(type.value)}
                                className={`flex-1 py-2 rounded-xl border items-center justify-center ${selectedType === type.value
                                        ? 'bg-blue-500 border-blue-500'
                                        : 'bg-white border-slate-200 dark:bg-slate-700 dark:border-slate-600'
                                    }`}
                            >
                                <StyledText className={`font-n-semibold text-sm ${selectedType === type.value ? 'text-white' : 'text-slate-600 dark:text-slate-300'
                                    }`}>
                                    {type.label}
                                </StyledText>
                            </StyledTouchableOpacity>
                        ))}
                    </StyledView>
                </StyledView>

                {/* Feedback Text */}
                <StyledView className="bg-white dark:bg-slate-800 rounded-2xl p-4 mb-3 border border-slate-100 dark:border-slate-700">
                    <StyledText className="text-sm font-n-bold text-slate-500 mb-2">Your Feedback</StyledText>
                    <StyledTextInput
                        className="bg-slate-50 dark:bg-slate-700 rounded-xl px-3 py-3 text-base text-slate-900 dark:text-white min-h-[120px]"
                        placeholder="Tell us what you think..."
                        placeholderTextColor="#94a3b8"
                        value={feedback}
                        onChangeText={setFeedback}
                        multiline
                        textAlignVertical="top"
                    />
                </StyledView>

                <StyledTouchableOpacity
                    onPress={handleSubmit}
                    className="bg-blue-500 rounded-2xl py-3 px-4"
                >
                    <StyledText className="text-center font-n-bold text-white">Submit Feedback</StyledText>
                </StyledTouchableOpacity>
            </StyledScrollView>
        </StyledView>
    );
}
