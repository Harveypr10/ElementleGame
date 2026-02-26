import React, { useState, useEffect } from 'react';
import {
    View, Text, TouchableOpacity, ScrollView, TextInput,
    Platform, Dimensions, Linking, ActivityIndicator, Alert,
} from 'react-native';
import { styled } from 'nativewind';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    ChevronLeft, RefreshCw, Mail, MessageSquare,
    Bug, HelpCircle, Filter, ChevronDown,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';

import { useAdminCases, FeedbackStatus, FeedbackType, UserFeedback } from '../../../../hooks/useAdminCases';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledScrollView = styled(ScrollView);
const StyledTextInput = styled(TextInput);

// ─── Constants ───────────────────────────────────────────────
const STATUS_COLORS: Record<FeedbackStatus, string> = {
    new: '#3b82f6',
    investigating: '#f59e0b',
    resolved: '#22c55e',
    closed: '#6b7280',
};

const STATUS_LABELS: Record<FeedbackStatus, string> = {
    new: 'New',
    investigating: 'Investigating',
    resolved: 'Resolved',
    closed: 'Closed',
};

const TYPE_ICONS = {
    feedback: MessageSquare,
    bug: Bug,
    support: HelpCircle,
};

const TYPE_LABELS: Record<FeedbackType, string> = {
    feedback: 'Feedback',
    bug: 'Bug Report',
    support: 'Support',
};

const ALL_STATUSES: FeedbackStatus[] = ['new', 'investigating', 'resolved', 'closed'];

// ─── Helpers ─────────────────────────────────────────────────
function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return format(new Date(dateStr), 'dd MMM yyyy');
}

// ─── Main Component ──────────────────────────────────────────
export default function CasesScreen() {
    const router = useRouter();
    const {
        cases, loading, error, filters, setFilter,
        selectedCase, selectedCaseId, selectCase,
        selectedNotes, updateStatus, addNote, refetch,
    } = useAdminCases();

    const [noteText, setNoteText] = useState('');
    const [savingNote, setSavingNote] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);

    // Responsive: split pane on wide screens
    const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
    useEffect(() => {
        const sub = Dimensions.addEventListener('change', ({ window }) => setScreenWidth(window.width));
        return () => sub.remove();
    }, []);
    const isWide = screenWidth >= 768;

    const handleReply = (ticket: UserFeedback) => {
        if (!ticket.email) return;
        const subject = `Re: Elementle ${TYPE_LABELS[ticket.type]} #${ticket.id.slice(0, 8)}`;
        const body = `\n\n--- Original Message ---\n${ticket.message}\n\nSubmitted: ${format(new Date(ticket.created_at), 'dd MMM yyyy HH:mm')}\nDevice: ${ticket.device_os || 'Unknown'}\nApp Version: ${ticket.app_version || 'Unknown'}`;
        const mailto = `mailto:${ticket.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        Linking.openURL(mailto);
    };

    const handleSaveNote = async () => {
        if (!noteText.trim() || !selectedCaseId) return;
        setSavingNote(true);
        const success = await addNote(selectedCaseId, noteText);
        setSavingNote(false);
        if (success) setNoteText('');
        else Alert.alert('Error', 'Failed to save note.');
    };

    const handleStatusChange = async (caseId: string, newStatus: FeedbackStatus) => {
        setStatusDropdownOpen(false);
        await updateStatus(caseId, newStatus);
    };

    // ─── Case List Item ───────────────────────────────────────
    const renderCaseItem = (item: UserFeedback) => {
        const TypeIcon = TYPE_ICONS[item.type];
        const isSelected = item.id === selectedCaseId;

        return (
            <StyledTouchableOpacity
                key={item.id}
                onPress={() => selectCase(item.id)}
                className={`p-4 mb-2 rounded-xl border ${isSelected ? 'border-blue-400 bg-blue-50' : 'border-slate-100 bg-white'}`}
                style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.03,
                    shadowRadius: 2,
                }}
            >
                <StyledView className="flex-row items-center justify-between mb-2">
                    <StyledView className="flex-row items-center">
                        <StyledView
                            className="w-2.5 h-2.5 rounded-full mr-2"
                            style={{ backgroundColor: STATUS_COLORS[item.status] }}
                        />
                        <StyledText className="text-xs font-n-bold text-slate-400 uppercase">
                            #{item.id.slice(0, 8)}
                        </StyledText>
                    </StyledView>
                    <StyledView
                        className="px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: `${STATUS_COLORS[item.status]}18` }}
                    >
                        <StyledText
                            className="text-xs font-n-bold"
                            style={{ color: STATUS_COLORS[item.status] }}
                        >
                            {STATUS_LABELS[item.status]}
                        </StyledText>
                    </StyledView>
                </StyledView>

                <StyledView className="flex-row items-center mb-1.5">
                    <TypeIcon size={14} color="#64748b" />
                    <StyledText className="text-xs text-slate-500 ml-1.5 font-n-semibold">
                        {TYPE_LABELS[item.type]}
                    </StyledText>
                    {item.rating != null && (
                        <StyledText className="text-xs text-amber-500 ml-2">
                            {'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)}
                        </StyledText>
                    )}
                </StyledView>

                <StyledText
                    className="text-sm text-slate-800 font-n-regular"
                    numberOfLines={2}
                >
                    {item.message}
                </StyledText>

                <StyledView className="flex-row items-center mt-2">
                    <StyledText className="text-xs text-slate-400">
                        {item.device_os || 'Unknown'} · {timeAgo(item.created_at)}
                    </StyledText>
                    {item.email && (
                        <StyledText className="text-xs text-blue-400 ml-2" numberOfLines={1}>
                            {item.email}
                        </StyledText>
                    )}
                </StyledView>
            </StyledTouchableOpacity>
        );
    };

    // ─── Detail Panel ─────────────────────────────────────────
    const renderDetailPanel = () => {
        if (!selectedCase) {
            return (
                <StyledView className="flex-1 items-center justify-center p-8">
                    <MessageSquare size={48} color="#cbd5e1" />
                    <StyledText className="text-slate-400 font-n-semibold mt-4 text-center">
                        Select a case to view details
                    </StyledText>
                </StyledView>
            );
        }

        const TypeIcon = TYPE_ICONS[selectedCase.type];

        return (
            <StyledScrollView className="flex-1 p-4">
                {/* Header */}
                <StyledView className="flex-row items-center justify-between mb-4">
                    <StyledText className="text-lg font-n-bold text-slate-900">
                        #{selectedCase.id.slice(0, 8)}
                    </StyledText>
                    {!isWide && (
                        <StyledTouchableOpacity onPress={() => selectCase(null)}>
                            <StyledText className="text-blue-500 font-n-semibold text-sm">← Back</StyledText>
                        </StyledTouchableOpacity>
                    )}
                </StyledView>

                {/* Status Dropdown */}
                <StyledView className="mb-4">
                    <StyledText className="text-xs font-n-bold text-slate-400 uppercase mb-2">Status</StyledText>
                    <StyledTouchableOpacity
                        onPress={() => setStatusDropdownOpen(!statusDropdownOpen)}
                        className="flex-row items-center justify-between bg-white border border-slate-200 rounded-xl px-4 py-3"
                    >
                        <StyledView className="flex-row items-center">
                            <StyledView
                                className="w-3 h-3 rounded-full mr-2.5"
                                style={{ backgroundColor: STATUS_COLORS[selectedCase.status] }}
                            />
                            <StyledText className="text-sm font-n-semibold text-slate-800">
                                {STATUS_LABELS[selectedCase.status]}
                            </StyledText>
                        </StyledView>
                        <ChevronDown size={16} color="#94a3b8" />
                    </StyledTouchableOpacity>

                    {statusDropdownOpen && (
                        <StyledView className="mt-1 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-lg">
                            {ALL_STATUSES.map(s => (
                                <StyledTouchableOpacity
                                    key={s}
                                    onPress={() => handleStatusChange(selectedCase.id, s)}
                                    className={`flex-row items-center px-4 py-3 ${s === selectedCase.status ? 'bg-slate-50' : ''}`}
                                >
                                    <StyledView
                                        className="w-3 h-3 rounded-full mr-2.5"
                                        style={{ backgroundColor: STATUS_COLORS[s] }}
                                    />
                                    <StyledText className="text-sm font-n-regular text-slate-700">
                                        {STATUS_LABELS[s]}
                                    </StyledText>
                                </StyledTouchableOpacity>
                            ))}
                        </StyledView>
                    )}
                </StyledView>

                {/* Metadata */}
                <StyledView className="bg-slate-50 rounded-xl p-4 mb-4">
                    <MetaRow label="Type" value={TYPE_LABELS[selectedCase.type]} icon={<TypeIcon size={14} color="#64748b" />} />
                    <MetaRow label="From" value={selectedCase.email || 'No email provided'} />
                    <MetaRow label="Device" value={selectedCase.device_os || 'Unknown'} />
                    <MetaRow label="Version" value={selectedCase.app_version || 'Unknown'} />
                    <MetaRow label="Submitted" value={format(new Date(selectedCase.created_at), 'dd MMM yyyy HH:mm')} />
                    {selectedCase.rating != null && (
                        <MetaRow label="Rating" value={`${'★'.repeat(selectedCase.rating)}${'☆'.repeat(5 - selectedCase.rating)}`} />
                    )}
                </StyledView>

                {/* Message */}
                <StyledView className="mb-4">
                    <StyledText className="text-xs font-n-bold text-slate-400 uppercase mb-2">Message</StyledText>
                    <StyledView className="bg-white border border-slate-200 rounded-xl p-4">
                        <StyledText className="text-sm text-slate-800 font-n-regular leading-5">
                            {selectedCase.message}
                        </StyledText>
                    </StyledView>
                </StyledView>

                {/* Reply Button */}
                {selectedCase.email && (
                    <StyledTouchableOpacity
                        onPress={() => handleReply(selectedCase)}
                        className="flex-row items-center justify-center bg-blue-500 rounded-xl py-3 mb-4"
                    >
                        <Mail size={16} color="#fff" />
                        <StyledText className="text-white font-n-bold text-sm ml-2">
                            Reply via Email
                        </StyledText>
                    </StyledTouchableOpacity>
                )}

                {/* Admin Notes */}
                <StyledView className="mb-8">
                    <StyledText className="text-xs font-n-bold text-slate-400 uppercase mb-2">
                        Admin Notes ({selectedNotes.length})
                    </StyledText>

                    {selectedNotes.map(note => (
                        <StyledView key={note.id} className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-2">
                            <StyledText className="text-sm text-slate-700 font-n-regular">{note.note}</StyledText>
                            <StyledText className="text-xs text-slate-400 mt-1">
                                {format(new Date(note.created_at), 'dd MMM yyyy HH:mm')}
                            </StyledText>
                        </StyledView>
                    ))}

                    <StyledTextInput
                        className="bg-white border border-slate-200 rounded-xl px-4 py-3 min-h-[80px] text-sm text-slate-800 font-n-regular mt-2"
                        placeholder="Add an internal note..."
                        placeholderTextColor="#94a3b8"
                        value={noteText}
                        onChangeText={setNoteText}
                        multiline
                        textAlignVertical="top"
                    />
                    <StyledTouchableOpacity
                        onPress={handleSaveNote}
                        disabled={savingNote || !noteText.trim()}
                        className={`mt-2 bg-slate-800 rounded-xl py-2.5 items-center ${(!noteText.trim() || savingNote) ? 'opacity-50' : ''}`}
                    >
                        <StyledText className="text-white font-n-bold text-sm">
                            {savingNote ? 'Saving...' : 'Save Note'}
                        </StyledText>
                    </StyledTouchableOpacity>
                </StyledView>
            </StyledScrollView>
        );
    };

    // ─── Filter Bar ────────────────────────────────────────────
    const renderFilterBar = () => (
        <StyledView className="px-4 py-3 bg-white border-b border-slate-100">
            <StyledView className="flex-row items-center justify-between">
                <StyledTouchableOpacity
                    onPress={() => setShowFilters(!showFilters)}
                    className="flex-row items-center"
                >
                    <Filter size={16} color="#64748b" />
                    <StyledText className="text-sm font-n-semibold text-slate-600 ml-1.5">Filters</StyledText>
                </StyledTouchableOpacity>

                <StyledTouchableOpacity onPress={refetch} className="flex-row items-center">
                    <RefreshCw size={14} color="#64748b" />
                    <StyledText className="text-xs text-slate-500 ml-1">Refresh</StyledText>
                </StyledTouchableOpacity>
            </StyledView>

            {showFilters && (
                <StyledView className="flex-row flex-wrap mt-3 gap-2">
                    {/* Status Filter */}
                    <FilterChip
                        label="All"
                        active={filters.status === 'all'}
                        onPress={() => setFilter('status', 'all')}
                    />
                    {ALL_STATUSES.map(s => (
                        <FilterChip
                            key={s}
                            label={STATUS_LABELS[s]}
                            active={filters.status === s}
                            color={STATUS_COLORS[s]}
                            onPress={() => setFilter('status', s)}
                        />
                    ))}

                    <StyledView className="w-full h-px bg-slate-100 my-1" />

                    {/* Type Filter */}
                    <FilterChip
                        label="All Types"
                        active={filters.type === 'all'}
                        onPress={() => setFilter('type', 'all')}
                    />
                    {(['feedback', 'bug', 'support'] as FeedbackType[]).map(t => (
                        <FilterChip
                            key={t}
                            label={TYPE_LABELS[t]}
                            active={filters.type === t}
                            onPress={() => setFilter('type', t)}
                        />
                    ))}
                </StyledView>
            )}
        </StyledView>
    );

    // ─── Main Render ──────────────────────────────────────────
    return (
        <StyledView className="flex-1 bg-slate-50">
            <SafeAreaView edges={['top']} className="bg-white">
                <StyledView className="flex-row items-center justify-between px-4 py-3 border-b border-slate-200">
                    <StyledTouchableOpacity
                        onPress={() => router.back()}
                        className="w-10 h-10 items-center justify-center -ml-2"
                    >
                        <ChevronLeft size={28} color="#1e293b" />
                    </StyledTouchableOpacity>
                    <StyledText className="text-xl font-n-bold text-slate-900">
                        Cases
                    </StyledText>
                    <StyledView className="w-10 items-end">
                        <StyledView className="bg-blue-500 rounded-full px-2 py-0.5">
                            <StyledText className="text-white text-xs font-n-bold">
                                {cases.length}
                            </StyledText>
                        </StyledView>
                    </StyledView>
                </StyledView>
            </SafeAreaView>

            {renderFilterBar()}

            {loading ? (
                <StyledView className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color="#3b82f6" />
                </StyledView>
            ) : error ? (
                <StyledView className="flex-1 items-center justify-center p-8">
                    <StyledText className="text-red-500 font-n-semibold text-center">{error}</StyledText>
                    <StyledTouchableOpacity onPress={refetch} className="mt-4 bg-slate-800 rounded-xl px-6 py-2.5">
                        <StyledText className="text-white font-n-bold text-sm">Retry</StyledText>
                    </StyledTouchableOpacity>
                </StyledView>
            ) : isWide ? (
                /* ─── Wide / Split-pane layout ───────────────── */
                <StyledView className="flex-1 flex-row">
                    {/* Case List */}
                    <StyledScrollView className="p-4" style={{ width: '40%', maxWidth: 400 }}>
                        {cases.length === 0 ? (
                            <StyledView className="items-center justify-center py-12">
                                <StyledText className="text-slate-400 font-n-semibold">No cases found</StyledText>
                            </StyledView>
                        ) : (
                            cases.map(renderCaseItem)
                        )}
                    </StyledScrollView>

                    {/* Divider */}
                    <StyledView className="w-px bg-slate-200" />

                    {/* Detail Panel */}
                    <StyledView style={{ flex: 1 }}>
                        {renderDetailPanel()}
                    </StyledView>
                </StyledView>
            ) : selectedCase ? (
                /* ─── Mobile: Detail View ────────────────────── */
                renderDetailPanel()
            ) : (
                /* ─── Mobile: List View ──────────────────────── */
                <StyledScrollView className="flex-1 p-4">
                    {cases.length === 0 ? (
                        <StyledView className="items-center justify-center py-12">
                            <StyledText className="text-slate-400 font-n-semibold">No cases found</StyledText>
                        </StyledView>
                    ) : (
                        cases.map(renderCaseItem)
                    )}
                </StyledScrollView>
            )}
        </StyledView>
    );
}

// ─── Reusable Components ──────────────────────────────────────

function MetaRow({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
    return (
        <StyledView className="flex-row items-center justify-between py-1.5">
            <StyledText className="text-xs text-slate-500 font-n-semibold">{label}</StyledText>
            <StyledView className="flex-row items-center">
                {icon && <StyledView className="mr-1.5">{icon}</StyledView>}
                <StyledText className="text-xs text-slate-700 font-n-regular">{value}</StyledText>
            </StyledView>
        </StyledView>
    );
}

function FilterChip({ label, active, color, onPress }: {
    label: string;
    active: boolean;
    color?: string;
    onPress: () => void;
}) {
    return (
        <StyledTouchableOpacity
            onPress={onPress}
            className={`px-3 py-1.5 rounded-full border ${active ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-white'}`}
        >
            <StyledView className="flex-row items-center">
                {color && (
                    <StyledView
                        className="w-2 h-2 rounded-full mr-1.5"
                        style={{ backgroundColor: color }}
                    />
                )}
                <StyledText
                    className={`text-xs font-n-semibold ${active ? 'text-blue-600' : 'text-slate-600'}`}
                >
                    {label}
                </StyledText>
            </StyledView>
        </StyledTouchableOpacity>
    );
}
