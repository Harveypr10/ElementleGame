import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';
// We can use expo-constants for version on web too if configured, otherwise hardcode or use package.json
import Constants from 'expo-constants';

export default function AboutWeb() {
    const router = useRouter();
    const [backHover, setBackHover] = useState(false);

    const version = Constants.expoConfig?.version || '1.0.0';

    return (
        <View style={styles.container}>
            <View style={styles.contentWrapper}>

                {/* Header */}
                <View style={styles.header}>
                    <Pressable
                        onPress={() => router.back()}
                        onHoverIn={() => setBackHover(true)}
                        onHoverOut={() => setBackHover(false)}
                        style={[styles.backButton, backHover && styles.backButtonHover]}
                    >
                        <ChevronLeft size={24} color="#374151" />
                    </Pressable>
                    <Text style={styles.title}>About</Text>
                    <View style={{ width: 44 }} />
                </View>

                {/* Card */}
                <View style={styles.card}>
                    <ScrollView style={styles.scrollContent}>
                        <View style={styles.section}>
                            <Text style={styles.subHeader}>About Elementle</Text>
                            <Text style={styles.paragraph}>
                                Elementle is a daily historical date puzzle game. Each day, you're challenged to pin down the exact date of a key event from history. You'll make guesses, get feedback, and refine your answer until you land on the correct date — or run out of tries.
                            </Text>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.paragraph}>The game blends learning with play:</Text>
                            <View style={styles.listItem}>
                                <Text style={styles.listIcon}>🧩</Text>
                                <Text style={styles.listText}>
                                    <Text style={styles.bold}>Daily Challenge</Text> – A new puzzle every day, tied to a real historical event.
                                </Text>
                            </View>
                            <View style={styles.listItem}>
                                <Text style={styles.listIcon}>📚</Text>
                                <Text style={styles.listText}>
                                    <Text style={styles.bold}>Learn as you play</Text> – Each puzzle comes with event details, so you walk away knowing more than when you started.
                                </Text>
                            </View>
                            <View style={styles.listItem}>
                                <Text style={styles.listIcon}>📊</Text>
                                <Text style={styles.listText}>
                                    <Text style={styles.bold}>Track your progress</Text> – Stats and streaks let you see how your knowledge (and intuition) grows over time.
                                </Text>
                            </View>
                            <View style={styles.listItem}>
                                <Text style={styles.listIcon}>🎉</Text>
                                <Text style={styles.listText}>
                                    <Text style={styles.bold}>Celebrate wins</Text> – Animated hamster companions cheer you on when you succeed.
                                </Text>
                            </View>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.paragraph}>
                                Elementle is built to be fun, fair, and educational — whether you're a history buff, a casual player, or just love a good daily challenge.
                            </Text>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.subHeader}>Credits</Text>
                            <Text style={styles.paragraph}>
                                Elementle was created by <Text style={styles.bold}>dobl Ltd</Text>, a team dedicated to helping people get the very best from technology in ways that feel simple, engaging, and enjoyable. The game reflects that mission — blending thoughtful design, playful interaction, and a touch of curiosity to make learning history both accessible and fun.
                            </Text>
                            <Text style={styles.copyright}>
                                © {new Date().getFullYear()} Elementle v{version}
                            </Text>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.subHeader}>Privacy</Text>
                            <Text style={styles.paragraph}>
                                Elementle uses Supabase authentication and stores puzzle attempts to track your progress.
                            </Text>
                            <Pressable onPress={() => router.push('/privacy')}>
                                <Text style={styles.link}>View Privacy Policy</Text>
                            </Pressable>
                        </View>
                    </ScrollView>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        paddingTop: 32,
        paddingBottom: 40,
        paddingHorizontal: 16,
        minHeight: '100vh' as any,
    },
    contentWrapper: {
        width: '100%',
        maxWidth: 672, // max-w-2xl
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
    },
    backButtonHover: {
        backgroundColor: '#f3f4f6',
    },
    title: {
        fontFamily: 'Nunito_700Bold',
        fontSize: 32,
        color: '#000',
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
        flex: 1,
    },
    scrollContent: {
        flex: 1,
    },
    section: {
        marginBottom: 24,
    },
    subHeader: {
        fontFamily: 'Nunito_600SemiBold',
        fontSize: 20,
        color: '#0f172a',
        marginBottom: 12,
    },
    paragraph: {
        fontFamily: 'Nunito_400Regular',
        fontSize: 16,
        color: '#334155',
        lineHeight: 24,
        marginBottom: 12,
    },
    listItem: {
        flexDirection: 'row',
        marginBottom: 8,
        paddingLeft: 4,
    },
    listIcon: {
        fontSize: 16,
        marginRight: 8,
        marginTop: 4,
    },
    listText: {
        fontFamily: 'Nunito_400Regular',
        fontSize: 16,
        color: '#334155',
        lineHeight: 24,
        flex: 1,
    },
    bold: {
        fontFamily: 'Nunito_700Bold',
        color: '#0f172a',
    },
    copyright: {
        fontFamily: 'Nunito_400Regular',
        fontSize: 14,
        color: '#64748b',
        marginTop: 8,
    },
    link: {
        fontFamily: 'Nunito_600SemiBold',
        fontSize: 16,
        color: '#2563eb', // primary/blue
        textDecorationLine: 'underline',
    },
});
