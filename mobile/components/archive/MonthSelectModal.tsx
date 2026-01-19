
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { styled } from 'nativewind';
import { ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { eachMonthOfInterval, format, setMonth, setYear, startOfYear, endOfYear, getYear, getMonth } from 'date-fns';

const StyledView = styled(View);
const StyledText = styled(Text);
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

    // Check if month is selectable (within min/max date range)
    const isMonthSelectable = (monthIndex: number) => {
        const d = new Date(viewingYear, monthIndex, 1);
        // We only care about Year/Month precision
        // If viewingYear == minYear, month must be >= minDate.month
        if (viewingYear === minYear && monthIndex < minDate.getMonth()) return false;
        // If viewingYear == maxYear, month must be <= maxDate.month
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
                <StyledView className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-3xl p-6 shadow-xl relative">
                    {/* Header */}
                    <StyledView className="flex-row items-center justify-between mb-2">
                        <StyledText className="text-xl font-n-bold text-slate-900 dark:text-white">
                            Select Month
                        </StyledText>
                        <StyledTouchableOpacity onPress={onClose} className="p-1">
                            <X size={24} color="#94a3b8" />
                        </StyledTouchableOpacity>
                    </StyledView>

                    {/* Year Selector */}
                    <StyledView className="flex-row items-center justify-between py-4 mb-2">
                        <StyledTouchableOpacity
                            onPress={handlePrevYear}
                            disabled={viewingYear <= minYear}
                            className={`p-2 rounded-xl bg-slate-50 dark:bg-slate-700 ${viewingYear <= minYear ? 'opacity-30' : ''}`}
                        >
                            <ChevronLeft size={20} className="text-slate-600 dark:text-slate-300" color="#64748b" />
                        </StyledTouchableOpacity>

                        <StyledText className="text-xl font-n-bold text-slate-900 dark:text-white">
                            {viewingYear}
                        </StyledText>

                        <StyledTouchableOpacity
                            onPress={handleNextYear}
                            disabled={viewingYear >= maxYear}
                            className={`p-2 rounded-xl bg-slate-50 dark:bg-slate-700 ${viewingYear >= maxYear ? 'opacity-30' : ''}`}
                        >
                            <ChevronRight size={20} className="text-slate-600 dark:text-slate-300" color="#64748b" />
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
                                        className={`py-3 rounded-xl items-center justify-center 
                                            ${isSelected ? 'bg-blue-500' : (selectable ? 'bg-slate-50 dark:bg-slate-700' : 'bg-transparent')}
                                        `}
                                    >
                                        <StyledText className={`font-n-medium 
                                            ${isSelected ? 'text-white' : (selectable ? 'text-slate-700 dark:text-slate-200' : 'text-slate-300 dark:text-slate-600')}
                                        `}>
                                            {m}
                                        </StyledText>
                                    </StyledTouchableOpacity>
                                </StyledView>
                            );
                        })}
                    </StyledView>

                    {/* Divider */}
                    <StyledView className="h-px bg-slate-100 dark:bg-slate-700 my-6" />

                    {/* Return to Today */}
                    <StyledTouchableOpacity
                        onPress={handleReturnToToday}
                        className="bg-blue-50 dark:bg-blue-900/30 py-3 rounded-full items-center"
                    >
                        <StyledText className="text-blue-500 font-n-bold">
                            Return to today
                        </StyledText>
                    </StyledTouchableOpacity>

                </StyledView>
            </StyledView>
        </Modal>
    );
};
