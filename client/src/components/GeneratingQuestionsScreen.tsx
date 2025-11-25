import { useState, useEffect, useRef } from "react";
import { useSupabase } from "@/lib/SupabaseProvider";
import { useToast } from "@/hooks/use-toast";
import HamsterImageUrl from "@assets/Question-Hamster-Blue.svg";

interface GeneratingQuestionsScreenProps {
  userId: string;
  region: string;
  postcode: string;
  onComplete: () => void;
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
}: GeneratingQuestionsScreenProps) {
  const supabase = useSupabase();
  const { toast } = useToast();
  const [textBlocks, setTextBlocks] = useState<TextBlock[]>([]);
  const [currentIdIndex, setCurrentIdIndex] = useState(0);
  const [sequenceStarted, setSequenceStarted] = useState(false);
  const [fadeIn, setFadeIn] = useState(false);

  // Animated area ref (between hamster and footer)
  const containerRef = useRef<HTMLDivElement>(null);

  // Trigger fade-in animation
  useEffect(() => {
    requestAnimationFrame(() => {
      setFadeIn(true);
    });
  }, []);

useEffect(() => {
  // Use refs to avoid effect re-run issues and to keep flags stable across renders
  const mountedRef = { current: true };
  const startedRef = { current: false };
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

  // If we've already started the sequence, do nothing (prevents duplicate starts)
  if (startedRef.current) {
    console.log("[GeneratingQuestions] Sequence already started, skipping effect re-run");
    return;
  }
  startedRef.current = true;

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
      console.log("[GeneratingQuestions] Step 1: fetching titles...");
      let eventTitles: string[] = [];
      try {
        const { data: eventData, error: eventErr } = await supabase
          .from("questions_master_region")
          .select("event_title")
          .limit(20);
        if (eventErr) console.error("[GeneratingQuestions] fetch titles error", eventErr);
        if (eventData && eventData.length) {
          eventTitles = eventData.map((e: any) => e.event_title + "...");
          console.log("[GeneratingQuestions] fetched titles count:", eventTitles.length);
        }
      } catch (err) {
        console.error("[GeneratingQuestions] fetch titles failed", err);
      }

      // Prepare queue and selection state
      const streamQueue: string[] = [...eventTitles];
      const occupiedCells = new Set<number>();
      const lastPicks: number[] = [];
      const rowBlockCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0 };
      const baseTime = Date.now();          // used for scheduling future spawns
      let scheduledSpawns = 0;              // explicit count of how many spawns we've scheduled/used


      const decrementRowBlocks = () => {
        for (const r of [0, 1, 2]) {
          if (rowBlockCounts[r] > 0) rowBlockCounts[r] = Math.max(0, rowBlockCounts[r] - 1);
        }
      };

      // Helper: compute random position inside a cell, clamped so the block never overflows
      const computePositionInCell = (cellIndex: number) => {
        const bounds = containerRef.current?.getBoundingClientRect();
        if (!bounds) return null;

        const cols = 2;
        const rows = 3;
        const col = cellIndex % cols;
        const row = Math.floor(cellIndex / cols);

        const cellWidth = bounds.width / cols;
        const cellHeight = bounds.height / rows;

        // Estimated rendered block size (px). Tune if you change maxWidth or font-size.
        const EST_BLOCK_W = 160; // px max width of the text block
        const EST_BLOCK_H = 48;  // px height for up to 2 lines (approx)

        // Padding inside the cell (px) to avoid edges
        const padX = Math.min(24, cellWidth * 0.12); // stronger horizontal padding
        const padY = Math.min(20, cellHeight * 0.12);

        // Compute min/max in px but also reserve space for the block so center won't overflow
        const leftPxMin = col * cellWidth + padX + EST_BLOCK_W / 2;
        const leftPxMax = (col + 1) * cellWidth - padX - EST_BLOCK_W / 2;
        const topPxMin = row * cellHeight + padY + EST_BLOCK_H / 2;
        const topPxMax = (row + 1) * cellHeight - padY - EST_BLOCK_H / 2;

        // If the available range is invalid (very small screens), fall back to safe center of cell
        const safeLeftPx =
          leftPxMax > leftPxMin
            ? leftPxMin + Math.random() * (leftPxMax - leftPxMin)
            : col * cellWidth + cellWidth / 2;
        const safeTopPx =
          topPxMax > topPxMin
            ? topPxMin + Math.random() * (topPxMax - topPxMin)
            : row * cellHeight + cellHeight / 2;

        const leftPct = (safeLeftPx / bounds.width) * 100;
        const topPct = (safeTopPx / bounds.height) * 100;

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
        if (!pos) return false;
        const id = `${Date.now()}-${cellIndex}`;
        occupiedCells.add(cellIndex);
        const spawnTime = Date.now();
        console.log("[GeneratingQuestions] spawnIntoCell", cellIndex, id, text);
        setTextBlocks((prev) => [
          ...prev,
          { id, text, top: pos.topPct, left: pos.leftPct, opacity: 0, spawnTime },
        ]);
        const removeId = window.setTimeout(() => {
          if (!mountedRef.current) return;
          setTextBlocks((prev) => prev.filter((b) => b.id !== id));
          occupiedCells.delete(cellIndex);
          console.log("[GeneratingQuestions] removed block", id, "freed cell", cellIndex);
        }, TEXT_LIFETIME);
        spawnTimeouts.push(removeId);
        return true;
      };

      // Immediate first pick then interval
      const immediatePick = () => {
        const first = pickNextCell();
        if (first !== null && streamQueue.length > 0) {
          const text = streamQueue.shift()!;
          const ok = spawnIntoCell(first, text);
          if (!ok) streamQueue.unshift(text);
          if (ok) {
            scheduledSpawns++;
            console.log("[GeneratingQuestions] scheduledSpawns =", scheduledSpawns, "streamQueue.length =", streamQueue.length);
          }
        }
      };

      immediatePick();

      spawnInterval = window.setInterval(() => {
        if (!mountedRef.current) return;

        const next = pickNextCell();
        if (next === null) return;

        let text = streamQueue.shift();
        if (!text) {
          text = eventTitles.length ? eventTitles[Math.floor(Math.random() * eventTitles.length)] : "...";
        }

        const ok = spawnIntoCell(next, text);
        if (!ok) streamQueue.unshift(text);

        if (ok) {
          scheduledSpawns++;
          console.log("[GeneratingQuestions] scheduledSpawns =", scheduledSpawns, "streamQueue.length =", streamQueue.length);
        }
      }, INTERVAL_MS);



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

      // Step 3: Fetch location names and append to streamQueue if we have spare cells
      console.log("[GeneratingQuestions] Step 3: Fetching location names...");
      if (locations.length > 0) {
        try {
          const locationIds = locations.map((l) => l.location_id);
          const { data: locData, error: locErr } = await supabase
            .from("populated_places")
            .select("id, name1")
            .in("id", locationIds);

          if (locErr) {
            console.error("[GeneratingQuestions] Step 3 Fetch location names error:", locErr);
          }

          if (locData && locData.length > 0) {
            const locationNames = locData.map((l: any) => (l.name1 ?? l.id) + "...");
            console.log("[GeneratingQuestions] Step 3 Location names:", locationNames.slice(0, 3));

            // Append to streamQueue and schedule any remaining cells (if fewer than MAX_CELLS were scheduled)
            streamQueue.push(...locationNames);
            console.log("[GeneratingQuestions] Stream queue extended to:", streamQueue.length);

            // Schedule any remaining cells (use same baseTime and INTERVAL_MS logic)
            const scheduledCount = scheduledSpawns;
            const totalToSchedule = Math.min(MAX_CELLS, streamQueue.length);

            for (let idxToSchedule = scheduledCount; idxToSchedule < totalToSchedule; idxToSchedule++) {
              const spawnAt = baseTime + idxToSchedule * INTERVAL_MS;

              const timeoutId = window.setTimeout(() => {
                if (!mountedRef?.current) return;
                const pos = computePositionInCell(idxToSchedule);
                if (!pos) return;
                const id = `${spawnAt}-${idxToSchedule}`;
                setTextBlocks((prev) => [
                  ...prev,
                  {
                    id,
                    text: streamQueue[idxToSchedule],
                    top: pos.topPct,
                    left: pos.leftPct,
                    opacity: 0,
                    spawnTime: spawnAt,
                  },
                ]);
                // removal
                const removeId = window.setTimeout(() => {
                  if (!mountedRef?.current) return;
                  setTextBlocks((prev) => prev.filter((b) => b.id !== id));
                }, TEXT_LIFETIME);
                spawnTimeouts.push(removeId);
              }, Math.max(0, spawnAt - Date.now()));

              // <-- increment scheduledSpawns now that we've reserved this spawn slot
              scheduledSpawns++;

              spawnTimeouts.push(timeoutId);
            }
          } else {
            console.log("[GeneratingQuestions] Step 3 Query returned no locations");
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

        // Step 5: calculate-demand (fire-and-log; do not block animation)
        (async () => {
          try {
            console.log("[GeneratingQuestions] Step 5: Calling calculate-demand");
            const demandPayload = {
              user_id: userId,
              region,
              today: new Date().toISOString().slice(0, 10),
            };
            const demandResponse = await fetch(`${functionBaseUrl}/calculate-demand`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify(demandPayload),
            });
            const demandBody = await demandResponse.text();
            console.log("[GeneratingQuestions] calculate-demand status:", demandResponse.status, demandBody);
            if (!demandResponse.ok) {
              console.error("[GeneratingQuestions] calculate-demand returned error:", demandResponse.status);
            }
          } catch (err) {
            console.error("[GeneratingQuestions] calculate-demand failed:", err);
          }
        })();

        // Step 6: allocate-questions (fire-and-log)
        (async () => {
          try {
            console.log("[GeneratingQuestions] Step 6: Calling allocate-questions");
            const allocatePayload = {
              user_id: userId,
              region,
              today: new Date().toISOString().slice(0, 10),
            };
            const allocateResponse = await fetch(`${functionBaseUrl}/allocate-questions`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify(allocatePayload),
            });
            const allocateBody = await allocateResponse.text();
            console.log("[GeneratingQuestions] allocate-questions status:", allocateResponse.status, allocateBody);
            if (!allocateResponse.ok) {
              console.error("[GeneratingQuestions] allocate-questions returned error:", allocateResponse.status);
            }
          } catch (err) {
            console.error("[GeneratingQuestions] allocate-questions failed:", err);
          }
        })();
      }

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
        finishTimeout = window.setTimeout(() => {
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
    console.log("[GeneratingQuestions] cleanup: clearing timers");
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
}, [userId, region, postcode, supabase, toast, onComplete]);



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






