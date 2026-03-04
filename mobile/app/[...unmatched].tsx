/**
 * Catch-all route — renders nothing.
 *
 * When a deep link URL resolves to a non-existent route (e.g. /league/join/CODE),
 * expo-router shows its default "+not-found" screen briefly before NavGuard redirects.
 * This catch-all prevents that flash by rendering null while the redirect processes.
 */
export default function CatchAll() {
    return null;
}
