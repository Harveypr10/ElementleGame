import { useState, useEffect } from "react";
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
  top: number;
  left: number;
  opacity: number;
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

  // Trigger fade-in animation
  useEffect(() => {
    requestAnimationFrame(() => {
      setFadeIn(true);
    });
  }, []);

  useEffect(() => {
    let mounted = true;
    let textInterval: NodeJS.Timeout | null = null;
    const SCREEN_DURATION = 8000; // 8 seconds
    const TEXT_LIFETIME = 2000; // 2 seconds per text block
    const TEXT_SPAWN_INTERVAL = 1000; // new text every 1 second

    // Guard: only run sequence once per component mount
    if (sequenceStarted) {
      console.log("[GeneratingQuestions] Sequence already started, skipping...");
      return;
    }

    const runSequence = async () => {
      try {
        console.log("[GeneratingQuestions] Starting sequence for userId:", userId);
        setSequenceStarted(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("No session found");
        console.log("[GeneratingQuestions] Session acquired:", session.user.id);

        // Step 1: Populate user locations
        console.log("[GeneratingQuestions] Step 1: Populating user locations...");
        try {
          await supabase.rpc("populate_user_locations", {
            p_user_id: userId,
            p_postcode: postcode,
          });
          console.log("[GeneratingQuestions] populate_user_locations complete");
        } catch (err) {
          console.error("[GeneratingQuestions] populate_user_locations failed:", err);
          throw err;
        }

// Step 2: Poll location_allocation until rows exist
console.log("[GeneratingQuestions] Step 2: Polling for location allocation with user_id:", userId);
let locations: Array<{ location_id: string; score: number }> = [];
for (let i = 0; i < 20; i++) {
  try {
    console.log(`[GeneratingQuestions] Step 2 Poll attempt ${i + 1}/20 - querying FROM location_allocation`);
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
      console.log(`[GeneratingQuestions] Step 2 Poll attempt ${i + 1} - no data yet, retrying...`);
    }
  } catch (pollErr) {
    console.error("[GeneratingQuestions] Step 2 Poll attempt failed:", pollErr);
  }
  await new Promise((r) => setTimeout(r, 500));
}


// Step 3: Fetch location names for displaying
console.log("[GeneratingQuestions] Step 3: Fetching location names from populated_places with IDs:", locations.map(l => l.location_id));
let locationNames: string[] = [];
if (locations.length > 0) {
  try {
    const locationIds = locations.map((l) => l.location_id);
    console.log("[GeneratingQuestions] Step 3 QUERY - FROM populated_places, SELECT id, populated_place, WHERE id IN:", locationIds);
    const { data: locData, error: locErr } = await supabase
      .from("populated_places")
      .select("id, populated_place")
      .in("id", locationIds);

    if (locErr) {
      console.error("[GeneratingQuestions] Step 3 Fetch location names error:", locErr);
    }

    if (locData) {
      console.log("[GeneratingQuestions] Step 3 Query returned", locData.length, "populated places");
      locationNames = locData.map((l) => (l.populated_place ?? l.id) + "...");
      console.log("[GeneratingQuestions] Step 3 Location names:", locationNames);
    } else {
      console.log("[GeneratingQuestions] Step 3 Query returned null data");
    }
    console.log("[GeneratingQuestions] Step 3 Complete - fetched", locationNames.length, "location names");
  } catch (err) {
    console.error("[GeneratingQuestions] Step 3 Fetch location names failed:", err);
  }
} else {
  console.log("[GeneratingQuestions] Step 3 Skipped - no locations to fetch names for");
}

        // Step 4: Fetch event titles
        console.log("[GeneratingQuestions] Step 4: Fetching event titles...");
        let eventTitles: string[] = [];
        try {
          // Ensure region is wrapped in an array
          const regionFilter = [region]; // e.g. ["UK"]

          const { data: eventData, error: eventErr } = await supabase
            .from("questions_master_region")
            .select("event_title")
            .contains("regions", regionFilter) // JSONB array containment
            .limit(20);

          if (eventErr) {
            console.error("[GeneratingQuestions] Fetch event titles error:", eventErr);
          }

          eventTitles = eventData
            ? eventData.map((e) => e.event_title + "...")
            : [];
          console.log("[GeneratingQuestions] Fetched event titles:", eventTitles.length);
        } catch (err) {
          console.error("[GeneratingQuestions] Fetch event titles failed:", err);
        }



        // Combine all text items
        const allTextItems = [...eventTitles, ...locationNames].filter(
          (item) => item
        );
        console.log("[GeneratingQuestions] Total text items:", allTextItems.length);

        // Get access token
        const accessToken = session.access_token;
        if (!accessToken) throw new Error("No access token found");

        // Derive function base URL from Supabase URL
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || (supabase as any).supabaseUrl;
        if (!supabaseUrl) throw new Error("Supabase URL not available");
        console.log("[GeneratingQuestions] Supabase URL:", supabaseUrl);
        // CORRECT: Replace .supabase.co with .functions.supabase.co
        const functionBaseUrl = supabaseUrl.replace(".supabase.co", ".functions.supabase.co");
        console.log("[GeneratingQuestions] Corrected function base URL:", functionBaseUrl);

        // Step 5: Call calculate-demand
        console.log("[GeneratingQuestions] Step 5: Calling calculate-demand with user_id:", userId);
        try {
          const demandPayload = {
            user_id: userId,
            region: region,
            today: new Date().toISOString().slice(0, 10), // YYYY-MM-DD format
          };
          console.log("[GeneratingQuestions] calculate-demand payload:", demandPayload);
          
          const demandResponse = await fetch(`${functionBaseUrl}/calculate-demand`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify(demandPayload),
          });

          console.log("[GeneratingQuestions] calculate-demand status:", demandResponse.status);
          const demandBody = await demandResponse.text();
          console.log("[GeneratingQuestions] calculate-demand response:", demandBody);

          if (!demandResponse.ok) {
            throw new Error(`calculate-demand returned ${demandResponse.status}: ${demandBody}`);
          }

          console.log("[GeneratingQuestions] calculate-demand complete for user:", userId);
        } catch (err) {
          console.error("[GeneratingQuestions] calculate-demand failed:", err);
        }

        // Step 6: Call allocate-questions
        console.log("[GeneratingQuestions] Step 6: Calling allocate-questions with user_id:", userId);
        try {
          const allocatePayload = {
            user_id: userId,
            region: region,
            today: new Date().toISOString().slice(0, 10), // YYYY-MM-DD format
          };
          console.log("[GeneratingQuestions] allocate-questions payload:", allocatePayload);
          
          const allocateResponse = await fetch(`${functionBaseUrl}/allocate-questions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify(allocatePayload),
          });

          console.log("[GeneratingQuestions] allocate-questions status:", allocateResponse.status);
          const allocateBody = await allocateResponse.text();
          console.log("[GeneratingQuestions] allocate-questions response:", allocateBody);

          if (!allocateResponse.ok) {
            throw new Error(`allocate-questions returned ${allocateResponse.status}: ${allocateBody}`);
          }

          console.log("[GeneratingQuestions] allocate-questions complete for user:", userId);
        } catch (err) {
          console.error("[GeneratingQuestions] allocate-questions failed:", err);
        }

        // Step 7: Archive sync check
        console.log("[GeneratingQuestions] Step 7: Checking archive sync...");
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

        console.log("[GeneratingQuestions] All backend operations complete, starting text animation...");

        if (!mounted) return;

               // Step 8: Start animation interval and handle transition
        const startTime = Date.now();
        let nextId = 0;
        textInterval = setInterval(() => {
          if (!mounted) {
            if (textInterval) clearInterval(textInterval);
            return;
          }

          const elapsedTime = Date.now() - startTime;

          // Spawn text blocks for first 6 seconds (leaving 2s for fade out)
          if (elapsedTime < 6000 && nextId < allTextItems.length) {
            const newBlock: TextBlock = {
              id: `text-${nextId}`,
              text: allTextItems[nextId],
              top: Math.random() * 40 + 30, // 30–70% from top
              left: Math.random() * 60 + 20, // 20–80% from left
              opacity: 0,
            };

            setTextBlocks((prev) => {
              const updated = [...prev, newBlock];

              return updated
                .map((block) => {
                  const blockElapsed =
                    elapsedTime -
                    parseInt(block.id.split("-")[1]) * TEXT_SPAWN_INTERVAL;

                  if (blockElapsed < 500) {
                    // Fade in (0–500ms)
                    return { ...block, opacity: blockElapsed / 500 };
                  } else if (blockElapsed < TEXT_LIFETIME - 500) {
                    // Fully visible (500–1500ms)
                    return { ...block, opacity: 1 };
                  } else if (blockElapsed < TEXT_LIFETIME) {
                    // Fade out (1500–2000ms)
                    return {
                      ...block,
                      opacity:
                        1 -
                        (blockElapsed - (TEXT_LIFETIME - 500)) / 500,
                    };
                  }
                  return null;
                })
                .filter((block): block is TextBlock => block !== null);
            });

            nextId++;
          }

          // ✅ Transition after 8 seconds
          if (elapsedTime >= SCREEN_DURATION) {
            console.log(
              "[GeneratingQuestions] Timer fired at",
              elapsedTime,
              "ms, clearing interval..."
            );
            if (textInterval) clearInterval(textInterval);
            if (mounted) {
              console.log(
                "[GeneratingQuestions] Transitioning to GameSelectionPage"
              );
              onComplete();
            }
          }
        }, TEXT_SPAWN_INTERVAL);
      } catch (error: any) {
        console.error("[GeneratingQuestions] Sequence error:", error);
        toast({
          title: "Setup error",
          description: "There was an issue preparing your questions",
          variant: "destructive",
        });
        if (mounted) {
          console.log(
            "[GeneratingQuestions] Error occurred, transitioning after 3 seconds"
          );
          setTimeout(() => {
            if (mounted) {
              console.log(
                "[GeneratingQuestions] Error recovery: Transitioning to GameSelectionPage"
              );
              onComplete();
            }
          }, 3000);
        }
      }
    };

    // Start the sequence
    runSequence();

    // Cleanup on unmount
    return () => {
      console.log("[GeneratingQuestions] Cleanup: unmounting component");
      mounted = false;
      if (textInterval) {
        clearInterval(textInterval);
      }
    };
  }, [userId, region, postcode]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4 transition-opacity duration-500"
      style={{ backgroundColor: '#7DAAE8', opacity: fadeIn ? 1 : 0 }}
    >
      {/* Hamster Image */}
      <div className="mb-12">
        <img
          src={HamsterImageUrl}
          alt="Hammie"
          className="w-64 h-64 object-contain"
        />
      </div>

      {/* Animated Text Blocks */}
      <div className="relative w-full h-80">
        {textBlocks.map((block) => (
          <div
            key={block.id}
            className="absolute text-white font-bold text-sm pointer-events-none transition-opacity duration-200"
            style={{
              top: `${block.top}%`,
              left: `${block.left}%`,
              opacity: block.opacity,
              transform: "translate(-50%, -50%)",
              whiteSpace: "nowrap",
            }}
          >
            {block.text}
          </div>
        ))}
      </div>

      {/* Footer Text */}
      <div className="mt-12 text-center">
        <p className="text-white font-medium text-sm">
          One moment please, Hammie is cooking up your personalised questions
        </p>
      </div>
    </div>
  );
}

