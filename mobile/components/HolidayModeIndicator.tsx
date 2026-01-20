import React from 'react';
import { View, Text } from 'react-native';
import { styled } from 'nativewind';
import { useStreakSaverStatus } from '../hooks/useStreakSaverStatus';

const StyledView = styled(View);
const StyledText = styled(Text);

export function HolidayModeIndicator() {
    const { holidayActive, holidayEndDate } = useStreakSaverStatus();

    if (!holidayActive || !holidayEndDate) return null;

    // Calculate days remaining
    const today = new Date();
    const endDate = new Date(holidayEndDate);
    const diffTime = endDate.getTime() - today.getTime();
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (daysRemaining < 0) return null; // Holiday has ended

    return (
        <StyledView className="bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 p-4 rounded-xl mb-4">
            <StyledView className="flex-row items-center justify-center gap-2">
                <StyledText className="text-2xl">🏖️</StyledText>
                <StyledView className="flex-1">
                    <StyledText className="text-blue-900 dark:text-blue-100 font-n-bold text-base">
                        Holiday Mode Active
                    </StyledText>
                    <StyledText className="text-blue-700 dark:text-blue-200 font-n-medium text-sm">
                        {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} remaining • Your streak is protected
                    </StyledText>
                </StyledView>
            </StyledView>
        </StyledView>
    );
}
