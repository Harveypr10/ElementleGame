import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert } from 'react-native';
import { styled } from 'nativewind';
import { ChevronLeft } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBugReportLogic } from '../hooks/useBugReportLogic';

import { ThemedText } from '../components/ThemedText';
import { ThemedView } from '../components/ThemedView';

const StyledView = styled(View);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledScrollView = styled(ScrollView);
const StyledTextInput = styled(TextInput);

export default function BugReportScreen() {
    const {
        description,
        setDescription,
        isSubmitting,
        submitBugReport,
        goBack,
        textScale,
        colors
    } = useBugReportLogic();

    const handlePressSubmit = async () => {
        const result = await submitBugReport();
        if (!result.success && result.error) {
            Alert.alert('Error', result.error);
        } else if (result.success && result.message) {
            // Success
            Alert.alert('Opening Mail', result.message);
        }
    };

    return (
        <ThemedView className="flex-1">
            <SafeAreaView edges={['top']} style={{ backgroundColor: colors.surface }}>
                <StyledView
                    className="flex-row items-center justify-between px-4 py-3"
                    style={{ backgroundColor: colors.surface }}
                >
                    <StyledTouchableOpacity
                        onPress={goBack}
                        className="w-10 h-10 items-center justify-center p-2"
                    >
                        <ChevronLeft size={28} color={colors.icon} />
                    </StyledTouchableOpacity>
                    <ThemedText size="2xl" className="font-n-bold">Report a Bug</ThemedText>
                    <StyledView className="w-10" />
                </StyledView>
            </SafeAreaView>

            <StyledScrollView className="flex-1 px-4 py-4">
                <StyledView className="w-full max-w-3xl self-center">
                    <StyledView
                        className="rounded-2xl p-4 mb-4 border"
                        style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                    >
                        <ThemedText size="base" className="font-n-bold mb-2 opacity-60">Describe the Bug</ThemedText>
                        <StyledTextInput
                            style={{
                                fontSize: 16 * textScale,
                                backgroundColor: colors.background,
                                color: colors.text
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
                        onPress={handlePressSubmit}
                        disabled={isSubmitting}
                        className={`bg-blue-500 rounded-2xl py-3 px-4 shadow-sm ${isSubmitting ? 'opacity-70' : ''}`}
                    >
                        <ThemedText size="lg" className="text-center font-n-bold text-white">
                            {isSubmitting ? 'Opening Link...' : 'Submit Report'}
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
