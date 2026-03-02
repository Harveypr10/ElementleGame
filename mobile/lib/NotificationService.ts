import { Platform } from 'react-native';
import type { NotificationHydratedData } from '../hooks/useNotificationData';

// ─── Safe import: native module may not be available until native build ─────
let Notifications: typeof import('expo-notifications') | null = null;
try {
    Notifications = require('expo-notifications');
    Notifications!.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
        }),
    });
} catch (e) {
    console.warn('[NotificationService] Native module not available yet — skipping setup');
}

// ─── Types ──────────────────────────────────────────────────────────────────
export interface ScheduleAllOptions {
    reminderEnabled: boolean;
    reminderTime: string;           // 'HH:mm' 24h format
    streakReminderEnabled: boolean;
    streakReminderTime: string;     // 'HH:mm' 24h format
}

// ─── Helper: guard for native module availability ───────────────────────────
function requireNative() {
    if (!Notifications) {
        console.warn('[NotificationService] Native module not available — operation skipped');
        return false;
    }
    return true;
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function addDaysToDate(dateStr: string, days: number): string {
    const d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
}

function makeDateAtTime(dateStr: string, timeStr: string): Date {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const d = new Date(dateStr + 'T00:00:00');
    d.setHours(hours, minutes, 0, 0);
    return d;
}

// ─── Permission Handling ────────────────────────────────────────────────────
export async function requestPermissions(): Promise<boolean> {
    if (!requireNative()) return false;

    const { status: existingStatus } = await Notifications!.getPermissionsAsync();

    if (existingStatus === 'granted') {
        console.log('[NotificationService] Permission already granted');
        if (Platform.OS === 'android') {
            await Notifications!.setNotificationChannelAsync('daily-reminder', {
                name: 'Daily Reminders',
                importance: Notifications!.AndroidImportance.HIGH,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#7DAAE8',
            });
        }
        return true;
    }

    if (existingStatus === 'undetermined') {
        const { status } = await Notifications!.requestPermissionsAsync();
        if (status === 'granted') {
            console.log('[NotificationService] Permission granted via native prompt');
            if (Platform.OS === 'android') {
                await Notifications!.setNotificationChannelAsync('daily-reminder', {
                    name: 'Daily Reminders',
                    importance: Notifications!.AndroidImportance.HIGH,
                    vibrationPattern: [0, 250, 250, 250],
                    lightColor: '#7DAAE8',
                });
            }
            return true;
        }
        console.log('[NotificationService] Permission denied via native prompt');
        return false;
    }

    console.log('[NotificationService] Permission previously denied');
    return false;
}

export async function hasPermission(): Promise<boolean> {
    if (!requireNative()) return false;
    const { status } = await Notifications!.getPermissionsAsync();
    return status === 'granted';
}

// ─── Cancel All ─────────────────────────────────────────────────────────────
export async function cancelAll(): Promise<void> {
    if (!requireNative()) return;
    await Notifications!.cancelAllScheduledNotificationsAsync();
    console.log('[NotificationService] All scheduled notifications cancelled');
}

// ─── Clear Badge ────────────────────────────────────────────────────────────
export async function clearBadge(): Promise<void> {
    if (!requireNative()) return;
    await Notifications!.setBadgeCountAsync(0);
}

// ─── Schedule Helper ────────────────────────────────────────────────────────
async function scheduleOne(
    date: Date,
    title: string,
    body: string,
    screen: string,
    label: string,
): Promise<void> {
    if (!requireNative()) return;

    const now = new Date();
    if (date <= now) {
        console.log(`[NotificationService] Skipping "${label}" — date ${date.toISOString()} is in the past`);
        return;
    }

    await Notifications!.scheduleNotificationAsync({
        content: {
            title,
            body,
            data: { screen },
            badge: 1,
            sound: 'default',
        },
        trigger: {
            type: Notifications!.SchedulableTriggerInputTypes.DATE,
            date,
        },
    });

    console.log(`[NotificationService] Scheduled "${label}" for ${date.toISOString()}: "${title}" — "${body.replace(/\n/g, ' | ')}" (→ ${screen})`);
}

// ─── Main Scheduling Engine ─────────────────────────────────────────────────
// This function builds notifications from pre-hydrated local data — NO network calls.
export async function scheduleAll(
    options: ScheduleAllOptions,
    ctx: NotificationHydratedData | null,
): Promise<void> {
    if (!requireNative()) return;

    // Always cancel first
    await cancelAll();

    if (!ctx) {
        console.log('[NotificationService] No hydrated data, skipping scheduling');
        return;
    }

    const { reminderEnabled, reminderTime, streakReminderEnabled, streakReminderTime } = options;

    if (!reminderEnabled && !streakReminderEnabled) {
        console.log('[NotificationService] All reminders disabled, skipping');
        return;
    }

    const permitted = await hasPermission();
    if (!permitted) {
        console.log('[NotificationService] No permission, skipping');
        return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const tomorrowStr = addDaysToDate(todayStr, 1);
    const { regionDisplayName } = ctx;

    // ── HOLIDAY MODE OVERRIDE ──
    if (ctx.holidayActive && ctx.holidayEndDate) {
        console.log(`[NotificationService] Holiday active until ${ctx.holidayEndDate}`);

        // Schedule return notification
        const returnDate = makeDateAtTime(ctx.holidayEndDate, reminderTime);
        await scheduleOne(
            returnDate,
            'Elementle - Holiday mode has ended!',
            'Play today to extend your streak.',
            'home',
            'Holiday Return',
        );

        // Queue drip campaign starting from Day 2 after holiday end
        if (reminderEnabled) {
            const dripBase = ctx.holidayEndDate;
            await scheduleDripCampaign(dripBase, reminderTime, ctx);
        }
        return;
    }

    // ══════════════════════════════════════════════════════════════════════
    // BLOCK A: TODAY & TOMORROW
    // ══════════════════════════════════════════════════════════════════════

    // ── TODAY: Daily Reminder ──
    if (reminderEnabled && (!ctx.regionPlayedToday || !ctx.userPlayedToday)) {
        // At least one mode unplayed → schedule daily reminder
        const todayDailyDate = makeDateAtTime(todayStr, reminderTime);
        await scheduleOne(
            todayDailyDate,
            'Elementle',
            "Today's puzzles are ready for you.\nPlay to keep your streak going!",
            'home',
            'Today Daily',
        );
    }

    // ── TODAY: Streak Reminder (for each unplayed mode with active streak) ──
    if (streakReminderEnabled) {
        // Region unplayed + has streak
        if (!ctx.regionPlayedToday && ctx.regionStreak > 0) {
            const todayStreakDate = makeDateAtTime(todayStr, streakReminderTime);
            const eventTitle = ctx.regionEventTitles[todayStr];
            let body = `Don't forget to play today's ${regionDisplayName} question`;
            if (eventTitle) body += `\n${eventTitle}`;

            await scheduleOne(
                todayStreakDate,
                'Elementle - Streak at risk!',
                body,
                // Today: user is playing TODAY's game to extend their current streak.
                // Streak hasn't broken yet (breaks at midnight), so no streak saver
                // popup will show → safe to deep link directly to the game.
                '/game/REGION/today',
                'Today Streak Region',
            );
        }

        // User mode unplayed + has streak
        if (!ctx.userPlayedToday && ctx.userStreak > 0) {
            const todayStreakDate = makeDateAtTime(todayStr, streakReminderTime);
            const eventTitle = ctx.userEventTitles[todayStr];
            let body = `Don't forget to play today's Personalised question`;
            if (eventTitle) body += `\n${eventTitle}`;

            await scheduleOne(
                todayStreakDate,
                'Elementle - Streak at risk!',
                body,
                // Today: same logic — streak still alive, playing today's game
                '/game/USER/next',
                'Today Streak User',
            );
        }
    }

    // ── TOMORROW ──

    // Predictive streak: if user hasn't played a mode today, its streak will be 0 tomorrow
    const tomorrowRegionStreak = ctx.regionPlayedToday ? ctx.regionStreak : 0;
    const tomorrowUserStreak = ctx.userPlayedToday ? ctx.userStreak : 0;

    // Tomorrow Daily
    if (reminderEnabled) {
        const tomorrowDailyDate = makeDateAtTime(tomorrowStr, reminderTime);
        await scheduleOne(
            tomorrowDailyDate,
            'Elementle',
            "Today's puzzles are ready for you.\nPlay to keep your streak going!",
            'home',
            'Tomorrow Daily',
        );
    }

    // Tomorrow Streak — deep link depends on whether streak saver / holiday popup could show.
    // If user has NO savers AND NO holiday days left → no popup possible → deep link to game.
    // If either is available → popup might show → deep link to home.
    const hasAnySaverOrHoliday = ctx.streakSaversRemaining > 0 || ctx.holidaySaversRemaining > 0;

    if (streakReminderEnabled) {
        if (tomorrowRegionStreak > 0) {
            const tomorrowStreakDate = makeDateAtTime(tomorrowStr, streakReminderTime);
            const eventTitle = ctx.regionEventTitles[tomorrowStr];
            let body = `Don't forget to play today's ${regionDisplayName} question`;
            if (eventTitle) body += `\n${eventTitle}`;

            await scheduleOne(
                tomorrowStreakDate,
                'Elementle - Streak at risk!',
                body,
                hasAnySaverOrHoliday ? 'home' : '/game/REGION/today',
                'Tomorrow Streak Region',
            );
        }

        if (tomorrowUserStreak > 0) {
            const tomorrowStreakDate = makeDateAtTime(tomorrowStr, streakReminderTime);
            const eventTitle = ctx.userEventTitles[tomorrowStr];
            let body = `Don't forget to play today's Personalised question`;
            if (eventTitle) body += `\n${eventTitle}`;

            await scheduleOne(
                tomorrowStreakDate,
                'Elementle - Streak at risk!',
                body,
                hasAnySaverOrHoliday ? 'home' : '/game/USER/next',
                'Tomorrow Streak User',
            );
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    // BLOCK B: WIN-BACK DRIP CAMPAIGN (Days 2, 3, 7, 14, 28)
    // ══════════════════════════════════════════════════════════════════════
    if (reminderEnabled) {
        await scheduleDripCampaign(todayStr, reminderTime, ctx);
    }

    console.log('[NotificationService] scheduleAll complete');
}

// ─── Drip Campaign Scheduler ────────────────────────────────────────────────
async function scheduleDripCampaign(
    baseDate: string,  // Today or Holiday end date
    reminderTime: string,
    ctx: NotificationHydratedData,
): Promise<void> {
    const { regionDisplayName, streakSaversRemaining, holidaySaversRemaining } = ctx;
    const hasSavers = streakSaversRemaining > 0;
    const hasHoliday = holidaySaversRemaining > 0;
    const hasAnySaverOrHoliday = hasSavers || hasHoliday;
    const fallback = 'a brand new puzzle';

    // Helper to get region event title for a specific date
    const getTitle = (dateStr: string): string => {
        return ctx.regionEventTitles[dateStr] || fallback;
    };

    // Deep link: if user has savers/holiday → home (popup may show).
    // If no savers/holiday → direct to game (no popup, make it easy to start).
    const gameOrHome = hasAnySaverOrHoliday ? 'home' : '/game/REGION/today';

    // ── Day 2 ──
    const day2Date = addDaysToDate(baseDate, 2);
    const day2Time = makeDateAtTime(day2Date, reminderTime);
    if (hasSavers || hasHoliday) {
        const options: string[] = [];
        if (hasSavers) options.push('Streak Saver');
        if (hasHoliday) options.push('Holiday Mode');
        await scheduleOne(
            day2Time,
            'Elementle',
            `🚨 Your streak is broken! But wait... you can still save it! Open Elementle now to use a ${options.join(' or ')}.`,
            'home',  // Rescue message → home for popup
            'Drip Day 2 (rescue)',
        );
    } else {
        await scheduleOne(
            day2Time,
            'Elementle',
            `Get back into Elementle! Today's ${regionDisplayName} is ready: ${getTitle(day2Date)}`,
            gameOrHome,
            'Drip Day 2',
        );
    }

    // ── Day 3 ──
    const day3Date = addDaysToDate(baseDate, 3);
    const day3Time = makeDateAtTime(day3Date, reminderTime);
    if (hasHoliday) {
        await scheduleOne(
            day3Time,
            'Elementle',
            'Your streak is at risk, but you can still use Holiday Mode to secure it! Open the app to save your progress.',
            'home',  // Rescue message → home for popup
            'Drip Day 3 (holiday)',
        );
    } else {
        await scheduleOne(
            day3Time,
            'Elementle',
            `We miss you! 🐹 Jump back into Elementle. Today's ${regionDisplayName}: ${getTitle(day3Date)}`,
            gameOrHome,
            'Drip Day 3',
        );
    }

    // ── Day 7 ──
    const day7Date = addDaysToDate(baseDate, 7);
    const day7Time = makeDateAtTime(day7Date, reminderTime);
    if (hasHoliday) {
        await scheduleOne(
            day7Time,
            'Elementle',
            "Last chance! ⏳ Today is the final day you can retroactively apply Holiday Mode to save your streak. Don't lose it!",
            'home',  // Rescue message → home for popup
            'Drip Day 7 (holiday)',
        );
    } else {
        await scheduleOne(
            day7Time,
            'Elementle',
            `It's been a week! Ready to jump back in? A new ${regionDisplayName} puzzle is waiting for you: ${getTitle(day7Date)}`,
            gameOrHome,
            'Drip Day 7',
        );
    }

    // ── Day 14 ──
    const day14Date = addDaysToDate(baseDate, 14);
    const day14Time = makeDateAtTime(day14Date, reminderTime);
    await scheduleOne(
        day14Time,
        'Elementle',
        `Two weeks since your last puzzle! Dust off those brain cells and try today's ${regionDisplayName}: ${getTitle(day14Date)}`,
        gameOrHome,
        'Drip Day 14',
    );

    // ── Day 28 ──
    const day28Date = addDaysToDate(baseDate, 28);
    const day28Time = makeDateAtTime(day28Date, reminderTime);
    await scheduleOne(
        day28Time,
        'Elementle',
        "It's been a while, but Hammie misses you! 🐹 Come back and play today's Elementle puzzle: " + getTitle(day28Date),
        gameOrHome,
        'Drip Day 28',
    );
}
