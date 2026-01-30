
import React from 'react';
import { View, Text, TouchableOpacity, ImageSourcePropType, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { styled } from 'nativewind';
import { LucideIcon } from 'lucide-react-native';
import { getCardShadow } from '../../lib/shadows';
import { ThemedText } from '../ThemedText';

const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledView = styled(View);
const StyledText = styled(Text);
const StyledImage = styled(Image);

interface HomeCardProps {
    title: string;
    subtitle?: string;
    icon?: ImageSourcePropType;
    backgroundColor: string;
    onPress: () => void;
    height?: number; // Optional custom height
    className?: string; // Additional classes
    children?: React.ReactNode;
    testID?: string; // Test identifier
    iconStyle?: any; // Optional custom icon style
}

const HomeCardComponent = ({
    title,
    subtitle,
    icon,
    backgroundColor,
    onPress,
    height = 160,
    className = "",
    children,
    testID,
    iconStyle
}: HomeCardProps) => {

    return (
        <StyledTouchableOpacity
            testID={testID}
            className={`w-full rounded-3xl flex-row items-center justify-between px-5 overflow-hidden mb-4 ${className}`}
            style={{ backgroundColor, height, ...getCardShadow('md') }}
            onPress={onPress}
            activeOpacity={0.9}
        >
            <StyledView className="flex-1 py-4">
                <ThemedText className="font-n-bold text-slate-900 leading-tight" size="xl">
                    {title}
                </ThemedText>
                {subtitle && (
                    <ThemedText className="text-slate-700 font-n-medium mt-1" size="base">
                        {subtitle}
                    </ThemedText>
                )}
                {children}
            </StyledView>

            {icon && (
                <StyledImage
                    source={icon}
                    className="w-24 h-24 ml-2"
                    contentFit="contain"
                    cachePolicy="disk"
                    style={iconStyle}
                />
            )}
        </StyledTouchableOpacity>
    );
};

export const HomeCard = React.memo(HomeCardComponent);
