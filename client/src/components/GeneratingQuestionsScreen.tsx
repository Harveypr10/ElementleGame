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
    const startTime = Date.now();
    const SCREEN_DURATION = 8000; // 8 seconds
    const TEXT_LIFETIME = 2000; // 2 seconds per text block
    const TEXT_SPAWN_INTERVAL = 1000; // new text every 1 second

    const runSequence = async () => {
      try {
        const { data: session } = await supabase.auth.getSession();
        if (!session) throw new Error("No session found");

        // Step 1: Populate user locations
        console.log("[GeneratingQuestions] Populating user locations...");
        await supabase.rpc("populate_user_locations", {
          p_user_id: userId,
          p_postcode: postcode,
        });

        // Step 2: Poll location_allocation until rows exist
        console.log("[GeneratingQuestions] Polling for location allocation...");
        let locations: Array<{ location_id: number; weighted_score: number }> = [];
        for (let i = 0; i < 20; i++) {
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
          await new Promise((r) => setTimeout(r, 500));
        }

        // Step 3: Fetch location names for displaying
        let locationNames: string[] = [];
        if (locations.length > 0) {
          const locationIds = locations.map((l) => l.location_id);
          const { data: locData } = await supabase
            .from("locations")
            .select("location_name")
            .in("id", locationIds);

          if (locData) {
            locationNames = locData.map((l) => l.location_name + "...");
          }
        }

        // Step 4: Fetch event titles
        console.log("[GeneratingQuestions] Fetching event titles...");
        const { data: eventData } = await supabase
          .from("questions_master_region")
          .select("event_title")
          .eq("region", region)
          .limit(20);

        const eventTitles = eventData
          ? eventData.map((e) => e.event_title + "...")
          : [];

        // Combine all text items
        const allTextItems = [...eventTitles, ...locationNames].filter(
          (item) => item
        );

        // Step 5: Call calculate-demand and allocate-questions (runs in parallel)
        console.log("[GeneratingQuestions] Starting demand/allocation...");
        const accessToken = (session.session as any)?.access_token;
        if (!accessToken) throw new Error("No access token found");
        
        await Promise.all([
          fetch("/functions/v1/calculate-demand", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              user_id: userId,
              region: region,
            }),
          }),
          fetch("/functions/v1/allocate-questions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              user_id: userId,
              region: region,
            }),
          }),
        ]);

        console.log("[GeneratingQuestions] Demand/allocation complete");

        // Step 6: Archive sync check
        console.log("[GeneratingQuestions] Checking archive sync...");
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
          console.log("[GeneratingQuestions] Updating archive_synced_count");
          await supabase
            .from("user_profiles")
            .update({ archive_synced_count: allocatedCount })
            .eq("id", userId);
        }

        // Animate text blocks
        let nextId = 0;
        const textInterval = setInterval(() => {
          if (!mounted) {
            clearInterval(textInterval);
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

          // Check if we should transition
          if (elapsedTime >= SCREEN_DURATION) {
            clearInterval(textInterval);
            if (mounted) {
              onComplete();
            }
          }
        }, TEXT_SPAWN_INTERVAL);

        return () => {
          clearInterval(textInterval);
        };
      } catch (error: any) {
        console.error("[GeneratingQuestions] Error:", error);
        toast({
          title: "Setup error",
          description: "There was an issue preparing your questions",
          variant: "destructive",
        });
        if (mounted) {
          setTimeout(() => onComplete(), 3000); // Still transition after 3s
        }
      }
    };

    const cleanup = runSequence();

    return () => {
      mounted = false;
      cleanup?.then((fn) => fn?.());
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
