/**
 * Share Functionality
 * 
 * Provides native share sheet integration for sharing game results
 */

import { Share, Platform } from 'react-native';

interface ShareGameResultOptions {
    date: string;
    guesses: number;
    result: 'won' | 'lost';
    mode: 'REGION' | 'USER';
    eventTitle?: string;
}

/**
 * Generate emoji grid for sharing (like Wordle)
 */
function generateEmojiGrid(guesses: number, won: boolean, maxGuesses: number = 5): string {
    const grid: string[] = [];

    for (let i = 0; i < guesses; i++) {
        if (i === guesses - 1 && won) {
            grid.push('🟩'); // Last guess if won
        } else {
            grid.push('🟨'); // Guesses that didn't win
        }
    }

    // Add remaining empty squares if lost
    if (!won) {
        for (let i = guesses; i < maxGuesses; i++) {
            grid.push('⬜');
        }
    }

    return grid.join('');
}

/**
 * Share game result using native share sheet
 */
export async function shareGameResult(options: ShareGameResultOptions): Promise<{
    success: boolean;
    error?: string;
}> {
    try {
        const { date, guesses, result, mode, eventTitle } = options;
        const won = result === 'won';
        const emojiGrid = generateEmojiGrid(guesses, won);

        const modeText = mode === 'REGION' ? '🌍 Region Mode' : '👤 User Mode';
        const resultText = won
            ? `Solved in ${guesses} ${guesses === 1 ? 'guess' : 'guesses'}!`
            : 'Better luck next time!';

        let message = `Elementle ${date}\n${modeText}\n\n${emojiGrid}\n\n${resultText}`;

        if (eventTitle) {
            message += `\n\n📅 ${eventTitle}`;
        }

        message += '\n\nPlay at elementle.com';

        const result_share = await Share.share(
            {
                message,
                ...(Platform.OS === 'ios' && { url: 'https://elementle.com' }),
            },
            {
                subject: `Elementle ${date}`,
                dialogTitle: 'Share your result',
            }
        );

        if (result_share.action === Share.sharedAction) {
            return { success: true };
        } else if (result_share.action === Share.dismissedAction) {
            return { success: false };
        }

        return { success: true };
    } catch (error: any) {
        console.error('[Share] Error sharing game result:', error);
        return {
            success: false,
            error: error?.message || 'Failed to share'
        };
    }
}

/**
 * Copy share text to clipboard (fallback)
 */
export async function copyShareText(options: ShareGameResultOptions): Promise<{
    success: boolean;
    text?: string;
}> {
    try {
        const { date, guesses, result, mode, eventTitle } = options;
        const won = result === 'won';
        const emojiGrid = generateEmojiGrid(guesses, won);

        const modeText = mode === 'REGION' ? '🌍 Region Mode' : '👤 User Mode';
        const resultText = won
            ? `Solved in ${guesses} ${guesses === 1 ? 'guess' : 'guesses'}!`
            : 'Better luck next time!';

        let text = `Elementle ${date}\n${modeText}\n\n${emojiGrid}\n\n${resultText}`;

        if (eventTitle) {
            text += `\n\n📅 ${eventTitle}`;
        }

        text += '\n\nPlay at elementle.com';

        // Copy to clipboard handled by caller
        return { success: true, text };
    } catch (error) {
        console.error('[Share] Error generating share text:', error);
        return { success: false };
    }
}
