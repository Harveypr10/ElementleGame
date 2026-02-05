/**
 * Go Pro Button - Web Version
 * 
 * Web-specific implementation with proper CSS styling.
 */

import React, { useState, useEffect } from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { useSubscription } from '../hooks/useSubscription';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface GoProButtonProps {
    onPress: () => void;
    scale?: number;
}

export function GoProButton({ onPress, scale = 1 }: GoProButtonProps) {
    const { isPro, isLoading } = useSubscription();
    const [cachedPro, setCachedPro] = useState(false);
    const [cacheChecked, setCacheChecked] = useState(false);

    useEffect(() => {
        AsyncStorage.getItem('cached_is_pro').then(val => {
            if (val === 'true') setCachedPro(true);
            setCacheChecked(true);
        });
    }, []);

    if (!cacheChecked) return null;

    const showPro = isLoading ? cachedPro : isPro;

    if (showPro) {
        return (
            <TouchableOpacity
                onPress={onPress}
                testID="button-pro-status"
                style={[
                    styles.button,
                    {
                        paddingHorizontal: 12 * scale,
                        paddingVertical: 6 * scale,
                    }
                ]}
            >
                <Text style={[styles.proText, { fontSize: 14 * scale }]}>
                    Pro
                </Text>
            </TouchableOpacity>
        );
    }

    return (
        <TouchableOpacity
            onPress={onPress}
            testID="button-go-pro"
            style={[
                styles.button,
                {
                    paddingHorizontal: 8 * scale,
                    paddingVertical: 6 * scale,
                }
            ]}
        >
            {/* Ads on indicator */}
            <View style={styles.adsRow}>
                <View style={styles.adsDot} />
                <Text style={styles.adsText}>Ads on</Text>
            </View>

            {/* Go Pro text */}
            <Text style={[styles.goProText, { fontSize: 12 * scale }]}>
                Go Pro
            </Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    button: {
        backgroundColor: '#f97316', // orange-500
        borderRadius: 8,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        cursor: 'pointer',
    },
    proText: {
        fontFamily: 'Nunito, sans-serif',
        fontWeight: '700',
        color: 'white',
    },
    adsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        marginBottom: 2,
    },
    adsDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#4ade80', // green-400
        boxShadow: '0 0 4px #4ade80',
    },
    adsText: {
        fontFamily: 'Nunito, sans-serif',
        fontSize: 10,
        fontWeight: '400',
        color: 'white',
    },
    goProText: {
        fontFamily: 'Nunito, sans-serif',
        fontWeight: '700',
        color: 'white',
        textAlign: 'center',
    },
});
