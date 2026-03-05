/**
 * LeagueUnlockPopup.tsx — Bottom-sheet style popup shown when leagues auto-unlock
 *
 * Displayed once when a new user qualifies for leagues (first full month + min games).
 * Auto-dismisses after 16 seconds or on "Got it!" button press.
 */

import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Image,
    Modal,
    Animated,
    Dimensions,
    Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const WinHamster = require('../assets/ui/webp_assets/Win-Hamster-Blue.webp');
const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface LeagueUnlockPopupProps {
    visible: boolean;
    onDismiss: () => void;
}

export default function LeagueUnlockPopup({ visible, onDismiss }: LeagueUnlockPopupProps) {
    const insets = useSafeAreaInsets();
    const slideAnim = useRef(new Animated.Value(400)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (visible) {
            // Animate in
            Animated.parallel([
                Animated.spring(slideAnim, {
                    toValue: 0,
                    useNativeDriver: true,
                    tension: 50,
                    friction: 9,
                }),
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
            ]).start();

            // Auto-dismiss after 16 seconds
            timerRef.current = setTimeout(() => {
                handleDismiss();
            }, 16000);
        } else {
            slideAnim.setValue(400);
            fadeAnim.setValue(0);
        }

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [visible]);

    const handleDismiss = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        // Animate out
        Animated.parallel([
            Animated.timing(slideAnim, {
                toValue: 400,
                duration: 250,
                useNativeDriver: true,
            }),
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 250,
                useNativeDriver: true,
            }),
        ]).start(() => {
            onDismiss();
        });
    };

    if (!visible) return null;

    return (
        <Modal transparent visible={visible} animationType="none" statusBarTranslucent>
            {/* Backdrop */}
            <Animated.View
                style={{
                    flex: 1,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    justifyContent: 'flex-end',
                    opacity: fadeAnim,
                }}
            >
                <TouchableOpacity
                    style={{ flex: 1 }}
                    activeOpacity={1}
                    onPress={handleDismiss}
                />

                {/* Bottom Sheet */}
                <Animated.View
                    style={{
                        transform: [{ translateY: slideAnim }],
                        backgroundColor: '#7c3aed',
                        borderTopLeftRadius: 28,
                        borderTopRightRadius: 28,
                        paddingHorizontal: 24,
                        paddingTop: 28,
                        paddingBottom: Math.max(insets.bottom, 20) + 16,
                        alignItems: 'center',
                        maxWidth: 768,
                        width: '100%',
                        alignSelf: 'center',
                    }}
                >
                    {/* Hamster Image */}
                    <Image
                        source={WinHamster}
                        style={{
                            width: SCREEN_WIDTH >= 768 ? 120 : 90,
                            height: SCREEN_WIDTH >= 768 ? 120 : 90,
                            marginBottom: 16,
                        }}
                        resizeMode="contain"
                    />

                    {/* Trophy + Title */}
                    <Text
                        style={{
                            fontSize: 22,
                            fontWeight: '800',
                            fontFamily: 'Nunito_800ExtraBold',
                            color: '#ffffff',
                            textAlign: 'center',
                            marginBottom: 12,
                        }}
                    >
                        🏆 You have been entered into the Elementle Global and National leagues!
                    </Text>

                    {/* Description */}
                    <Text
                        style={{
                            fontSize: 15,
                            fontFamily: 'Nunito_500Medium',
                            color: 'rgba(255,255,255,0.9)',
                            textAlign: 'center',
                            lineHeight: 22,
                            marginBottom: 24,
                            paddingHorizontal: 8,
                        }}
                    >
                        Explore the leagues from your Home screen. You can create or join
                        new leagues and leave or delete leagues from the settings menu.
                    </Text>

                    {/* Got it! Button */}
                    <TouchableOpacity
                        onPress={handleDismiss}
                        activeOpacity={0.85}
                        style={{
                            backgroundColor: '#ffffff',
                            paddingVertical: 14,
                            paddingHorizontal: 48,
                            borderRadius: 14,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.15,
                            shadowRadius: 6,
                            elevation: 4,
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 17,
                                fontWeight: '700',
                                fontFamily: 'Nunito_700Bold',
                                color: '#7c3aed',
                                textAlign: 'center',
                            }}
                        >
                            Got it!
                        </Text>
                    </TouchableOpacity>
                </Animated.View>
            </Animated.View>
        </Modal>
    );
}
