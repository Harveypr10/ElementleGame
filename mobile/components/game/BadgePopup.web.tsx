import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { X } from 'lucide-react-native';

// Default/fallback badge image
const DefaultBadge = require('../../assets/badges/webp_new/Badge - Streak 7.webp');

interface Badge {
    id: number;
    name: string;
    description: string;
    category: string;
    threshold: number;
    badge_count?: number;
    game_type?: 'REGION' | 'USER';
}

interface BadbePopupWebProps {
    visible: boolean;
    badge: Badge | null;
    onClose: () => void;
    gameMode?: 'REGION' | 'USER';
}

export function BadgePopupWeb({ visible, badge, onClose, gameMode = 'REGION' }: BadbePopupWebProps) {
    const [opacity, setOpacity] = useState(0);
    const [isVisible, setIsVisible] = useState(false);
    const autoDismissRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (visible && badge) {
            setIsVisible(true);
            setTimeout(() => setOpacity(1), 50);

            // Auto-dismiss after 4 seconds
            autoDismissRef.current = setTimeout(() => {
                handleClose();
            }, 4000);
        }

        return () => {
            if (autoDismissRef.current) {
                clearTimeout(autoDismissRef.current);
            }
        };
    }, [visible, badge]);

    const handleClose = () => {
        if (autoDismissRef.current) {
            clearTimeout(autoDismissRef.current);
            autoDismissRef.current = null;
        }
        setOpacity(0);
        setTimeout(() => {
            setIsVisible(false);
            onClose();
        }, 400);
    };

    if (!isVisible || !badge) return null;

    // Get badge color based on category
    const getBadgeColor = () => {
        const cat = badge.category.toLowerCase();
        if (cat === 'streak') return '#EF4444'; // Red
        if (cat === 'accuracy') return '#22C55E'; // Green
        if (cat === 'percentile') return '#8B5CF6'; // Purple
        return '#3B82F6'; // Blue default
    };

    const badgeColor = getBadgeColor();

    return (
        <Pressable style={[styles.overlay, { opacity }]} onPress={handleClose}>
            <View style={styles.popup}>
                {/* Close Button */}
                <Pressable style={styles.closeButton} onPress={handleClose}>
                    <X size={20} color="#64748B" />
                </Pressable>

                {/* Badge Image - Using default for now */}
                <View style={styles.badgeContainer}>
                    <Image
                        source={DefaultBadge}
                        style={styles.badgeImage}
                        contentFit="contain"
                    />
                </View>

                {/* Badge Info */}
                <Text style={styles.unlockText}>Badge Unlocked!</Text>
                <Text style={[styles.badgeName, { color: badgeColor }]}>{badge.name}</Text>
                <Text style={styles.badgeDescription}>{badge.description}</Text>
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1001,
    },
    popup: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 32,
        alignItems: 'center',
        maxWidth: 340,
        width: '90%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 24,
        elevation: 10,
        position: 'relative',
    },
    closeButton: {
        position: 'absolute',
        top: 12,
        right: 12,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    badgeContainer: {
        width: 140,
        height: 140,
        marginBottom: 16,
    },
    badgeImage: {
        width: '100%',
        height: '100%',
    },
    unlockText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748B',
        fontFamily: 'Nunito',
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    badgeName: {
        fontSize: 24,
        fontWeight: '800',
        fontFamily: 'Nunito',
        marginBottom: 8,
        textAlign: 'center',
    },
    badgeDescription: {
        fontSize: 14,
        fontWeight: '500',
        color: '#64748B',
        fontFamily: 'Nunito',
        textAlign: 'center',
        lineHeight: 20,
    },
});
