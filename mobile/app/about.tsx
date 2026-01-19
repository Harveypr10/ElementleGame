import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { styled } from 'nativewind';
import { ChevronLeft } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledScrollView = styled(ScrollView);

export default function AboutScreen() {
    const router = useRouter();

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
                    <StyledText className="text-xl font-n-bold text-slate-900 dark:text-white">About</StyledText>
                    <StyledView className="w-10" />
                </StyledView>
            </SafeAreaView>

            <StyledScrollView className="flex-1 px-4 py-4">
                {/* App Info */}
                <StyledView className="bg-white dark:bg-slate-800 rounded-2xl p-4 mb-3 border border-slate-100 dark:border-slate-700">
                    <StyledText className="text-2xl font-n-bold text-center text-slate-900 dark:text-white mb-2">
                        Elementle
                    </StyledText>
                    <StyledText className="text-sm text-center text-slate-500 mb-4">
                        Version {Constants.expoConfig?.version || '1.0.0'}
                    </StyledText>
                    <StyledText className="text-base text-slate-600 dark:text-slate-400 text-center">
                        A daily puzzle game where you guess dates of historical events
                    </StyledText>
                </StyledView>

                {/* Credits */}
                <StyledView className="bg-white dark:bg-slate-800 rounded-2xl p-4 mb-3 border border-slate-100 dark:border-slate-700">
                    <StyledText className="text-sm font-n-bold text-slate-500 uppercase tracking-wide mb-2">Credits</StyledText>
                    <StyledText className="text-base text-slate-900 dark:text-white mb-1">
                        Developed by Elementle Team
                    </StyledText>
                    <StyledText className="text-sm text-slate-500">
                        © {new Date().getFullYear()} Elementle. All rights reserved.
                    </StyledText>
                </StyledView>

                {/* Contact */}
                <StyledView className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700">
                    <StyledText className="text-sm font-n-bold text-slate-500 uppercase tracking-wide mb-2">Contact</StyledText>
                    <StyledText className="text-base text-blue-500">
                        support@elementle.com
                    </StyledText>
                </StyledView>
            </StyledScrollView>
        </StyledView>
    );
}
