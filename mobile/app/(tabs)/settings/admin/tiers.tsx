import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, Alert, Modal, TextInput, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { styled } from 'nativewind';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Edit2, Plus } from 'lucide-react-native';
import { supabase } from '../../../../lib/supabase';
import { Database } from '../../../../lib/supabase-types';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledTextInput = styled(TextInput);
const StyledSwitch = styled(Switch);

type UserTier = Database['public']['Tables']['user_tier']['Row'];

export default function SubscriptionTiersScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [tiers, setTiers] = useState<UserTier[]>([]);
    const [selectedTier, setSelectedTier] = useState<UserTier | null>(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [saving, setSaving] = useState(false);

    // Edit form state
    const [editForm, setEditForm] = useState<Partial<UserTier>>({});

    useEffect(() => {
        fetchTiers();
    }, []);

    const fetchTiers = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('user_tier')
                .select('*')
                .order('sort_order', { ascending: true });

            if (error) throw error;
            setTiers(data || []);
        } catch (error: any) {
            console.error('Error fetching tiers:', error);
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (tier: UserTier) => {
        setSelectedTier(tier);
        setEditForm({
            ...tier
        });
        setModalVisible(true);
    };

    const handleSave = async () => {
        if (!selectedTier || !selectedTier.id) return;

        try {
            setSaving(true);
            const { error } = await supabase
                .from('user_tier')
                .update({
                    streak_savers: editForm.streak_savers,
                    holiday_savers: editForm.holiday_savers,
                    holiday_duration_days: editForm.holiday_duration_days,
                    active: editForm.active,
                    description: editForm.description,
                    tier: editForm.tier,
                    tier_type: editForm.tier_type
                })
                .eq('id', selectedTier.id);

            if (error) throw error;

            setModalVisible(false);
            fetchTiers();
            Alert.alert('Success', 'Tier updated successfully');
        } catch (error: any) {
            console.error('Error updating tier:', error);
            Alert.alert('Error', error.message);
        } finally {
            setSaving(false);
        }
    };

    const renderItem = ({ item }: { item: UserTier }) => (
        <StyledView className="bg-white dark:bg-slate-800 p-4 mb-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <StyledView className="flex-row justify-between items-start">
                <StyledView className="flex-1">
                    <StyledView className="flex-row items-center mb-1">
                        <StyledText className="text-lg font-n-bold text-slate-900 dark:text-white mr-2">
                            {item.tier}
                        </StyledText>
                        <StyledView className={`px-2 py-0.5 rounded-full ${item.active ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                            <StyledText className={`text-xs font-n-bold ${item.active ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                                {item.active ? 'ACTIVE' : 'INACTIVE'}
                            </StyledText>
                        </StyledView>
                    </StyledView>
                    <StyledText className="text-sm text-slate-500 mb-2">
                        Type: {item.tier_type}
                    </StyledText>
                    <StyledView className="flex-row gap-4">
                        <StyledView>
                            <StyledText className="text-xs text-slate-400">Streak Savers</StyledText>
                            <StyledText className="text-base font-n-bold text-slate-900 dark:text-white">
                                {item.streak_savers}
                            </StyledText>
                        </StyledView>
                        <StyledView>
                            <StyledText className="text-xs text-slate-400">Holiday Savers</StyledText>
                            <StyledText className="text-base font-n-bold text-slate-900 dark:text-white">
                                {item.holiday_savers}
                            </StyledText>
                        </StyledView>
                        <StyledView>
                            <StyledText className="text-xs text-slate-400">Holiday Days</StyledText>
                            <StyledText className="text-base font-n-bold text-slate-900 dark:text-white">
                                {item.holiday_duration_days}
                            </StyledText>
                        </StyledView>
                    </StyledView>
                </StyledView>
                <StyledTouchableOpacity
                    onPress={() => handleEdit(item)}
                    className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg"
                >
                    <Edit2 size={20} className="text-slate-600 dark:text-slate-300" />
                </StyledTouchableOpacity>
            </StyledView>
        </StyledView>
    );

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
                        Subscription Tiers
                    </StyledText>
                    <StyledView className="w-10" />
                </StyledView>
            </SafeAreaView>

            {loading ? (
                <StyledView className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#2563eb" />
                </StyledView>
            ) : (
                <FlatList
                    data={tiers}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={{ padding: 16 }}
                />
            )}

            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <StyledView className="flex-1 justify-end bg-black/50">
                    <StyledView className="bg-white dark:bg-slate-900 rounded-t-3xl p-6 h-4/5">
                        <StyledView className="flex-row justify-between items-center mb-6">
                            <StyledText className="text-xl font-n-bold text-slate-900 dark:text-white">
                                Edit Tier
                            </StyledText>
                            <StyledTouchableOpacity onPress={() => setModalVisible(false)}>
                                <StyledText className="text-blue-600 text-lg">Close</StyledText>
                            </StyledTouchableOpacity>
                        </StyledView>

                        <StyledView className="flex-1">
                            <StyledText className="text-sm font-bold text-slate-400 mb-1">Tier Name</StyledText>
                            <StyledTextInput
                                value={editForm.tier}
                                onChangeText={(text) => setEditForm({ ...editForm, tier: text })}
                                className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl mb-4 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700"
                            />

                            <StyledText className="text-sm font-bold text-slate-400 mb-1">Description</StyledText>
                            <StyledTextInput
                                value={editForm.description || ''}
                                onChangeText={(text) => setEditForm({ ...editForm, description: text })}
                                className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl mb-4 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700"
                            />

                            <StyledView className="flex-row justify-between mb-4">
                                <StyledView className="flex-1 mr-2">
                                    <StyledText className="text-sm font-bold text-slate-400 mb-1">Streak Savers</StyledText>
                                    <StyledTextInput
                                        value={editForm.streak_savers?.toString()}
                                        onChangeText={(text) => setEditForm({ ...editForm, streak_savers: parseInt(text) || 0 })}
                                        keyboardType="numeric"
                                        className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700"
                                    />
                                </StyledView>
                                <StyledView className="flex-1 ml-2">
                                    <StyledText className="text-sm font-bold text-slate-400 mb-1">Holiday Savers</StyledText>
                                    <StyledTextInput
                                        value={editForm.holiday_savers?.toString()}
                                        onChangeText={(text) => setEditForm({ ...editForm, holiday_savers: parseInt(text) || 0 })}
                                        keyboardType="numeric"
                                        className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700"
                                    />
                                </StyledView>
                            </StyledView>

                            <StyledView className="mb-4">
                                <StyledText className="text-sm font-bold text-slate-400 mb-1">Holiday Duration (Days)</StyledText>
                                <StyledTextInput
                                    value={editForm.holiday_duration_days?.toString()}
                                    onChangeText={(text) => setEditForm({ ...editForm, holiday_duration_days: parseInt(text) || 0 })}
                                    keyboardType="numeric"
                                    className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700"
                                />
                            </StyledView>

                            <StyledView className="flex-row items-center justify-between mb-6 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                                <StyledText className="text-base font-n-bold text-slate-900 dark:text-white">Active</StyledText>
                                <StyledSwitch
                                    value={editForm.active}
                                    onValueChange={(val) => setEditForm({ ...editForm, active: val })}
                                    trackColor={{ false: "#767577", true: "#2563eb" }}
                                />
                            </StyledView>

                            <StyledTouchableOpacity
                                onPress={handleSave}
                                disabled={saving}
                                className="bg-blue-600 p-4 rounded-xl items-center"
                            >
                                {saving ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <StyledText className="text-white font-n-bold text-lg">Save Changes</StyledText>
                                )}
                            </StyledTouchableOpacity>
                        </StyledView>
                    </StyledView>
                </StyledView>
            </Modal>
        </StyledView>
    );
}
