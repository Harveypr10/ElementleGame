import React, { useState, forwardRef, useRef, useCallback } from 'react';
import { View, TextInput, TouchableOpacity, TextInputProps, StyleSheet, Platform } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';

interface PasswordInputProps extends Omit<TextInputProps, 'secureTextEntry'> {
    className?: string;
}

/**
 * PasswordInput — dual-input pattern to avoid iOS bug where toggling
 * secureTextEntry causes backspace to clear the entire field.
 *
 * Two TextInputs are rendered (one secure, one plain text) and only
 * the active one is shown. The secureTextEntry prop never changes
 * on either input, sidestepping the iOS behaviour.
 */
export const PasswordInput = forwardRef<TextInput, PasswordInputProps>(
    ({ className, style, value, onChangeText, ...props }, ref) => {
        const [showPassword, setShowPassword] = useState(false);
        const secureRef = useRef<TextInput | null>(null);
        const plainRef = useRef<TextInput | null>(null);

        // Forward ref to the currently active input
        const setRef = useCallback(
            (node: TextInput | null) => {
                if (typeof ref === 'function') ref(node);
                else if (ref) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (ref as any).current = node;
                }
            },
            [ref],
        );

        const handleToggle = () => {
            const next = !showPassword;
            setShowPassword(next);
            // Focus the newly visible input on next frame
            setTimeout(() => {
                if (next) {
                    plainRef.current?.focus();
                } else {
                    secureRef.current?.focus();
                }
            }, 50);
        };

        return (
            <View style={[styles.container, style as any]} className={className}>
                {/* Secure (hidden) input — always has secureTextEntry=true */}
                <TextInput
                    ref={(node) => {
                        secureRef.current = node;
                        if (!showPassword) setRef(node);
                    }}
                    {...props}
                    value={value}
                    onChangeText={onChangeText}
                    secureTextEntry={true}
                    style={[styles.input, showPassword && styles.hidden]}
                    className="flex-1 text-base font-nunito"
                    placeholderTextColor="#999"
                    pointerEvents={showPassword ? 'none' : 'auto'}
                />

                {/* Plain text input — always has secureTextEntry=false */}
                <TextInput
                    ref={(node) => {
                        plainRef.current = node;
                        if (showPassword) setRef(node);
                    }}
                    {...props}
                    value={value}
                    onChangeText={onChangeText}
                    secureTextEntry={false}
                    style={[styles.input, !showPassword && styles.hidden]}
                    className="flex-1 text-base font-nunito"
                    placeholderTextColor="#999"
                    pointerEvents={showPassword ? 'auto' : 'none'}
                />

                <TouchableOpacity
                    onPress={handleToggle}
                    style={styles.iconButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    {showPassword ? (
                        <EyeOff size={20} color="#666" />
                    ) : (
                        <Eye size={20} color="#666" />
                    )}
                </TouchableOpacity>
            </View>
        );
    }
);

PasswordInput.displayName = 'PasswordInput';

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#d1d5db',
        borderRadius: 8,
        backgroundColor: '#fff',
        paddingHorizontal: 12,
        height: 40,
    },
    input: {
        flex: 1,
        paddingVertical: 8,
        color: '#000',
    },
    hidden: {
        position: 'absolute',
        width: 0,
        height: 0,
        opacity: 0,
    },
    iconButton: {
        padding: 4,
        marginLeft: 8,
    },
});

