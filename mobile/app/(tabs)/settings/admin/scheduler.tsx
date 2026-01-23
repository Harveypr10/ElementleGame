import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { styled } from 'nativewind';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Save, RefreshCw } from 'lucide-react-native';
import { supabase } from '../../../../lib/supabase';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledTextInput = styled(TextInput);
const StyledScrollView = styled(ScrollView);

export default function SchedulerScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [startTime, setStartTime] = useState('');
    const [frequency, setFrequency] = useState('');
    const [configId, setConfigId] = useState<string | null>(null);

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('demand_scheduler_config')
                .select('*')
                .single();

            if (error) {
                // If no row found, that's okay, we'll insert one on save
                if (error.code !== 'PGRST116') throw error;
            }

            if (data) {
                setStartTime(data.start_time);
                setFrequency(data.frequency_hours?.toString() || '24');
                setConfigId(data.id);
            } else {
                // Default
                setStartTime('02:00');
                setFrequency('24');
            }
        } catch (error: any) {
            console.error('Error fetching scheduler config:', error);
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);

            const payload = {
                start_time: startTime,
                frequency_hours: parseInt(frequency),
                updated_at: new Date().toISOString()
            };

            let result;
            if (configId) {
                result = await supabase
                    .from('demand_scheduler_config')
                    .update(payload)
                    .eq('id', configId);
            } else {
                result = await supabase
                    .from('demand_scheduler_config')
                    .insert([payload]);
            }

            if (result.error) throw result.error;

            Alert.alert('Success', 'Scheduler configuration updated');
        } catch (error: any) {
            console.error('Error saving config:', error);
            Alert.alert('Error', error.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <StyledView className="flex-1 bg-white dark:bg-slate-900">
            <SafeAreaView edges={['top']} className="bg-white dark:bg-slate-900">
                <StyledView className="flex-row items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
                    <StyledTouchableOpacity
                        onPress={() => router.back()}
                        className="w-10 h-10 items-center justify-center -ml-2"
                    >
                        <ChevronLeft size={28} color="#1e293b" />
                    </StyledTouchableOpacity>
                    <StyledText className="text-xl font-n-bold text-slate-900 dark:text-white">
                        Scheduler
                    </StyledText>
                    <StyledTouchableOpacity
                        onPress={fetchConfig}
                        disabled={loading}
                        className="w-10 h-10 items-center justify-center"
                    >
                        <RefreshCw size={24} color="#64748b" />
                    </StyledTouchableOpacity>
                </StyledView>
            </SafeAreaView>

            {loading ? (
                <StyledView className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#2563eb" />
                </StyledView>
            ) : (
                <StyledScrollView className="flex-1 p-4">
                    <StyledView className="bg-white dark:bg-slate-800 rounded-2xl p-4 mb-4 border border-slate-100 dark:border-slate-700 shadow-sm">
                        <StyledText className="text-base font-n-bold text-slate-900 dark:text-white mb-2">
                            Frequency (Hours)
                        </StyledText>
                        <StyledText className="text-sm text-slate-500 mb-2">
                            How often the demand calculation job runs.
                        </StyledText>
                        <StyledTextInput
                            value={frequency}
                            onChangeText={setFrequency}
                            keyboardType="numeric"
                            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-base text-slate-900 dark:text-white font-n-bold"
                        />
                    </StyledView>

                    <StyledView className="bg-white dark:bg-slate-800 rounded-2xl p-4 mb-4 border border-slate-100 dark:border-slate-700 shadow-sm">
                        <StyledText className="text-base font-n-bold text-slate-900 dark:text-white mb-2">
                            Start Time (UTC)
                        </StyledText>
                        <StyledText className="text-sm text-slate-500 mb-2">
                            Format: HH:MM:SS
                        </StyledText>
                        <StyledTextInput
                            value={startTime}
                            onChangeText={setStartTime}
                            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-base text-slate-900 dark:text-white font-n-bold"
                        />
                    </StyledView>

                    <StyledTouchableOpacity
                        onPress={handleSave}
                        disabled={saving}
                        className="bg-blue-600 rounded-xl p-4 flex-row items-center justify-center mt-4"
                    >
                        {saving ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <>
                                <Save size={20} color="white" style={{ marginRight: 8 }} />
                                <StyledText className="text-white font-n-bold text-lg">Save Config</StyledText>
                            </>
                        )}
                    </StyledTouchableOpacity>
                </StyledScrollView>
            )}
        </StyledView>
    );
}
