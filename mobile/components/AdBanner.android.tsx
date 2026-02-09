/**
 * Android-specific AdBanner — No-op implementation.
 * 
 * Returns an invisible View so layout doesn't break,
 * but no ads are rendered on Android.
 */

import React from 'react';
import { View } from 'react-native';

export function AdBanner() {
    return <View style={{ height: 0, display: 'none' }} />;
}
