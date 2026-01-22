import React, { useState, useEffect, useRef } from 'react';
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
    KeyboardAvoidingView,
    Keyboard,
    Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, HelpCircle, ChevronRight } from 'lucide-react-native';
import { PostcodeAutocomplete } from '../../components/PostcodeAutocomplete';
import { supabase } from '../../lib/supabase';

interface Region {
    code: string;
    name: string;
}

export default function PersonalisePage() {
    const router = useRouter();
    const colorScheme = useColorScheme();
    const isDarkMode = colorScheme === 'dark';

    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [region, setRegion] = useState<string>('');
    const [postcode, setPostcode] = useState('');
    const [adsConsent, setAdsConsent] = useState(false);
    const [regions, setRegions] = useState<Region[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingRegions, setLoadingRegions] = useState(true);
    const [regionModalVisible, setRegionModalVisible] = useState(false);

    // Refs for keyboard navigation
    const lastNameRef = useRef<TextInput>(null);
    const firstNameRef = useRef<TextInput>(null);

    const backgroundColor = isDarkMode ? 'hsl(222, 47%, 11%)' : '#FAFAFA';
    const textColor = isDarkMode ? '#FAFAFA' : '#54524F';
    const cardBg = isDarkMode ? '#1e293b' : '#fff';

    // Fetch regions on mount
    useEffect(() => {
        fetchRegions();
    }, []);

    // Auto-select region once fetched
    useEffect(() => {
        console.log('[useEffect] regions.length:', regions.length, 'current region:', region);
        if (regions.length > 0 && !region) {
            const ukRegion = regions.find((r: Region) => r.name === 'United Kingdom');
            if (ukRegion) {
                console.log('Setting region to UK:', ukRegion.code);
                setRegion(ukRegion.code);
            } else {
                console.log('Setting region to first:', regions[0].code);
                setRegion(regions[0].code);
            }
        }
    }, [regions, region]);

    const fetchRegions = async () => {
        try {
            // Log current session to debug RLS
            const { data: { session } } = await supabase.auth.getSession();
            console.log('[Regions] Current session:', session ? 'Authenticated' : 'Anonymous');
            console.log('[Regions] User ID:', session?.user?.id);
            console.log('[Regions] User role:', session?.user?.role);

            const { data, error } = await supabase
                .from('regions')
                .select('code, name')
                .order('name');

            console.log('[Regions] Query result - error:', error, 'data:', data);

            if (error) {
                console.error('[Regions] Supabase error:', error);
                console.error('[Regions] Error code:', error.code, 'Message:', error.message);

                // If RLS is blocking, use fallback
                if (error.code === 'PGRST301' || error.message?.includes('policy')) {
                    console.warn('[Regions] RLS policy blocking access. Using fallback data.');
                }
                throw error;
            }

            if (!data || data.length === 0) {
                console.warn('[Regions] Query succeeded but returned empty array - likely RLS filtering all rows');
                console.warn('[Regions] Check that regions table has a SELECT policy for authenticated users');
                throw new Error('Empty result - RLS may be blocking access');
            }

            console.log('[Regions] Successfully fetched', data.length, 'regions');
            setRegions(data);
        } catch (error) {
            console.error('[Regions] Error:', error);
            // Use exact data from your table as fallback
            const fallbackRegions = [
                { code: 'UK', name: 'United Kingdom' },
                { code: 'US', name: 'United States' },
            ];
            console.log('[Regions] Using fallback regions:', fallbackRegions);
            setRegions(fallbackRegions);
        } finally {
            setLoadingRegions(false);
        }
    };

    const handleGenerateQuestions = async () => {
        if (!firstName.trim()) {
            Alert.alert('Required Field', 'Please enter your first name');
            return;
        }

        // Handle blank postcode with warning dialog
        if (!postcode.trim()) {
            Alert.alert(
                'No postcode provided',
                'Without a postcode, we can\'t provide local puzzles. You\'ll only have access to general region-based puzzles. Are you sure you want to continue without entering a postcode?',
                [
                    {
                        text: 'Go Back',
                        style: 'cancel',
                    },
                    {
                        text: 'Continue anyway',
                        onPress: () => proceedToGeneration(),
                    },
                ]
            );
            return;
        }

        // If postcode is filled, proceed directly
        // PostcodeAutocomplete component already validated it against Postcodes.io
        // Backend will handle database validation if needed
        proceedToGeneration();
    };

    const proceedToGeneration = async () => {
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                Alert.alert('Error', 'Session expired. Please log in again.');
                router.replace('/(auth)/login');
                return;
            }

            const userId = session.user.id;

            // Get user_tier_id for "Standard" tier
            // From logs: available tiers include {"tier": "standard", "tier_type": "lifetime"}
            const { data: tierData, error: tierError } = await supabase
                .from('user_tier')
                .select('id, tier, tier_type')
                .ilike('tier', 'standard')
                .eq('tier_type', 'lifetime')
                .limit(1);

            let tierIdToUse = null;

            if (tierError) {
                console.error('[Profile] Error fetching tier:', tierError);
            } else if (!tierData || tierData.length === 0) {
                console.warn('[Profile] No standard/lifetime tier found. Querying all tiers...');
                const { data: allTiers } = await supabase.from('user_tier').select('tier, tier_type').limit(10);
                console.log('[Profile] Available tiers:', allTiers);
            } else {
                tierIdToUse = tierData[0].id;
                console.log('[Profile] Found tier:', tierData[0]);
            }

            // Update user_profiles table directly
            const profileData: any = {
                id: userId,
                first_name: firstName.trim(),
                last_name: lastName.trim() || null,
                email: session.user.email,
                region: region,
                postcode: postcode.trim() || null,
                accepted_terms: true,
                ads_consent: adsConsent,
                signup_method: 'password', // 'password', 'magic_link', 'google', 'apple'
            };

            // Only add tier_id if we found one
            if (tierIdToUse) {
                profileData.user_tier_id = tierIdToUse;
            }

            console.log('[Profile] Upserting profile data:', { ...profileData, id: userId });

            const { error: profileError } = await supabase
                .from('user_profiles')
                .upsert(profileData, {
                    onConflict: 'id'
                });

            if (profileError) {
                console.error('[Profile] Error saving profile:', profileError);
                console.error('[Profile] Error code:', profileError.code);
                console.error('[Profile] Error message:', profileError.message);
                console.error('[Profile] Error details:', profileError.details);
                Alert.alert('Error', 'Failed to save your profile. Please try again.');
                setLoading(false);
                return;
            }

            console.log('[Profile] Profile saved successfully');

            // Create initial user_settings
            const { error: settingsError } = await supabase
                .from('user_settings')
                .insert({
                    user_id: userId,
                    use_region_default: true,
                    digit_preference: '8',
                });

            if (settingsError) {
                console.log('Settings creation error (may already exist):', settingsError);
            }

            // Navigate to GeneratingQuestionsScreen with params
            router.push({
                pathname: '/(auth)/generating-questions',
                params: {
                    userId,
                    region,
                    postcode: postcode.trim() || '',
                },
            });
        } catch (error) {
            console.error('Error saving profile:', error);
            Alert.alert('Error', 'Failed to save your profile. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleBack = () => {
        router.back();
    };

    return (
        <KeyboardAvoidingView
            style={[styles.container, { backgroundColor }]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={handleBack}
                    style={styles.backButton}
                    onPressIn={() => Keyboard.dismiss()}
                >
                    <ChevronLeft size={28} color={textColor} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: textColor }]}>
                    Personalise your game
                </Text>
                <View style={styles.headerSpacer} />
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
            >
                <View style={[styles.card, { backgroundColor: cardBg }]}>
                    <Text style={[styles.subtitle, { color: textColor }]}>
                        Set up your profile to get personalised puzzles
                    </Text>

                    <View style={styles.formContainer}>
                        {/* Name Fields (2 column grid) */}
                        <View style={styles.nameGrid}>
                            <View style={styles.nameField}>
                                <Text style={[styles.label, { color: textColor }]}>First Name</Text>
                                <TextInput
                                    ref={firstNameRef}
                                    style={[styles.input, { color: textColor }]}
                                    className="font-nunito"
                                    placeholder="First name"
                                    placeholderTextColor="#999"
                                    value={firstName}
                                    onChangeText={setFirstName}
                                    autoCapitalize="words"
                                    returnKeyType="next"
                                    onSubmitEditing={() => lastNameRef.current?.focus()}
                                    blurOnSubmit={false}
                                />
                            </View>

                            <View style={styles.nameField}>
                                <Text style={[styles.label, { color: textColor }]}>Last Name</Text>
                                <TextInput
                                    ref={lastNameRef}
                                    style={[styles.input, { color: textColor }]}
                                    className="font-nunito"
                                    placeholder="Last name"
                                    placeholderTextColor="#999"
                                    value={lastName}
                                    onChangeText={setLastName}
                                    autoCapitalize="words"
                                    returnKeyType="done"
                                    onSubmitEditing={() => Keyboard.dismiss()}
                                />
                            </View>
                        </View>

                        {/* Region Field */}
                        <View style={styles.fieldContainer}>
                            <View style={styles.labelRow}>
                                <Text style={[styles.label, { color: textColor }]}>Region</Text>
                                <TouchableOpacity
                                    onPress={() =>
                                        Alert.alert(
                                            'Region',
                                            'Puzzle questions are based on your geographical region'
                                        )
                                    }
                                >
                                    <HelpCircle size={16} color="#999" />
                                </TouchableOpacity>
                            </View>

                            {loadingRegions ? (
                                <ActivityIndicator />
                            ) : (
                                <TouchableOpacity
                                    style={[styles.regionSelector, { borderColor: isDarkMode ? '#444' : '#d1d5db' }]}
                                    onPress={() => setRegionModalVisible(true)}
                                    onPressIn={() => Keyboard.dismiss()}
                                >
                                    <Text style={[styles.regionSelectorText, { color: textColor }]}>
                                        {regions.find(r => r.code === region)?.name || 'Select Region'}
                                    </Text>
                                    <ChevronRight size={20} color="#999" />
                                </TouchableOpacity>
                            )}

                            <Text style={[styles.helperText, { color: textColor }]}>
                                This determines which region version of the game you play
                            </Text>
                        </View>

                        {/* Postcode Field */}
                        <View style={styles.fieldContainer}>
                            <View style={styles.labelRow}>
                                <Text style={[styles.label, { color: textColor }]}>Postcode</Text>
                                <TouchableOpacity
                                    onPress={() =>
                                        Alert.alert(
                                            'Postcode',
                                            'Your postcode helps us provide local puzzles tailored to your area'
                                        )
                                    }
                                >
                                    <HelpCircle size={16} color="#999" />
                                </TouchableOpacity>
                            </View>

                            <PostcodeAutocomplete
                                value={postcode}
                                onChange={setPostcode}
                                placeholder="Enter postcode"
                                required={false}
                            />
                        </View>

                        {/* Ads Consent Checkbox */}
                        <TouchableOpacity
                            style={styles.checkboxRow}
                            onPress={() => setAdsConsent(!adsConsent)}
                        >
                            <View style={[styles.checkbox, adsConsent && styles.checkboxChecked]}>
                                {adsConsent && <Text style={styles.checkmark}>✓</Text>}
                            </View>
                            <Text style={[styles.checkboxLabel, { color: textColor }]}>
                                I agree to receive tailored ads and promotional content (optional)
                            </Text>
                        </TouchableOpacity>

                        {/* Generate Questions Button */}
                        <TouchableOpacity
                            style={[
                                styles.primaryButton,
                                !firstName.trim() && styles.disabledButton,
                            ]}
                            onPress={handleGenerateQuestions}
                            onPressIn={() => Keyboard.dismiss()}
                            disabled={!firstName.trim() || loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.primaryButtonText}>Generate Questions</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>

                <TouchableOpacity
                    style={styles.returnLink}
                    onPress={() => router.push('/(auth)/login')}
                    onPressIn={() => Keyboard.dismiss()}
                >
                    <Text style={styles.linkText}>Return to log in</Text>
                </TouchableOpacity>
            </ScrollView>

            {/* Region Selection Modal */}
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
                                <Text style={styles.modalClose}>✕</Text>
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
                                        <Text style={styles.modalOptionCheck}>✓</Text>
                                    )}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>
        </KeyboardAvoidingView>
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
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
    },
    card: {
        borderRadius: 12,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    subtitle: {
        fontSize: 14,
        fontFamily: 'Nunito',
        marginBottom: 24,
        textAlign: 'center',
    },
    formContainer: {
        gap: 16,
    },
    nameGrid: {
        flexDirection: 'row',
        gap: 16,
    },
    nameField: {
        flex: 1,
    },
    fieldContainer: {
        gap: 8,
    },
    labelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        fontFamily: 'Nunito-Bold',
    },
    input: {
        borderWidth: 1,
        borderColor: '#d1d5db',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 16,
        fontFamily: 'Nunito',
    },
    pickerContainer: {
        borderWidth: 1,
        borderRadius: 8,
        overflow: 'hidden',
    },
    pickerWrapper: {
        borderWidth: 1,
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: '#fff',
    },
    picker: {
        height: 40,
    },
    pickerText: {
        fontSize: 16,
        fontFamily: 'Nunito',
    },
    helperText: {
        fontSize: 12,
        fontFamily: 'Nunito',
        opacity: 0.7,
    },
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        marginTop: 8,
    },
    checkbox: {
        width: 20,
        height: 20,
        borderWidth: 2,
        borderColor: '#d1d5db',
        borderRadius: 4,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 2,
    },
    checkboxChecked: {
        backgroundColor: '#7DAAE8',
        borderColor: '#7DAAE8',
    },
    checkmark: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
    },
    checkboxLabel: {
        flex: 1,
        fontSize: 14,
        fontFamily: 'Nunito',
    },
    primaryButton: {
        backgroundColor: '#7DAAE8',
        paddingVertical: 24,
        borderRadius: 9999,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8,
    },
    primaryButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        fontFamily: 'Nunito-Bold',
    },
    disabledButton: {
        opacity: 0.5,
    },
    returnLink: {
        marginTop: 16,
        alignItems: 'center',
    },
    linkText: {
        color: '#7DAAE8',
        fontSize: 14,
        fontFamily: 'Nunito',
    },
    regionSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 12,
        backgroundColor: 'transparent',
    },
    regionSelectorText: {
        fontSize: 16,
        fontFamily: 'Nunito',
        flex: 1,
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
    modalClose: {
        fontSize: 28,
        color: '#999',
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
    modalOptionCheck: {
        fontSize: 20,
        color: '#7DAAE8',
        fontWeight: 'bold',
    },
});
