/**
 * RegionAutocomplete.tsx
 * Typeahead autocomplete for selecting a region/country.
 * Uses reference_countries table for the full list of allowed countries.
 * Uses ScrollView + .map() instead of FlatList to avoid the
 * "VirtualizedLists should never be nested inside plain ScrollViews" error.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    TextInput,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    Keyboard,
    useColorScheme,
} from 'react-native';
import { ThemedText } from './ThemedText';
import { supabase } from '../lib/supabase';

interface Region {
    code: string;
    name: string;
}

interface RegionAutocompleteProps {
    value: string;          // region code (e.g. 'UK', 'US', 'FR')
    onChange: (code: string) => void;
    placeholder?: string;
    required?: boolean;
    /** Pre-loaded regions list (optional — avoids re-fetch) */
    regions?: Region[];
}

export function RegionAutocomplete({
    value,
    onChange,
    placeholder = 'Start typing your region...',
    required = false,
    regions: externalRegions,
}: RegionAutocompleteProps) {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';

    const [query, setQuery] = useState('');
    const [regions, setRegions] = useState<Region[]>(externalRegions || []);
    const [showDropdown, setShowDropdown] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const inputRef = useRef<TextInput>(null);

    // Fetch regions from reference_countries if not provided externally
    useEffect(() => {
        if (externalRegions && externalRegions.length > 0) {
            setRegions(externalRegions);
            return;
        }

        const fetchRegions = async () => {
            try {
                const { data, error } = await supabase
                    .from('reference_countries')
                    .select('code, name')
                    .order('name');

                if (!error && data) {
                    setRegions(data);
                }
            } catch (e) {
                console.warn('[RegionAutocomplete] Failed to fetch regions:', e);
            }
        };

        fetchRegions();
    }, [externalRegions]);

    // Sync display text when value changes externally
    useEffect(() => {
        if (value && !isFocused) {
            const match = regions.find(r => r.code === value);
            if (match) {
                setQuery(match.name);
            }
        }
    }, [value, regions, isFocused]);

    // Filter regions based on query
    const filteredRegions = query.trim()
        ? regions.filter(r =>
            r.name.toLowerCase().includes(query.toLowerCase())
        )
        : regions; // Show all when empty

    const handleSelect = useCallback((region: Region) => {
        setQuery(region.name);
        onChange(region.code);
        setShowDropdown(false);
        Keyboard.dismiss();
    }, [onChange]);

    const handleFocus = useCallback(() => {
        setIsFocused(true);
        setShowDropdown(true);
        // Clear text so user can type fresh
        setQuery('');
    }, []);

    const handleBlur = useCallback(() => {
        setIsFocused(false);
        // Delay hiding to allow tap on dropdown item
        setTimeout(() => {
            setShowDropdown(false);
            // Restore display name if nothing was selected
            if (value) {
                const match = regions.find(r => r.code === value);
                if (match) {
                    setQuery(match.name);
                }
            }
        }, 200);
    }, [value, regions]);

    const handleChangeText = useCallback((text: string) => {
        setQuery(text);
        setShowDropdown(true);
    }, []);

    // Colours
    const bgColor = isDark ? '#1e293b' : '#FFFFFF';
    const borderColor = isDark ? '#444' : '#d1d5db';
    const textColor = isDark ? '#FFFFFF' : '#1e293b';
    const placeholderColor = isDark ? '#666' : '#9ca3af';
    const dropdownBg = isDark ? '#1e293b' : '#FFFFFF';
    const selectedBg = isDark ? '#2563eb22' : '#dbeafe';

    return (
        <View style={styles.container}>
            <TextInput
                ref={inputRef}
                style={[
                    styles.input,
                    {
                        backgroundColor: bgColor,
                        borderColor: isFocused ? '#3b82f6' : borderColor,
                        color: textColor,
                    },
                ]}
                value={query}
                onChangeText={handleChangeText}
                onFocus={handleFocus}
                onBlur={handleBlur}
                placeholder={placeholder}
                placeholderTextColor={placeholderColor}
                autoCorrect={false}
                autoCapitalize="words"
            />

            {showDropdown && filteredRegions.length > 0 && (
                <View
                    style={[
                        styles.dropdown,
                        {
                            backgroundColor: dropdownBg,
                            borderColor: borderColor,
                        },
                    ]}
                >
                    <ScrollView
                        style={styles.dropdownList}
                        keyboardShouldPersistTaps="handled"
                        nestedScrollEnabled={true}
                    >
                        {filteredRegions.map((item) => (
                            <TouchableOpacity
                                key={item.code}
                                style={[
                                    styles.dropdownItem,
                                    item.code === value && { backgroundColor: selectedBg },
                                ]}
                                onPress={() => handleSelect(item)}
                                activeOpacity={0.7}
                            >
                                <ThemedText
                                    style={[
                                        styles.dropdownItemText,
                                        { color: textColor },
                                        item.code === value && {
                                            color: '#3b82f6',
                                            fontWeight: '700',
                                        },
                                    ]}
                                    size="base"
                                >
                                    {item.name}
                                </ThemedText>
                                {item.code === value && (
                                    <ThemedText style={{ color: '#3b82f6', fontSize: 16 }}>✓</ThemedText>
                                )}
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
        zIndex: 9999,
        elevation: 9999,
    },
    input: {
        height: 48,
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 16,
        fontSize: 16,
        fontFamily: 'Nunito_400Regular',
    },
    dropdown: {
        position: 'absolute',
        top: 52,
        left: 0,
        right: 0,
        borderWidth: 1,
        borderRadius: 12,
        maxHeight: 200,
        zIndex: 99999,
        elevation: 99999,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        overflow: 'hidden',
    },
    dropdownList: {
        maxHeight: 200,
    },
    dropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#e2e8f0',
    },
    dropdownItemText: {
        fontSize: 16,
        fontFamily: 'Nunito_400Regular',
    },
});
