/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other colors defined in the theme that you can use.
 */

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
    light: {
        text: '#11181C',
        background: '#fff',
        surface: '#fff',
        border: '#e2e8f0', // Slate 200
        tint: tintColorLight,
        icon: '#687076',
        tabIconDefault: '#687076',
        tabIconSelected: tintColorLight,
    },
    dark: {
        text: '#ECEDEE',
        background: '#0f172a', // Slate 900
        surface: '#1e293b', // Slate 800
        border: '#334155', // Slate 700
        tint: tintColorDark,
        icon: '#9BA1A6',
        tabIconDefault: '#9BA1A6',
        tabIconSelected: tintColorDark,
    },
};
