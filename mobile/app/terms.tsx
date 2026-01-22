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

export default function TermsScreen() {
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
                    <StyledText style={{ fontSize: 20 * textScale }} className="font-n-bold text-slate-900 dark:text-white">Terms of Service</StyledText>
                    <StyledView className="w-10" />
                </StyledView>
            </SafeAreaView>

            <StyledScrollView className="flex-1 px-4 py-4">
                <StyledView className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700">
                    <StyledText style={{ fontSize: 16 * textScale }} className="text-slate-900 dark:text-white mb-4">
                        Last updated: {new Date().toLocaleDateString()}
                    </StyledText>

                    <StyledText style={{ fontSize: 18 * textScale }} className="font-n-bold text-slate-900 dark:text-white mb-2">
                        Acceptance of Terms
                    </StyledText>
                    <StyledText style={{ fontSize: 16 * textScale }} className="text-slate-600 dark:text-slate-400 mb-4">
                        By accessing and using Elementle, you accept and agree to be bound by the terms and provision of this agreement.
                    </StyledText>

                    <StyledText style={{ fontSize: 18 * textScale }} className="font-n-bold text-slate-900 dark:text-white mb-2">
                        Use License
                    </StyledText>
                    <StyledText style={{ fontSize: 16 * textScale }} className="text-slate-600 dark:text-slate-400 mb-4">
                        Permission is granted to temporarily use Elementle for personal, non-commercial use only.
                    </StyledText>

                    <StyledText style={{ fontSize: 18 * textScale }} className="font-n-bold text-slate-900 dark:text-white mb-2">
                        Contact
                    </StyledText>
                    <StyledText style={{ fontSize: 16 * textScale }} className="text-slate-600 dark:text-slate-400">
                        For questions about these terms, please contact support@elementle.com
                    </StyledText>
                </StyledView>
            </StyledScrollView>
        </StyledView>
    );
}
