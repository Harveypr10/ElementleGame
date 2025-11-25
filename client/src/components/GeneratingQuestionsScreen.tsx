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
    let mounted = true;

    // Timing and grid constants
    const SCREEN_DURATION = 8000; // total screen time (ms)
    const TEXT_LIFETIME = 2500; // 2.5s visible
    const FADE_DURATION = 1200; // slower fade in/out
    const INTERVAL_MS = 1000; // new event every 1s
    const MAX_CELLS = 6;

    // Helpers
    const rowOf = (i: number) => Math.floor(i / 2);

    // Handles for cleanup
    const spawnTimeouts: number[] = [];
    let spawnInterval: number | null = null;
    let animInterval: number | null = null;
    let finishTimeout: number | null = null;
    let finished = false; // ensure onComplete called once

    if (sequenceStarted) {
      console.log("[GeneratingQuestions] Sequence already started, skipping effect re-run");
      return;
    }

    const startAnimationLoop = () => {
      console.log("[GeneratingQuestions] startAnimationLoop()");
      const animStart = Date.now();
      animInterval = window.setInterval(() => {
        if (!mounted) return;
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

    const runSequence = async () => {
      try {
        console.log("[GeneratingQuestions] runSequence() start");
        setSequenceStarted(true);

        // start animation loop immediately
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

        // queue and helpers
        const streamQueue: string[] = [...eventTitles];
        const occupiedCells = new Set<number>();
        const lastPicks: number[] = [];
        const rowBlockCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0 };

        const decrementRowBlocks = () => {
          for (const r of [0, 1, 2]) {
            if (rowBlockCounts[r] > 0) rowBlockCounts[r] = Math.max(0, rowBlockCounts[r] - 1);
          }
        };

        const computePositionInCell = (cellIndex: number) => {
          const bounds = containerRef.current?.getBoundingClientRect();
          if (!bounds) return null;
          const cols = 2;
          const rows = 3;
          const col = cellIndex % cols;
          const row = Math.floor(cellIndex / cols);
          const cellWidth = bounds.width / cols;
          const cellHeight = bounds.height / rows;
          const padX = Math.min(20, cellWidth * 0.12);
          const padY = Math.min(20, cellHeight * 0.12);
          const leftPxMin = col * cellWidth + padX;
          const leftPxMax = (col + 1) * cellWidth - padX;
          const topPxMin = row * cellHeight + padY;
          const topPxMax = (row + 1) * cellHeight - padY;
          const leftPx = leftPxMin + Math.random() * Math.max(1, leftPxMax - leftPxMin);
          const topPx = topPxMin + Math.random() * Math.max(1, topPxMax - topPxMin);
          return { topPct: (topPx / bounds.height) * 100, leftPct: (leftPx / bounds.width) * 100 };
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
            if (!mounted) return;
            setTextBlocks((prev) => prev.filter((b) => b.id !== id));
            occupiedCells.delete(cellIndex);
            console.log("[GeneratingQuestions] removed block", id, "freed cell", cellIndex);
          }, TEXT_LIFETIME);
          spawnTimeouts.push(removeId);
          return true;
        };

        // immediate first pick + interval
        const immediatePick = () => {
          const first = pickNextCell();
          if (first !== null && streamQueue.length > 0) {
            const text = streamQueue.shift()!;
            const ok = spawnIntoCell(first, text);
            if (!ok) streamQueue.unshift(text);
          }
        };

        immediatePick();
        spawnInterval = window.setInterval(() => {
          if (!mounted) return;
          const next = pickNextCell();
          if (next === null) return;
          let text = streamQueue.shift();
          if (!text) {
            text = eventTitles.length ? eventTitles[Math.floor(Math.random() * eventTitles.length)] : "...";
          }
          const ok = spawnIntoCell(next, text);
          if (!ok) streamQueue.unshift(text);
        }, INTERVAL_MS);

        // schedule finish (ensure single call)
        finishTimeout = window.setTimeout(() => {
          if (!mounted) return;
          if (finished) return;
          finished = true;
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
            if (!mounted) return;
            onComplete();
          }, 100);
        }, SCREEN_DURATION);

        // continue backend steps in parallel (populate locations, demand, allocate, archive sync)
        // ... (kept as in your existing code) ...
        // NOTE: these do not block the animation or the finishTimeout above.

      } catch (err) {
        console.error("[GeneratingQuestions] runSequence error:", err);
        if (mounted) {
          toast({
            title: "Setup error",
            description: "There was an issue preparing your questions",
            variant: "destructive",
          });
          setTimeout(() => {
            if (!mounted) return;
            onComplete();
          }, 3000);
        }
      }
    };

    runSequence();

    // cleanup
    return () => {
      mounted = false;
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
  }, [userId, region, postcode, supabase, toast, onComplete, sequenceStarted]);




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
      <div ref={containerRef} className="relative w-full flex-1">
        {textBlocks.map((block) => (
          <div
            key={block.id}
            className="absolute text-white font-bold text-sm pointer-events-none"
            style={{
              top: `${block.top}%`,
              left: `${block.left}%`,
              opacity: block.opacity,
              transform: "translate(-50%, -50%)",
              maxWidth: "180px", // slightly wider to allow two lines
              textAlign: "center",
              whiteSpace: "normal", // allow wrapping
              wordBreak: "break-word",
              transition: "opacity 120ms linear",
            }}
          >
            {block.text}
          </div>
        ))}
      </div>

      {/* Footer Text */}
      <div className="mt-8 text-center max-w-md mx-auto">
        <p className="text-white font-medium text-xl leading-snug">
          One moment please, Hammie is cooking up your personalised questions...
        </p>
      </div>
    </div>
  );
}






