/**
 * League Management Hub
 *
 * - Global Identity header (editable display name + tag)
 * - Per-league cards with:
 *   - Admin badge + editable nickname
 *   - Admin panel: member list (half-screen scroll), per-user share toggle,
 *     "All users" share toggle, remove+block
 *   - Share section: visible if admin OR can_share, shows join code + copy + share
 *   - Leave / Re-join / Delete controls
 * - Create + Join league buttons
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    Alert,
    TextInput,
    ActivityIndicator,
    Platform,
    Dimensions,
    Switch,
    Share,
} from 'react-native';
import { styled } from 'nativewind';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import {
    ChevronLeft, ChevronDown, ChevronUp, Trophy, Plus, Users,
    Pencil, Check, X, LogOut, Trash2, RotateCcw, Shield, Copy, Share2,
    UserX, ArrowUp, ArrowDown, GripVertical,
} from 'lucide-react-native';
import { useAuth } from '../../lib/auth';
import { useProfile } from '../../hooks/useProfile';
import {
    useMyLeaguesAll,
    useGlobalIdentity,
    useSetGlobalIdentity,
    useUpdateLeagueNickname,
    useLeaveLeague,
    useRejoinLeague,
    useLeaveLeagueMode,
    useRejoinLeagueMode,
    useDeleteLeagueMembership,
    useLeagueMembers,
    useUpdateMemberShare,
    useToggleAllSharing,
    useRemoveAndBlockMember,
    useAdminRemoveMember,
    useAdminRejoinMember,
    useAdminUnblockMember,
    LeagueWithMembership,
    AdminMember,
    GameMode,
} from '../../hooks/useLeagueData';
import { useThemeColor } from '../../hooks/useThemeColor';
import { ThemedView } from '../../components/ThemedView';
import { ThemedText } from '../../components/ThemedText';
import { useOptions } from '../../lib/options';
import { useLeague } from '../../contexts/LeagueContext';

const StyledView = styled(View);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledScrollView = styled(ScrollView);

const SCREEN_HEIGHT = Dimensions.get('window').height;
const MEMBER_LIST_MAX_HEIGHT = SCREEN_HEIGHT * 0.4;

// ─── Admin Member Row ───────────────────────────────────────────────────

function AdminMemberRow({
    member,
    leagueId,
}: {
    member: AdminMember;
    leagueId: string;
}) {
    const updateShare = useUpdateMemberShare();
    const adminRemove = useAdminRemoveMember();
    const adminRejoin = useAdminRejoinMember();
    const blockMember = useRemoveAndBlockMember();
    const adminUnblock = useAdminUnblockMember();
    const textColor = useThemeColor({}, 'text');
    const iconColor = useThemeColor({}, 'icon');
    const borderColor = useThemeColor({}, 'border');

    const handleToggleShare = () => {
        updateShare.mutate({ leagueId, targetUserId: member.user_id, canShare: !member.can_share });
    };

    const handleRemove = () => {
        Alert.alert(
            'Remove member',
            `Remove "${member.league_nickname || member.global_display_name}" from this league? They will no longer be shown in this league.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: () => adminRemove.mutate({ leagueId, targetUserId: member.user_id }),
                },
            ]
        );
    };

    const handleRejoin = () => {
        adminRejoin.mutate({ leagueId, targetUserId: member.user_id });
    };

    const handleBlock = () => {
        blockMember.mutate({ leagueId, targetUserId: member.user_id });
    };

    const handleUnblock = () => {
        adminUnblock.mutate({ leagueId, targetUserId: member.user_id });
    };

    const isLoading = adminRemove.isPending || adminRejoin.isPending || blockMember.isPending || adminUnblock.isPending;

    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: borderColor }}>
            <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontFamily: 'Nunito_600SemiBold', color: member.is_active ? textColor : '#94a3b8' }} numberOfLines={1}>
                    {member.league_nickname || member.global_display_name}
                </Text>
                <Text style={{ fontSize: 10, fontFamily: 'Nunito_400Regular', color: '#94a3b8' }}>
                    {member.global_display_name} {member.global_tag}
                </Text>
            </View>

            {/* Actions — not for admin themselves */}
            {!member.is_admin && (
                <>
                    {member.is_active && !member.is_banned && (
                        <>
                            {/* Remove icon — fixed width column */}
                            <TouchableOpacity
                                onPress={handleRemove}
                                disabled={isLoading}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                style={{ width: 48, alignItems: 'center', justifyContent: 'center' }}
                            >
                                {isLoading ? <ActivityIndicator size="small" color="#ef4444" /> : <UserX size={22} color="#ef4444" />}
                            </TouchableOpacity>
                            {/* Share toggle — fixed width column */}
                            <View style={{ width: 60, alignItems: 'center' }}>
                                <Switch
                                    value={member.can_share}
                                    onValueChange={handleToggleShare}
                                    trackColor={{ false: '#cbd5e1', true: '#3b82f6' }}
                                    thumbColor="#ffffff"
                                    style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
                                />
                            </View>
                        </>
                    )}
                    {!member.is_active && !member.is_banned && (
                        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                            <TouchableOpacity
                                onPress={handleRejoin}
                                disabled={isLoading}
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: '#22c55e' }}
                            >
                                {isLoading ? <ActivityIndicator size="small" color="#fff" /> : <RotateCcw size={12} color="#fff" />}
                                <Text style={{ fontSize: 11, fontFamily: 'Nunito_600SemiBold', color: '#fff' }}>Rejoin</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleBlock}
                                disabled={isLoading}
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: '#ef4444' }}
                            >
                                {isLoading ? <ActivityIndicator size="small" color="#fff" /> : <UserX size={12} color="#fff" />}
                                <Text style={{ fontSize: 11, fontFamily: 'Nunito_600SemiBold', color: '#fff' }}>Block</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                    {member.is_banned && (
                        <TouchableOpacity
                            onPress={handleUnblock}
                            disabled={isLoading}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: '#94a3b8' }}
                        >
                            {isLoading ? <ActivityIndicator size="small" color="#94a3b8" /> : <RotateCcw size={12} color="#94a3b8" />}
                            <Text style={{ fontSize: 11, fontFamily: 'Nunito_600SemiBold', color: '#94a3b8' }}>Unblock</Text>
                        </TouchableOpacity>
                    )}
                </>
            )}
        </View>
    );
}

// ─── Per-League Card ────────────────────────────────────────────────────

function LeagueManageCard({ league, reorderMode, onMoveUp, onMoveDown, isFirst, isLast }: {
    league: LeagueWithMembership;
    reorderMode?: boolean;
    onMoveUp?: () => void;
    onMoveDown?: () => void;
    isFirst?: boolean;
    isLast?: boolean;
}) {
    const { user } = useAuth();
    const { profile } = useProfile();
    const regionLabel = profile?.region ? `${profile.region} Edition` : 'UK Edition';
    const updateNickname = useUpdateLeagueNickname();
    const leaveLeague = useLeaveLeague();
    const rejoinLeague = useRejoinLeague();
    const leaveMode = useLeaveLeagueMode();
    const rejoinMode = useRejoinLeagueMode();
    const deleteMembership = useDeleteLeagueMembership();
    const toggleAllSharing = useToggleAllSharing();

    const surfaceColor = useThemeColor({}, 'surface');
    const borderColor = useThemeColor({}, 'border');
    const textColor = useThemeColor({}, 'text');
    const iconColor = useThemeColor({}, 'icon');

    const [expanded, setExpanded] = useState(false);
    const [editing, setEditing] = useState(false);
    const [nickname, setNickname] = useState(league.league_nickname || '');

    // Helper: reset League screen saved state so it shows first league / current month
    const clearLeagueScreenState = useCallback(() => {
        if (user?.id) {
            AsyncStorage.removeItem(`league_screen_state_${user.id}`).catch(() => { });
        }
    }, [user?.id]);
    const [copied, setCopied] = useState(false);

    const isAdmin = league.admin_user_id === user?.id;
    const canShareLink = isAdmin || league.can_share;

    // Fetch members only when admin + expanded
    const { data: members, isLoading: membersLoading } = useLeagueMembers(
        isAdmin && expanded ? league.id : null
    );

    const joinLink = league.join_code ? `https://elementle.tech/league/join/${league.join_code}` : '';
    const shareMessage = isAdmin
        ? `Join my Elementle league "${league.name}"! 🧩🏆\n\nElementle is a daily puzzle game where you guess historical dates.\n\nJoin code: ${league.join_code}\n\nOr tap this link to join:\n${joinLink}`
        : `Join the Elementle league I'm in - "${league.name}"! 🧩🏆\n\nElementle is a daily puzzle game where you guess historical dates.\n\nJoin code: ${league.join_code}\n\nOr tap this link to join:\n${joinLink}`;

    // Independent "All" toggle state — only changes on explicit "All" toggle click,
    // NOT when individual member toggles change.
    const [allShareOn, setAllShareOn] = useState(false);

    // Initialise once from member data (when members first load)
    const membersInitRef = React.useRef(false);
    React.useEffect(() => {
        if (members && members.length > 0 && !membersInitRef.current) {
            membersInitRef.current = true;
            setAllShareOn(members.filter(m => !m.is_admin).every(m => m.can_share));
        }
    }, [members]);

    const handleSaveNickname = async () => {
        if (!nickname.trim()) return;
        try {
            await updateNickname.mutateAsync({ leagueId: league.id, nickname: nickname.trim() });
            setEditing(false);
        } catch (e: any) {
            Alert.alert('Error', e?.message || 'Failed to update nickname');
        }
    };

    const handleToggleAllSharing = () => {
        const newValue = !allShareOn;
        setAllShareOn(newValue);
        toggleAllSharing.mutate({ leagueId: league.id, canShare: newValue });
    };

    const handleCopyLink = async () => {
        await Clipboard.setStringAsync(joinLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleNativeShare = async () => {
        try {
            await Share.share({ message: shareMessage });
        } catch (e) { /* cancelled */ }
    };

    const handleLeave = () => {
        Alert.alert(
            'Leave league',
            `Are you sure you want to leave "${league.name}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Leave',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await leaveLeague.mutateAsync(league.id);
                            clearLeagueScreenState();
                        }
                        catch (e: any) { Alert.alert('Error', e?.message || 'Failed to leave league'); }
                    },
                },
            ]
        );
    };

    const handleRejoin = async () => {
        try { await rejoinLeague.mutateAsync(league.id); }
        catch (e: any) { Alert.alert('Error', e?.message || 'Failed to rejoin league'); }
    };

    const handleLeaveMode = async (mode: GameMode) => {
        try {
            await leaveMode.mutateAsync({ leagueId: league.id, gameMode: mode });
            clearLeagueScreenState();
        }
        catch (e: any) { Alert.alert('Error', e?.message || `Failed to leave ${mode} board`); }
    };

    const handleRejoinMode = async (mode: GameMode) => {
        try { await rejoinMode.mutateAsync({ leagueId: league.id, gameMode: mode }); }
        catch (e: any) { Alert.alert('Error', e?.message || `Failed to rejoin ${mode} board`); }
    };

    const handleDelete = () => {
        Alert.alert(
            'Delete membership',
            `Permanently remove "${league.name}" from your leagues?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            // Ensure is_active is false before deleting (RPC requires it)
                            if (league.is_active) {
                                await leaveLeague.mutateAsync(league.id);
                            }
                            await deleteMembership.mutateAsync(league.id);
                            clearLeagueScreenState();
                        } catch (e: any) { Alert.alert('Error', e?.message || 'Failed to delete'); }
                    },
                },
            ]
        );
    };

    const handleDeleteLeague = () => {
        Alert.alert(
            'Delete League',
            `This is a permanent action. The league "${league.name}" will be removed for ALL members and cannot be recovered.\n\nAre you sure?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Confirm',
                    style: 'destructive',
                    onPress: async () => {
                        try { await deleteMembership.mutateAsync(league.id); }
                        catch (e: any) { Alert.alert('Error', e?.message || 'Failed to delete league'); }
                    },
                },
            ]
        );
    };

    // User has left all enabled boards → can delete membership
    const leftAllBoards = (
        (!league.has_region_board || !league.is_active_region) &&
        (!league.has_user_board || !league.is_active_user)
    );
    // Admin-deleted league (if backend supports it)
    const isAdminDeleted = (league as any).is_deleted === true;

    return (
        <StyledView
            style={{
                backgroundColor: surfaceColor, borderRadius: 12, borderWidth: 1,
                borderColor, overflow: 'hidden',
                opacity: league.is_active ? 1 : 0.6,
            }}
        >
            {/* Header row */}
            <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 10 }}
                onPress={reorderMode ? undefined : () => setExpanded(!expanded)}
                activeOpacity={reorderMode ? 1 : 0.7}
            >
                <Trophy size={20} color="#b45309" />
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', fontFamily: 'Nunito_700Bold', color: textColor }}>
                        {league.name}
                    </Text>
                    {!reorderMode && isAdmin && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#b45309', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                            <Shield size={10} color="#fff" />
                            <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700', fontFamily: 'Nunito_700Bold' }}>Admin</Text>
                        </View>
                    )}
                    {!reorderMode && isAdminDeleted && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#ef4444', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                            <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700', fontFamily: 'Nunito_700Bold' }}>Deleted by Admin</Text>
                        </View>
                    )}
                </View>
                {!reorderMode && league.is_system_league && (
                    <View style={{ backgroundColor: '#1d4ed8', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700', fontFamily: 'Nunito_700Bold' }}>System</Text>
                    </View>
                )}
                {!reorderMode && !league.is_active && (
                    <View style={{ backgroundColor: '#94a3b8', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700', fontFamily: 'Nunito_700Bold' }}>Left</Text>
                    </View>
                )}
                {/* Delete button for non-admin who left both boards, or Remove button for admin-deleted leagues */}
                {!reorderMode && !league.is_system_league && !isAdmin && (leftAllBoards || isAdminDeleted) && (
                    <TouchableOpacity
                        onPress={isAdminDeleted ? handleDelete : handleDelete}
                        disabled={deleteMembership.isPending}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: '#ef4444' }}
                    >
                        {deleteMembership.isPending
                            ? <ActivityIndicator size="small" color="#ef4444" />
                            : <Trash2 size={12} color="#ef4444" />
                        }
                        <Text style={{ fontSize: 11, fontFamily: 'Nunito_600SemiBold', color: '#ef4444' }}>
                            {isAdminDeleted ? 'Remove' : 'Delete'}
                        </Text>
                    </TouchableOpacity>
                )}
                {/* Reorder mode: show up/down arrows inline */}
                {reorderMode ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <TouchableOpacity
                            onPress={onMoveUp}
                            disabled={isFirst}
                            style={{ opacity: isFirst ? 0.3 : 1, padding: 6 }}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <ArrowUp size={20} color={iconColor} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={onMoveDown}
                            disabled={isLast}
                            style={{ opacity: isLast ? 0.3 : 1, padding: 6 }}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <ArrowDown size={20} color={iconColor} />
                        </TouchableOpacity>
                        <GripVertical size={20} color={iconColor} style={{ opacity: 0.4 }} />
                    </View>
                ) : !reorderMode ? (
                    expanded ? <ChevronUp size={20} color={iconColor} /> : <ChevronDown size={20} color={iconColor} />
                ) : null}
            </TouchableOpacity>

            {/* Expanded content — hidden in reorder mode */}
            {expanded && !reorderMode && (
                <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 14 }}>
                    {/* Nickname section */}
                    <View>
                        <Text style={{ fontSize: 11, fontFamily: 'Nunito_600SemiBold', color: iconColor, marginBottom: 4 }}>
                            League nickname
                        </Text>
                        {editing ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <TextInput
                                    style={{
                                        flex: 1, fontSize: 15, fontFamily: 'Nunito_600SemiBold', color: textColor,
                                        borderWidth: 1, borderColor, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
                                    }}
                                    value={nickname}
                                    onChangeText={(t) => setNickname(t.replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 15))}
                                    maxLength={15}
                                    autoFocus
                                />
                                <TouchableOpacity onPress={handleSaveNickname} disabled={updateNickname.isPending}>
                                    {updateNickname.isPending ? <ActivityIndicator size="small" /> : <Check size={20} color="#22c55e" />}
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => { setEditing(false); setNickname(league.league_nickname || ''); }}>
                                    <X size={20} color="#ef4444" />
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Text style={{ fontSize: 15, fontFamily: 'Nunito_600SemiBold', color: textColor }}>
                                    {league.league_nickname || 'Not set'}
                                </Text>
                                {league.is_active && (
                                    <TouchableOpacity onPress={() => setEditing(true)}>
                                        <Pencil size={14} color={iconColor} />
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}
                    </View>

                    {/* Member count */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Users size={14} color={iconColor} />
                        <Text style={{ fontSize: 12, fontFamily: 'Nunito_400Regular', color: iconColor }}>
                            {league.member_count ?? '—'} active members
                        </Text>
                    </View>

                    {/* Admin info — show to non-admins */}
                    {!isAdmin && league.admin_display_name && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Shield size={14} color="#b45309" />
                            <Text style={{ fontSize: 12, fontFamily: 'Nunito_400Regular', color: iconColor }}>
                                Admin: {league.admin_display_name}{league.admin_tag ? ` ${league.admin_tag}` : ''}
                            </Text>
                        </View>
                    )}

                    {/* ── Admin Panel: Member List ── */}
                    {isAdmin && league.is_active && (
                        <View style={{ borderTopWidth: 1, borderTopColor: borderColor, paddingTop: 12, gap: 6 }}>
                            {/* Column headers row */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, marginBottom: 4 }}>
                                <Text style={{ flex: 1, fontSize: 14, fontFamily: 'Nunito_700Bold', color: textColor }}>Members</Text>
                                <Text style={{ width: 48, textAlign: 'center', fontSize: 11, fontFamily: 'Nunito_600SemiBold', color: iconColor }}>Remove</Text>
                                <Text style={{ width: 60, textAlign: 'center', fontSize: 11, fontFamily: 'Nunito_600SemiBold', color: iconColor, lineHeight: 14 }}>Allow to{"\n"}Share</Text>
                            </View>
                            {/* All Members row — visually distinct */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: borderColor, backgroundColor: 'rgba(0,0,0,0.02)' }}>
                                <Text style={{ flex: 1, fontSize: 13, fontFamily: 'Nunito_500Medium', color: iconColor, fontStyle: 'italic' }}>All Members</Text>
                                <View style={{ width: 48 }} />
                                <View style={{ width: 60, alignItems: 'center' }}>
                                    <Switch
                                        value={allShareOn}
                                        onValueChange={handleToggleAllSharing}
                                        trackColor={{ false: '#cbd5e1', true: '#3b82f6' }}
                                        thumbColor="#ffffff"
                                        disabled={toggleAllSharing.isPending}
                                        style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
                                    />
                                </View>
                            </View>

                            {membersLoading ? (
                                <ActivityIndicator size="small" style={{ paddingVertical: 16 }} />
                            ) : members && members.length > 0 ? (
                                <ScrollView
                                    style={{ maxHeight: MEMBER_LIST_MAX_HEIGHT }}
                                    nestedScrollEnabled
                                    showsVerticalScrollIndicator
                                >
                                    {(members as AdminMember[]).filter(m => !m.is_admin).map((member) => (
                                        <AdminMemberRow
                                            key={member.user_id}
                                            member={member}
                                            leagueId={league.id}
                                        />
                                    ))}
                                </ScrollView>
                            ) : (
                                <Text style={{ fontSize: 12, fontFamily: 'Nunito_400Regular', color: iconColor, textAlign: 'center', paddingVertical: 8 }}>
                                    No members found
                                </Text>
                            )}
                        </View>
                    )}

                    {/* ── Share Section: visible if admin OR user has can_share ── */}
                    {canShareLink && league.is_active && league.join_code && (
                        <View style={{ borderTopWidth: 1, borderTopColor: borderColor, paddingTop: 12, gap: 8 }}>
                            <Text style={{ fontSize: 12, fontFamily: 'Nunito_700Bold', color: textColor }}>Share league</Text>

                            {/* Join code display */}
                            <View style={{ alignItems: 'center', paddingVertical: 8 }}>
                                <Text style={{ fontSize: 10, fontFamily: 'Nunito_500Medium', color: iconColor, marginBottom: 4 }}>Join code</Text>
                                <Text style={{
                                    fontSize: 22, fontWeight: '800', fontFamily: 'Nunito_800ExtraBold',
                                    letterSpacing: 3, color: textColor,
                                }}>
                                    {league.join_code}
                                </Text>
                            </View>

                            {/* Copy + Share buttons */}
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                <TouchableOpacity
                                    style={{
                                        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                                        paddingVertical: 10, borderRadius: 8, borderWidth: 1,
                                        backgroundColor: copied ? '#dcfce7' : surfaceColor,
                                        borderColor: copied ? '#22c55e' : borderColor,
                                    }}
                                    onPress={handleCopyLink}
                                >
                                    {copied ? (
                                        <>
                                            <Check size={14} color="#22c55e" />
                                            <Text style={{ fontSize: 13, fontFamily: 'Nunito_600SemiBold', color: '#22c55e' }}>Copied!</Text>
                                        </>
                                    ) : (
                                        <>
                                            <Copy size={14} color={iconColor} />
                                            <Text style={{ fontSize: 13, fontFamily: 'Nunito_600SemiBold', color: textColor }}>Copy link</Text>
                                        </>
                                    )}
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={{
                                        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                                        paddingVertical: 10, borderRadius: 8,
                                        backgroundColor: '#1d4ed8',
                                    }}
                                    onPress={handleNativeShare}
                                >
                                    <Share2 size={14} color="#ffffff" />
                                    <Text style={{ fontSize: 13, fontFamily: 'Nunito_700Bold', color: '#ffffff' }}>Share</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {/* Per-Mode Board Status */}
                    {(league.has_region_board && league.has_user_board) ? (
                        <View style={{ gap: 8, marginTop: 2 }}>
                            {/* Region Board Row */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: league.is_active_region ? '#22c55e' : '#94a3b8' }} />
                                    <Text style={{ fontSize: 13, fontFamily: 'Nunito_600SemiBold', color: textColor }}>{regionLabel} League</Text>
                                </View>
                                {league.is_active_region ? (
                                    <TouchableOpacity
                                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: '#8E57DB' }}
                                        onPress={() => handleLeaveMode('region')}
                                        disabled={leaveMode.isPending}
                                    >
                                        <LogOut size={12} color="#8E57DB" />
                                        <Text style={{ fontSize: 12, fontFamily: 'Nunito_600SemiBold', color: '#8E57DB' }}>Leave</Text>
                                    </TouchableOpacity>
                                ) : (
                                    <TouchableOpacity
                                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: '#8E57DB' }}
                                        onPress={() => handleRejoinMode('region')}
                                        disabled={rejoinMode.isPending}
                                    >
                                        <RotateCcw size={12} color="#fff" />
                                        <Text style={{ fontSize: 12, fontFamily: 'Nunito_600SemiBold', color: '#fff' }}>Rejoin</Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            {/* User Board Row */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: league.is_active_user ? '#22c55e' : '#94a3b8' }} />
                                    <Text style={{ fontSize: 13, fontFamily: 'Nunito_600SemiBold', color: textColor }}>Personal League</Text>
                                </View>
                                {league.is_active_user ? (
                                    <TouchableOpacity
                                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: '#B278CD' }}
                                        onPress={() => handleLeaveMode('user')}
                                        disabled={leaveMode.isPending}
                                    >
                                        <LogOut size={12} color="#B278CD" />
                                        <Text style={{ fontSize: 12, fontFamily: 'Nunito_600SemiBold', color: '#B278CD' }}>Leave</Text>
                                    </TouchableOpacity>
                                ) : (
                                    <TouchableOpacity
                                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: '#B278CD' }}
                                        onPress={() => handleRejoinMode('user')}
                                        disabled={rejoinMode.isPending}
                                    >
                                        <RotateCcw size={12} color="#fff" />
                                        <Text style={{ fontSize: 12, fontFamily: 'Nunito_600SemiBold', color: '#fff' }}>Rejoin</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    ) : (
                        /* Single-board fallback: original leave/rejoin */
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 2 }}>
                            {league.is_active ? (
                                <TouchableOpacity
                                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#ef4444' }}
                                    onPress={handleLeave}
                                    disabled={leaveLeague.isPending}
                                >
                                    {leaveLeague.isPending ? <ActivityIndicator size="small" color="#ef4444" /> : <LogOut size={14} color="#ef4444" />}
                                    <Text style={{ fontSize: 13, fontFamily: 'Nunito_600SemiBold', color: '#ef4444' }}>Leave</Text>
                                </TouchableOpacity>
                            ) : (
                                <>
                                    <TouchableOpacity
                                        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#1d4ed8' }}
                                        onPress={handleRejoin}
                                        disabled={rejoinLeague.isPending}
                                    >
                                        {rejoinLeague.isPending ? <ActivityIndicator size="small" color="#fff" /> : <RotateCcw size={14} color="#fff" />}
                                        <Text style={{ fontSize: 13, fontFamily: 'Nunito_600SemiBold', color: '#fff' }}>Re-join</Text>
                                    </TouchableOpacity>

                                    {!league.is_system_league && (
                                        <TouchableOpacity
                                            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#ef4444' }}
                                            onPress={handleDelete}
                                            disabled={deleteMembership.isPending}
                                        >
                                            {deleteMembership.isPending ? <ActivityIndicator size="small" color="#ef4444" /> : <Trash2 size={14} color="#ef4444" />}
                                            <Text style={{ fontSize: 13, fontFamily: 'Nunito_600SemiBold', color: '#ef4444' }}>Delete</Text>
                                        </TouchableOpacity>
                                    )}
                                </>
                            )}
                        </View>
                    )}

                    {/* ── Admin: Delete League button ── */}
                    {isAdmin && !league.is_system_league && (
                        <TouchableOpacity
                            style={{
                                flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                                gap: 8, paddingVertical: 12, borderRadius: 10,
                                backgroundColor: '#ef4444', marginTop: 8,
                            }}
                            onPress={handleDeleteLeague}
                            disabled={deleteMembership.isPending}
                        >
                            {deleteMembership.isPending
                                ? <ActivityIndicator size="small" color="#fff" />
                                : <Trash2 size={16} color="#fff" />
                            }
                            <Text style={{ fontSize: 14, fontWeight: '700', fontFamily: 'Nunito_700Bold', color: '#ffffff' }}>
                                Delete league
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}
        </StyledView>
    );
}

// ─── Main Screen ────────────────────────────────────────────────────────

export default function ManageLeaguesScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const insets = useSafeAreaInsets();

    // Theme colors
    const backgroundColor = useThemeColor({}, 'background');
    const surfaceColor = useThemeColor({}, 'surface');
    const borderColor = useThemeColor({}, 'border');
    const textColor = useThemeColor({}, 'text');
    const iconColor = useThemeColor({}, 'icon');

    const { data: leagues, isLoading } = useMyLeaguesAll();
    const { data: globalIdentity } = useGlobalIdentity();
    const setGlobalIdentity = useSetGlobalIdentity();
    const { pendingLeagueInviteRegion, pendingLeagueInviteUser } = useLeague();
    const { profile } = useProfile();
    const regionLabel = profile?.region ? `${profile.region} Edition` : 'UK Edition';

    const [editingGlobal, setEditingGlobal] = useState(false);
    const [globalName, setGlobalName] = useState('');
    const [reorderMode, setReorderMode] = useState(false);
    const [orderedLeagueIds, setOrderedLeagueIds] = useState<string[]>([]);
    const orderInitialisedRef = useRef(false);

    // Load saved league order from AsyncStorage
    useEffect(() => {
        if (!user?.id) return;
        AsyncStorage.getItem(`league_order_${user.id}`).then(saved => {
            if (saved) {
                try { setOrderedLeagueIds(JSON.parse(saved)); } catch { }
            }
        });
    }, [user?.id]);

    // When leagues load, merge with saved order
    useEffect(() => {
        if (!leagues || leagues.length === 0 || orderInitialisedRef.current) return;
        orderInitialisedRef.current = true;
        const allIds = (leagues as LeagueWithMembership[]).map(l => l.id);
        setOrderedLeagueIds(prev => {
            if (prev.length === 0) return allIds;
            // Keep saved order for existing leagues, append new ones at end
            const ordered = prev.filter(id => allIds.includes(id));
            const newIds = allIds.filter(id => !ordered.includes(id));
            return [...ordered, ...newIds];
        });
    }, [leagues]);

    // Sort leagues by saved order
    const sortedLeagues = React.useMemo(() => {
        if (!leagues) return [];
        const leagueArr = leagues as LeagueWithMembership[];
        // System leagues always first, in their original order
        // Sort ALL leagues by saved order
        const sorted = [...(leagueArr as LeagueWithMembership[])].sort((a, b) => {
            const idxA = orderedLeagueIds.indexOf(a.id);
            const idxB = orderedLeagueIds.indexOf(b.id);
            return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
        });
        return sorted;
    }, [leagues, orderedLeagueIds]);

    // Save order to AsyncStorage
    const saveOrder = useCallback(async (ids: string[]) => {
        if (!user?.id) return;
        setOrderedLeagueIds(ids);
        await AsyncStorage.setItem(`league_order_${user.id}`, JSON.stringify(ids));
    }, [user?.id]);

    const handleMoveUp = useCallback((leagueId: string) => {
        const ids = sortedLeagues.map(l => l.id);
        const idx = ids.indexOf(leagueId);
        if (idx <= 0) return;
        [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]];
        saveOrder(ids);
    }, [sortedLeagues, saveOrder]);

    const handleMoveDown = useCallback((leagueId: string) => {
        const ids = sortedLeagues.map(l => l.id);
        const idx = ids.indexOf(leagueId);
        if (idx === -1 || idx >= ids.length - 1) return;
        [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]];
        saveOrder(ids);
    }, [sortedLeagues, saveOrder]);

    // ── Leave All Leagues toggle ──
    const { leagueTablesEnabled, toggleLeagueTables } = useOptions();
    const leaveLeague = useLeaveLeague();
    const rejoinLeague = useRejoinLeague();
    const [leavingAll, setLeavingAll] = useState(false);

    // Toggle state — initialized from actual league data so it survives remounts
    const [removeAllToggle, setRemoveAllToggle] = useState(false);
    const toggleInitRef = useRef(false);

    useEffect(() => {
        if (toggleInitRef.current || !leagues || leagues.length === 0) return;
        toggleInitRef.current = true;
        const allLeft = (leagues as LeagueWithMembership[]).every(l => !l.is_active);
        if (allLeft) setRemoveAllToggle(true);
    }, [leagues]);

    // Computed: are all leagues fully left? (for Options auto-disable only, NOT for the toggle)
    const allLeaguesFullyLeft = React.useMemo(() => {
        if (!leagues || leagues.length === 0) return false;
        return (leagues as LeagueWithMembership[]).every(l => {
            if (!l.is_active) return true;
            const regionLeft = !l.has_region_board || !l.is_active_region;
            const userLeft = !l.has_user_board || !l.is_active_user;
            return regionLeft && userLeft;
        });
    }, [leagues]);

    const handleBackPress = useCallback(() => {
        if (reorderMode) {
            setReorderMode(false);
        }
        // If all leagues are left, redirect to Settings instead of back to Leagues screen
        if (removeAllToggle || allLeaguesFullyLeft) {
            router.replace('/(tabs)/settings');
        } else {
            router.back();
        }
    }, [reorderMode, router, removeAllToggle, allLeaguesFullyLeft]);

    const handleToggleRemoveAll = useCallback(async () => {
        if (removeAllToggle) {
            // Turning OFF — rejoin all, no confirmation needed
            setLeavingAll(true);
            try {
                const leagueArr = leagues as LeagueWithMembership[];
                for (const league of leagueArr) {
                    if (!league.is_active) {
                        await rejoinLeague.mutateAsync(league.id);
                    }
                }
                // Turn league tables back on
                if (!leagueTablesEnabled) toggleLeagueTables();
                setRemoveAllToggle(false);
            } catch (e: any) {
                Alert.alert('Error', e?.message || 'Failed to rejoin leagues');
            } finally {
                setLeavingAll(false);
            }
        } else {
            // Turning ON — leave all, confirmation required
            Alert.alert(
                'Are you sure?',
                'Are you sure you want to leave all leagues?',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Continue',
                        style: 'destructive',
                        onPress: async () => {
                            setLeavingAll(true);
                            try {
                                const leagueArr = leagues as LeagueWithMembership[];
                                for (const league of leagueArr) {
                                    if (league.is_active) {
                                        await leaveLeague.mutateAsync(league.id);
                                    }
                                }
                                // Turn off league tables on home screen
                                if (leagueTablesEnabled) toggleLeagueTables();
                                setRemoveAllToggle(true);
                                // Reset Leagues screen state
                                if (user?.id) AsyncStorage.removeItem(`league_screen_state_${user.id}`).catch(() => { });
                            } catch (e: any) {
                                Alert.alert('Error', e?.message || 'Failed to leave leagues');
                            } finally {
                                setLeavingAll(false);
                            }
                        },
                    },
                ]
            );
        }
    }, [removeAllToggle, leagues, leaveLeague, rejoinLeague, leagueTablesEnabled, toggleLeagueTables]);

    useEffect(() => {
        if (globalIdentity?.global_display_name && !globalName) {
            setGlobalName(globalIdentity.global_display_name);
        }
    }, [globalIdentity]);


    const handleSaveGlobalName = async () => {
        if (!globalName.trim()) return;
        try {
            await setGlobalIdentity.mutateAsync(globalName.trim());
            setEditingGlobal(false);
        } catch (e: any) {
            Alert.alert('Error', e?.message || 'Failed to update display name');
        }
    };

    return (
        <ThemedView className="flex-1">
            <SafeAreaView edges={['top']} style={{ backgroundColor }}>
                {/* Header */}
                <StyledView className="flex-row items-center justify-center relative px-4 py-3" style={{ flexDirection: 'row' }}>
                    <StyledTouchableOpacity
                        onPress={handleBackPress}
                        style={{ position: 'absolute', left: 16, zIndex: 10, padding: 8 }}
                        hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                    >
                        <ChevronLeft size={28} color={iconColor} />
                    </StyledTouchableOpacity>
                    <ThemedText size="2xl" className="font-n-bold text-center">Manage Leagues</ThemedText>
                </StyledView>
            </SafeAreaView>

            <StyledScrollView className="flex-1 px-4 pt-4" contentContainerStyle={{ paddingBottom: Platform.OS === 'android' ? Math.max(40, insets.bottom + 24) : 40, gap: 12, maxWidth: 768, alignSelf: 'center', width: '100%' }}>
                {/* Global Identity Card */}
                <StyledView
                    style={{
                        backgroundColor: surfaceColor, borderRadius: 12, borderWidth: 1,
                        borderColor, padding: 16, gap: 8,
                        opacity: removeAllToggle ? 0.35 : 1,
                    }}
                    pointerEvents={removeAllToggle ? 'none' : 'auto'}
                >
                    <Text style={{ fontSize: 11, fontFamily: 'Nunito_700Bold', color: iconColor, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Your identity
                    </Text>

                    {editingGlobal ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <TextInput
                                style={{
                                    flex: 1, fontSize: 18, fontFamily: 'Nunito_700Bold', color: textColor,
                                    borderWidth: 1, borderColor, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
                                }}
                                value={globalName}
                                onChangeText={(t) => setGlobalName(t.replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 15))}
                                maxLength={15}
                                autoFocus
                            />
                            <TouchableOpacity onPress={handleSaveGlobalName} disabled={setGlobalIdentity.isPending}>
                                {setGlobalIdentity.isPending ? <ActivityIndicator size="small" /> : <Check size={22} color="#22c55e" />}
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => { setEditingGlobal(false); setGlobalName(globalIdentity?.global_display_name || ''); }}>
                                <X size={22} color="#ef4444" />
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                            <Text style={{ fontSize: 20, fontFamily: 'Nunito_800ExtraBold', color: textColor }}>
                                {globalIdentity?.global_display_name || 'Not set'}
                            </Text>
                            <Text style={{ fontSize: 14, fontFamily: 'Nunito_600SemiBold', color: iconColor }}>
                                {globalIdentity?.global_tag || ''}
                            </Text>
                            <TouchableOpacity onPress={() => setEditingGlobal(true)} style={{ marginLeft: 4 }}>
                                <Pencil size={14} color={iconColor} />
                            </TouchableOpacity>
                        </View>
                    )}

                    <Text style={{ fontSize: 11, fontFamily: 'Nunito_400Regular', color: '#94a3b8' }}>
                        This is your identity across all leagues
                    </Text>
                </StyledView>

                {/* League list */}
                {isLoading ? (
                    <StyledView className="items-center py-8">
                        <ActivityIndicator />
                    </StyledView>
                ) : !leagues || leagues.length === 0 ? (
                    <StyledView className="items-center py-8" style={{ gap: 8 }}>
                        <ThemedText className="font-n-regular" style={{ color: iconColor }}>
                            You haven't joined any leagues yet
                        </ThemedText>
                    </StyledView>
                ) : (
                    <View style={{ opacity: removeAllToggle ? 0.35 : 1 }} pointerEvents={removeAllToggle ? 'none' : 'auto'}>
                        {sortedLeagues.map((league, index) => {
                            return (
                                <LeagueManageCard
                                    key={league.id}
                                    league={league}
                                    reorderMode={reorderMode}
                                    onMoveUp={() => handleMoveUp(league.id)}
                                    onMoveDown={() => handleMoveDown(league.id)}
                                    isFirst={index === 0}
                                    isLast={index === sortedLeagues.length - 1}
                                />
                            );
                        })}
                    </View>
                )}

                {/* Action Buttons */}
                {!isLoading && (
                    <StyledView style={{ marginTop: 8, gap: 10, opacity: removeAllToggle ? 0.35 : 1 }} pointerEvents={removeAllToggle ? 'none' : 'auto'}>
                        {/* Re-order button — show when there are 2+ leagues */}
                        {sortedLeagues.length > 1 && (
                            <TouchableOpacity
                                style={{
                                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
                                    paddingVertical: 14, borderRadius: 12, borderWidth: 1,
                                    backgroundColor: reorderMode ? '#22c55e' : surfaceColor,
                                    borderColor: reorderMode ? '#22c55e' : borderColor,
                                }}
                                onPress={() => setReorderMode(!reorderMode)}
                            >
                                <GripVertical size={18} color={reorderMode ? '#ffffff' : iconColor} />
                                <Text style={{
                                    color: reorderMode ? '#ffffff' : textColor,
                                    fontSize: 15, fontWeight: '600', fontFamily: 'Nunito_600SemiBold',
                                }}>
                                    {reorderMode ? 'Done' : 'Re-order'}
                                </Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={{
                                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
                                paddingVertical: 14, borderRadius: 12,
                                backgroundColor: '#1d4ed8',
                            }}
                            onPress={() => router.push('/league/create')}
                        >
                            <Plus size={18} color="#ffffff" />
                            <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: '700', fontFamily: 'Nunito_700Bold' }}>Create a league</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={{
                                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
                                paddingVertical: 14, borderRadius: 12, borderWidth: 1,
                                backgroundColor: '#e2e8f0', borderColor: '#e2e8f0',
                            }}
                            onPress={() => {
                                // Block manual join while per-mode invitations are pending
                                if (pendingLeagueInviteRegion || pendingLeagueInviteUser) {
                                    const editions: string[] = [];
                                    if (pendingLeagueInviteRegion) editions.push(regionLabel);
                                    if (pendingLeagueInviteUser) editions.push('Personal Edition');
                                    const editionText = editions.join(' and ');
                                    Alert.alert(
                                        'Invitation Pending',
                                        `You have a ${editionText} invitation waiting for you. Click the Leagues button on the home screen to join the league.`
                                    );
                                    return;
                                }
                                router.push('/league/join');
                            }}
                        >
                            <Users size={18} color="#475569" />
                            <Text style={{ color: '#475569', fontSize: 15, fontWeight: '600', fontFamily: 'Nunito_600SemiBold' }}>Join a league</Text>
                        </TouchableOpacity>
                    </StyledView>
                )}

                {/* Remove myself from all leagues toggle */}
                {!isLoading && leagues && leagues.length > 0 && (
                    <View style={{ marginTop: 28, paddingBottom: 20 }}>
                        <View style={{
                            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                            backgroundColor: surfaceColor, borderRadius: 12, borderWidth: 1,
                            borderColor, paddingHorizontal: 16, paddingVertical: 14,
                        }}>
                            <View style={{ flex: 1, paddingRight: 12 }}>
                                <Text style={{ fontSize: 15, fontWeight: '600', fontFamily: 'Nunito_600SemiBold', color: '#ef4444' }}>
                                    Remove myself from all leagues?
                                </Text>
                            </View>
                            <Switch
                                value={removeAllToggle}
                                onValueChange={handleToggleRemoveAll}
                                trackColor={{ false: '#cbd5e1', true: '#ef4444' }}
                                thumbColor="#ffffff"
                            />
                        </View>
                    </View>
                )}
            </StyledScrollView>
        </ThemedView>
    );
}
