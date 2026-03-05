/**
 * usePushToken — Registers the Expo Push Token for remote award notifications
 *
 * - Requests notification permission (reuses NotificationService.requestPermissions)
 * - Gets the ExpoPushToken from expo-notifications
 * - Saves it to user_profiles.expo_push_token
 * - Caches in AsyncStorage to avoid redundant DB writes
 *
 * Called once from UserScopedProviders in _layout.tsx.
 */

import { useEffect } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import * as NotificationService from '../lib/NotificationService';

const PUSH_TOKEN_CACHE_KEY = 'expo_push_token_saved';

export function usePushToken() {
    const { user } = useAuth();

    useEffect(() => {
        if (!user?.id) return;
        if (Platform.OS === 'web') return; // Push tokens not supported on web

        registerPushToken(user.id);
    }, [user?.id]);
}

async function registerPushToken(userId: string): Promise<void> {
    try {
        // Dynamically import expo-notifications (may not be available in all environments)
        let Notifications: typeof import('expo-notifications') | null = null;
        try {
            Notifications = require('expo-notifications');
        } catch {
            console.log('[PushToken] expo-notifications not available — skipping');
            return;
        }

        // Guard: native module may be missing (simulator without dev client)
        if (!Notifications?.getExpoPushTokenAsync) {
            console.log('[PushToken] Native push token module not available — skipping');
            return;
        }

        // 1. Check if permission is already granted (don't prompt on every launch)
        const hasPermission = await NotificationService.hasPermission();
        if (!hasPermission) {
            // Only request if status is undetermined (first time)
            const granted = await NotificationService.requestPermissions();
            if (!granted) {
                console.log('[PushToken] Notification permission not granted — skipping');
                return;
            }
        }

        // 2. Get the Expo Push Token
        const tokenData = await Notifications.getExpoPushTokenAsync({
            projectId: 'f566ab94-4e6b-48bd-8393-6ed577d17db2',
        });
        const token = tokenData.data;

        if (!token) {
            console.warn('[PushToken] Received empty token');
            return;
        }

        // 3. Check cache — skip DB write if token hasn't changed
        const cachedToken = await AsyncStorage.getItem(PUSH_TOKEN_CACHE_KEY);
        if (cachedToken === token) {
            console.log('[PushToken] Token unchanged — skipping DB update');
            return;
        }

        // 4. Save to user_profiles
        // Cast to any because expo_push_token was just added to DB
        // and generated types haven't been refreshed yet
        const { error } = await supabase
            .from('user_profiles')
            .update({ expo_push_token: token } as any)
            .eq('id', userId);

        if (error) {
            console.error('[PushToken] Error saving push token:', error);
            return;
        }

        // 5. Cache the token
        await AsyncStorage.setItem(PUSH_TOKEN_CACHE_KEY, token);
        console.log('[PushToken] Push token registered successfully');
    } catch (e) {
        // Non-fatal — don't crash the app if push token registration fails
        console.warn('[PushToken] Registration failed:', e);
    }
}
