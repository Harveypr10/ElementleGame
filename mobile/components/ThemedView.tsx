import { View, type ViewProps } from 'react-native';
import { styled } from 'nativewind';
import { useThemeColor } from '../hooks/useThemeColor';

const StyledView = styled(View);

export type ThemedViewProps = ViewProps & {
    lightColor?: string;
    darkColor?: string;
    className?: string;
    variant?: 'default' | 'surface';
};

export function ThemedView({ style, lightColor, darkColor, className, variant = 'default', ...otherProps }: ThemedViewProps) {
    // If variant is 'surface', map to 'surface' color key, otherwise 'background'
    const colorKey = variant === 'surface' ? 'surface' : 'background';
    const backgroundColor = useThemeColor({ light: lightColor, dark: darkColor }, colorKey);

    return <StyledView className={className} style={[{ backgroundColor }, style]} {...otherProps} />;
}
