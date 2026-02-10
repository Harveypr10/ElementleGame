import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Animated,
    Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { ThemedText } from '../../components/ThemedText';

interface TextBlock {
    id: string;
    text: string;
    top: number; // percent
    left: number; // percent
    opacity: Animated.Value;
    spawnTime: number;
}

type RegenerationType = 'first_login' | 'postcode_change' | 'category_change';

export default function GeneratingQuestionsScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const isPreview = params.preview === 'true';
    const { user, markFirstLoginCompleted } = useAuth();

    // TODO: Get these from params or context
    const userId = user?.id || params.userId as string || 'temp-user';
    const region = params.region as string || 'United Kingdom';
    const postcode = params.postcode as string || '';
    const regenerationType = (params.regenerationType as RegenerationType) || 'first_login';

    const [textBlocks, setTextBlocks] = useState<TextBlock[]>([]);
    const containerRef = useRef<View>(null);
    const sequenceStartedRef = useRef(false);
    const mountedRef = useRef(true);

    // Animation constants
    const SCREEN_DURATION = 10000; // 10 seconds
    const TEXT_LIFETIME = 2500; // 2.5 seconds
    const FADE_DURATION = 1200; // 1.2 seconds
    const INTERVAL_MS = 1000; // Spawn every 1 second
    const MAX_CELLS = 6; // 2x3 grid
    const INITIAL_TITLES = 4; // Reserved titles

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        if (sequenceStartedRef.current) {
            console.log('[GeneratingQuestions] Sequence already started');
            return;
        }
        sequenceStartedRef.current = true;

        runSequence();

        return () => {
            mountedRef.current = false;
        };
    }, []);

    const runSequence = async () => {
        const spawnTimeouts: NodeJS.Timeout[] = [];
        let spawnInterval: NodeJS.Timeout | null = null;
        let animInterval: NodeJS.Timeout | null = null;
        let finishTimeout: NodeJS.Timeout | null = null;

        // Queue and selection helpers
        const streamQueue: string[] = [];
        let initialConsumed = 0;
        const occupiedCells = new Set<number>();
        const lastPicks: number[] = [];
        const rowBlockCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0 };

        const rowOf = (i: number) => Math.floor(i / 2);

        // Start animation loop
        console.log('[GeneratingQuestions] Starting animation loop');
        animInterval = setInterval(() => {
            if (!mountedRef.current) return;

            setTextBlocks((prev) =>
                prev
                    .map((block) => {
                        const elapsed = Date.now() - block.spawnTime;
                        if (elapsed < 0) return block;

                        let newOpacity = 0;
                        if (elapsed < FADE_DURATION) {
                            newOpacity = elapsed / FADE_DURATION;
                        } else if (elapsed < TEXT_LIFETIME - FADE_DURATION) {
                            newOpacity = 1;
                        } else if (elapsed < TEXT_LIFETIME) {
                            const out = (elapsed - (TEXT_LIFETIME - FADE_DURATION)) / FADE_DURATION;
                            newOpacity = 1 - out;
                        } else {
                            return null;
                        }

                        block.opacity.setValue(newOpacity);
                        return block;
                    })
                    .filter((b): b is TextBlock => b !== null)
            );
        }, 100);

        try {
            // Step 1: Fetch event titles
            console.log('[GeneratingQuestions] Fetching event titles');
            let eventTitles: string[] = [];

            try {
                // Mock data for now
                const mockTitles = [
                    'The Battle of Hastings',
                    'The Great Fire of London',
                    'The Signing of Magna Carta',
                    'The Norman Conquest',
                    'The English Civil War',
                    'The Dissolution of the Monasteries',
                    'The Spanish Armada',
                    'The Gunpowder Plot',
                    'The Wars of the Roses',
                    'The Black Death',
                    'The Industrial Revolution',
                    'The Reform Act',
                    'The Chartist Movement',
                    'The Corn Laws Repealed',
                    'The Great Exhibition',
                    'The Crimean War',
                    'The Indian Mutiny',
                    'The Boer War',
                    'The Suffragette Movement',
                    'The Easter Rising',
                    'The General Strike',
                    'The Abdication Crisis',
                    'The Blitz',
                    'D-Day Landings',
                    'VE Day',
                    'The Festival of Britain',
                    'The Coronation of Elizabeth II',
                    'The Suez Crisis',
                    'The Moon Landing',
                    'The Falklands War',
                ];

                // Shuffle and dedupe
                const shuffled = mockTitles.sort(() => Math.random() - 0.5);
                eventTitles = shuffled.slice(0, 30).map(title => title + '...');
                console.log('[GeneratingQuestions] Fetched titles:', eventTitles.length);
            } catch (err) {
                console.error('[GeneratingQuestions] Error fetching titles:', err);
            }

            // Initialize queue
            streamQueue.push(...eventTitles);

            // Helper functions
            const decrementRowBlocks = () => {
                for (const r of [0, 1, 2]) {
                    if (rowBlockCounts[r] > 0) rowBlockCounts[r] = Math.max(0, rowBlockCounts[r] - 1);
                }
            };

            const pickNextCell = (): number | null => {
                decrementRowBlocks();
                const all = Array.from({ length: MAX_CELLS }, (_, i) => i);

                let candidates = all.filter(
                    (i) => !occupiedCells.has(i) && !lastPicks.includes(i) && rowBlockCounts[rowOf(i)] === 0
                );
                if (candidates.length === 0) {
                    candidates = all.filter((i) => !occupiedCells.has(i) && rowBlockCounts[rowOf(i)] === 0);
                }
                if (candidates.length === 0) {
                    candidates = all.filter((i) => !occupiedCells.has(i) && !lastPicks.includes(i));
                }
                if (candidates.length === 0) {
                    candidates = all.filter((i) => !occupiedCells.has(i));
                }
                if (candidates.length === 0) return null;

                const choice = candidates[Math.floor(Math.random() * candidates.length)];
                lastPicks.push(choice);
                if (lastPicks.length > 3) lastPicks.shift();
                rowBlockCounts[rowOf(choice)] = 3;
                return choice;
            };

            const computePositionInCell = (cellIndex: number) => {
                const cols = 2;
                const rows = 3;
                const col = cellIndex % cols;
                const row = Math.floor(cellIndex / cols);

                // Rough estimates for container (will be dynamic in real app)
                const width = 400;
                const height = 600;
                const cellWidth = width / cols;
                const cellHeight = height / rows;

                const EST_BLOCK_W = 160;
                const EST_BLOCK_H = 48;
                const padX = Math.min(24, cellWidth * 0.12);
                const padY = Math.min(20, cellHeight * 0.12);

                const leftPxMin = col * cellWidth + padX + EST_BLOCK_W / 2;
                const leftPxMax = (col + 1) * cellWidth - padX - EST_BLOCK_W / 2;
                const topPxMin = row * cellHeight + padY + EST_BLOCK_H / 2;
                const topPxMax = (row + 1) * cellHeight - padY - EST_BLOCK_H / 2;

                const safeLeftPx =
                    leftPxMax > leftPxMin
                        ? leftPxMin + Math.random() * (leftPxMax - leftPxMin)
                        : col * cellWidth + cellWidth / 2;
                const safeTopPx =
                    topPxMax > topPxMin
                        ? topPxMin + Math.random() * (topPxMax - topPxMin)
                        : row * cellHeight + cellHeight / 2;

                const leftPct = (safeLeftPx / width) * 100;
                const topPct = (safeTopPx / height) * 100;

                return { topPct, leftPct };
            };

            const popNextText = () => {
                if (streamQueue.length === 0) return undefined;

                if (initialConsumed < INITIAL_TITLES && streamQueue.length > 0) {
                    const val = streamQueue.shift();
                    if (val) initialConsumed++;
                    return val;
                }

                // Random from rest
                const idx = Math.floor(Math.random() * streamQueue.length);
                const [item] = streamQueue.splice(idx, 1);
                return item;
            };

            const spawnIntoCell = (cellIndex: number, text: string) => {
                const pos = computePositionInCell(cellIndex);
                if (!pos) return false;

                const id = `${Date.now()}-${cellIndex}`;
                occupiedCells.add(cellIndex);
                const spawnTime = Date.now();
                const opacity = new Animated.Value(0);

                console.log('[GeneratingQuestions] Spawning:', text.substring(0, 30));

                setTextBlocks((prev) => [
                    ...prev,
                    { id, text, top: pos.topPct, left: pos.leftPct, opacity, spawnTime },
                ]);

                const removeId = setTimeout(() => {
                    if (!mountedRef.current) return;
                    setTextBlocks((prev) => prev.filter((b) => b.id !== id));
                    occupiedCells.delete(cellIndex);
                }, TEXT_LIFETIME);

                spawnTimeouts.push(removeId);
                return true;
            };

            // Immediate first spawn
            const first = pickNextCell();
            if (first !== null && streamQueue.length > 0) {
                const text = popNextText();
                if (text) spawnIntoCell(first, text);
            }

            // Start spawn interval after 1s
            const startSpawnInterval = () => {
                spawnInterval = setInterval(() => {
                    if (!mountedRef.current) return;

                    const next = pickNextCell();
                    if (next === null) return;

                    const text = popNextText() || 'Event...';
                    if (text) spawnIntoCell(next, text);
                }, INTERVAL_MS);
            };

            const intervalTimeout = setTimeout(() => {
                if (mountedRef.current) startSpawnInterval();
            }, INTERVAL_MS);
            spawnTimeouts.push(intervalTimeout);

            // Step 2 & 3: Fetch locations (in parallel)
            if (userId) { // Postcode might not be available, but userId is
                try {
                    console.log('[GeneratingQuestions] Fetching locations for user:', userId);

                    // Query location_allocation for this user
                    // Expecting populated_places relation
                    const { data: allocationData, error: allocError } = await supabase
                        .from('location_allocation')
                        .select('populated_places(name1)')
                        .eq('user_id', userId)
                        .limit(20);

                    let locationNames: string[] = [];

                    if (allocError) {
                        console.error('[GeneratingQuestions] Error fetching locations:', allocError);
                        // Fallback to generic UK cities if specific query fails (e.g. table issue)
                        locationNames = ['London', 'Manchester', 'Birmingham', 'Glasgow', 'Liverpool', 'Bristol', 'Edinburgh', 'Leeds'].map(n => n + '...');
                    } else if (allocationData && allocationData.length > 0) {
                        // Extract names
                        locationNames = allocationData
                            .map((item: any) => item.populated_places?.name1)
                            .filter((n: any) => n)
                            .map((n: string) => n + '...');

                        console.log('[GeneratingQuestions] Fetched real locations:', locationNames.length);
                    } else {
                        console.log('[GeneratingQuestions] No locations found for user, using generic');
                        locationNames = ['London', 'Manchester', 'Birmingham', 'Liverpool'].map(n => n + '...');
                    }

                    if (locationNames.length > 0) {
                        const shuffled = locationNames.sort(() => Math.random() - 0.5);

                        // Interleave locations into queue
                        const insertIndex = Math.min(
                            Math.max(0, INITIAL_TITLES - initialConsumed),
                            streamQueue.length
                        );
                        const front = streamQueue.slice(0, insertIndex);
                        const tail = streamQueue.slice(insertIndex);

                        const interleaved: string[] = [];
                        const maxTakeFromTail = Math.max(0, Math.min(tail.length, Math.floor((shuffled.length + tail.length) / 2)));
                        let iPlace = 0;
                        let iTail = 0;

                        while (iPlace < shuffled.length || iTail < maxTakeFromTail) {
                            if (iPlace < shuffled.length) {
                                interleaved.push(shuffled[iPlace++]);
                            }
                            if (iTail < maxTakeFromTail) {
                                interleaved.push(tail[iTail++]);
                            }
                        }

                        const remainingTail = tail.slice(iTail);
                        const newQueue = front.concat(interleaved, remainingTail);

                        streamQueue.length = 0;
                        streamQueue.push(...newQueue);

                        console.log('[GeneratingQuestions] Interleaved locations, queue length:', streamQueue.length);
                    }

                } catch (err) {
                    console.error('[GeneratingQuestions] Error fetching locations:', err);
                }
            }


            // Step 4: Call calculate-demand Edge Function and poll for completion
            console.log('[GeneratingQuestions] Calling calculate-demand Edge Function');
            try {
                // Use static import
                const { data: { session } } = await supabase.auth.getSession();

                if (!session?.user?.id) {
                    throw new Error('No authenticated user');
                }

                // Invoke the Edge Function
                if (isPreview) {
                    console.log('[GeneratingQuestions] Preview mode - skipping API call');
                    // Mock delay for preview
                    await new Promise(resolve => setTimeout(resolve, 2000));
                } else {
                    const { data: funcData, error: funcError } = await supabase.functions.invoke('calculate-demand', {
                        body: { user_id: session.user.id }
                    });

                    if (funcError) {
                        console.error('[GeneratingQuestions] Edge Function error:', funcError);
                        throw funcError;
                    }
                    console.log('[GeneratingQuestions] Edge Function response:', funcData);
                }


                // Poll questions_allocated_user until questions exist
                const pollForQuestions = async (): Promise<boolean> => {
                    const maxAttempts = 10; // 10 seconds max
                    const pollInterval = 1000; // 1 second

                    for (let attempt = 0; attempt < maxAttempts; attempt++) {
                        if (!mountedRef.current) return false;

                        const { data: questions, error: pollError } = await supabase
                            .from('questions_allocated_user')
                            .select('id')
                            .eq('user_id', session.user.id)
                            .limit(1);

                        if (pollError) {
                            console.error('[GeneratingQuestions] Polling error:', pollError);
                            await new Promise(resolve => setTimeout(resolve, pollInterval));
                            continue;
                        }

                        if (questions && questions.length > 0) {
                            console.log('[GeneratingQuestions] Questions generated successfully!');
                            return true;
                        }

                        console.log(`[GeneratingQuestions] Polling attempt ${attempt + 1}/${maxAttempts}`);
                        await new Promise(resolve => setTimeout(resolve, pollInterval));
                    }

                    console.warn('[GeneratingQuestions] Polling timed out after 10 seconds');
                    return false;
                };

                // Start polling in background
                pollForQuestions().then(async (success) => {
                    if (success) {
                        console.log('[GeneratingQuestions] Questions ready, warming readiness cache');
                        // Warm the puzzle readiness cache so Home screen Play button is immediately enabled
                        try {
                            const today = new Date().toISOString().split('T')[0];
                            await AsyncStorage.setItem('puzzle_readiness_cache', JSON.stringify({ date: today, userReady: true }));
                        } catch (e) {
                            console.warn('[GeneratingQuestions] Failed to warm readiness cache:', e);
                        }
                    } else {
                        console.warn('[GeneratingQuestions] Questions not ready, but will redirect anyway');
                    }
                });

            } catch (err) {
                console.error('[GeneratingQuestions] Error calling calculate-demand:', err);
                // Don't block the animation, let it complete normally
            }

            finishTimeout = setTimeout(() => {
                if (!mountedRef.current) return;

                console.log('[GeneratingQuestions] Finishing sequence');

                if (spawnInterval) clearInterval(spawnInterval);
                if (animInterval) clearInterval(animInterval);
                spawnTimeouts.forEach(clearTimeout);

                setTimeout(async () => {
                    if (!mountedRef.current) return;

                    if (isPreview) {
                        console.log('[GeneratingQuestions] Preview mode - skipping redirect');
                    } else {
                        // Mark first login as completed
                        await markFirstLoginCompleted();
                        router.replace('/');
                    }
                }, 100);
            }, SCREEN_DURATION);

        } catch (error) {
            console.error('[GeneratingQuestions] Error:', error);
            Alert.alert('Error', 'Failed to generate questions. Redirecting...');
            setTimeout(() => {
                if (mountedRef.current) router.replace('/');
            }, 3000);
        }
    };

    return (
        <View style={styles.container}>
            {/* Hamster Image */}
            <View style={styles.hamsterContainer}>
                <Image
                    source={require('../../assets/ui/webp_assets/Question-Hamster-v2.webp')}
                    style={styles.hamsterImage}
                    contentFit="contain"
                    cachePolicy="disk"
                />
            </View>

            {/* Animated Text Container */}
            <View ref={containerRef} style={styles.textContainer}>
                {textBlocks.map((block) => (
                    <Animated.View
                        key={block.id}
                        style={[
                            styles.textBlock,
                            {
                                top: `${block.top}%`,
                                left: `${block.left}%`,
                                opacity: block.opacity,
                            },
                        ]}
                    >
                        <ThemedText style={styles.textBlockText} numberOfLines={2} size="sm">
                            {block.text}
                        </ThemedText>
                    </Animated.View>
                ))}
            </View>

            {/* Preview Close Button */}
            {isPreview && (
                <View style={{ position: 'absolute', top: 50, right: 20, zIndex: 999 }}>
                    <ThemedText
                        onPress={() => router.back()}
                        style={{ color: 'white', fontWeight: 'bold', fontSize: 18, backgroundColor: 'rgba(0,0,0,0.3)', padding: 10, borderRadius: 8 }}
                    >
                        Close Preview
                    </ThemedText>
                </View>
            )}

            {/* Footer Text */}
            <View style={styles.footer}>
                <ThemedText style={styles.footerText} size="base">
                    Hold tight, Hammie is cooking up your personalised questions...
                </ThemedText>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#7DAAE8',
        padding: 16,
    },
    hamsterContainer: {
        alignItems: 'center',
        marginBottom: 32,
        marginTop: 56,
    },
    hamsterImage: {
        width: 176,
        height: 176,
    },
    textContainer: {
        flex: 1,
        position: 'relative',
    },
    textBlock: {
        position: 'absolute',
        transform: [{ translateX: -80 }, { translateY: -24 }],
        maxWidth: 160,
    },
    textBlockText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
        textAlign: 'center',
        fontFamily: 'Nunito-Bold',
    },
    footer: {
        paddingVertical: 24,
        alignItems: 'center',
    },
    footerText: {
        color: '#fff',
        fontSize: 16,
        textAlign: 'center',
        fontFamily: 'Nunito',
    },
});
