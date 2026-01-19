import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { styled } from 'nativewind';
import { ChevronLeft } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../lib/auth';
import { useProfile } from '../hooks/useProfile';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledScrollView = styled(ScrollView);
const StyledTextInput = styled(TextInput);

export default function AccountInfoScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const { profile } = useProfile();

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
                    <StyledText className="text-xl font-n-bold text-slate-900 dark:text-white">Account Info</StyledText>
                    <StyledView className="w-10" />
                </StyledView>
            </SafeAreaView>

            <StyledScrollView className="flex-1 px-4 py-4">
                {/* Email */}
                <StyledView className="bg-white dark:bg-slate-800 rounded-2xl p-4 mb-3 border border-slate-100 dark:border-slate-700">
                    <StyledText className="text-sm font-n-bold text-slate-500 mb-1">Email</StyledText>
                    <StyledText className="text-base text-slate-900 dark:text-white">{user?.email}</StyledText>
                </StyledView>

                {/* Name */}
                <StyledView className="bg-white dark:bg-slate-800 rounded-2xl p-4 mb-3 border border-slate-100 dark:border-slate-700">
                    <StyledText className="text-sm font-n-bold text-slate-500 mb-2">Name</StyledText>
                    <StyledTextInput
                        className="bg-slate-50 dark:bg-slate-700 rounded-xl px-3 py-2 text-base text-slate-900 dark:text-white mb-2"
                        placeholder="First Name"
                        placeholderTextColor="#94a3b8"
                        value={profile?.first_name || ''}
                        editable={false}
                    />
                    <StyledTextInput
                        className="bg-slate-50 dark:bg-slate-700 rounded-xl px-3 py-2 text-base text-slate-900 dark:text-white"
                        placeholder="Last Name"
                        placeholderTextColor="#94a3b8"
                        value={profile?.last_name || ''}
                        editable={false}
                    />
                </StyledView>

                {/* Region */}
                <StyledView className="bg-white dark:bg-slate-800 rounded-2xl p-4 mb-3 border border-slate-100 dark:border-slate-700">
                    <StyledText className="text-sm font-n-bold text-slate-500 mb-1">Region</StyledText>
                    <StyledText className="text-base text-slate-900 dark:text-white">{profile?.region || 'Not set'}</StyledText>
                </StyledView>

                {/* Update Button */}
                <StyledTouchableOpacity
                    onPress={() => Alert.alert('Edit Profile', 'Profile editing coming soon!')}
                    className="bg-blue-500 rounded-2xl py-3 px-4"
                >
                    <StyledText className="text-center font-n-bold text-white">Edit Profile</StyledText>
                </StyledTouchableOpacity>
            </StyledScrollView>
        </StyledView>
    );
}
