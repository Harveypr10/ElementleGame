
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { styled } from 'nativewind';
import { ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { ThemedText } from '../ThemedText';
import { ThemedView } from '../ThemedView';
import { useThemeColor } from '../../hooks/useThemeColor';

const StyledView = styled(View);
const StyledTouchableOpacity = styled(TouchableOpacity);

interface MonthSelectModalProps {
    visible: boolean;
    onClose: () => void;
    currentDate: Date;
    minDate: Date;
    maxDate: Date;
    onSelectDate: (date: Date) => void;
}

export const MonthSelectModal = ({ visible, onClose, currentDate, minDate, maxDate, onSelectDate }: MonthSelectModalProps) => {
    const [viewingYear, setViewingYear] = useState(currentDate.getFullYear());

    // Theme Colors
    const surfaceColor = useThemeColor({}, 'surface');
    const backgroundColor = useThemeColor({}, 'background'); // Not used directly but good to have
    const iconColor = useThemeColor({}, 'icon');
    const textColor = useThemeColor({}, 'text');

    // Manual colors for grid items
    // Slate-50 / Slate-700 equivalent
    const itemBgColor = useThemeColor({ light: '#f8fafc', dark: '#334155' }, 'surface');
    const itemTextColor = useThemeColor({ light: '#334155', dark: '#e2e8f0' }, 'text');
    const disabledTextColor = useThemeColor({ light: '#cbd5e1', dark: '#475569' }, 'text');

    useEffect(() => {
        if (visible) {
            setViewingYear(currentDate.getFullYear());
        }
    }, [visible, currentDate]);

    const minYear = minDate.getFullYear();
    const maxYear = maxDate.getFullYear();

    const handlePrevYear = () => {
        if (viewingYear > minYear) setViewingYear(y => y - 1);
    };

    const handleNextYear = () => {
        if (viewingYear < maxYear) setViewingYear(y => y + 1);
    };

    const months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];

    const currentMonthIndex = currentDate.getFullYear() === viewingYear ? currentDate.getMonth() : -1;

    const isMonthSelectable = (monthIndex: number) => {
        // We only care about Year/Month precision
        if (viewingYear === minYear && monthIndex < minDate.getMonth()) return false;
        if (viewingYear === maxYear && monthIndex > maxDate.getMonth()) return false;
        return true;
    };

    const handleSelectMonth = (monthIndex: number) => {
        const newDate = new Date(viewingYear, monthIndex, 1);
        onSelectDate(newDate);
        onClose();
    };

    const handleReturnToToday = () => {
        onSelectDate(new Date());
        onClose();
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <StyledView className="flex-1 bg-black/50 items-center justify-center p-4">
                {/* Modal Content - explicit style for background color to fix dark mode */}
                <StyledView
                    className="w-full max-w-sm rounded-3xl p-6 shadow-xl relative"
                    style={{ backgroundColor: surfaceColor }}
                >
                    {/* Header */}
                    <StyledView className="flex-row items-center justify-between mb-2">
                        <ThemedText className="font-n-bold" size="xl">
                            Select Month
                        </ThemedText>
                        <StyledTouchableOpacity onPress={onClose} className="p-1">
                            <X size={24} color={iconColor} />
                        </StyledTouchableOpacity>
                    </StyledView>

                    {/* Year Selector */}
                    <StyledView className="flex-row items-center justify-between py-4 mb-2">
                        <StyledTouchableOpacity
                            onPress={handlePrevYear}
                            disabled={viewingYear <= minYear}
                            className={`p-2 rounded-xl border border-slate-100 dark:border-slate-700 ${viewingYear <= minYear ? 'opacity-30' : ''}`}
                            style={{ backgroundColor: itemBgColor }}
                        >
                            <ChevronLeft size={20} color={iconColor} />
                        </StyledTouchableOpacity>

                        <ThemedText className="font-n-bold" size="xl">
                            {viewingYear}
                        </ThemedText>

                        <StyledTouchableOpacity
                            onPress={handleNextYear}
                            disabled={viewingYear >= maxYear}
                            className={`p-2 rounded-xl border border-slate-100 dark:border-slate-700 ${viewingYear >= maxYear ? 'opacity-30' : ''}`}
                            style={{ backgroundColor: itemBgColor }}
                        >
                            <ChevronRight size={20} color={iconColor} />
                        </StyledTouchableOpacity>
                    </StyledView>

                    {/* Month Grid */}
                    <StyledView className="flex-row flex-wrap justify-between gap-y-4">
                        {months.map((m, index) => {
                            const selectable = isMonthSelectable(index);
                            const isSelected = index === currentMonthIndex;

                            return (
                                <StyledView key={m} className="w-[30%]">
                                    <StyledTouchableOpacity
                                        onPress={() => handleSelectMonth(index)}
                                        disabled={!selectable}
                                        className={`py-3 rounded-xl items-center justify-center`}
                                        style={{
                                            backgroundColor: isSelected ? '#3b82f6' : (selectable ? itemBgColor : 'transparent')
                                        }}
                                    >
                                        <ThemedText
                                            className="font-n-medium"
                                            style={{
                                                color: isSelected ? '#ffffff' : (selectable ? itemTextColor : disabledTextColor)
                                            }}
                                            size="base"
                                        >
                                            {m}
                                        </ThemedText>
                                    </StyledTouchableOpacity>
                                </StyledView>
                            );
                        })}
                    </StyledView>

                    {/* Divider */}
                    <StyledView className="h-px w-full my-6 bg-slate-100 dark:bg-slate-700 opacity-50" />

                    {/* Return to Today */}
                    <StyledTouchableOpacity
                        onPress={handleReturnToToday}
                        className="w-full py-3 rounded-full items-center active:opacity-80"
                        style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}
                    >
                        <ThemedText className="font-n-bold text-[#3b82f6]" size="base">
                            Return to today
                        </ThemedText>
                    </StyledTouchableOpacity>

                </StyledView>
            </StyledView>
        </Modal>
    );
};
