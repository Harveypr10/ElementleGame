/**
 * /league/user — User Mode League Tables
 * Simple wrapper that renders the tab league screen with gameMode='user'.
 */
import LeagueScreen from '../(tabs)/league';
export default function UserLeagueScreen() {
    return <LeagueScreen gameMode="user" />;
}
