import React, { createContext, useContext, useState, ReactNode } from 'react';
import { View, Text, Animated } from 'react-native';
import { styled } from 'nativewind';

const StyledView = styled(View);
const StyledText = styled(Text);

interface Toast {
    id: string;
    title: string;
    description?: string;
    variant?: 'default' | 'success' | 'error';
    duration?: number;
}

interface ToastContextType {
    toast: (toast: Omit<Toast, 'id'>) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const toast = ({ title, description, variant = 'default', duration = 3000 }: Omit<Toast, 'id'>) => {
        const id = Math.random().toString(36).substring(7);
        const newToast = { id, title, description, variant, duration };

        setToasts(prev => [...prev, newToast]);

        // Auto-remove after duration
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, duration);
    };

    return (
        <ToastContext.Provider value={{ toast }}>
            {children}

            {/* Toast Container */}
            <StyledView className="absolute top-16 left-0 right-0 px-4 pointer-events-none z-50">
                {toasts.map((t, index) => (
                    <ToastMessage key={t.id} toast={t} index={index} />
                ))}
            </StyledView>
        </ToastContext.Provider>
    );
}

function ToastMessage({ toast, index }: { toast: Toast; index: number }) {
    const [fadeAnim] = useState(new Animated.Value(0));
    const [slideAnim] = useState(new Animated.Value(-50));

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
