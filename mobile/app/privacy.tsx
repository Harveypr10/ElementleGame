import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { styled } from 'nativewind';
import { ChevronLeft } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useOptions } from '../lib/options';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledScrollView = styled(ScrollView);

export default function PrivacyScreen() {
    const router = useRouter();
    const { textScale } = useOptions();

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
                    <StyledText style={{ fontSize: 20 * textScale }} className="font-n-bold text-slate-900 dark:text-white">Privacy Policy</StyledText>
                    <StyledView className="w-10" />
                </StyledView>
            </SafeAreaView>

            <StyledScrollView className="flex-1 px-4 py-4">
                <StyledView className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700">
                    <StyledText style={{ fontSize: 16 * textScale }} className="text-slate-900 dark:text-white mb-4">
                        Last updated: {new Date().toLocaleDateString()}
                    </StyledText>

                    <StyledText style={{ fontSize: 18 * textScale }} className="font-n-bold text-slate-900 dark:text-white mb-2">
                        Data Collection
                    </StyledText>
                    <StyledText style={{ fontSize: 16 * textScale }} className="text-slate-600 dark:text-slate-400 mb-4">
                        We collect minimal data necessary to provide you with the best experience. This includes your email, game progress, and preferences.
                    </StyledText>

                    <StyledText style={{ fontSize: 18 * textScale }} className="font-n-bold text-slate-900 dark:text-white mb-2">
                        Data Usage
                    </StyledText>
                    <StyledText style={{ fontSize: 16 * textScale }} className="text-slate-600 dark:text-slate-400 mb-4">
                        Your data is used solely to provide and improve our services. We never sell your personal information to third parties.
                    </StyledText>

                    <StyledText style={{ fontSize: 18 * textScale }} className="font-n-bold text-slate-900 dark:text-white mb-2">
                        Contact Us
                    </StyledText>
                    <StyledText style={{ fontSize: 16 * textScale }} className="text-slate-600 dark:text-slate-400">
                        If you have any questions about our privacy policy, please contact us at support@elementle.com
                    </StyledText>
                </StyledView>
            </StyledScrollView>
        </StyledView>
    );
}
