import { Tabs } from 'expo-router';
import { View, Text } from 'react-native';
// TODO: Add icons

export default function TabLayout() {
    return (
        <Tabs screenOptions={{ headerShown: false }}>
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Home',
                    tabBarLabel: 'Home',
                }}
            />
            <Tabs.Screen
                name="options"
                options={{
                    title: 'Options',
                    tabBarLabel: 'Options',
                }}
            />
        </Tabs>
    );
}
