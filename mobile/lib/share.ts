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
    puzzleDate?: string; // Calendar date for deep link URL (not the historical answer)
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
        const { date, guesses, result, mode, eventTitle, puzzleDate } = options;
        const won = result === 'won';
        const todayDate = new Date().toISOString().split('T')[0];

        let message: string;
        let shareUrl: string;

        if (mode === 'USER') {
            // USER mode: personalized puzzles — don't reveal specifics, link to today
            shareUrl = `https://elementle.tech/play/${todayDate}?mode=USER`;
            message = `I've discovered when ${eventTitle || 'a historical event'} happened. Why don't you see what your personalised puzzle is for today!\n\n${shareUrl}`;
        } else {
            // REGION mode: shared puzzle — include emoji grid and result
            const emojiGrid = generateEmojiGrid(guesses, won);
            const modeText = '🌍 Region Mode';
            const resultText = won
                ? `Solved in ${guesses} ${guesses === 1 ? 'guess' : 'guesses'}!`
                : 'Better luck next time!';

            shareUrl = puzzleDate
                ? `https://elementle.tech/play/${puzzleDate}?mode=REGION`
                : 'https://elementle.tech';

            message = `Elementle ${date}\n${modeText}\n\n${emojiGrid}\n\n${resultText}`;
            if (eventTitle) {
                message += `\n\n📅 ${eventTitle}`;
            }
            message += `\n\n${shareUrl}`;
        }

        const result_share = await Share.share(
            {
                message,
                ...(Platform.OS === 'ios' && { url: shareUrl }),
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
        const { date, guesses, result, mode, eventTitle, puzzleDate } = options;
        const won = result === 'won';
        const todayDate = new Date().toISOString().split('T')[0];

        let text: string;

        if (mode === 'USER') {
            // USER mode: personalized puzzles — don't reveal specifics, link to today
            const shareUrl = `https://elementle.tech/play/${todayDate}?mode=USER`;
            text = `I've discovered when ${eventTitle || 'a historical event'} happened. Why don't you see what your personalised puzzle is for today!\n\n${shareUrl}`;
        } else {
            // REGION mode: shared puzzle — include emoji grid and result
            const emojiGrid = generateEmojiGrid(guesses, won);
            const modeText = '🌍 Region Mode';
            const resultText = won
                ? `Solved in ${guesses} ${guesses === 1 ? 'guess' : 'guesses'}!`
                : 'Better luck next time!';

            text = `Elementle ${date}\n${modeText}\n\n${emojiGrid}\n\n${resultText}`;
            if (eventTitle) {
                text += `\n\n📅 ${eventTitle}`;
            }
            if (puzzleDate) {
                text += `\n\nhttps://elementle.tech/play/${puzzleDate}?mode=REGION`;
            } else {
                text += '\n\nPlay at elementle.tech';
            }
        }

        // Copy to clipboard handled by caller
        return { success: true, text };
    } catch (error) {
        console.error('[Share] Error generating share text:', error);
        return { success: false };
    }
}
