import { useState } from 'react';
import { useRouter } from 'expo-router';
import { SplashScreen } from '../components/SplashScreen';
import { useAuth } from '../lib/auth';

export default function Index() {
    const router = useRouter();
    const { user, loading } = useAuth();
    const [showSplash, setShowSplash] = useState(true);

    const handleSplashComplete = () => {
        setShowSplash(false);
        if (loading) return; // Wait for auth to load if it's still loading (though 3s should be enough)

        if (user) {
            router.replace('/(tabs)');
        } else {
            // Redirect to the onboarding landing page
            router.replace('/(auth)/onboarding');
        }
    };

    if (showSplash) {
        return <SplashScreen onComplete={handleSplashComplete} />;
    }

    return null; // Logic handled in onComplete, or we could render a loader here if auth is still pending
}
