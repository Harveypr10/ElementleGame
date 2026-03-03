import { Stack } from 'expo-router';

export default function LeagueLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="region" />
            <Stack.Screen name="user" />
            <Stack.Screen name="join" />
            <Stack.Screen name="manage" />
            <Stack.Screen name="create" />
        </Stack>
    );
}
