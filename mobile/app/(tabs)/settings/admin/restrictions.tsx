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

interface AdminSetting {
    key: string;
    value: string;
    description: string;
}

export default function RestrictionsScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // State for settings
    const [postcodeDays, setPostcodeDays] = useState('30');
    const [categoryDays, setCategoryDays] = useState('30');

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('admin_settings')
                .select('*')
                .in('key', ['postcode_restriction_days', 'category_restriction_days']);

            if (error) throw error;

            if (data) {
                const pc = data.find(s => s.key === 'postcode_restriction_days');
                const cat = data.find(s => s.key === 'category_restriction_days');

                if (pc) setPostcodeDays(pc.value);
                if (cat) setCategoryDays(cat.value);
            }
        } catch (error: any) {
            console.error('Error fetching settings:', error);
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);

            // multiple updates
            const updates = [
                supabase.from('admin_settings').update({ value: postcodeDays }).eq('key', 'postcode_restriction_days'),
                supabase.from('admin_settings').update({ value: categoryDays }).eq('key', 'category_restriction_days')
            ];

            const results = await Promise.all(updates);

            const errors = results.filter(r => r.error);
            if (errors.length > 0) {
                throw errors[0].error;
            }

            Alert.alert('Success', 'Settings updated successfully');
        } catch (error: any) {
            console.error('Error saving settings:', error);
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
                        Restrictions
                    </StyledText>
                    <StyledTouchableOpacity
                        onPress={fetchSettings}
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
                            Postcode Restrictions
                        </StyledText>
                        <StyledText className="text-sm text-slate-500 mb-2">
                            Days to wait before a user can change their postcode again.
                        </StyledText>
                        <StyledTextInput
                            value={postcodeDays}
                            onChangeText={setPostcodeDays}
                            keyboardType="numeric"
                            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-base text-slate-900 dark:text-white font-n-bold"
                        />
                    </StyledView>

                    <StyledView className="bg-white dark:bg-slate-800 rounded-2xl p-4 mb-4 border border-slate-100 dark:border-slate-700 shadow-sm">
                        <StyledText className="text-base font-n-bold text-slate-900 dark:text-white mb-2">
                            Category Restrictions
                        </StyledText>
                        <StyledText className="text-sm text-slate-500 mb-2">
                            Days to wait before a user can change their categories again.
                        </StyledText>
                        <StyledTextInput
                            value={categoryDays}
                            onChangeText={setCategoryDays}
                            keyboardType="numeric"
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
                                <StyledText className="text-white font-n-bold text-lg">Save Changes</StyledText>
                            </>
                        )}
                    </StyledTouchableOpacity>
                </StyledScrollView>
            )}
        </StyledView>
    );
}
