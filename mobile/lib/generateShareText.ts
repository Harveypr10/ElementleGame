/**
 * generateShareText.ts
 * 
 * Builds the emoji-grid share string for Elementle game results.
 */

interface GuessFeedbackCell {
    state: string;
}

interface ShareTextParams {
    edition: string;          // e.g. "UK Edition", "US Edition", "Personalised"
    formattedDate: string;    // Puzzle calendar date e.g. "25th Feb 2026"
    eventTitle: string;       // e.g. "Spanish Flu Pandemic Ends"
    guessFeedback: GuessFeedbackCell[][]; // Grid of cell states
    guessDateCanonicals: string[]; // Canonical dates per guess row (YYYY-MM-DD)
    answerDateCanonical: string;   // Answer date (YYYY-MM-DD)
    currentStreak: number;
    showStreak: boolean;      // Only show streak if this is the latest puzzle on an active streak
    guessesCount: number;
    deepLinkUrl: string;
    isWin: boolean;
}

const EMOJI_MAP: Record<string, string> = {
    correct: '🟩',
    inSequence: '🟧',
    notInSequence: '⬛',
    empty: '⬜',
};

/**
 * Compare a guessed date (canonical YYYY-MM-DD) to the answer date.
 * Returns 🔼 (guess is before answer), 🔽 (guess is after answer), ✅ (exact match).
 */
function getRowArrow(guessCanonical: string, answerCanonical: string): string {
    if (guessCanonical === answerCanonical) return '✅';
    // Compare as strings works for YYYY-MM-DD format
    return guessCanonical < answerCanonical ? '🔼' : '🔽';
}

export function generateShareText(params: ShareTextParams): string {
    const {
        edition,
        formattedDate,
        eventTitle,
        guessFeedback,
        guessDateCanonicals,
        answerDateCanonical,
        currentStreak,
        showStreak,
        guessesCount,
        deepLinkUrl,
        isWin,
    } = params;

    // Header
    const header = `Elementle: ${edition} - ${formattedDate}`;

    // Emoji grid with row arrows
    const gridRows = guessFeedback.map((row, i) => {
        const tiles = row.map(cell => EMOJI_MAP[cell.state] || '⬛').join('');
        const arrow = guessDateCanonicals[i]
            ? getRowArrow(guessDateCanonicals[i], answerDateCanonical)
            : '';
        return `${tiles} ${arrow}`;
    });

    // Footer line
    const streakPart = (showStreak && currentStreak > 0) ? `🔥 ${currentStreak}-day streak • ` : '';
    const footer = `${streakPart}${guessesCount} ${guessesCount === 1 ? 'guess' : 'guesses'}`;

    // Assemble
    const lines = [
        header,
        `Event - ${eventTitle}`,
        '',
        ...gridRows,
        '',
        footer,
        deepLinkUrl,
    ];

    return lines.join('\n');
}
