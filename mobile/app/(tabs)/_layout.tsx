import { Tabs } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { Home, Settings as SettingsIcon, SlidersHorizontal, Shield, Trophy } from 'lucide-react-native';
import { useProfile } from '../../hooks/useProfile';
import { useOptions } from '../../lib/options';
import { useWindowDimensions, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
    const { colorScheme } = useColorScheme();
    const { isAdmin } = useProfile();
    const { quickMenuEnabled, leagueTablesEnabled } = useOptions();
    const isDark = colorScheme === 'dark';
    const { width: screenWidth } = useWindowDimensions();
    const isLargeScreen = screenWidth >= 768;
    const insets = useSafeAreaInsets();

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    display: quickMenuEnabled ? 'flex' : 'none',
                    backgroundColor: isDark ? '#0f172a' : '#f1f5f9',
                    borderTopWidth: 0,
                    height: Platform.OS === 'android' ? 66 : 75,
                    paddingBottom: Platform.OS === 'android' ? 14 : 18,
                    paddingTop: 8,
                },
                tabBarActiveTintColor: isDark ? '#ffffff' : '#1e293b',
                tabBarInactiveTintColor: isDark ? '#94a3b8' : '#64748b',
                tabBarLabelStyle: {
                    fontSize: isLargeScreen ? 16 : 13,
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
                        <Home size={isLargeScreen ? 32 : 26} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="options"
                options={{
                    title: 'Options',
                    tabBarLabel: 'Options',
                    tabBarIcon: ({ color, size }) => (
                        <SlidersHorizontal size={isLargeScreen ? 32 : 26} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="settings"
                options={{
                    title: 'Settings',
                    tabBarLabel: 'Settings',
                    tabBarIcon: ({ color, size }) => (
                        <SettingsIcon size={isLargeScreen ? 32 : 26} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="league"
                options={{
                    title: 'League',
                    href: null, // Always hidden from tab bar — accessed via Home screen buttons
                    tabBarIcon: ({ color, size }) => (
                        <Trophy size={isLargeScreen ? 32 : 26} color={color} />
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
                        <Shield size={isLargeScreen ? 32 : 26} color={color} />
                    ),
                }}
            />
            {/* Hide account-info from tab bar - it's accessed via Settings screen */}
            <Tabs.Screen
                name="settings/account-info"
                options={{
                    href: null, // Always hidden from tab bar
                }}
            />
        </Tabs>
    );
}
