import React from 'react';
import { View, Text, TouchableOpacity, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { styled } from 'nativewind';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ArrowRight } from 'lucide-react-native';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);

const ROUTES = [
    { name: 'Landing (Onboarding)', path: '/(auth)/onboarding' },
    { name: 'Login', path: '/(auth)/login' },
    { name: 'Subscription Flow', path: '/(auth)/subscription-flow' },
    { name: 'Personalise', path: '/(auth)/personalise' },
    { name: 'Category Selection', path: '/(auth)/category-selection' },
    { name: 'Home', path: '/(tabs)/' },
    { name: 'Settings', path: '/(tabs)/settings' },
    { name: 'Profile', path: '/(tabs)/profile' },
    { name: 'Stats', path: '/(tabs)/stats' },
    { name: 'Admin Dashboard', path: '/(tabs)/settings/admin' },
    { name: 'UI Gallery (Debug)', path: '/(tabs)/settings/admin/gallery' },
];

export default function NavigatorScreen() {
    const router = useRouter();

    return (
        <StyledView className="flex-1 bg-white dark:bg-slate-900">
            <SafeAreaView edges={['top']} className="bg-white dark:bg-slate-900">
                <StyledView className="flex-row items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
                    <StyledTouchableOpacity
                        onPress={() => router.back()}
                        className="w-10 h-10 items-center justify-center -ml-2"
                    >
                        <ChevronLeft size={28} color="#1e293b" />
                    </StyledTouchableOpacity>
                    <StyledText className="text-xl font-n-bold text-slate-900 dark:text-white">
                        Route Navigator
                    </StyledText>
                    <StyledView className="w-10" />
                </StyledView>
            </SafeAreaView>

            <FlatList
                data={ROUTES}
                keyExtractor={(item) => item.path}
                contentContainerStyle={{ padding: 16 }}
                renderItem={({ item }) => (
                    <StyledTouchableOpacity
                        onPress={() => router.push(item.path)}
                        className="flex-row items-center justify-between bg-white dark:bg-slate-800 p-4 mb-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm"
                    >
                        <StyledView>
                            <StyledText className="text-base font-n-bold text-slate-900 dark:text-white">
                                {item.name}
                            </StyledText>
                            <StyledText className="text-xs text-slate-400">
                                {item.path}
                            </StyledText>
                        </StyledView>
                        <ArrowRight size={20} className="text-slate-400" />
                    </StyledTouchableOpacity>
                )}
            />
        </StyledView>
    );
}
