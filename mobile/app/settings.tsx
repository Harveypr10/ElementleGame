
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { styled } from 'nativewind';
import { Settings, User as UserIcon, Crown, List, ChevronRight, LogOut, Info, ChevronLeft } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../lib/auth';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledScrollView = styled(ScrollView);
const StyledTouchableOpacity = styled(TouchableOpacity);

export default function SettingsScreen() {
    const router = useRouter();
    const { user, signOut } = useAuth();

    // Mock Subscription State (TODO: Hook up to real subscription logic)
    const isPro = false;

    const handleSignOut = async () => {
        await signOut();
        router.replace('/(auth)/login');
    };

    const MenuItem = ({ icon: Icon, title, subtitle, onPress, isDestructive = false, isProFeature = false }: any) => (
        <StyledTouchableOpacity
            onPress={onPress}
            className={`flex-row items-center p-4 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 active:bg-slate-50 dark:active:bg-slate-700`}
        >
            <StyledView className={`w-10 h-10 rounded-full items-center justify-center mr-4 ${isDestructive ? 'bg-red-50' : 'bg-slate-100 dark:bg-slate-700'}`}>
                <Icon size={20} color={isDestructive ? '#ef4444' : '#64748b'} />
            </StyledView>
            <StyledView className="flex-1">
                <StyledView className="flex-row items-center">
                    <StyledText className={`text-base font-semibold ${isDestructive ? 'text-red-600' : 'text-slate-900 dark:text-white'}`}>
                        {title}
                    </StyledText>
                    {isProFeature && (
                        <StyledView className="ml-2 bg-amber-100 px-2 py-0.5 rounded-full">
                            <StyledText className="text-[10px] font-n-bold text-amber-600">PRO</StyledText>
                        </StyledView>
                    )}
                </StyledView>
                {subtitle && <StyledText className="text-sm text-slate-500 mt-0.5">{subtitle}</StyledText>}
            </StyledView>
            <ChevronRight size={20} color="#cbd5e1" />
        </StyledTouchableOpacity>
    );

    return (
        <StyledView className="flex-1 bg-slate-50 dark:bg-slate-900">
            {/* Header */}
            <SafeAreaView edges={['top']} className="bg-white dark:bg-slate-900 z-50">
                <StyledView className="items-center relative pb-2 bg-white dark:bg-slate-900 z-50">
                    <StyledView className="absolute left-4 top-2">
                        <StyledTouchableOpacity onPress={() => router.back()}>
                            <ChevronLeft size={28} color="#1e293b" />
                        </StyledTouchableOpacity>
                    </StyledView>
                    <StyledText className="text-4xl font-n-bold text-slate-900 dark:text-white mb-6 pt-2 font-heading">
                        Settings
                    </StyledText>
                </StyledView>
            </SafeAreaView>

            <StyledScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>

                {/* Account Section */}
                <StyledText className="px-6 py-2 text-sm font-n-bold text-slate-500 uppercase mt-6">Account</StyledText>
                <StyledView className="bg-white dark:bg-slate-800 border-y border-slate-100 dark:border-slate-700">
                    <MenuItem
                        icon={UserIcon}
                        title="Profile"
                        subtitle={user?.email}
                        onPress={() => router.push('/settings/account-info')}
                    />
                    <MenuItem
                        icon={Crown}
                        title="Subscription"
                        subtitle={isPro ? "Elementle Pro Active" : "Standard Plan"}
                        onPress={() => Alert.alert("Subscription", "Subscription management coming soon!")}
                    />
                </StyledView>

                {/* Game Settings */}
                <StyledText className="px-6 py-2 text-sm font-n-bold text-slate-500 uppercase mt-6">Game</StyledText>
                <StyledView className="bg-white dark:bg-slate-800 border-y border-slate-100 dark:border-slate-700">
                    <MenuItem
                        icon={Settings}
                        title="Game Options"
                        subtitle="Theme, Sound, Date Format"
                        onPress={() => router.push('/(tabs)/options')}
                    />
                    <MenuItem
                        icon={List}
                        title="Categories"
                        subtitle="Customize puzzle topics"
                        isProFeature={true}
                        onPress={() => isPro
                            ? Alert.alert("Categories", "Category selection")
                            : Alert.alert("Pro Feature", "Upgrade to Pro to customize categories.")
                        }
                    />
                </StyledView>

                {/* Support */}
                <StyledText className="px-6 py-2 text-sm font-n-bold text-slate-500 uppercase mt-6">Support</StyledText>
                <StyledView className="bg-white dark:bg-slate-800 border-y border-slate-100 dark:border-slate-700">
                    <MenuItem
                        icon={Info}
                        title="About Elementle"
                        subtitle="Version 2.0.0 (Native)"
                        onPress={() => { }}
                    />
                    <MenuItem
                        icon={LogOut}
                        title="Sign Out"
                        isDestructive={true}
                        onPress={() => Alert.alert(
                            "Sign Out",
                            "Are you sure you want to sign out?",
                            [
                                { text: "Cancel", style: "cancel" },
                                { text: "Sign Out", style: "destructive", onPress: handleSignOut }
                            ]
                        )}
                    />
                </StyledView>

                <StyledView className="items-center mt-8">
                    <StyledText className="text-slate-400 text-xs text-center">
                        Elementle © 2026{'\n'}
                        Made with ❤️ by Agent
                    </StyledText>
                </StyledView>

            </StyledScrollView>
        </StyledView>
    );
}
