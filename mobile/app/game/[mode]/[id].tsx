
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Calendar, HelpCircle } from 'lucide-react-native';
import { ActiveGame } from '../../../components/game/ActiveGame';
import { useAuth } from '../../../lib/auth';
import { useOptions } from '../../../lib/options';
import { supabase } from '../../../lib/supabase';
import { format } from 'date-fns';
import { ThemedView } from '../../../components/ThemedView';
import { ThemedText } from '../../../components/ThemedText';
import { useThemeColor } from '../../../hooks/useThemeColor';

export default function GameScreen() {
    const backgroundColor = useThemeColor({}, 'background');
    const iconColor = useThemeColor({}, 'icon');
    const surfaceColor = useThemeColor({}, 'surface');
    const textColor = useThemeColor({}, 'text');

    const { mode, id } = useLocalSearchParams();
    const router = useRouter();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [puzzle, setPuzzle] = useState<any>(null);
    const [debugInfo, setDebugInfo] = useState<string>("");

    const isRegion = mode === 'REGION';
    const modeStr = isRegion ? 'REGION' : 'USER';
    const puzzleIdParam = id as string;

    // Use a ref to prevent double-firing useEffect
    const hasFetched = useRef(false);

    useEffect(() => {
        if (!hasFetched.current) {
            hasFetched.current = true;
            fetchPuzzle();
        }
    }, [mode, id, user?.id]);

    const fetchPuzzle = async () => {
        try {
            setLoading(true);
            setDebugInfo("");

            const now = new Date();
            const today = now.toISOString().split('T')[0];

            console.log(`[GameScreen] Loading Puzzle. Mode: ${modeStr}, Param: ${puzzleIdParam}, Today: ${today}`);

            let allocationData: any = null;
            let masterData: any = null;

            if (isRegion) {
                // REGION MODE QUERY
                let regionQuery = supabase.from('questions_allocated_region').select('*, categories(id, name)');

                if (puzzleIdParam === 'today') {
                    regionQuery = regionQuery.eq('region', 'UK').eq('puzzle_date', today);
                } else if (/^\d{4}-\d{2}-\d{2}$/.test(puzzleIdParam)) {
                    // It's a specific date string, query by date not ID
                    regionQuery = regionQuery.eq('region', 'UK').eq('puzzle_date', puzzleIdParam);
                } else {
                    regionQuery = regionQuery.eq('id', puzzleIdParam).eq('region', 'UK');
                }

                const { data: allocRes, error: allocError } = await regionQuery.maybeSingle();

                console.log('[GameScreen] Region allocation data:', allocRes);

                if (allocError) {
                    console.error('[GameScreen] Region Allocation Error:', allocError);
                    setDebugInfo(`Allocation Error: ${allocError.message}`);
                    setPuzzle(null);
                    setLoading(false);
                    return;
                }

                if (!allocRes) {
                    console.warn(`[GameScreen] No Region allocation found for ${puzzleIdParam}`);

                    if (puzzleIdParam === 'today') {
                        const { data: recent } = await supabase
                            .from('questions_allocated_region')
                            .select('puzzle_date')
                            .eq('region', 'UK')
                            .order('puzzle_date', { ascending: false })
                            .limit(3);
                        setDebugInfo(`No puzzle for ${today}. Recent dates in DB: ${recent?.map(r => r.puzzle_date).join(', ') || 'None'}`);
                    }

                    setPuzzle(null);
                    setLoading(false);
                    return;
                }

                allocationData = allocRes;

                if (allocRes.question_id) {
                    const { data: master, error: masterError } = await supabase
                        .from('questions_master_region')
                        .select('*')
                        .eq('id', allocRes.question_id)
                        .maybeSingle();
                    masterData = master;
                }

            } else {
                // USER MODE QUERY
                if (!user?.id) {
                    console.warn('[GameScreen] User Mode requires authenticated user.');
                    setPuzzle(null);
                    setLoading(false);
                    return;
                }

                let query = supabase.from('questions_allocated_user').select('*, categories(id, name)');

                if (puzzleIdParam === 'next') {
                    query = query.eq('user_id', user.id).eq('puzzle_date', today);
                } else {
                    query = query.eq('id', puzzleIdParam).eq('user_id', user.id);
                }

                const { data: allocRes, error: allocError } = await query.maybeSingle();

                console.log('[GameScreen] User allocation data:', allocRes);

                if (allocError) {
                    console.error('[GameScreen] User Allocation Error:', allocError);
                    setDebugInfo(`Allocation Error: ${allocError.message}`);
                    setPuzzle(null);
                    setLoading(false);
                    return;
                }

                if (!allocRes) {
                    console.warn(`[GameScreen] No User allocation found for ${puzzleIdParam}`);

                    if (puzzleIdParam === 'next') {
                        const { data: recent } = await supabase
                            .from('questions_allocated_user')
                            .select('puzzle_date')
                            .eq('user_id', user.id)
                            .order('puzzle_date', { ascending: false })
                            .limit(3);
                        setDebugInfo(`No user puzzle for ${today}. Recent dates in DB: ${recent?.map(r => r.puzzle_date).join(', ') || 'None'}`);
                    }

                    setPuzzle(null);
                    setLoading(false);
                    return;
                }

                allocationData = allocRes;

                if (allocRes.question_id) {
                    const { data: master, error: masterError } = await supabase
                        .from('questions_master_user')
                        .select('*, populated_places!populated_place_id(name1)')
                        .eq('id', allocRes.question_id)
                        .maybeSingle();
                    masterData = master;
                }
            }

            if (allocationData) {
                const finalPuzzle = {
                    id: allocationData.id,
                    title: masterData?.event_title || masterData?.title || `Puzzle #${allocationData.id}`,
                    date: allocationData.puzzle_date,
                    solutionDate: masterData?.answer_date_canonical || masterData?.answer_date || allocationData.puzzle_date,
                    difficulty: masterData?.difficulty || 1,
                    masterId: allocationData.question_id,
                    category: allocationData?.categories?.name || "History",
                    categoryNumber: allocationData?.categories?.id,
                    location: allocationData?.categories?.id === 999 && masterData?.populated_places?.name1
                        ? masterData.populated_places.name1
                        : "",
                    eventDescription: masterData?.event_description || masterData?.description || ""
                };

                setPuzzle(finalPuzzle);
            }

        } catch (e) {
            console.error('[GameScreen] Critical Error:', e);
            Alert.alert("Error", "Unexpected crash loading puzzle.");
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView className="flex-1 bg-white dark:bg-slate-900 justify-center items-center">
                <ActivityIndicator size="large" color="#3b82f6" />
                <Text className="text-slate-900 dark:text-white mt-4 font-body">Loading Puzzle...</Text>
            </SafeAreaView>
        );
    }

    if (!puzzle) {
        return (
            <SafeAreaView className="flex-1 bg-white dark:bg-slate-900 justify-center items-center px-6">
                <Text className="text-slate-900 dark:text-white text-xl font-display mb-2 text-center">No Puzzle Found</Text>
                <Text className="text-slate-500 dark:text-slate-400 text-center mb-6">
                    {debugInfo || `We couldn't find a puzzle for ${modeStr} mode on this date.`}
                </Text>

                <TouchableOpacity
                    className="bg-blue-600 px-6 py-3 rounded-xl flex-row items-center mb-4"
                    onPress={() => router.replace('/archive')}
                >
                    <Calendar className="text-white mr-2" size={20} />
                    <Text className="text-white font-bold text-lg">Pick Another Date</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    className="bg-slate-700 px-6 py-3 rounded-xl flex-row items-center"
                    onPress={() => router.back()}
                >
                    <ChevronLeft className="text-white mr-2" size={20} />
                    <Text className="text-white font-bold text-lg">Go Back</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    return (
        <ThemedView className="flex-1">
            <SafeAreaView edges={['top']} className="z-10" style={{ backgroundColor: surfaceColor }}>
                <View className="relative items-center pb-2 z-50" style={{ backgroundColor: surfaceColor }}>

                    {/* Left: Back Arrow */}
                    <View className="absolute left-4 top-2">
                        <TouchableOpacity
                            onPress={() => router.back()}
                            className="items-center justify-center bg-transparent"
                        >
                            <ChevronLeft size={28} color={iconColor} />
                        </TouchableOpacity>
                    </View>

                    {/* Center: Title */}
                    <ThemedText size="4xl" className="font-n-bold mb-2 pt-2 font-heading tracking-tight text-center">
                        Elementle
                    </ThemedText>

                    {/* Right: Help */}
                    <View className="absolute right-4 top-2">
                        <TouchableOpacity
                            onPress={() => Alert.alert("How to Play", "Guess the date of the historic event!\n\n• Green = Correct\n• Yellow = Close (within 10 years/days)\n• Arrows indicate if you need to go Higher or Lower.")}
                            className="items-center justify-center bg-transparent"
                        >
                            <HelpCircle size={28} color={iconColor} />
                        </TouchableOpacity>
                    </View>
                </View>
            </SafeAreaView>

            {/* Active Game Component (Handles Engine & UI) */}
            <View className="flex-1">
                <ActiveGame
                    puzzle={puzzle}
                    gameMode={modeStr}
                    backgroundColor={backgroundColor}
                />
            </View>
        </ThemedView>
    );
}
