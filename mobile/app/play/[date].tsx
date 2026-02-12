import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Linking } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';

// On native, redirect to the actual game screen immediately
// On web, show a landing page with download CTA

export default function PlayLandingPage() {
    const router = useRouter();
    const { date } = useLocalSearchParams<{ date: string }>();
    const params = useLocalSearchParams();
    const mode = (params.mode as string) || 'REGION';

    // NATIVE: Redirect immediately to the game
    if (Platform.OS !== 'web') {
        React.useEffect(() => {
            const targetDate = date || 'today';
            router.replace({
                pathname: `/game/${mode}/${targetDate}`,
                params: { skipIntro: 'true' },
            });
        }, []);

        // Show nothing while redirecting
        return null;
    }

    // WEB: Render landing page
    const appStoreUrl = 'https://apps.apple.com/app/elementle/id6758143250';

    return (
        <View style={styles.container}>
            {/* Smart App Banner meta tag for iOS Safari */}
            {Platform.OS === 'web' && (
                <meta name="apple-itunes-app" content="app-id=6758143250" />
            )}

            <View style={styles.content}>
                <Text style={styles.title}>Elementle</Text>

                <View style={styles.hamsterContainer}>
                    <Image
                        source={require('../../assets/Welcome-Hamster-Cutout.png')}
                        style={styles.hamsterImage}
                        contentFit="contain"
                    />
                </View>

                <View style={styles.textContainer}>
                    <Text style={styles.heading}>
                        Think you can solve it?
                    </Text>
                    <Text style={styles.description}>
                        Download Elementle to play today's puzzle!
                    </Text>
                    {date && (
                        <Text style={styles.dateHint}>
                            Puzzle date: {date}
                        </Text>
                    )}
                </View>

                <TouchableOpacity
                    onPress={() => Linking.openURL(appStoreUrl)}
                    style={styles.downloadButton}
                    activeOpacity={0.9}
                >
                    <Text style={styles.downloadButtonText}>Download on the App Store</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => router.push('/(auth)/onboarding')}
                    style={styles.webPlayButton}
                    activeOpacity={0.9}
                >
                    <Text style={styles.webPlayButtonText}>Play on Web</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAFAFA',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
        minHeight: Platform.OS === 'web' ? ('100vh' as any) : undefined,
    },
    content: {
        maxWidth: 448,
        width: '100%',
        alignItems: 'center',
        gap: 24,
    },
    title: {
        fontSize: 44,
        fontWeight: 'bold',
        fontFamily: 'Nunito_700Bold',
        color: '#54524F',
        textAlign: 'center',
    },
    hamsterContainer: {
        height: 160,
        width: 160,
        justifyContent: 'center',
        alignItems: 'center',
    },
    hamsterImage: {
        height: 160,
        width: 160,
    },
    textContainer: {
        alignItems: 'center',
        gap: 12,
    },
    heading: {
        fontSize: 22,
        fontWeight: 'bold',
        fontFamily: 'Nunito_700Bold',
        color: '#1e293b',
        textAlign: 'center',
    },
    description: {
        fontSize: 16,
        fontFamily: 'Nunito_400Regular',
        color: '#64748b',
        textAlign: 'center',
        maxWidth: 300,
    },
    dateHint: {
        fontSize: 14,
        fontFamily: 'Nunito_400Regular',
        color: '#94a3b8',
        textAlign: 'center',
    },
    downloadButton: {
        width: '70%',
        paddingVertical: 16,
        borderRadius: 9999,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#7DAAE8',
    },
    downloadButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        fontFamily: 'Nunito_700Bold',
    },
    webPlayButton: {
        width: '70%',
        paddingVertical: 16,
        borderRadius: 9999,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#8A8A8A',
    },
    webPlayButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        fontFamily: 'Nunito_700Bold',
    },
});
