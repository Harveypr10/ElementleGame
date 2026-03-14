/**
 * resolveLocationName.ts
 * 
 * Universal 3-tier location name resolution utility.
 * Resolves a populated_place_id to a human-readable display name:
 *   - UK numeric IDs  → populated_places.name1
 *   - US-XX codes     → reference_us_states.name
 *   - ROW country codes → reference_countries.name
 * 
 * Returns null on any failure so callers can gracefully fallback.
 */

import { supabase } from './supabase';

/**
 * Resolve a populated_place_id to a display name.
 * 
 * @param placeId - The populated_place_id from questions_master_user
 *                  Can be: numeric string (UK), "US-TX" (US state), "FR" (ROW country), null, undefined
 * @returns The resolved location name, or null if not resolvable
 */
export async function resolveLocationName(placeId: string | null | undefined): Promise<string | null> {
    if (!placeId) return null;

    try {
        const trimmed = placeId.trim();
        if (!trimmed) return null;

        // Tier 1: US state code (e.g. "US-TX")
        if (trimmed.startsWith('US-')) {
            // @ts-ignore – reference_us_states not yet in generated types
            const { data } = await supabase
                .from('reference_us_states')
                .select('name')
                .eq('code', trimmed)
                .maybeSingle();
            return data?.name ?? null;
        }

        // Tier 2: UK osgb place ID (e.g. "osgb4000000074564395")
        if (trimmed.startsWith('osgb')) {
            const { data } = await supabase
                .from('populated_places')
                .select('name1')
                .eq('id', trimmed)
                .maybeSingle();
            return data?.name1 ?? null;
        }

        // Tier 3: ROW country code (e.g. "FR", "DE")
        // @ts-ignore – reference_countries not yet in generated types
        const { data } = await supabase
            .from('reference_countries')
            .select('name')
            .eq('code', trimmed)
            .maybeSingle();
        return data?.name ?? null;

    } catch (error) {
        console.warn('[resolveLocationName] Error resolving place ID:', placeId, error);
        return null;
    }
}
