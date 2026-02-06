/**
 * useAdminLogic.ts
 * Shared logic for Admin dashboard screens
 */

import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useProfile } from './useProfile';
import { useOptions } from '../lib/options';
import { useThemeColor } from './useThemeColor';
import { supabase } from '../lib/supabase';

export interface AdminMenuItem {
    title: string;
    subtitle: string;
    icon: string; // Icon name for reference
    color: string;
    route: string;
}

export const adminMenuItems: AdminMenuItem[] = [
    {
        title: "Restrictions",
        subtitle: "Manage postcode and category change limits",
        icon: "Shield",
        color: "#dc2626",
        route: "/settings/admin/restrictions"
    },
    {
        title: "Subscription Tiers",
        subtitle: "Manage visibility of subscription tiers",
        icon: "Zap",
        color: "#9333ea",
        route: "/settings/admin/tiers"
    },
    {
        title: "Demand Scheduler",
        subtitle: "Configure demand calculation frequency",
        icon: "CalendarClock",
        color: "#2563eb",
        route: "/settings/admin/scheduler"
    },
    {
        title: "Screen Navigator",
        subtitle: "Test various specialized screens (Debug)",
        icon: "Layers",
        color: "#475569",
        route: "/settings/admin/navigator"
    }
];

export const useAdminLogic = () => {
    const router = useRouter();
    const { isAdmin, isLoading: profileLoading } = useProfile();
    const { textScale } = useOptions();

    // Theme
    const backgroundColor = useThemeColor({}, 'background');
    const surfaceColor = useThemeColor({}, 'surface');
    const borderColor = useThemeColor({}, 'border');
    const textColor = useThemeColor({}, 'text');
    const iconColor = useThemeColor({}, 'icon');

    // Security redirect for non-admins
    useEffect(() => {
        if (!profileLoading && !isAdmin) {
            router.replace('/');
        }
    }, [isAdmin, profileLoading]);

    const goBack = () => {
        router.back();
    };

    const navigateTo = (route: string) => {
        router.push(route);
    };

    return {
        isAdmin,
        isLoading: profileLoading,
        textScale,
        menuItems: adminMenuItems,

        colors: {
            background: backgroundColor,
            surface: surfaceColor,
            border: borderColor,
            text: textColor,
            icon: iconColor,
        },

        goBack,
        navigateTo,
    };
};
