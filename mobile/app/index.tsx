import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../lib/auth';
import { View, ActivityIndicator } from 'react-native';

export default function Index() {
    const router = useRouter();
    const { user, authPhase } = useAuth();

    useEffect(() => {
        if (authPhase !== 'ready') return;

        if (user) {
            router.replace('/(tabs)');
        } else {
            // Guests or unauthenticated users start at onboarding
            router.replace('/(auth)/onboarding');
        }
    }, [user, authPhase]);

    return (
        <View style={{ flex: 1, backgroundColor: '#7DAAE8' }}>
            {/* Show empty view matching splash bg to prevent white flash during redirect */}
        </View>
    );
}
