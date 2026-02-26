import { Stack } from 'expo-router';

export default function AdminLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: 'white' }
            }}
        >
            <Stack.Screen name="index" />
            <Stack.Screen name="users" />
            <Stack.Screen name="cases" />
            <Stack.Screen name="restrictions" />
            <Stack.Screen name="scheduler" />
            <Stack.Screen name="tiers" />
            <Stack.Screen name="questions" />
            <Stack.Screen name="navigator" />
        </Stack>
    );
}
