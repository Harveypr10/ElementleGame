import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    ActivityIndicator,
    useColorScheme,
    Platform,
    Alert,
    Switch,
    Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, Key, Mail, Link2, Check, X } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { PostcodeAutocomplete } from '../../components/PostcodeAutocomplete';

interface Region {
    code: string;
    name: string;
}

interface Profile {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    region: string | null;
    postcode: string | null;
    googleLinked: boolean | null;
    appleLinked: boolean | null;
    passwordCreated: boolean | null;
}

export default function AccountInfoPage() {
    const router = useRouter();
    const { user } = useAuth();
    const colorScheme = useColorScheme();
    const isDarkMode = colorScheme === 'dark';

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [regions, setRegions] = useState<Region[]>([]);
    const [regionModalVisible, setRegionModalVisible] = useState(false);

    // Form state
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [region, setRegion] = useState('');
    const [postcode, setPostcode] = useState('');

    // Connected accounts state
    const [hasPassword, setHasPassword] = useState(false);
    const [isGoogleConnected, setIsGoogleConnected] = useState(false);
    const [isAppleConnected, setIsAppleConnected] = useState(false);
    const [magicLinkEnabled, setMagicLinkEnabled] = useState(true);

    // Colors
    const backgroundColor = isDarkMode ? 'hsl(222, 47%, 11%)' : '#FAFAFA';
    const textColor = isDarkMode ? '#FAFAFA' : '#54524F';
    const cardBg = isDarkMode ? '#1e293b' : '#fff';
    const borderColor = isDarkMode ? '#444' : '#d1d5db';

    // Fetch profile and regions
    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch profile
            const { data: profileData, error: profileError } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('id', user?.id)
                .single();

            if (profileError) throw profileError;

            console.log('[AccountInfo] Loaded profile:', profileData);
            setProfile(profileData);
            // Use snake_case column names from database
            setFirstName(profileData.first_name || '');
            setLastName(profileData.last_name || '');
            setRegion(profileData.region || '');
            setPostcode(profileData.postcode || '');
            setHasPassword(profileData.password_created || false);
            setIsGoogleConnected(profileData.google_linked || false);
            setIsAppleConnected(profileData.apple_linked || false);
            setMagicLinkEnabled(profileData.magic_link !== false); // Default to true if not set

            // Fetch regions
            const { data: regionsData, error: regionsError } = await supabase
                .from('regions')
                .select('*')
                .order('name');

            if (regionsError) throw regionsError;

            setRegions(regionsData);
        } catch (error: any) {
            console.error('[AccountInfo] Error fetching data:', error);
            Alert.alert('Error', 'Failed to load account information');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const { error } = await supabase
                .from('user_profiles')
                .update({
                    first_name: firstName,
                    last_name: lastName,
                    region,
                    postcode: postcode || null,
                })
                .eq('id', user?.id);

            if (error) throw error;

            Alert.alert('Success', 'Profile updated successfully');
        } catch (error: any) {
            console.error('[AccountInfo] Error saving:', error);
            Alert.alert('Error', 'Failed to update profile');
        } finally {
            setSaving(false);
        }
    };

    const handlePasswordAction = () => {
        if (hasPassword) {
            Alert.alert('Change Password', 'Password change feature coming soon!');
        } else {
            Alert.alert('Create Password', 'Password creation feature coming soon!');
        }
    };

    const handleMagicLinkToggle = async (enabled: boolean) => {
        try {
            const { error } = await supabase
                .from('user_profiles')
                .update({ magic_link: enabled })
                .eq('id', user?.id);

            if (error) throw error;

            setMagicLinkEnabled(enabled);
            console.log('[AccountInfo] Magic link updated:', enabled);
        } catch (error: any) {
            Alert.alert('Error', 'Failed to update magic link setting');
            console.error('[AccountInfo] Magic link toggle error:', error);
        }
    };

    const handleGoogleConnect = async () => {
        if (isGoogleConnected) {
            // Unlink
            Alert.alert(
                'Disconnect Google',
                'Are you sure you want to disconnect your Google account?',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Disconnect',
                        style: 'destructive',
                        onPress: async () => {
                            try {
                                const { error } = await supabase
                                    .from('user_profiles')
                                    .update({ google_linked: false })
                                    .eq('id', user?.id);

                                if (error) throw error;

                                setIsGoogleConnected(false);
                                Alert.alert('Success', 'Google account disconnected');
                            } catch (error: any) {
                                Alert.alert('Error', 'Failed to disconnect Google');
                            }
                        },
                    },
                ]
            );
        } else {
            // Link
            try {
                const { error } = await supabase.auth.linkIdentity({
                    provider: 'google',
                });

                if (error) throw error;

                // Update profile
                await supabase
                    .from('user_profiles')
                    .update({ google_linked: true })
                    .eq('id', user?.id);

                setIsGoogleConnected(true);
                Alert.alert('Success', 'Google account connected');
            } catch (error: any) {
                Alert.alert('Error', error.message || 'Failed to connect Google');
            }
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, { backgroundColor }]}>
                <ActivityIndicator size="large" color="#7DAAE8" />
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ChevronLeft size={28} color={textColor} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: textColor }]}>Account Info</Text>
                <View style={styles.headerSpacer} />
            </View>

            <ScrollView style={styles.content}>
                {/* Profile Information */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: textColor }]}>Profile Information</Text>

                    <View style={styles.card}>
                        <View style={styles.field}>
                            <Text style={[styles.label, { color: textColor }]}>Email</Text>
                            <Text style={[styles.valueText, { color: textColor }]}>{profile?.email}</Text>
                        </View>

                        <View style={styles.field}>
                            <Text style={[styles.label, { color: textColor }]}>First Name</Text>
                            <TextInput
                                style={[styles.input, { color: textColor, borderColor }]}
                                value={firstName}
                                onChangeText={setFirstName}
                                placeholderTextColor="#999"
                            />
                        </View>

                        <View style={styles.field}>
                            <Text style={[styles.label, { color: textColor }]}>Last Name</Text>
                            <TextInput
                                style={[styles.input, { color: textColor, borderColor }]}
                                value={lastName}
                                onChangeText={setLastName}
                                placeholderTextColor="#999"
                            />
                        </View>

                        <View style={styles.field}>
                            <Text style={[styles.label, { color: textColor }]}>Region</Text>
                            <TouchableOpacity
                                style={[styles.selector, { borderColor }]}
                                onPress={() => setRegionModalVisible(true)}
                            >
                                <Text style={[styles.selectorText, { color: textColor }]}>
                                    {regions.find(r => r.code === region)?.name || 'Select Region'}
                                </Text>
                                <ChevronRight size={20} color="#999" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.field}>
                            <Text style={[styles.label, { color: textColor }]}>Postcode</Text>
                            <PostcodeAutocomplete
                                value={postcode}
                                onChange={setPostcode}
                                placeholder="Enter postcode"
                            />
                        </View>
                    </View>
                </View>

                {/* Connected Accounts */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: textColor }]}>Connected Accounts</Text>

                    <View style={styles.card}>
                        {/* Password */}
                        <TouchableOpacity style={styles.accountItem} onPress={handlePasswordAction}>
                            <View style={styles.accountIcon}>
                                <Key size={20} color="#7DAAE8" />
                            </View>
                            <View style={styles.accountInfo}>
                                <Text style={[styles.accountName, { color: textColor }]}>Password</Text>
                                <Text style={styles.accountStatus}>
                                    {hasPassword ? 'Connected' : 'Not set'}
                                </Text>
                            </View>
                            <ChevronRight size={20} color="#999" />
                        </TouchableOpacity>

                        {/* Magic Link */}
                        <View style={styles.accountItem}>
                            <View style={styles.accountIcon}>
                                <Mail size={20} color="#7DAAE8" />
                            </View>
                            <View style={styles.accountInfo}>
                                <Text style={[styles.accountName, { color: textColor }]}>Magic Link</Text>
                                <Text style={styles.accountStatus}>
                                    {magicLinkEnabled ? 'Enabled' : 'Disabled'}
                                </Text>
                            </View>
                            <Switch
                                value={magicLinkEnabled}
                                onValueChange={handleMagicLinkToggle}
                                trackColor={{ false: '#767577', true: '#7DAAE8' }}
                            />
                        </View>

                        {/* Google */}
                        <TouchableOpacity style={styles.accountItem} onPress={handleGoogleConnect}>
                            <View style={styles.accountIcon}>
                                <Text style={styles.googleIcon}>G</Text>
                            </View>
                            <View style={styles.accountInfo}>
                                <Text style={[styles.accountName, { color: textColor }]}>Google</Text>
                                <Text style={styles.accountStatus}>
                                    {isGoogleConnected ? 'Connected' : 'Not connected'}
                                </Text>
                            </View>
                            <ChevronRight size={20} color="#999" />
                        </TouchableOpacity>

                        {/* Apple */}
                        <View style={[styles.accountItem, styles.accountItemDisabled]}>
                            <View style={styles.accountIcon}>
                                <Text style={styles.appleIcon}></Text>
                            </View>
                            <View style={styles.accountInfo}>
                                <Text style={[styles.accountName, { color: '#999' }]}>Apple</Text>
                                <Text style={styles.accountStatus}>Coming soon</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Save Button */}
                <TouchableOpacity
                    style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                    onPress={handleSave}
                    disabled={saving}
                >
                    {saving ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.saveButtonText}>Save Changes</Text>
                    )}
                </TouchableOpacity>
            </ScrollView>

            {/* Region Modal */}
            <Modal
                visible={regionModalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setRegionModalVisible(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setRegionModalVisible(false)}
                >
                    <View style={[styles.modalContent, { backgroundColor: cardBg }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: textColor }]}>Select Region</Text>
                            <TouchableOpacity onPress={() => setRegionModalVisible(false)}>
                                <X size={24} color="#999" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.modalList}>
                            {regions.map((r) => (
                                <TouchableOpacity
                                    key={r.code}
                                    style={[
                                        styles.modalOption,
                                        region === r.code && styles.modalOptionSelected
                                    ]}
                                    onPress={() => {
                                        setRegion(r.code);
                                        setRegionModalVisible(false);
                                    }}
                                >
                                    <Text style={[
                                        styles.modalOptionText,
                                        { color: textColor },
                                        region === r.code && styles.modalOptionTextSelected
                                    ]}>
                                        {r.name}
                                    </Text>
                                    {region === r.code && (
                                        <Check size={20} color="#7DAAE8" />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        paddingTop: Platform.OS === 'ios' ? 60 : 12,
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        fontFamily: 'Nunito-Bold',
    },
    headerSpacer: {
        width: 32,
    },
    content: {
        flex: 1,
        paddingHorizontal: 16,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        fontFamily: 'Nunito-Bold',
        marginBottom: 12,
        textTransform: 'uppercase',
        opacity: 0.6,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
    },
    field: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        fontFamily: 'Nunito',
        marginBottom: 8,
    },
    input: {
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 16,
        fontFamily: 'Nunito',
    },
    valueText: {
        fontSize: 16,
        fontFamily: 'Nunito',
        opacity: 0.7,
    },
    selector: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 12,
    },
    selectorText: {
        fontSize: 16,
        fontFamily: 'Nunito',
        flex: 1,
    },
    accountItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    accountItemDisabled: {
        opacity: 0.5,
    },
    accountIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#eef6ff',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    googleIcon: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#EA4335',
    },
    appleIcon: {
        fontSize: 20,
        color: '#000',
    },
    accountInfo: {
        flex: 1,
    },
    accountName: {
        fontSize: 16,
        fontWeight: '600',
        fontFamily: 'Nunito',
    },
    accountStatus: {
        fontSize: 14,
        fontFamily: 'Nunito',
        color: '#999',
        marginTop: 2,
    },
    saveButton: {
        backgroundColor: '#7DAAE8',
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        marginTop: 16,
        marginBottom: 32,
    },
    saveButtonDisabled: {
        opacity: 0.5,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
        fontFamily: 'Nunito-Bold',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingTop: 20,
        paddingBottom: 40,
        maxHeight: '70%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        fontFamily: 'Nunito-Bold',
    },
    modalList: {
        paddingHorizontal: 20,
    },
    modalOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    modalOptionSelected: {
        backgroundColor: '#eef6ff',
    },
    modalOptionText: {
        fontSize: 16,
        fontFamily: 'Nunito',
        flex: 1,
    },
    modalOptionTextSelected: {
        fontWeight: 'bold',
        fontFamily: 'Nunito-Bold',
        color: '#7DAAE8',
    },
});
