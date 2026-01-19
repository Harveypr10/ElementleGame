import React, { useState, forwardRef } from 'react';
import { View, TextInput, TouchableOpacity, TextInputProps, StyleSheet } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';

interface PasswordInputProps extends Omit<TextInputProps, 'secureTextEntry'> {
    className?: string;
}

export const PasswordInput = forwardRef<TextInput, PasswordInputProps>(
    ({ className, style, ...props }, ref) => {
        const [showPassword, setShowPassword] = useState(false);

        return (
            <View style={[styles.container, style]} className={className}>
                <TextInput
                    ref={ref}
                    {...props}
                    secureTextEntry={!showPassword}
                    style={styles.input}
                    className="flex-1 text-base font-nunito"
                    placeholderTextColor="#999"
                />
                <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
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
    iconButton: {
        padding: 4,
        marginLeft: 8,
    },
});
