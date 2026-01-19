import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    TextInput,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    StyleSheet,
    Text,
    TextInputProps,
} from 'react-native';

interface PostcodeAutocompleteProps extends Omit<TextInputProps, 'value' | 'onChangeText' | 'onChange'> {
    value: string;
    onChange: (value: string) => void;
    className?: string;
    required?: boolean;
}

interface PostcodeSuggestion {
    postcode: string;
}

export function PostcodeAutocomplete({
    value,
    onChange,
    className,
    required = false,
    ...props
}: PostcodeAutocompleteProps) {
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [validPostcodes, setValidPostcodes] = useState<Set<string>>(new Set());
    const [isValid, setIsValid] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');
    const [isFocused, setIsFocused] = useState(false);

    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const inputRef = useRef<TextInput>(null);

    // Fetch suggestions from Postcodes.io
    const fetchSuggestions = useCallback(async (input: string) => {
        const cleanInput = input.replace(/\s/g, '').toUpperCase();
        if (!cleanInput || cleanInput.length < 1) {
            setSuggestions([]);
            setShowSuggestions(false);
            setValidPostcodes(new Set());
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(
                `https://api.postcodes.io/postcodes?q=${encodeURIComponent(cleanInput)}`
            );
            const data = await res.json();

            if (data.result) {
                const postcodes = data.result.slice(0, 20).map((r: any) => r.postcode);
                setSuggestions(postcodes);
                setValidPostcodes(new Set(postcodes));
                setShowSuggestions(isFocused && postcodes.length > 0);
            } else {
                setSuggestions([]);
                setValidPostcodes(new Set());
                setShowSuggestions(false);
            }
        } catch (error) {
            console.error('Error fetching postcodes:', error);
            setSuggestions([]);
            setValidPostcodes(new Set());
            setShowSuggestions(false);
        } finally {
            setLoading(false);
        }
    }, [isFocused]);

    // Debounced search
    const handleInputChange = useCallback((newValue: string) => {
        const upperValue = newValue.toUpperCase();
        onChange(upperValue);
        setSelectedIndex(-1);

        // Reset validation state while typing
        if (upperValue) {
            setIsValid(true);
            setErrorMessage('');
        } else {
            setIsValid(true);
            setErrorMessage('');
        }

        // Clear existing timer
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        // Set new timer (300ms debounce)
        debounceTimerRef.current = setTimeout(() => {
            fetchSuggestions(upperValue);
        }, 300);
    }, [onChange, fetchSuggestions]);

    // Handle suggestion selection
    const selectSuggestion = (suggestion: string) => {
        console.log('[PostcodeAutocomplete] Selecting:', suggestion);
        onChange(suggestion);
        setSuggestions([]);
        setShowSuggestions(false);
        setIsValid(true);
        // Don't blur - let user proceed
    };

    // Validate on blur
    const handleBlur = useCallback(() => {
        setIsFocused(false);

        // Use shorter delay - onPressIn fires before blur
        setTimeout(() => {
            setShowSuggestions(false);
            setSelectedIndex(-1);

            const currentValue = value;

            // If blank, allow blur (empty is valid)
            if (!currentValue) {
                setIsValid(true);
                setErrorMessage('');
                return;
            }

            // Check against cached valid postcodes (EXACT MATCH required)
            const cleanCurrent = currentValue.replace(/\s/g, '').toUpperCase();
            const matchedPostcode = Array.from(validPostcodes).find(
                (pc) => pc.replace(/\s/g, '').toUpperCase() === cleanCurrent
            );

            if (matchedPostcode) {
                onChange(matchedPostcode);
                setIsValid(true);
                setErrorMessage('');
                return;
            }

            // Postcode does NOT match any suggestion - show error and refocus
            setIsValid(false);
            setErrorMessage('Please select a postcode from the dropdown list or clear the field');

            // Refocus input to prevent blur
            inputRef.current?.focus();
        }, 250); // Increased delay to ensure onPress fires
    }, [value, validPostcodes, onChange]);

    const handleFocus = useCallback(() => {
        setIsFocused(true);
        if (suggestions.length > 0) {
            setShowSuggestions(true);
        }
    }, [suggestions.length]);

    // Clean up timers on unmount
    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, []);

    return (
        <View style={styles.container}>
            <View style={[
                styles.inputContainer,
                !isValid && styles.inputContainerInvalid
            ]}>
                <TextInput
                    ref={inputRef}
                    value={value}
                    onChangeText={handleInputChange}
                    onBlur={handleBlur}
                    onFocus={handleFocus}
                    style={styles.input}
                    className="text-base font-nunito"
                    placeholder={props.placeholder || 'Enter postcode'}
                    placeholderTextColor="#999"
                    autoCapitalize="characters"
                    autoCorrect={false}
                    autoComplete="off"
                    {...props}
                />

                {loading && (
                    <ActivityIndicator size="small" color="#666" style={styles.loader} />
                )}
            </View>

            {errorMessage && (
                <Text style={styles.errorText}>
                    {errorMessage}
                </Text>
            )}

            {showSuggestions && suggestions.length > 0 && (
                <View style={styles.suggestionsContainer}>
                    <FlatList
                        data={suggestions}
                        keyExtractor={(item, index) => `${item}-${index}`}
                        renderItem={({ item, index }) => (
                            <TouchableOpacity
                                onPressIn={() => selectSuggestion(item)}
                                style={[
                                    styles.suggestionItem,
                                    selectedIndex === index && styles.suggestionItemSelected
                                ]}
                            >
                                <Text style={styles.suggestionText}>{item}</Text>
                            </TouchableOpacity>
                        )}
                        style={styles.suggestionsList}
                        keyboardShouldPersistTaps="handled"
                    />
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'relative',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#d1d5db',
        borderRadius: 8,
        backgroundColor: '#fff',
        paddingHorizontal: 12,
        height: 40,
    },
    inputContainerInvalid: {
        borderColor: '#ef4444',
    },
    input: {
        flex: 1,
        paddingVertical: 8,
        color: '#000',
    },
    loader: {
        marginLeft: 8,
    },
    errorText: {
        fontSize: 12,
        color: '#ef4444',
        marginTop: 4,
        fontFamily: 'Nunito',
    },
    suggestionsContainer: {
        position: 'absolute',
        top: 44,
        left: 0,
        right: 0,
        maxHeight: 240,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#d1d5db',
        borderRadius: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        zIndex: 1000,
    },
    suggestionsList: {
        maxHeight: 240,
    },
    suggestionItem: {
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
        minHeight: 44,
        justifyContent: 'center',
    },
    suggestionItemSelected: {
        backgroundColor: '#f3f4f6',
    },
    suggestionText: {
        fontSize: 14,
        color: '#000',
        fontFamily: 'Nunito',
    },
});
