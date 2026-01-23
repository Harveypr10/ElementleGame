/**
 * Learn more about Light and Dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '../constants/Colors';
import { useOptions } from '../lib/options';

export function useThemeColor(
    props: { light?: string; dark?: string },
    colorName: keyof typeof Colors.light
) {
    // Access the manual dark mode setting from our context
    const { darkMode } = useOptions();
    const theme = darkMode ? 'dark' : 'light';

    const colorFromProps = props[theme];

    if (colorFromProps) {
        return colorFromProps;
    } else {
        return Colors[theme][colorName];
    }
}
