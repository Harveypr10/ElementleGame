import { Tabs } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { Home, Settings as SettingsIcon, SlidersHorizontal, Shield } from 'lucide-react-native';
import { useProfile } from '../../hooks/useProfile';
import { useOptions } from '../../lib/options';

export default function TabLayout() {
    const { colorScheme } = useColorScheme();
    const { isAdmin } = useProfile();
    const { quickMenuEnabled } = useOptions();
    const isDark = colorScheme === 'dark';

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    display: quickMenuEnabled ? 'flex' : 'none',
                    backgroundColor: isDark ? '#0f172a' : '#f1f5f9',
                    borderTopWidth: 0,
                    height: 75,
                    paddingBottom: 18,
                    paddingTop: 8,
                },
                tabBarActiveTintColor: isDark ? '#ffffff' : '#1e293b',
                tabBarInactiveTintColor: isDark ? '#94a3b8' : '#64748b',
                tabBarLabelStyle: {
                    fontSize: 13,
                    fontWeight: '600',
                    fontFamily: 'Nunito_600SemiBold',
                },
                tabBarIconStyle: {
                    marginTop: 2,
                },
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Home',
                    tabBarLabel: 'Home',
                    tabBarIcon: ({ color, size }) => (
                        <Home size={26} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="options"
                options={{
                    title: 'Options',
                    tabBarLabel: 'Options',
                    tabBarIcon: ({ color, size }) => (
                        <SlidersHorizontal size={26} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="settings"
                options={{
                    title: 'Settings',
                    tabBarLabel: 'Settings',
                    tabBarIcon: ({ color, size }) => (
                        <SettingsIcon size={26} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="settings/admin"
                options={{
                    title: 'Admin',
                    tabBarLabel: 'Admin',
                    href: isAdmin ? '/settings/admin' : null,
                    tabBarIcon: ({ color, size }) => (
                        <Shield size={26} color={color} />
                    ),
                }}
            />
        </Tabs>
    );
}
