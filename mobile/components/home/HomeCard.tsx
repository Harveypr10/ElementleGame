
import { View, Text, TouchableOpacity, Image, ImageSourcePropType, Pressable } from 'react-native';
import { styled } from 'nativewind';
import { LucideIcon } from 'lucide-react-native';
import { getCardShadow } from '../../lib/shadows';

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
}

export function HomeCard({
    title,
    subtitle,
    icon,
    backgroundColor,
    onPress,
    height = 160,
    className = "",
    children,
    testID
}: HomeCardProps) {
    return (
        <StyledTouchableOpacity
            testID={testID}
            className={`w-full rounded-3xl flex-row items-center justify-between px-6 overflow-hidden mb-4 ${className}`}
            style={{ backgroundColor, height, ...getCardShadow('md') }}
            onPress={onPress}
            activeOpacity={0.9}
        >
            <StyledView className="flex-1 py-4">
                <StyledText className="text-xl font-n-bold text-slate-900 leading-tight">
                    {title}
                </StyledText>
                {subtitle && (
                    <StyledText className="text-slate-700 font-n-medium mt-1">
                        {subtitle}
                    </StyledText>
                )}
                {children}
            </StyledView>

            {icon && (
                <StyledImage
                    source={icon}
                    className="w-24 h-24 ml-4"
                    resizeMode="contain"
                />
            )}
        </StyledTouchableOpacity>
    );
}
