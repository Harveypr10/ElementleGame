import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { styled } from 'nativewind';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Play, Box } from 'lucide-react-native';

// Import components to test
import { StreakSaverPopup, StreakSaverCloseAction } from '../../../../components/game/StreakSaverPopup';
import { HolidayModePopup } from '../../../../components/game/HolidayModePopup';
import { BadgeUnlockModal } from '../../../../components/game/BadgeUnlockModal';
import { StreakCelebration } from '../../../../components/game/StreakCelebration';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);

export default function GalleryScreen() {
    const router = useRouter();

    // Test States
    const [view, setView] = useState<string | null>(null);
    const [streakCount, setStreakCount] = useState(10);

    // Badge Test Data
    const testBadge = {
        name: 'Time Traveler',
        description: 'You played 7 days in a row! Amazing consistency.',
        category: 'streak',
        threshold: 7
    };

    const closeAll = () => setView(null);

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
                        UI Gallery
                    </StyledText>
                    <StyledView className="w-10" />
                </StyledView>
            </SafeAreaView>

            <ScrollView className="flex-1 p-4">
                <StyledText className="text-sm font-bold text-slate-400 mb-4 uppercase tracking-wider">
                    Game Popups
                </StyledText>

                <GalleryItem
                    title="Streak Saver (Region)"
                    description="Popup shown when a region streak is broken."
                    onPress={() => setView('streak-region')}
                />

                <GalleryItem
                    title="Streak Saver (User)"
                    description="Popup shown when a personal streak is broken."
                    onPress={() => setView('streak-user')}
                />

                <GalleryItem
                    title="Holiday Mode"
                    description="Popup to activate holiday mode."
                    onPress={() => setView('holiday')}
                />

                <GalleryItem
                    title="Badge Unlocked"
                    description="Celebration modal for new badge."
                    onPress={() => setView('badge')}
                />

                <GalleryItem
                    title="Streak Celebration"
                    description="Confetti and hamster for streak increment."
                    onPress={() => setView('celebration')}
                />

                <StyledText className="text-sm font-bold text-slate-400 mb-4 mt-6 uppercase tracking-wider">
                    Screens
                </StyledText>

                <GalleryItem
                    title="Question Generation"
                    description="Loading screen with hamster animation. (Preview Mode)"
                    onPress={() => router.push('/(auth)/generating-questions?preview=true')}
                    icon={<Play size={20} color="#2563eb" />}
                />

            </ScrollView>

            {/* --- COMPONENT RENDERING --- */}

            {/* Streak Saver - Region */}
            <StreakSaverPopup
                visible={view === 'streak-region'}
                onClose={() => closeAll()}
                gameType="REGION"
                currentStreak={streakCount}
                showCloseButton
            />

            {/* Streak Saver - User */}
            <StreakSaverPopup
                visible={view === 'streak-user'}
                onClose={() => closeAll()}
                gameType="USER"
                currentStreak={streakCount}
                showCloseButton
            />

            {/* Holiday Mode */}
            <HolidayModePopup
                visible={view === 'holiday'}
                onClose={() => closeAll()}
                currentStreak={streakCount}
                gameType="REGION"
                showCloseButton
            />

            {/* Badge Unlock */}
            <BadgeUnlockModal
                visible={view === 'badge'}
                badge={testBadge}
                onClose={() => closeAll()}
                showCloseButton
                gameMode="REGION"
            />

            {/* Streak Celebration */}
            <StreakCelebration
                visible={view === 'celebration'}
                streak={streakCount}
                onClose={() => closeAll()}
                showCloseButton
            />

        </StyledView>
    );
}

function GalleryItem({ title, description, onPress, icon }: any) {
    return (
        <StyledTouchableOpacity
            onPress={onPress}
            className="flex-row items-center bg-white dark:bg-slate-800 p-4 mb-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm active:bg-slate-50 dark:active:bg-slate-700"
        >
            <StyledView className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 items-center justify-center mr-4">
                {icon || <Box size={20} color="#64748b" />}
            </StyledView>
            <StyledView className="flex-1">
                <StyledText className="text-base font-n-bold text-slate-900 dark:text-white">
                    {title}
                </StyledText>
                <StyledText className="text-xs text-slate-500 mt-0.5">
                    {description}
                </StyledText>
            </StyledView>
        </StyledTouchableOpacity>
    );
}
