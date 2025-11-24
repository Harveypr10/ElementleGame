import { useState, useEffect } from "react";
import { useSupabase } from "@/lib/SupabaseProvider";
import { useToast } from "@/hooks/use-toast";
import HamsterImageUrl from "@assets/generated_images/Hamster_logo_icon_5c761af3.png";

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

  useEffect(() => {
    let mounted = true;
    let textInterval: NodeJS.Timeout | null = null;
    const SCREEN_DURATION = 8000; // 8 seconds
    const TEXT_LIFETIME = 2000; // 2 seconds per text block
    const TEXT_SPAWN_INTERVAL = 1000; // new text every 1 second

    const runSequence = async () => {
      try {
        console.log("[GeneratingQuestions] Starting sequence...");
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("No session found");

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
        console.log("[GeneratingQuestions] Step 2: Polling for location allocation...");
        let locations: Array<{ location_id: number; weighted_score: number }> = [];
        for (let i = 0; i < 20; i++) {
          try {
            const { data } = await supabase
              .from("location_allocation")
              .select("location_id, weighted_score")
              .eq("user_id", userId)
              .order("weighted_score", { ascending: false });

            if (data && data.length > 0) {
              locations = data as Array<{ location_id: number; weighted_score: number }>;
              console.log(
                "[GeneratingQuestions] Found locations:",
                locations.length
              );
              break;
            }
          } catch (pollErr) {
            console.error("[GeneratingQuestions] Poll attempt failed:", pollErr);
          }
          await new Promise((r) => setTimeout(r, 500));
        }

        // Step 3: Fetch location names for displaying
        console.log("[GeneratingQuestions] Step 3: Fetching location names...");
        let locationNames: string[] = [];
        if (locations.length > 0) {
          try {
            const locationIds = locations.map((l) => l.location_id);
            const { data: locData } = await supabase
              .from("locations")
              .select("location_name")
              .in("id", locationIds);

            if (locData) {
              locationNames = locData.map((l) => l.location_name + "...");
            }
            console.log("[GeneratingQuestions] Fetched location names:", locationNames.length);
          } catch (err) {
            console.error("[GeneratingQuestions] Fetch location names failed:", err);
          }
        }

        // Step 4: Fetch event titles
        console.log("[GeneratingQuestions] Step 4: Fetching event titles...");
        let eventTitles: string[] = [];
        try {
          const { data: eventData } = await supabase
            .from("questions_master_region")
            .select("event_title")
            .eq("region", region)
            .limit(20);

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

        // Step 5: Call calculate-demand
        console.log("[GeneratingQuestions] Step 5: Calling calculate-demand...");
        const accessToken = session.access_token;
        if (!accessToken) throw new Error("No access token found");
        
        try {
          const demandResponse = await fetch("/functions/v1/calculate-demand", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              user_id: userId,
              region: region,
            }),
          });
          if (!demandResponse.ok) {
            throw new Error(`calculate-demand returned ${demandResponse.status}`);
          }
          console.log("[GeneratingQuestions] calculate-demand complete");
        } catch (err) {
          console.error("[GeneratingQuestions] calculate-demand failed:", err);
        }

        // Step 6: Call allocate-questions
        console.log("[GeneratingQuestions] Step 6: Calling allocate-questions...");
        try {
          const allocateResponse = await fetch("/functions/v1/allocate-questions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              user_id: userId,
              region: region,
            }),
          });
          if (!allocateResponse.ok) {
            throw new Error(`allocate-questions returned ${allocateResponse.status}`);
          }
          console.log("[GeneratingQuestions] allocate-questions complete");
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

        // Start animation interval
        const startTime = Date.now();
        let nextId = 0;
        textInterval = setInterval(() => {
          if (!mounted) {
            if (textInterval) clearInterval(textInterval);
            return;
          }

          const elapsedTime = Date.now() - startTime;

          // Stop spawning text after 6 seconds (leaving 2 seconds for last items to fade out)
          if (elapsedTime < 6000 && nextId < allTextItems.length) {
            const newBlock: TextBlock = {
              id: `text-${nextId}`,
              text: allTextItems[nextId],
              top: Math.random() * 40 + 30, // 30-70% from top
              left: Math.random() * 60 + 20, // 20-80% from left
              opacity: 0, // Will fade in
            };

            setTextBlocks((prev) => {
              // Fade in new block
              const updated = [...prev, newBlock];

              // Fade out and remove old blocks
              return updated
                .map((block) => {
                  const blockElapsed = elapsedTime - parseInt(block.id.split("-")[1]) * TEXT_SPAWN_INTERVAL;

                  if (blockElapsed < 500) {
                    // Fade in (0-500ms)
                    return { ...block, opacity: blockElapsed / 500 };
                  } else if (blockElapsed < TEXT_LIFETIME - 500) {
                    // Fully visible (500ms - 1500ms)
                    return { ...block, opacity: 1 };
                  } else if (blockElapsed < TEXT_LIFETIME) {
                    // Fade out (1500ms - 2000ms)
                    return {
                      ...block,
                      opacity: 1 - (blockElapsed - (TEXT_LIFETIME - 500)) / 500,
                    };
                  }
                  return null;
                })
                .filter((block): block is TextBlock => block !== null);
            });

            nextId++;
          }

          // Check if we should transition (8 seconds elapsed)
          if (elapsedTime >= SCREEN_DURATION) {
            console.log("[GeneratingQuestions] Timer fired at", elapsedTime, "ms, clearing interval...");
            if (textInterval) clearInterval(textInterval);
            if (mounted) {
              console.log("[GeneratingQuestions] Transitioning to GameSelectionPage");
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
          console.log("[GeneratingQuestions] Error occurred, transitioning after 3 seconds");
          setTimeout(() => {
            if (mounted) {
              console.log("[GeneratingQuestions] Error recovery: Transitioning to GameSelectionPage");
              onComplete();
            }
          }, 3000);
        }
      }
    };

    // Start the sequence
    runSequence();

    // Return cleanup function
    return () => {
      console.log("[GeneratingQuestions] Cleanup: unmounting component");
      mounted = false;
      if (textInterval) {
        clearInterval(textInterval);
      }
    };
  }, [userId, region, postcode, supabase, toast, onComplete]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-300 to-blue-400 dark:from-blue-900 dark:to-blue-800 p-4">
      {/* Hamster Image */}
      <div className="mb-12">
        <img
          src={HamsterImageUrl}
          alt="Hammie"
          className="w-32 h-32 object-contain"
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
