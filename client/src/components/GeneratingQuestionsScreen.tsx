    import { useState, useEffect, useRef } from "react";
    import { useSupabase } from "@/lib/SupabaseProvider";
    import { useToast } from "@/hooks/use-toast";
    import HamsterImageUrl from "@assets/Question-Hamster-Blue.svg";

    type RegenerationType = 'first_login' | 'postcode_change' | 'category_change';

    interface GeneratingQuestionsScreenProps {
      userId: string;
      region: string;
      postcode: string;
      onComplete: () => void;
      regenerationType?: RegenerationType;
      selectedCategoryIds?: number[]; // For category_change: filter event_titles to match selected categories
      isPro?: boolean; // For postcode_change: if Pro, fetch and filter by user's saved categories
    }

    interface TextBlock {
      id: string;
      text: string;
      top: number;   // percent relative to the animated container
      left: number;  // percent relative to the animated container
      opacity: number;
      spawnTime: number; // ms timestamp
    }

    export function GeneratingQuestionsScreen({
      userId,
      region,
      postcode,
      onComplete,
      regenerationType = 'first_login',
      selectedCategoryIds,
      isPro = false,
    }: GeneratingQuestionsScreenProps) {
      const supabase = useSupabase();
      const { toast } = useToast();
      const [textBlocks, setTextBlocks] = useState<TextBlock[]>([]);
      const [fadeIn, setFadeIn] = useState(false);

      // Animated area ref (between hamster and footer)
      const containerRef = useRef<HTMLDivElement>(null);
      
      // Ref to track if sequence has started - prevents duplicate runs across re-renders
      const sequenceStartedRef = useRef(false);

      // Trigger fade-in animation
      useEffect(() => {
        requestAnimationFrame(() => {
          setFadeIn(true);
        });
      }, []);

    useEffect(() => {
      // If we've already started the sequence, do nothing (prevents duplicate starts)
      if (sequenceStartedRef.current) {
        console.log("[GeneratingQuestions] Sequence already started, skipping effect re-run");
        return;
      }
      sequenceStartedRef.current = true;
      
      // Use refs to avoid effect re-run issues and to keep flags stable across renders
      const mountedRef = { current: true };
      const finishedRef = { current: false };

      // Timing and grid constants
      const SCREEN_DURATION = 10000; // total screen time (ms)
      const TEXT_LIFETIME = 2500; // 2.5s visible
      const FADE_DURATION = 1200; // fade in/out (ms)
      const INTERVAL_MS = 1000; // new event every 1s
      const MAX_CELLS = 6;

      // Helpers
      const rowOf = (i: number) => Math.floor(i / 2);

      // Timer handles for cleanup
      const spawnTimeouts: number[] = [];
      let spawnInterval: number | null = null;
      let animInterval: number | null = null;
      let finishTimeout: number | null = null;

      // Start animation loop immediately so opacity updates run while backend work proceeds
      const startAnimationLoop = () => {
        console.log("[GeneratingQuestions] startAnimationLoop()");
        const tickStart = Date.now();
        animInterval = window.setInterval(() => {
          if (!mountedRef.current) return;
          const now = Date.now();
          setTextBlocks((prev) =>
            prev
              .map((block) => {
                const blockElapsed = now - block.spawnTime;
                if (blockElapsed < 0) return block;
                if (blockElapsed < FADE_DURATION) {
                  return { ...block, opacity: Math.min(1, blockElapsed / FADE_DURATION) };
                } else if (blockElapsed < TEXT_LIFETIME - FADE_DURATION) {
                  return { ...block, opacity: 1 };
                } else if (blockElapsed < TEXT_LIFETIME) {
                  const out = (blockElapsed - (TEXT_LIFETIME - FADE_DURATION)) / FADE_DURATION;
                  return { ...block, opacity: Math.max(0, 1 - out) };
                }
                return null;
              })
              .filter((b): b is TextBlock => b !== null)
          );
        }, 100);
      };

      // Main async runner
      (async () => {
        try {
          console.log("[GeneratingQuestions] runSequence() start");
          startAnimationLoop();

          // Step 0: session
          const {
            data: { session },
          } = await supabase.auth.getSession();
          const accessToken = session?.access_token;
          if (!accessToken) throw new Error("No access token found");
          console.log("[GeneratingQuestions] got access token");

          // Step 1: fetch titles
          // For category_change with selectedCategoryIds, filter to matching categories only
          // For postcode_change with isPro, fetch user's saved categories and filter by them
          // For first_login or non-Pro postcode_change, show all questions
          console.log("[GeneratingQuestions] Step 1: fetching titles...", {
            regenerationType,
            selectedCategoryIds: selectedCategoryIds?.length ?? 0,
            isPro,
          });
          let eventTitles: string[] = [];
          try {
            // Determine which category IDs to use for filtering
            let categoryIdsToFilter: number[] | undefined = selectedCategoryIds;
            
            // For Pro users doing postcode_change, fetch their saved categories
            if (regenerationType === 'postcode_change' && isPro && !selectedCategoryIds) {
              console.log("[GeneratingQuestions] Pro user postcode change - fetching saved categories");
              try {
                const categoriesResponse = await fetch('/api/user/pro-categories', {
                  credentials: 'include',
                  headers: {
                    'Authorization': `Bearer ${accessToken}`,
                  },
                });
                if (categoriesResponse.ok) {
                  const categoriesData = await categoriesResponse.json();
                  if (categoriesData.categoryIds && Array.isArray(categoriesData.categoryIds) && categoriesData.categoryIds.length > 0) {
                    categoryIdsToFilter = categoriesData.categoryIds;
                    console.log("[GeneratingQuestions] Pro user's saved categories:", categoryIdsToFilter);
                  }
                }
              } catch (catErr) {
                console.error("[GeneratingQuestions] Failed to fetch user's saved categories:", catErr);
              }
            }
            
            // Filter by categories if we have any (category_change OR Pro postcode_change)
            const shouldFilterByCategories = 
              (regenerationType === 'category_change' && selectedCategoryIds && selectedCategoryIds.length > 0) ||
              (regenerationType === 'postcode_change' && isPro && categoryIdsToFilter && categoryIdsToFilter.length > 0);
            
            if (shouldFilterByCategories && categoryIdsToFilter && categoryIdsToFilter.length > 0) {
              console.log("[GeneratingQuestions] Filtering by categories:", categoryIdsToFilter);
              
              // Fetch more questions and filter client-side to ensure we get matching results
              const { data: eventData, error: eventErr } = await supabase
                .from("questions_master_region")
                .select("event_title, categories")
                .limit(100);
              
              if (eventErr) console.error("[GeneratingQuestions] fetch titles error", eventErr);
              
              if (eventData && eventData.length) {
                // Filter questions that have at least one matching category
                const categorySet = new Set(categoryIdsToFilter);
                const filteredEvents = eventData.filter((e: any) => {
                  const questionCategories = e.categories as number[] | null;
                  if (!questionCategories || !Array.isArray(questionCategories)) return false;
                  return questionCategories.some(cat => categorySet.has(cat));
                });
                
                console.log("[GeneratingQuestions] Filtered from", eventData.length, "to", filteredEvents.length, "questions");
                
                if (filteredEvents.length > 0) {
                  // Deduplicate and shuffle, then take first 30
                  const uniqueTitles = Array.from(new Set(filteredEvents.map((e: any) => e.event_title)));
                  const shuffled = uniqueTitles.sort(() => Math.random() - 0.5);
                  eventTitles = shuffled.slice(0, 30).map((title: string) => title + "...");
                  console.log("[GeneratingQuestions] fetched titles count:", eventTitles.length, "(filtered by selected categories, deduped)");
                } else {
                  console.log("[GeneratingQuestions] No titles found for selected categories, using unfiltered");
                  // Deduplicate unfiltered as well
                  const uniqueTitles = Array.from(new Set(eventData.map((e: any) => e.event_title)));
                  eventTitles = uniqueTitles.slice(0, 30).map((title: string) => title + "...");
                }
              }
            } else {
              // For first_login or non-Pro postcode_change, fetch all questions
              const { data: eventData, error: eventErr } = await supabase
                .from("questions_master_region")
                .select("event_title")
                .limit(50); // Fetch more to account for duplicates
              
              if (eventErr) console.error("[GeneratingQuestions] fetch titles error", eventErr);
              if (eventData && eventData.length) {
                // Deduplicate event titles to avoid showing same title twice
                const uniqueTitles = Array.from(new Set(eventData.map((e: any) => e.event_title)));
                // Shuffle to ensure random order (prevents same first title showing twice at start)
                const shuffled = uniqueTitles.sort(() => Math.random() - 0.5);
                eventTitles = shuffled.slice(0, 30).map((title: string) => title + "...");
                console.log("[GeneratingQuestions] fetched titles count:", eventTitles.length, "(all categories, deduped, shuffled)");
              }
            }
          } catch (err) {
            console.error("[GeneratingQuestions] fetch titles failed", err);
          }

    // Queue + selection helpers (declare together so nothing is referenced before it exists)
    const INITIAL_TITLES = 4;
    const eventTitlesAll = [...eventTitles]; // keep original list if needed

    // Core queue: initial reserved titles at the front, rest follow
    const streamQueue: string[] = eventTitlesAll.slice(0, INITIAL_TITLES).concat(eventTitlesAll.slice(INITIAL_TITLES));

    // Selection state and scheduling counters
    let initialConsumed = 0; // how many of the initial reserved titles we've shown
    const occupiedCells = new Set<number>();
    const lastPicks: number[] = [];
    const rowBlockCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0 };
    const baseTime = Date.now(); // used for scheduling future spawns
    let scheduledSpawns = 0; // explicit count of how many spawns we've scheduled/used

          // Helper: pick and remove a random item from the queue (for non-initial items)
          const popRandomFromQueue = (q: string[]) => {
            if (!q || q.length === 0) return undefined;
            const idx = Math.floor(Math.random() * q.length);
            const [item] = q.splice(idx, 1);
            return item;
          };

          // Helper: get the next text to show
          // - If we still have reserved initial titles, return them in FIFO order (shift).
          // - Otherwise return a random item from the remaining queue.
          const popNextText = (q: string[]) => {
            if (!q || q.length === 0) return undefined;

            // If there are still initial titles not yet consumed, return them FIFO
            if (initialConsumed < INITIAL_TITLES && q.length > 0) {
              const val = q.shift();
              if (val !== undefined) {
                initialConsumed++;
                return val;
              }
              return undefined;
            }

            // Otherwise pick randomly from the rest
            return popRandomFromQueue(q);
          };


    // Helper: clamp a percentage to a safe 0–100 range
    const clampPct = (v: number) => Math.max(0, Math.min(100, Number.isFinite(v) ? v : 0));

    // Helper: decrement row block counters (keeps rowBlockCounts in sync)
    const decrementRowBlocks = () => {
      for (const r of [0, 1, 2]) {
        if (rowBlockCounts[r] > 0) rowBlockCounts[r] = Math.max(0, rowBlockCounts[r] - 1);
      }
    };


          // Helper: compute random position inside a cell, clamped so the block never overflows
          const computePositionInCell = (cellIndex: number) => {
            // Try to get container bounds; fall back to window size if not available
            const bounds = containerRef.current?.getBoundingClientRect();
            const width = bounds?.width ?? window.innerWidth;
            const height = bounds?.height ?? window.innerHeight;

            const cols = 2;
            const rows = 3;
            const col = cellIndex % cols;
            const row = Math.floor(cellIndex / cols);

            const cellWidth = width / cols;
            const cellHeight = height / rows;

            // Estimated rendered block size (px). Tune if you change maxWidth or font-size.
            const EST_BLOCK_W = 160;
            const EST_BLOCK_H = 48;

            const padX = Math.min(24, cellWidth * 0.12);
            const padY = Math.min(20, cellHeight * 0.12);

            const leftPxMin = col * cellWidth + padX + EST_BLOCK_W / 2;
            const leftPxMax = (col + 1) * cellWidth - padX - EST_BLOCK_W / 2;
            const topPxMin = row * cellHeight + padY + EST_BLOCK_H / 2;
            const topPxMax = (row + 1) * cellHeight - padY - EST_BLOCK_H / 2;

            const safeLeftPx =
              leftPxMax > leftPxMin ? leftPxMin + Math.random() * (leftPxMax - leftPxMin) : col * cellWidth + cellWidth / 2;
            const safeTopPx =
              topPxMax > topPxMin ? topPxMin + Math.random() * (topPxMax - topPxMin) : row * cellHeight + cellHeight / 2;

            const leftPct = (safeLeftPx / width) * 100;
            const topPct = (safeTopPx / height) * 100;

            return { topPct, leftPct };
          };



          const pickNextCell = (): number | null => {
            decrementRowBlocks();
            const all = Array.from({ length: MAX_CELLS }, (_, i) => i);
            let candidates = all.filter((i) => !occupiedCells.has(i) && !lastPicks.includes(i) && rowBlockCounts[rowOf(i)] === 0);
            if (candidates.length === 0) candidates = all.filter((i) => !occupiedCells.has(i) && rowBlockCounts[rowOf(i)] === 0);
            if (candidates.length === 0) candidates = all.filter((i) => !occupiedCells.has(i) && !lastPicks.includes(i));
            if (candidates.length === 0) candidates = all.filter((i) => !occupiedCells.has(i));
            if (candidates.length === 0) return null;
            const choice = candidates[Math.floor(Math.random() * candidates.length)];
            lastPicks.push(choice);
            if (lastPicks.length > 3) lastPicks.shift();
            rowBlockCounts[rowOf(choice)] = 3;
            return choice;
          };

          const spawnIntoCell = (cellIndex: number, text: string) => {
            const pos = computePositionInCell(cellIndex);
            if (!pos) {
              console.warn("[GeneratingQuestions] spawnIntoCell: no position available for cell", cellIndex, "text:", text);
              return false;
            }

            const id = `${Date.now()}-${cellIndex}`;
            occupiedCells.add(cellIndex);
            const spawnTime = Date.now();

            console.log("[GeneratingQuestions] spawnIntoCell", cellIndex, id, text);

            setTextBlocks((prev) => [
              ...prev,
              { id, text, top: clampPct(pos.topPct), left: clampPct(pos.leftPct), opacity: 0, spawnTime },
            ]);

            const removeId = window.setTimeout(() => {
              if (!mountedRef.current) return;
              setTextBlocks((prev) => prev.filter((b) => b.id !== id));
              occupiedCells.delete(cellIndex);
              // Free up a scheduled spawn slot when a block is removed
              scheduledSpawns = Math.max(0, scheduledSpawns - 1);
              console.log("[GeneratingQuestions] removed block", id, "freed cell", cellIndex, "scheduledSpawns =", scheduledSpawns);
            }, TEXT_LIFETIME);


            spawnTimeouts.push(removeId);
            return true;
          };


          // Immediate first pick then interval
          const immediatePick = () => {
            const first = pickNextCell();
            if (first !== null && streamQueue.length > 0) {
              const text = popNextText(streamQueue) ?? (eventTitles.length ? eventTitles[Math.floor(Math.random() * eventTitles.length)] : "...");

              const ok = spawnIntoCell(first, text);
              if (!ok) streamQueue.unshift(text);
              if (ok) {
                console.log("[GeneratingQuestions] immediate spawn ok; streamQueue.length =", streamQueue.length);
              }
            }
          };

          // Do an immediate pick to fill one free cell now
          immediatePick();

          // Delay starting the regular interval by one INTERVAL_MS so the immediate pick(s)
          // don't race with the first interval tick and cause a burst at startup.
          const startSpawnInterval = () => {
            spawnInterval = window.setInterval(() => {
              if (!mountedRef.current) return;

              const next = pickNextCell();
              if (next === null) return;

              const text = popNextText(streamQueue) ?? (eventTitlesAll.length ? eventTitlesAll[Math.floor(Math.random() * eventTitlesAll.length)] : "...");
              if (!text) return;

              const ok = spawnIntoCell(next, text);
              if (!ok) {
                // put it back if spawn failed
                streamQueue.unshift(text);
              }
            }, INTERVAL_MS);
          };

          // Start the interval after one INTERVAL_MS (push the timeout id into spawnTimeouts so cleanup clears it)
          const initialIntervalTimeout = window.setTimeout(() => {
            if (!mountedRef.current) return;
            startSpawnInterval();
          }, INTERVAL_MS);
          spawnTimeouts.push(initialIntervalTimeout);



          // ---------- Insert here (after initial spawn scheduling, before finishTimeout) ----------
          try {
            console.log("[GeneratingQuestions] Step 1c: Populating user locations...");
            await supabase.rpc("populate_user_locations", {
              p_user_id: userId,
              p_postcode: postcode,
            });
            console.log("[GeneratingQuestions] populate_user_locations complete");
          } catch (err) {
            console.error("[GeneratingQuestions] populate_user_locations failed:", err);
            // continue — animation should not be blocked
          }

          // Step 2: Poll location_allocation until rows exist
          console.log("[GeneratingQuestions] Step 2: Polling for location allocation with user_id:", userId);
          let locations: Array<{ location_id: string; score: number }> = [];
          for (let i = 0; i < 20; i++) {
            try {
              const { data, error } = await supabase
                .from("location_allocation")
                .select("location_id, score")
                .eq("user_id", userId)
                .order("score", { ascending: false });

              if (error) {
                console.error("[GeneratingQuestions] Step 2 Poll query error:", error);
              }

              if (data && data.length > 0) {
                locations = data as Array<{ location_id: string; score: number }>;
                console.log("[GeneratingQuestions] Step 2 Poll SUCCESS - found", locations.length, "locations");
                break;
              } else {
                console.log(`[GeneratingQuestions] Step 2 Poll attempt ${i + 1} - no data yet`);
              }
            } catch (pollErr) {
              console.error("[GeneratingQuestions] Step 2 Poll attempt failed:", pollErr);
            }
            await new Promise((r) => setTimeout(r, 500));
          }

// Step 3: Fetch location names and insert into queue (interleaved, Option B)
console.log("[GeneratingQuestions] Step 3: Fetching location names...");

if (Array.isArray(locations) && locations.length > 0) {
  try {
    const locationIds = (locations as Array<{ location_id: string; score: number }>).map((l) => l.location_id);
    console.log("[GeneratingQuestions] Step 3: locationIds to fetch:", locationIds);

    const { data: locData, error: locErr } = await supabase
      .from("populated_places")
      .select("id, name1")
      .in("id", locationIds);

    if (locErr) {
      console.error("[GeneratingQuestions] Step 3 Fetch location names error:", locErr);
    }

    if (locData && locData.length > 0) {
      const locationRows = locData as Array<{ id: string; name1?: string }>;
      const locationNames = locationRows.map((row) => (row.name1 ?? row.id) + "...");
      console.log("[GeneratingQuestions] Step 3 Location names fetched:", locationNames);

      // Shuffle place names
      const shuffled = locationNames.sort(() => Math.random() - 0.5);

      // Compute insertion index so we don't replace the reserved opening titles
      const insertIndex = Math.min(Math.max(0, INITIAL_TITLES - initialConsumed), streamQueue.length);

      // Build a new queue that interleaves place names with existing items
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

      // Replace streamQueue contents in-place
      streamQueue.length = 0;
      streamQueue.push(...newQueue);

      console.log("[GeneratingQuestions] inserted and interleaved locationNames at index", insertIndex, "streamQueue length:", streamQueue.length);
      console.log("[GeneratingQuestions] streamQueue sample (first 12):", streamQueue.slice(0, 12));

      // Do not fill free cells immediately here. The interval producer will consume streamQueue at a steady INTERVAL_MS pace.
    } else {
      console.log("[GeneratingQuestions] Step 3 Query returned no populated_places rows", locData);
    }
  } catch (err) {
    console.error("[GeneratingQuestions] Step 3 Fetch location names failed:", err);
  }
} else {
  console.log("[GeneratingQuestions] Step 3 Skipped - no locations");
}



// Derive function base URL for edge functions
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || (supabase as any).supabaseUrl;
if (!supabaseUrl) {
  console.warn("[GeneratingQuestions] Supabase URL not available; skipping function calls");
} else {
  const functionBaseUrl = supabaseUrl.replace(".supabase.co", ".functions.supabase.co");
  console.log("[GeneratingQuestions] Function base URL:", functionBaseUrl);

  // Step 5: calculate-demand only (allocate-questions is triggered automatically server-side)
  try {
    console.log("[GeneratingQuestions] Step 5: Calling calculate-demand");
    const demandPayload = { user_id: userId, region, today: new Date().toISOString().slice(0, 10) };
    const demandResponse = await fetch(`${functionBaseUrl}/calculate-demand`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(demandPayload),
    });
    const demandBody = await demandResponse.text();
    console.log("[GeneratingQuestions] calculate-demand status:", demandResponse.status, demandBody);
    if (!demandResponse.ok) throw new Error(`calculate-demand returned error: ${demandResponse.status}`);
  } catch (err) {
    console.error("[GeneratingQuestions] Step 5 failed:", err);
  }
}
  // Step 6 removed and is now called within calculate-demand

// Step 7: Archive sync check (best-effort)
(async () => {
  try {
    const { data: allocated } = await supabase
      .from("questions_allocated_user")
      .select("puzzle_date")
      .eq("user_id", userId);

    const allocatedCount = allocated?.length ?? 0;
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("archive_synced_count")
      .eq("id", userId)
      .single();

    if (allocatedCount > (profile?.archive_synced_count ?? 0)) {
      console.log("[GeneratingQuestions] Updating archive_synced_count to", allocatedCount);
      await supabase
        .from("user_profiles")
        .update({ archive_synced_count: allocatedCount })
        .eq("id", userId);
    }
    console.log("[GeneratingQuestions] Archive sync check complete");
  } catch (err) {
    console.error("[GeneratingQuestions] Archive sync check failed:", err);
  }
})();
 // ---------- end insert ----------

            // Ensure the screen transitions after SCREEN_DURATION exactly once
            finishTimeout = window.setTimeout(async () => {
              if (!mountedRef.current) return;
              if (finishedRef.current) return;
              finishedRef.current = true;
              console.log("[GeneratingQuestions] finishTimeout fired - cleaning up and calling onComplete");

              if (spawnInterval !== null) {
                window.clearInterval(spawnInterval);
                spawnInterval = null;
              }
              if (animInterval !== null) {
                window.clearInterval(animInterval);
                animInterval = null;
              }

              spawnTimeouts.forEach((id) => window.clearTimeout(id));

              // Update restriction timestamps after generation completes
              try {
                console.log("[GeneratingQuestions] Calling /api/generation-complete with regenerationType:", regenerationType);
                const response = await fetch('/api/generation-complete', {
                  method: 'POST',
                  credentials: 'include',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                  },
                  body: JSON.stringify({ regenerationType }),
                });
                const result = await response.json();
                console.log("[GeneratingQuestions] /api/generation-complete result:", result);
              } catch (err) {
                console.error("[GeneratingQuestions] Failed to update restriction timestamps:", err);
                // Don't block completion - this is best-effort
              }

              // small delay to allow last fade-out to complete visually before transition
              setTimeout(() => {
                if (!mountedRef.current) return;
                onComplete();
              }, 100);
            }, SCREEN_DURATION);

            // Continue backend steps (populate locations, demand, allocate, archive sync) in parallel
            // They do not block the animation or the finishTimeout above.
        } catch (err) {
          console.error("[GeneratingQuestions] runSequence error:", err);
          if (mountedRef.current) {
            toast({
              title: "Setup error",
              description: "There was an issue preparing your questions",
              variant: "destructive",
            });
            setTimeout(() => {
              if (!mountedRef.current) return;
              onComplete();
            }, 3000);
          }
        }
      })(); // end of async IIFE

      // Cleanup on unmount
      return () => {
        mountedRef.current = false;
        // Reset sequenceStartedRef so sequence can restart on remount (handles React StrictMode double-mount)
        sequenceStartedRef.current = false;
        console.log("[GeneratingQuestions] cleanup: clearing timers and resetting sequence flag");
        if (spawnInterval !== null) {
          window.clearInterval(spawnInterval);
          spawnInterval = null;
        }
        if (animInterval !== null) {
          window.clearInterval(animInterval);
          animInterval = null;
        }
        if (finishTimeout !== null) {
          window.clearTimeout(finishTimeout);
          finishTimeout = null;
        }
        spawnTimeouts.forEach((id) => window.clearTimeout(id));
      };
      // Intentionally minimal dependency list: do not include sequenceStarted state here
    }, [userId, region, postcode, supabase, toast, onComplete, regenerationType]);



      return (
        <div
          className="min-h-screen flex flex-col p-4"
          style={{ backgroundColor: "#7DAAE8" }}
        >
          {/* Hamster Image */}
          <div className="mb-8 flex justify-center">
            <img
              src={HamsterImageUrl}
              alt="Hammie"
              className="w-64 h-64 object-contain"
            />
          </div>

          {/* Animated Text Blocks (constrained area between hamster and footer) */}
          <div ref={containerRef} className="relative w-full flex-1 pb-6">
            {textBlocks.map((block) => (
              <div
                key={block.id}
                className="absolute text-white font-bold text-sm pointer-events-none"
                style={{
                  top: `${block.top}%`,
                  left: `${block.left}%`,
                  opacity: block.opacity,
                  transform: "translate(-50%, -50%)",
                  maxWidth: "160px",
                  width: "auto",
                  textAlign: "center",
                  whiteSpace: "normal",
                  wordBreak: "break-word",
                  overflow: "hidden",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  lineHeight: "1.15rem",
                  transition: "opacity 200ms linear",
                }}
              >
                {block.text}
              </div>
            ))}
          </div>

          {/* Footer Text */}
          <div
            className="mt-4 text-center max-w-md mx-auto"
            style={{ transform: "translateY(-8px)" }} // adjust -8px to taste
          >
            <p className="text-white font-medium text-xl leading-snug">
              One moment please, Hammie is cooking up your personalised questions...
            </p>
          </div>

        </div>
      );
    }






