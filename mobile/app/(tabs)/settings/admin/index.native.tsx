import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { styled } from 'nativewind';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Shield, Clock, CalendarClock, Zap, Layers, ChevronRight } from 'lucide-react-native';
import { useOptions } from '../../../../lib/options';
import { useProfile } from '../../../../hooks/useProfile';
import DebugControlPanel from '../../../../components/admin/DebugControlPanel';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledScrollView = styled(ScrollView);

export default function AdminDashboard() {
    const router = useRouter();
    const { textScale } = useOptions();
    const { isAdmin, isLoading } = useProfile();

    // Security Check
    React.useEffect(() => {
        if (!isLoading && !isAdmin) {
            router.replace('/');
        }
    }, [isAdmin, isLoading]);

    if (isLoading || !isAdmin) {
        return (
            <StyledView className="flex-1 bg-white dark:bg-slate-900 items-center justify-center">
                <StyledText className="text-slate-500">Loading...</StyledText>
            </StyledView>
        );
    }

    const menuItems = [
        {
            title: "Restrictions",
            subtitle: "Manage postcode and category change limits",
            icon: Shield,
            color: "#dc2626", // Red
            route: "/settings/admin/restrictions"
        },
        {
            title: "Subscription Tiers",
            subtitle: "Manage visibility of subscription tiers",
            icon: Zap,
            color: "#9333ea", // Purple
            route: "/settings/admin/tiers"
        },
        {
            title: "Demand Scheduler",
            subtitle: "Configure demand calculation frequency",
            icon: CalendarClock,
            color: "#2563eb", // Blue
            route: "/settings/admin/scheduler"
        },
        {
            title: "Screen Navigator",
            subtitle: "Test various specialized screens (Debug)",
            icon: Layers,
            color: "#475569", // Slate
            route: "/settings/admin/navigator" // I might need to build this too
        }
    ];

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
                        Admin Dashboard
                    </StyledText>
                    <StyledView className="w-8" />
                </StyledView>
            </SafeAreaView>

            <StyledScrollView className="flex-1 p-4">
                <StyledText className="text-sm font-n-bold text-slate-500 uppercase tracking-wide mb-4">
                    Management Tools
                </StyledText>

                {menuItems.map((item, index) => (
                    <StyledTouchableOpacity
                        key={index}
                        onPress={() => router.push(item.route)}
                        className="flex-row items-center bg-white dark:bg-slate-800 p-4 rounded-2xl mb-3 border border-slate-100 dark:border-slate-700 shadow-sm"
                    >
                        <StyledView
                            className="w-12 h-12 rounded-full items-center justify-center mr-4"
                            style={{ backgroundColor: `${item.color}20` }} // 20% opacity using hex
                        >
                            <item.icon size={24} color={item.color} />
                        </StyledView>

                        <StyledView className="flex-1">
                            <StyledText
                                style={{ fontSize: 16 * textScale }}
                                className="font-n-bold text-slate-900 dark:text-white"
                            >
                                {item.title}
                            </StyledText>
                            <StyledText
                                style={{ fontSize: 13 * textScale }}
                                className="text-slate-500 dark:text-slate-400 mt-0.5"
                            >
                                {item.subtitle}
                            </StyledText>
                        </StyledView>

                        <ChevronRight size={20} color="#94a3b8" />
                    </StyledTouchableOpacity>
                ))}

                {/* Debug Actions Section */}
                <StyledText className="text-sm font-n-bold text-slate-500 uppercase tracking-wide mb-4 mt-8">
                    Debug Actions
                </StyledText>

                <DebugControlPanel />

            </StyledScrollView>
        </StyledView>
    );
}
