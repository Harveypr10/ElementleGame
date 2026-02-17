import React, { createContext, useContext, useState, ReactNode } from 'react';
import { View, Text, Animated } from 'react-native';
import { Image } from 'expo-image';
import { styled } from 'nativewind';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const StyledView = styled(View);
const StyledText = styled(Text);

interface Toast {
    id: string;
    title: string;
    description?: string;
    variant?: 'default' | 'success' | 'error' | 'share' | 'migration';
    duration?: number;
    position?: 'top' | 'bottom';
}

interface ToastContextType {
    toast: (toast: Omit<Toast, 'id'>) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const toast = ({ title, description, variant = 'default', duration = 3000, position = 'top' }: Omit<Toast, 'id'>) => {
        const id = Math.random().toString(36).substring(7);
        const newToast = { id, title, description, variant, duration, position };

        setToasts(prev => [...prev, newToast]);

        // Auto-remove after duration + buffer for exit animation to complete.
        // The BottomToastMessage exit animation starts at (duration - 400)ms
        // and takes 300ms. Adding 500ms buffer ensures the animation finishes
        // before React unmounts the component (fixes iPhone instant-disappear).
        const removalBuffer = 500;
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, duration + removalBuffer);
    };

    const topToasts = toasts.filter(t => t.position !== 'bottom');
    const bottomToasts = toasts.filter(t => t.position === 'bottom');

    return (
        <ToastContext.Provider value={{ toast }}>
            {children}

            {/* Top Toast Container */}
            <StyledView className="absolute top-16 left-0 right-0 px-4 pointer-events-none z-50">
                {topToasts.map((t, index) => (
                    <ToastMessage key={t.id} toast={t} index={index} />
                ))}
            </StyledView>

            {/* Bottom Toast Container */}
            {bottomToasts.length > 0 && (
                <BottomToastContainer>
                    {bottomToasts.map((t, index) => (
                        <BottomToastMessage key={t.id} toast={t} />
                    ))}
                </BottomToastContainer>
            )}
        </ToastContext.Provider>
    );
}

function BottomToastContainer({ children }: { children: ReactNode }) {
    const insets = useSafeAreaInsets();
    return (
        <View
            style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 99999,
                pointerEvents: 'box-none',
            }}
        >
            {children}
        </View>
    );
}

const ShareHamsterImg = require('../assets/ui/webp_assets/Login-Hamster-White.webp');

function BottomToastMessage({ toast }: { toast: Toast }) {
    const insets = useSafeAreaInsets();
    const [slideAnim] = React.useState(new Animated.Value(400));

    React.useEffect(() => {
        // Slide up with spring
        Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
            damping: 20,
            stiffness: 90,
        }).start();

        // Slide back down before removal
        const exitDelay = (toast.duration || 3000) - 400;
        const exitTimer = setTimeout(() => {
            Animated.timing(slideAnim, {
                toValue: 500,
                duration: 300,
                useNativeDriver: true,
            }).start();
        }, exitDelay);

        return () => clearTimeout(exitTimer);
    }, []);

    const bgColor =
        toast.variant === 'share' ? '#e87daa' :
            toast.variant === 'migration' ? '#7DAAE8' :
                toast.variant === 'success' ? '#22c55e' :
                    toast.variant === 'error' ? '#ef4444' :
                        '#334155';

    return (
        <Animated.View
            style={{
                transform: [{ translateY: slideAnim }],
            }}
        >
            <StyledView
                className="w-full px-6 pb-6 rounded-t-3xl shadow-2xl items-center"
                // pt ~19px (p-6 = 24px reduced by 20%)
                style={{ backgroundColor: bgColor, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 16) + 8 }}
            >
                <StyledView className="w-16 h-1 mt-1 mb-4 bg-white/30 rounded-full" />

                <StyledText className="text-lg font-n-bold text-white mb-1 text-center">
                    {toast.title}
                </StyledText>
                {toast.description && (
                    <StyledText className="text-base font-n-medium text-white/90 text-center leading-6">
                        {toast.description}
                    </StyledText>
                )}

                {/* Share hamster image */}
                <Image
                    source={ShareHamsterImg}
                    style={{ width: 108, height: 108, marginTop: 18 }}
                    contentFit="contain"
                />
            </StyledView>
        </Animated.View>
    );
}

function ToastMessage({ toast, index }: { toast: Toast; index: number }) {
    const [fadeAnim] = React.useState(new Animated.Value(0));
    const [slideAnim] = React.useState(new Animated.Value(-50));

    React.useEffect(() => {
        // Entrance animation
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.spring(slideAnim, {
                toValue: 0,
                tension: 40,
                friction: 7,
                useNativeDriver: true,
            }),
        ]).start();

        // Exit animation before removal
        const exitDelay = (toast.duration || 3000) - 300;
        setTimeout(() => {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    toValue: -50,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start();
        }, exitDelay);
    }, []);

    const bgColorClass =
        toast.variant === 'success' ? 'bg-green-100 dark:bg-green-900/90' :
            toast.variant === 'error' ? 'bg-red-100 dark:bg-red-900/90' :
                'bg-white dark:bg-slate-800';

    const textColorClass =
        toast.variant === 'success' ? 'text-green-900 dark:text-green-100' :
            toast.variant === 'error' ? 'text-red-900 dark:text-red-100' :
                'text-slate-900 dark:text-white';

    const descColorClass =
        toast.variant === 'success' ? 'text-green-700 dark:text-green-200' :
            toast.variant === 'error' ? 'text-red-700 dark:text-red-200' :
                'text-slate-600 dark:text-slate-300';

    return (
        <Animated.View
            style={{
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
                marginBottom: 8,
            }}
        >
            <StyledView
                className={`${bgColorClass} rounded-lg p-4 shadow-lg border border-slate-200 dark:border-slate-700 pointer-events-auto`}
                style={{ top: index * 70 }}
            >
                <StyledText className={`${textColorClass} font-n-bold text-base`}>
                    {toast.title}
                </StyledText>
                {toast.description && (
                    <StyledText className={`${descColorClass} font-n-medium text-sm mt-1`}>
                        {toast.description}
                    </StyledText>
                )}
            </StyledView>
        </Animated.View>
    );
}

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within ToastProvider');
    }
    return context;
};
