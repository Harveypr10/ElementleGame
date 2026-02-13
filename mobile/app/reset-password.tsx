/**
 * Passthrough Route: /reset-password
 * 
 * This route exists because Universal Links (applinks:elementle.tech) and
 * Supabase password reset emails point to /reset-password.
 * 
 * With the Auth Orchestrator:
 * - Web: detectSessionInUrl: true auto-processes the #access_token fragment,
 *   fires PASSWORD_RECOVERY event, and auth.tsx sets pendingRecovery=true.
 *   NavigationGuard then redirects to /(auth)/set-new-password.
 * - Native: checkNativeDeepLink in auth.tsx processes the tokens directly.
 * 
 * This component simply renders a spinner while the orchestrator does its work.
 */

import React from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';

export default function ResetPasswordPassthrough() {
    return (
        <View style={styles.container}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.text}>Processing reset link...</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
    },
    text: {
        marginTop: 16,
        fontSize: 16,
        color: '#64748b',
    },
});
