/**
 * Accessibility Labels and Helpers
 * 
 * Provides accessibility labels and hints for screen readers
 */

export const AccessibilityLabels = {
    // Home Screen
    HOME_PLAY_BUTTON: 'Play today\'s puzzle',
    HOME_ARCHIVE_BUTTON: 'View puzzle archive',
    HOME_STATS_BUTTON: 'View statistics',
    HOME_SETTINGS_BUTTON: 'Open settings',
    HOME_HELP_BUTTON: 'View help',

    // Keyboard
    KEYBOARD_DIGIT: (digit: string) => `Enter digit ${digit}`,
    KEYBOARD_ENTER: 'Submit guess',
    KEYBOARD_DELETE: 'Delete last digit',
    KEYBOARD_CLEAR: 'Clear all digits',

    // Game
    GAME_CELL: (position: number, value: string, feedback: string) =>
        `Position ${position + 1}, ${value || 'empty'}, ${feedback}`,
    GAME_GUESS_ROW: (rowNumber: number, total: number) =>
        `Guess ${rowNumber} of ${total}`,
    GAME_CLUE: (clue: string) => `Puzzle clue: ${clue}`,

    // Stats
    STATS_WIN_RATE: (rate: number) => `Win rate: ${rate} percent`,
    STATS_CURRENT_STREAK: (streak: number) => `Current streak: ${streak} days`,
    STATS_MAX_STREAK: (streak: number) => `Maximum streak: ${streak} days`,
    STATS_TOTAL_GAMES: (games: number) => `Total games played: ${games}`,

    // Archive
    ARCHIVE_DAY: (date: string, hasPuzzle: boolean, isSolved: boolean) => {
        if (!hasPuzzle) return `${date}, no puzzle`;
        if (isSolved) return `${date}, puzzle solved`;
        return `${date}, puzzle available`;
    },
    ARCHIVE_MONTH_SELECTOR: 'Select month',

    // Modal
    MODAL_CLOSE: 'Close modal',
    MODAL_SHARE: 'Share results',
    MODAL_VIEW_STATS: 'View detailed statistics',
    MODAL_VIEW_ARCHIVE: 'View puzzle archive',

    // Authentication
    AUTH_EMAIL_INPUT: 'Email address',
    AUTH_PASSWORD_INPUT: 'Password',
    AUTH_SIGN_IN: 'Sign in',
    AUTH_SIGN_UP: 'Create account',
    AUTH_GUEST_CONTINUE: 'Continue as guest',

    // Settings
    SETTINGS_DATE_FORMAT: 'Date format preference',
    SETTINGS_DATE_LENGTH: 'Date length preference',
    SETTINGS_CLUES_TOGGLE: 'Show clues toggle',
    SETTINGS_SOUND_TOGGLE: 'Sound effects toggle',
    SETTINGS_HAPTICS_TOGGLE: 'Haptic feedback toggle',
} as const;

export const AccessibilityHints = {
    // Home Screen
    HOME_PLAY_BUTTON: 'Double tap to start playing today\'s puzzle',
    HOME_ARCHIVE_BUTTON: 'Double tap to browse past puzzles',
    HOME_STATS_BUTTON: 'Double tap to view your game statistics',

    // Keyboard
    KEYBOARD_ENTER: 'Submit your current guess to check if correct',
    KEYBOARD_DELETE: 'Remove the last entered digit',
    KEYBOARD_CLEAR: 'Clear all entered digits',

    // Game
    GAME_CELL: 'This cell shows feedback for your guess',
    GAME_SUBMIT_DISABLED: 'Enter all digits before submitting',

    // Archive
    ARCHIVE_DAY: 'Double tap to play this puzzle',
    ARCHIVE_MONTH_NAV: 'Navigate to different month',
} as const;

/**
 * Get accessibility role for component type
 */
export function getAccessibilityRole(type: 'button' | 'link' | 'text' | 'image' | 'header' | 'input'): string {
    const roles = {
        button: 'button',
        link: 'link',
        text: 'text',
        image: 'image',
        header: 'header',
        input: 'none', // Use 'none' for TextInput on iOS
    };

    return roles[type];
}

/**
 * Get accessibility state for interactive elements
 */
export function getAccessibilityState(options: {
    disabled?: boolean;
    selected?: boolean;
    checked?: boolean;
    busy?: boolean;
    expanded?: boolean;
}) {
    return {
        disabled: options.disabled || false,
        selected: options.selected || false,
        checked: options.checked || false,
        busy: options.busy || false,
        expanded: options.expanded || false,
    };
}
