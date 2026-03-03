/**
 * Create League Flow
 *
 * Two-step flow:
 *  1. Enter league name
 *  2. Success — shows join code + share buttons (copy link / native share)
 */

import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Alert,
    Share,
    Switch,
} from 'react-native';
import { styled } from 'nativewind';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Trophy, Copy, Share2, Check, Users } from 'lucide-react-native';
import { Image } from 'expo-image';
import * as Clipboard from 'expo-clipboard';
import { useCreateLeague } from '../../hooks/useLeagueData';
import { useThemeColor } from '../../hooks/useThemeColor';
import { useProfile } from '../../hooks/useProfile';
import { ThemedView } from '../../components/ThemedView';
import { ThemedText } from '../../components/ThemedText';

const StyledView = styled(View);
const StyledTouchableOpacity = styled(TouchableOpacity);

const CelebrationHamster = require('../../assets/ui/webp_assets/Win-Hamster-Blue.webp');

interface CreationResult {
    league_id: string;
    join_code: string;
    display_name: string;
    global_tag: string;
}

export default function CreateLeagueScreen() {
    const router = useRouter();
    const createLeague = useCreateLeague();

    // Theme colors
    const backgroundColor = useThemeColor({}, 'background');
    const surfaceColor = useThemeColor({}, 'surface');
    const borderColor = useThemeColor({}, 'border');
    const textColor = useThemeColor({}, 'text');
    const iconColor = useThemeColor({}, 'icon');
    const { profile } = useProfile();
    const regionLabel = profile?.region ? `${profile.region} Edition` : 'UK Edition';

    const [leagueName, setLeagueName] = useState('');
    const [step, setStep] = useState<'name' | 'success'>('name');
    const [result, setResult] = useState<CreationResult | null>(null);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasRegionBoard, setHasRegionBoard] = useState(true);
    const [hasUserBoard, setHasUserBoard] = useState(true);

    const joinLink = result ? `https://elementle.tech/league/join/${result.join_code}` : '';
    const shareMessage = result
        ? `Join my Elementle league "${leagueName}"! 🧩🏆\n\nElementle is a daily puzzle game where you guess historical dates.\n\nJoin code: ${result.join_code}\n\nOr tap this link to join:\n${joinLink}`
        : '';

    const handleCreate = async () => {
        if (!leagueName.trim()) {
            setError('Please enter a league name');
            return;
        }
        if (!hasRegionBoard && !hasUserBoard) {
            setError('At least one board must be enabled');
            return;
        }
        setError(null);

        try {
            const data = await createLeague.mutateAsync({
                name: leagueName.trim(),
                hasRegionBoard,
                hasUserBoard,
            });
            setResult(data as CreationResult);
            setStep('success');
        } catch (e: any) {
            console.error('[CreateLeague] Error:', e);
            Alert.alert('Error', e?.message || 'Failed to create league. Please try again.');
        }
    };

    const handleCopyLink = async () => {
        await Clipboard.setStringAsync(joinLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleNativeShare = async () => {
        try {
            await Share.share({ message: shareMessage });
        } catch (e) {
            // User cancelled — no action needed
        }
    };

    const handleDone = () => {
        router.replace('/league/manage');
    };

    return (
        <ThemedView className="flex-1">
            <SafeAreaView edges={['top']} style={{ backgroundColor }}>
                {/* Header */}
                <StyledView className="flex-row items-center justify-center relative px-4 py-3" style={{ flexDirection: 'row' }}>
                    <StyledTouchableOpacity
                        onPress={() => router.back()}
                        style={{ position: 'absolute', left: 16, zIndex: 10, padding: 8 }}
                        hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                    >
                        <ChevronLeft size={28} color={iconColor} />
                    </StyledTouchableOpacity>
                    <ThemedText size="2xl" className="font-n-bold text-center">
                        {step === 'name' ? 'Create League' : 'League Created'}
                    </ThemedText>
                </StyledView>
            </SafeAreaView>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                {step === 'name' ? (
                    /* ──────────── Step 1: Name Entry ──────────── */
                    <StyledView className="flex-1 px-6 pt-10 items-center" style={{ maxWidth: 768, alignSelf: 'center', width: '100%' }}>
                        <Image source={CelebrationHamster} style={{ width: 80, height: 80, marginBottom: 24 }} contentFit="contain" />

                        <ThemedText size="xl" className="font-n-extrabold text-center" style={{ marginBottom: 8 }}>
                            Name your league
                        </ThemedText>
                        <ThemedText className="font-n-regular text-center" style={{ color: iconColor, marginBottom: 32, lineHeight: 20 }}>
                            Choose a name for your private league. You can invite friends to join after creating it.
                        </ThemedText>

                        <StyledView
                            className="flex-row items-center border rounded-xl w-full"
                            style={{ backgroundColor: surfaceColor, borderColor, paddingHorizontal: 16, paddingVertical: 14, gap: 12, flexDirection: 'row' }}
                        >
                            <Trophy size={20} color={iconColor} />
                            <TextInput
                                style={{ flex: 1, fontSize: 16, fontFamily: 'Nunito_600SemiBold', color: textColor }}
                                value={leagueName}
                                onChangeText={(text) => { setLeagueName(text); setError(null); }}
                                placeholder="e.g. The History Buffs"
                                placeholderTextColor="#94a3b8"
                                autoCorrect={false}
                                maxLength={40}
                                autoFocus
                            />
                        </StyledView>

                        {error && (
                            <Text style={{ color: '#ef4444', fontSize: 13, fontFamily: 'Nunito_500Medium', textAlign: 'center', marginTop: 12 }}>{error}</Text>
                        )}

                        {/* Board Toggles */}
                        <StyledView className="w-full" style={{ marginTop: 24, gap: 14 }}>
                            <ThemedText className="font-n-bold" size="base" style={{ marginBottom: 4 }}>Enable leaderboards</ThemedText>

                            <StyledView className="flex-row items-center justify-between" style={{ flexDirection: 'row' }}>
                                <View>
                                    <ThemedText className="font-n-semibold" size="base">{regionLabel} League</ThemedText>
                                    <Text style={{ fontSize: 12, fontFamily: 'Nunito_400Regular', color: iconColor }}>Based on daily {profile?.region || 'UK'} edition puzzles</Text>
                                </View>
                                <Switch
                                    value={hasRegionBoard}
                                    onValueChange={(val) => {
                                        if (!val && !hasUserBoard) return; // prevent disabling both
                                        setHasRegionBoard(val);
                                    }}
                                    trackColor={{ false: borderColor, true: '#8E57DB' }}
                                    thumbColor="#ffffff"
                                />
                            </StyledView>

                            <StyledView className="flex-row items-center justify-between" style={{ flexDirection: 'row' }}>
                                <View>
                                    <ThemedText className="font-n-semibold" size="base">Personal League</ThemedText>
                                    <Text style={{ fontSize: 12, fontFamily: 'Nunito_400Regular', color: iconColor }}>Based on personal mode puzzles</Text>
                                </View>
                                <Switch
                                    value={hasUserBoard}
                                    onValueChange={(val) => {
                                        if (!val && !hasRegionBoard) return;
                                        setHasUserBoard(val);
                                    }}
                                    trackColor={{ false: borderColor, true: '#B278CD' }}
                                    thumbColor="#ffffff"
                                />
                            </StyledView>
                        </StyledView>

                        <TouchableOpacity
                            style={{
                                width: '100%', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 20,
                                backgroundColor: leagueName.trim().length > 0 ? '#1d4ed8' : borderColor,
                            }}
                            onPress={handleCreate}
                            disabled={createLeague.isPending || !leagueName.trim()}
                        >
                            {createLeague.isPending ? (
                                <ActivityIndicator color="#ffffff" />
                            ) : (
                                <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '700', fontFamily: 'Nunito_700Bold' }}>Create League</Text>
                            )}
                        </TouchableOpacity>
                    </StyledView>
                ) : (
                    /* ──────────── Step 2: Success + Share ──────────── */
                    <StyledView className="flex-1 px-6 pt-8 items-center" style={{ maxWidth: 768, alignSelf: 'center', width: '100%' }}>
                        <Image source={CelebrationHamster} style={{ width: 100, height: 100, marginBottom: 20 }} contentFit="contain" />

                        <ThemedText size="xl" className="font-n-extrabold text-center" style={{ marginBottom: 4 }}>
                            {leagueName}
                        </ThemedText>
                        <ThemedText className="font-n-regular text-center" style={{ color: iconColor, marginBottom: 24 }}>
                            Your league is ready! Share the join code with friends.
                        </ThemedText>

                        {/* Join Code Card */}
                        <StyledView
                            className="w-full rounded-2xl border p-5 items-center"
                            style={{ backgroundColor: surfaceColor, borderColor, marginBottom: 20 }}
                        >
                            <Text style={{ fontSize: 12, fontFamily: 'Nunito_600SemiBold', color: iconColor, marginBottom: 8 }}>
                                Join code
                            </Text>
                            <Text style={{ fontSize: 32, fontWeight: '800', fontFamily: 'Nunito_800ExtraBold', letterSpacing: 4, color: textColor, marginBottom: 4 }}>
                                {result?.join_code}
                            </Text>
                            <Text style={{ fontSize: 12, fontFamily: 'Nunito_400Regular', color: '#94a3b8' }}>
                                {joinLink}
                            </Text>
                        </StyledView>

                        {/* Share Buttons */}
                        <StyledView className="w-full" style={{ gap: 10 }}>
                            {/* Copy link */}
                            <TouchableOpacity
                                style={{
                                    width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
                                    paddingVertical: 14, borderRadius: 12, borderWidth: 1,
                                    backgroundColor: copied ? '#dcfce7' : surfaceColor,
                                    borderColor: copied ? '#22c55e' : borderColor,
                                }}
                                onPress={handleCopyLink}
                            >
                                {copied ? (
                                    <>
                                        <Check size={18} color="#22c55e" />
                                        <Text style={{ fontSize: 15, fontWeight: '600', fontFamily: 'Nunito_600SemiBold', color: '#22c55e' }}>Link copied!</Text>
                                    </>
                                ) : (
                                    <>
                                        <Copy size={18} color={iconColor} />
                                        <Text style={{ fontSize: 15, fontWeight: '600', fontFamily: 'Nunito_600SemiBold', color: textColor }}>Copy invite link</Text>
                                    </>
                                )}
                            </TouchableOpacity>

                            {/* Native share */}
                            <TouchableOpacity
                                style={{
                                    width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
                                    paddingVertical: 14, borderRadius: 12,
                                    backgroundColor: '#1d4ed8',
                                }}
                                onPress={handleNativeShare}
                            >
                                <Share2 size={18} color="#ffffff" />
                                <Text style={{ fontSize: 15, fontWeight: '700', fontFamily: 'Nunito_700Bold', color: '#ffffff' }}>Share with friends</Text>
                            </TouchableOpacity>
                        </StyledView>

                        {/* Done button */}
                        <TouchableOpacity style={{ marginTop: 24, paddingVertical: 10 }} onPress={handleDone}>
                            <Text style={{ fontSize: 15, fontFamily: 'Nunito_600SemiBold', color: iconColor }}>Done</Text>
                        </TouchableOpacity>
                    </StyledView>
                )}
            </KeyboardAvoidingView>
        </ThemedView>
    );
}
