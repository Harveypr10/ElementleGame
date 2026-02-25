/**
 * generateArchiveShareText.ts
 *
 * Builds the emoji-grid share string for the Monthly Archive screen.
 * Iterates through each day of the selected month and maps statuses
 * to emojis, inserting a line break every 7 emojis (calendar-row style).
 */

interface DayInfo {
    status: 'won' | 'lost' | 'played' | 'not-played';
    isFuture: boolean;
}

interface ArchiveShareTextParams {
    edition: string;           // e.g. "UK Edition" or "Personalised"
    monthLabel: string;        // e.g. "Feb 2026"
    days: DayInfo[];           // One entry per calendar day of the month (1st → last)
    wonCount: number;          // Total wins
    totalDenominator: number;  // For current month: days elapsed; for past: total days in month
    isCurrentMonth: boolean;   // Controls wording: "month to date" vs "in month"
    percentile?: number;       // Optional cumulative monthly percentile
    deepLinkUrl: string;       // e.g. "https://elementle.tech"
}

const STATUS_EMOJI: Record<string, string> = {
    won: '🟩',
    lost: '🟥',
    played: '🟦',      // Started but incomplete
    'not-played': '⬛', // Past, unplayed
    future: '⬜',       // Future day
};

/**
 * Generate a shareable plain-text summary of a user's monthly archive.
 */
export function generateArchiveShareText(params: ArchiveShareTextParams): string {
    const {
        edition,
        monthLabel,
        days,
        wonCount,
        totalDenominator,
        isCurrentMonth,
        percentile,
        deepLinkUrl,
    } = params;

    // Build emoji grid with line break every 7 emojis
    const emojis = days.map(d => d.isFuture ? STATUS_EMOJI.future : STATUS_EMOJI[d.status] || '⬛');
    const gridRows: string[] = [];
    for (let i = 0; i < emojis.length; i += 7) {
        gridRows.push(emojis.slice(i, i + 7).join(''));
    }

    // Wording differs for current vs past month
    const wonLabel = isCurrentMonth
        ? `${wonCount}/${totalDenominator} won month to date`
        : `${wonCount}/${totalDenominator} won in month`;

    // Assemble lines
    const lines: string[] = [
        `Elementle: ${edition}`,
        '',
        monthLabel,
        ...gridRows,
        '',
        wonLabel,
    ];

    if (percentile !== undefined && percentile > 0) {
        const rounded = percentile <= 1 ? 1
            : percentile <= 2 ? 2
                : percentile <= 5 ? 5
                    : percentile <= 10 ? 10
                        : percentile <= 20 ? 20
                            : Math.ceil(percentile / 10) * 10;
        lines.push(`Top ${rounded}% ranking`);
    }

    lines.push('');
    lines.push(deepLinkUrl);

    return lines.join('\n');
}
