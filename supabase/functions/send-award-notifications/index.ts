/**
 * send-award-notifications — Supabase Edge Function
 *
 * Triggered by pg_cron at 12:05 UTC on the 1st of each month (and Jan 1st for YTD).
 * Queries league_awards + global_percentile_awards granted in the last 24 hours,
 * groups them per user, and sends styled push notifications via the Expo Push API.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ─── Constants ──────────────────────────────────────────────────────────

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

const MEDAL_EMOJI: Record<string, string> = {
    gold: '🥇',
    silver: '🥈',
    bronze: '🥉',
}

const MEDAL_LABEL: Record<string, string> = {
    gold: 'Gold',
    silver: 'Silver',
    bronze: 'Bronze',
}

const PERCENTILE_LABEL: Record<string, string> = {
    top_1: 'Top 1%',
    top_5: 'Top 5%',
    top_10: 'Top 10%',
    top_25: 'Top 25%',
    top_50: 'Top 50%',
}

// ─── Types ──────────────────────────────────────────────────────────────

interface MedalRow {
    user_id: string
    expo_push_token: string | null
    medal: string
    league_name: string
    period_label: string
    timeframe: string
    game_mode: string
}

interface PercentileRow {
    user_id: string
    expo_push_token: string | null
    percentile_tier: string
    period_label: string
    timeframe: string
    game_mode: string
}

interface UserNotification {
    token: string
    medals: MedalRow[]
    percentiles: PercentileRow[]
}

// ─── Helpers ────────────────────────────────────────────────────────────

function formatPeriod(periodLabel: string, timeframe: string): string {
    if (timeframe === 'ytd') return periodLabel // e.g. '2026'
    const [year, month] = periodLabel.split('-')
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December',
    ]
    return `${months[parseInt(month, 10) - 1]} ${year}`
}

function buildNotificationBody(notif: UserNotification): { title: string; body: string } {
    const totalAwards = notif.medals.length + notif.percentiles.length

    // Single medal
    if (totalAwards === 1 && notif.medals.length === 1) {
        const m = notif.medals[0]
        return {
            title: `${MEDAL_EMOJI[m.medal]} League Medal Won!`,
            body: `You finished ${MEDAL_LABEL[m.medal]} in "${m.league_name}" for ${formatPeriod(m.period_label, m.timeframe)}!`,
        }
    }

    // Single percentile badge
    if (totalAwards === 1 && notif.percentiles.length === 1) {
        const p = notif.percentiles[0]
        const tierLabel = PERCENTILE_LABEL[p.percentile_tier] || p.percentile_tier
        return {
            title: '📊 Global Ranking Badge!',
            body: `You're in the ${tierLabel} globally for ${formatPeriod(p.period_label, p.timeframe)}!`,
        }
    }

    // Multiple awards — summarize
    const parts: string[] = []
    if (notif.medals.length > 0) {
        const medalSummary = notif.medals
            .map(m => `${MEDAL_EMOJI[m.medal]} ${MEDAL_LABEL[m.medal]} in "${m.league_name}"`)
            .join(', ')
        parts.push(medalSummary)
    }
    if (notif.percentiles.length > 0) {
        const pBadge = notif.percentiles[0]
        const tierLabel = PERCENTILE_LABEL[pBadge.percentile_tier] || pBadge.percentile_tier
        parts.push(`📊 ${tierLabel} globally`)
    }

    return {
        title: `🏆 You won ${totalAwards} awards this period!`,
        body: parts.join(' • '),
    }
}

// ─── Main Handler ───────────────────────────────────────────────────────

serve(async (_req) => {
    try {
        console.log('[AwardNotifications] Starting award notification dispatch')

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        )

        // ── 1. Fetch medals granted in the last 24 hours ──
        const { data: medals, error: medalsErr } = await supabase
            .from('league_awards')
            .select(`
                user_id,
                medal,
                league_id,
                period_label,
                timeframe,
                game_mode,
                awarded_at,
                leagues!inner ( name )
            `)
            .gte('awarded_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

        if (medalsErr) {
            console.error('[AwardNotifications] Error fetching medals:', medalsErr)
            throw medalsErr
        }

        console.log(`[AwardNotifications] Found ${medals?.length ?? 0} medals in last 24h`)

        // ── 2. Fetch percentile badges granted in the last 24 hours ──
        const { data: percentiles, error: pctErr } = await supabase
            .from('global_percentile_awards')
            .select('user_id, percentile_tier, period_label, timeframe, game_mode, awarded_at')
            .gte('awarded_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

        if (pctErr) {
            console.error('[AwardNotifications] Error fetching percentiles:', pctErr)
            throw pctErr
        }

        console.log(`[AwardNotifications] Found ${percentiles?.length ?? 0} percentile badges in last 24h`)

        // ── 3. Collect unique user IDs ──
        const userIds = new Set<string>()
        medals?.forEach(m => userIds.add(m.user_id))
        percentiles?.forEach(p => userIds.add(p.user_id))

        if (userIds.size === 0) {
            console.log('[AwardNotifications] No awards to notify — done')
            return new Response(JSON.stringify({ sent: 0, skipped: 0 }), {
                headers: { 'Content-Type': 'application/json' },
            })
        }

        // ── 4. Fetch push tokens for those users ──
        const { data: profiles, error: profileErr } = await supabase
            .from('user_profiles')
            .select('id, expo_push_token')
            .in('id', [...userIds])
            .not('expo_push_token', 'is', null)

        if (profileErr) {
            console.error('[AwardNotifications] Error fetching profiles:', profileErr)
            throw profileErr
        }

        const tokenMap = new Map<string, string>()
        profiles?.forEach(p => {
            if (p.expo_push_token) tokenMap.set(p.id, p.expo_push_token)
        })

        console.log(`[AwardNotifications] ${tokenMap.size} users have push tokens out of ${userIds.size} total`)

        // ── 5. Group notifications per user ──
        const userNotifications = new Map<string, UserNotification>()

        for (const m of (medals ?? [])) {
            const token = tokenMap.get(m.user_id)
            if (!token) continue
            if (!userNotifications.has(m.user_id)) {
                userNotifications.set(m.user_id, { token, medals: [], percentiles: [] })
            }
            userNotifications.get(m.user_id)!.medals.push({
                user_id: m.user_id,
                expo_push_token: token,
                medal: m.medal,
                league_name: (m as any).leagues?.name ?? 'Unknown League',
                period_label: m.period_label,
                timeframe: m.timeframe,
                game_mode: m.game_mode,
            })
        }

        for (const p of (percentiles ?? [])) {
            const token = tokenMap.get(p.user_id)
            if (!token) continue
            if (!userNotifications.has(p.user_id)) {
                userNotifications.set(p.user_id, { token, medals: [], percentiles: [] })
            }
            userNotifications.get(p.user_id)!.percentiles.push({
                user_id: p.user_id,
                expo_push_token: token,
                percentile_tier: p.percentile_tier,
                period_label: p.period_label,
                timeframe: p.timeframe,
                game_mode: p.game_mode,
            })
        }

        // ── 6. Build and send notifications via Expo Push API ──
        const messages: any[] = []

        for (const [userId, notif] of userNotifications) {
            const { title, body } = buildNotificationBody(notif)
            messages.push({
                to: notif.token,
                sound: 'default',
                title,
                body,
                data: {
                    screen: 'leagues',
                    type: 'award_notification',
                },
            })
            console.log(`[AwardNotifications] Queued notification for user ${userId}: "${title}"`)
        }

        let sent = 0
        let errors = 0

        if (messages.length > 0) {
            // Expo accepts batches of up to 100 — chunk if needed
            const BATCH_SIZE = 100
            for (let i = 0; i < messages.length; i += BATCH_SIZE) {
                const batch = messages.slice(i, i + BATCH_SIZE)

                const response = await fetch(EXPO_PUSH_URL, {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Accept-Encoding': 'gzip, deflate',
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(batch),
                })

                if (!response.ok) {
                    const errText = await response.text()
                    console.error(`[AwardNotifications] Expo API error: ${response.status} — ${errText}`)
                    errors += batch.length
                } else {
                    const result = await response.json()
                    console.log(`[AwardNotifications] Expo API response:`, JSON.stringify(result))

                    // Count successes and errors from ticket responses
                    if (result.data) {
                        for (const ticket of result.data) {
                            if (ticket.status === 'ok') {
                                sent++
                            } else {
                                errors++
                                console.warn(`[AwardNotifications] Ticket error:`, ticket)
                            }
                        }
                    }
                }
            }
        }

        const skipped = userIds.size - userNotifications.size
        const summary = {
            total_awards: (medals?.length ?? 0) + (percentiles?.length ?? 0),
            users_with_awards: userIds.size,
            users_with_tokens: tokenMap.size,
            notifications_sent: sent,
            notifications_errored: errors,
            users_skipped_no_token: skipped,
        }

        console.log('[AwardNotifications] Complete:', JSON.stringify(summary))

        return new Response(JSON.stringify(summary), {
            headers: { 'Content-Type': 'application/json' },
        })
    } catch (error) {
        console.error('[AwardNotifications] Fatal error:', error)
        return new Response(JSON.stringify({ error: (error as Error).message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        })
    }
})
