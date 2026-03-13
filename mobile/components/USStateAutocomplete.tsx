/**
 * USStateAutocomplete.tsx
 * Typeahead autocomplete for US states, matching PostcodeAutocomplete design.
 * Returns value in 'US-XX' format (e.g. 'US-TX', 'US-CA').
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Text,
    TextInputProps,
    ScrollView,
} from 'react-native';

import { useThemeColor } from '../hooks/useThemeColor';

interface USStateAutocompleteProps extends Omit<TextInputProps, 'value' | 'onChangeText' | 'onChange'> {
    value: string; // 'US-XX' format or display name
    onChange: (value: string) => void; // Returns 'US-XX' format
    className?: string;
    required?: boolean;
}

interface USState {
    code: string; // e.g. 'US-CA'
    name: string; // e.g. 'California'
    abbr: string; // e.g. 'CA'
}

const US_STATES: USState[] = [
    { code: 'US-AL', name: 'Alabama', abbr: 'AL' },
    { code: 'US-AK', name: 'Alaska', abbr: 'AK' },
    { code: 'US-AZ', name: 'Arizona', abbr: 'AZ' },
    { code: 'US-AR', name: 'Arkansas', abbr: 'AR' },
    { code: 'US-CA', name: 'California', abbr: 'CA' },
    { code: 'US-CO', name: 'Colorado', abbr: 'CO' },
    { code: 'US-CT', name: 'Connecticut', abbr: 'CT' },
    { code: 'US-DE', name: 'Delaware', abbr: 'DE' },
    { code: 'US-FL', name: 'Florida', abbr: 'FL' },
    { code: 'US-GA', name: 'Georgia', abbr: 'GA' },
    { code: 'US-HI', name: 'Hawaii', abbr: 'HI' },
    { code: 'US-ID', name: 'Idaho', abbr: 'ID' },
    { code: 'US-IL', name: 'Illinois', abbr: 'IL' },
    { code: 'US-IN', name: 'Indiana', abbr: 'IN' },
    { code: 'US-IA', name: 'Iowa', abbr: 'IA' },
    { code: 'US-KS', name: 'Kansas', abbr: 'KS' },
    { code: 'US-KY', name: 'Kentucky', abbr: 'KY' },
    { code: 'US-LA', name: 'Louisiana', abbr: 'LA' },
    { code: 'US-ME', name: 'Maine', abbr: 'ME' },
    { code: 'US-MD', name: 'Maryland', abbr: 'MD' },
    { code: 'US-MA', name: 'Massachusetts', abbr: 'MA' },
    { code: 'US-MI', name: 'Michigan', abbr: 'MI' },
    { code: 'US-MN', name: 'Minnesota', abbr: 'MN' },
    { code: 'US-MS', name: 'Mississippi', abbr: 'MS' },
    { code: 'US-MO', name: 'Missouri', abbr: 'MO' },
    { code: 'US-MT', name: 'Montana', abbr: 'MT' },
    { code: 'US-NE', name: 'Nebraska', abbr: 'NE' },
    { code: 'US-NV', name: 'Nevada', abbr: 'NV' },
    { code: 'US-NH', name: 'New Hampshire', abbr: 'NH' },
    { code: 'US-NJ', name: 'New Jersey', abbr: 'NJ' },
    { code: 'US-NM', name: 'New Mexico', abbr: 'NM' },
    { code: 'US-NY', name: 'New York', abbr: 'NY' },
    { code: 'US-NC', name: 'North Carolina', abbr: 'NC' },
    { code: 'US-ND', name: 'North Dakota', abbr: 'ND' },
    { code: 'US-OH', name: 'Ohio', abbr: 'OH' },
    { code: 'US-OK', name: 'Oklahoma', abbr: 'OK' },
    { code: 'US-OR', name: 'Oregon', abbr: 'OR' },
    { code: 'US-PA', name: 'Pennsylvania', abbr: 'PA' },
    { code: 'US-RI', name: 'Rhode Island', abbr: 'RI' },
    { code: 'US-SC', name: 'South Carolina', abbr: 'SC' },
    { code: 'US-SD', name: 'South Dakota', abbr: 'SD' },
    { code: 'US-TN', name: 'Tennessee', abbr: 'TN' },
    { code: 'US-TX', name: 'Texas', abbr: 'TX' },
    { code: 'US-UT', name: 'Utah', abbr: 'UT' },
    { code: 'US-VT', name: 'Vermont', abbr: 'VT' },
    { code: 'US-VA', name: 'Virginia', abbr: 'VA' },
    { code: 'US-WA', name: 'Washington', abbr: 'WA' },
    { code: 'US-WV', name: 'West Virginia', abbr: 'WV' },
    { code: 'US-WI', name: 'Wisconsin', abbr: 'WI' },
    { code: 'US-WY', name: 'Wyoming', abbr: 'WY' },
    { code: 'US-DC', name: 'District of Columbia', abbr: 'DC' },
];

/** Get the display name for a US-XX code */
export function getStateName(code: string): string {
    const state = US_STATES.find(s => s.code === code);
    return state ? state.name : '';
}

export function USStateAutocomplete({
    value,
    onChange,
    className,
    required = false,
    ...props
}: USStateAutocompleteProps) {
    const [inputText, setInputText] = useState('');
    const [suggestions, setSuggestions] = useState<USState[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isValid, setIsValid] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');
    const [isFocused, setIsFocused] = useState(false);

    const inputRef = useRef<TextInput>(null);

    // Sync inputText from external value (e.g. on mount with pre-filled value)
    useEffect(() => {
        if (value && value.startsWith('US-')) {
            const state = US_STATES.find(s => s.code === value);
            if (state) {
                setInputText(state.name);
            }
        }
    }, []);

    const filterStates = useCallback((text: string) => {
        if (!text.trim()) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        const lower = text.toLowerCase();
        const filtered = US_STATES.filter(
            s =>
                s.name.toLowerCase().startsWith(lower) ||
                s.abbr.toLowerCase() === lower ||
                s.name.toLowerCase().includes(lower)
        );

        // Sort: starts-with matches first, then includes matches
        filtered.sort((a, b) => {
            const aStarts = a.name.toLowerCase().startsWith(lower) ? 0 : 1;
            const bStarts = b.name.toLowerCase().startsWith(lower) ? 0 : 1;
            if (aStarts !== bStarts) return aStarts - bStarts;
            return a.name.localeCompare(b.name);
        });

        setSuggestions(filtered);
        setShowSuggestions(isFocused && filtered.length > 0);
    }, [isFocused]);

    const handleInputChange = useCallback((newValue: string) => {
        setInputText(newValue);
        setIsValid(true);
        setErrorMessage('');

        // Clear the actual value when typing (not yet selected)
        onChange('');

        filterStates(newValue);
    }, [onChange, filterStates]);

    const selectState = (state: USState) => {
        console.log('[USStateAutocomplete] Selected:', state.name, state.code);
        setInputText(state.name);
        onChange(state.code);
        setSuggestions([]);
        setShowSuggestions(false);
        setIsValid(true);
        setErrorMessage('');
    };

    const handleBlur = useCallback(() => {
        setIsFocused(false);

        setTimeout(() => {
            setShowSuggestions(false);

            if (!inputText.trim()) {
                setIsValid(true);
                setErrorMessage('');
                onChange('');
                return;
            }

            // Check if a valid state was selected
            if (value && value.startsWith('US-')) {
                setIsValid(true);
                return;
            }

            // Try to match what they typed to a state
            const lower = inputText.toLowerCase().trim();
            const exactMatch = US_STATES.find(
                s => s.name.toLowerCase() === lower || s.abbr.toLowerCase() === lower
            );

            if (exactMatch) {
                setInputText(exactMatch.name);
                onChange(exactMatch.code);
                setIsValid(true);
                setErrorMessage('');
                return;
            }

            // No match
            setIsValid(false);
            setErrorMessage('Please select a state from the list');
            inputRef.current?.focus();
        }, 250);
    }, [inputText, value, onChange]);

    const handleFocus = useCallback(() => {
        setIsFocused(true);
        if (suggestions.length > 0) {
            setShowSuggestions(true);
        }
    }, [suggestions.length]);

    const backgroundColor = useThemeColor({}, 'background');
    const surfaceColor = useThemeColor({}, 'surface');
    const borderColor = useThemeColor({}, 'border');
    const textColor = useThemeColor({}, 'text');

    return (
        <View style={styles.container}>
            <View style={[
                styles.inputContainer,
                !isValid && styles.inputContainerInvalid,
                { backgroundColor: backgroundColor, borderColor: borderColor }
            ]}>
                <TextInput
                    ref={inputRef}
                    value={inputText}
                    onChangeText={handleInputChange}
                    onBlur={handleBlur}
                    onFocus={handleFocus}
                    style={[styles.input, { color: textColor }]}
                    className="text-base font-nunito"
                    placeholder={props.placeholder || 'Start typing your state...'}
                    placeholderTextColor="#94a3b8"
                    autoCapitalize="words"
                    autoCorrect={false}
                    autoComplete="off"
                    {...props}
                />
            </View>

            {errorMessage ? (
                <Text style={styles.errorText}>
                    {errorMessage}
                </Text>
            ) : null}

            {showSuggestions && suggestions.length > 0 && (
                <View style={[styles.suggestionsContainer, { backgroundColor: surfaceColor, borderColor: borderColor }]}>
                    <ScrollView
                        style={styles.suggestionsList}
                        keyboardShouldPersistTaps="handled"
                        nestedScrollEnabled={true}
                    >
                        {suggestions.map((state, index) => (
                            <TouchableOpacity
                                key={state.code}
                                onPressIn={() => selectState(state)}
                                style={[
                                    styles.suggestionItem,
                                    { borderBottomColor: borderColor }
                                ]}
                            >
                                <Text style={[styles.suggestionText, { color: textColor }]}>
                                    {state.name}
                                </Text>
                                <Text style={[styles.suggestionAbbr, { color: '#94a3b8' }]}>
                                    {state.abbr}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
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
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 0,
        minHeight: 48,
    },
    inputContainerInvalid: {
        borderColor: '#ef4444',
    },
    input: {
        flex: 1,
        height: 48,
        paddingVertical: 0,
        paddingTop: 0,
        paddingBottom: 0,
        fontSize: 16,
        lineHeight: 20,
        textAlignVertical: 'center',
    },
    errorText: {
        fontSize: 12,
        color: '#ef4444',
        marginTop: 4,
        fontFamily: 'Nunito',
    },
    suggestionsContainer: {
        position: 'absolute',
        top: 48,
        left: 0,
        right: 0,
        maxHeight: 240,
        borderWidth: 1,
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
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderBottomWidth: 1,
        minHeight: 44,
    },
    suggestionText: {
        fontSize: 14,
        fontFamily: 'Nunito',
        flex: 1,
    },
    suggestionAbbr: {
        fontSize: 13,
        fontFamily: 'Nunito',
        marginLeft: 8,
    },
});
