import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type DateFormat = 'ddmmyy' | 'mmddyy';
export type GameMode = 'REGION' | 'USER';

type SettingsContextType = {
    dateFormat: DateFormat;
    gameMode: GameMode;
    toggleDateFormat: () => void;
    setGameMode: (mode: GameMode) => void;
    loading: boolean;
};

const SettingsContext = createContext<SettingsContextType>({
    dateFormat: 'ddmmyy',
    gameMode: 'REGION',
    toggleDateFormat: () => { },
    setGameMode: () => { },
    loading: true,
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
    const [dateFormat, setDateFormat] = useState<DateFormat>('ddmmyy');
    const [gameMode, setGameMode] = useState<GameMode>('REGION');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const storedFormat = await AsyncStorage.getItem('settings_date_format');
            if (storedFormat === 'mmddyy') setDateFormat('mmddyy');

            const storedMode = await AsyncStorage.getItem('settings_game_mode');
            if (storedMode === 'USER' || storedMode === 'REGION') {
                setGameMode(storedMode as GameMode);
            }
        } catch (e) {
            console.error('Failed to load settings', e);
        } finally {
            setLoading(false);
        }
    };

    const toggleDateFormat = async () => {
        const newFormat = dateFormat === 'ddmmyy' ? 'mmddyy' : 'ddmmyy';
        setDateFormat(newFormat);
        await AsyncStorage.setItem('settings_date_format', newFormat);
    };

    const updateGameMode = async (mode: GameMode) => {
        setGameMode(mode);
        await AsyncStorage.setItem('settings_game_mode', mode);
    };

    return (
        <SettingsContext.Provider
            value={{
                dateFormat,
                gameMode,
                toggleDateFormat,
                setGameMode: updateGameMode,
                loading
            }}
        >
            {children}
        </SettingsContext.Provider>
    );
}

export const useSettings = () => useContext(SettingsContext);
