import React from 'react';
import { Text, TextProps } from 'react-native';
import { styled } from 'nativewind';
import { useOptions } from '../lib/options';
import { getScaledSize, TEXT_SIZES } from '../lib/textScaling';

const StyledText = styled(Text);

import { useThemeColor } from '../hooks/useThemeColor';

export interface ThemedTextProps extends TextProps {
    className?: string;
    lightColor?: string;
    darkColor?: string;
    size?: keyof typeof TEXT_SIZES; // 'sm', 'base', 'lg', etc.
    baseSize?: number; // Manual override
}

export function ThemedText({
    className,
    style,
    lightColor,
    darkColor,
    size = 'base',
    baseSize,
    children,
    ...props
}: ThemedTextProps) {
    const { textSize } = useOptions();
    const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');

    // Determine the base font size to scale
    // If 'baseSize' is provided, scale it directly. Otherwise use the preset size.
    // We need to import scaleText if we want to scale custom baseSize, or just use scaleText logic here.
    // But since we have getScaledSize, let's just use what we have or import scaleText.
    // The previous view showed scaleText is exported from ../lib/textScaling.

    let finalFontSize: number;

    if (baseSize) {
        // We need scaleText but haven't imported it in the previous snippet, only getScaledSize.
        // Let's assume we can import it or just use getScaledSize logic if we trust it.
        // Actually, looking at the previous file content, only getScaledSize and TEXT_SIZES were imported.
        // I should update the import too if needed, but for now I can just use the multiplier logic if I want to be safe,
        // or better, update the import line in a separate block if I can't do it here.
        // Wait, I can allow multiple edits but this tool is single contiguous block.
        // I'll check imports first.

        // Actually, let's look at lines 1-6 of the file again. 
        // line 5: import { getScaledSize, TEXT_SIZES } from '../lib/textScaling';

        // I will replace the whole function to be clean.
        // I will assume I can fix the import in a separate step if needed, or just use the logic:
        // const scale = textSize === 'small' ? 0.9 : textSize === 'large' ? 1.1 : 1.0;
        // finalFontSize = Math.round(baseSize * scale);

        // But better to use the utilities.
        // Let's just use getScaledSize(size, textSize) for the default case.
        // For baseSize, I'll manually implement the scale for now to avoid import issues or do a multi-replace.

        const scale = textSize === 'small' ? 0.9 : textSize === 'large' ? 1.1 : 1.0;
        finalFontSize = Math.round(baseSize * scale);
    } else {
        finalFontSize = getScaledSize(size, textSize);
    }

    return (
        <StyledText
            className={className}
            style={[
                { color },
                style,
                { fontSize: finalFontSize }
            ]}
            {...props}
        >
            {children}
        </StyledText>
    );
}
