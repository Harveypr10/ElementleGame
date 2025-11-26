import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, ChevronLeft } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAdBannerActive } from "@/components/AdBanner";
import { ScreenAdBanner } from "@/components/ScreenAdBanner";

interface AboutPageProps {
  onBack: () => void;
}

export function AboutPage({ onBack }: AboutPageProps) {
  const adBannerActive = useAdBannerActive();
  
  return (
    <div className={`min-h-screen flex flex-col p-4 ${adBannerActive ? 'pb-[50px]' : ''}`}>
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          data-testid="button-back-from-about"
          className="w-14 h-14 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <ChevronLeft className="h-9 w-9 text-gray-700" />
        </button>

        <div className="flex flex-col items-center">
          <h1 className="text-4xl font-bold">About</h1>
        </div>

        {/* Spacer to balance layout */}
        <div className="w-14" />
      </div>


      <ScrollArea className="flex-1">
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle>About Elementle</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 prose dark:prose-invert max-w-none">
            <section>
              <p>
                Elementle is a daily historical date puzzle game. Each day, you're challenged to pin down the exact date of a key event from history. You'll make guesses, get feedback, and refine your answer until you land on the correct date — or run out of tries.
              </p>
            </section>

            <section>
              <p>The game blends learning with play:</p>
              <ul className="list-none pl-0 space-y-2">
                <li>🧩 <strong>Daily Challenge</strong> – A new puzzle every day, tied to a real historical event.</li>
                <li>📚 <strong>Learn as you play</strong> – Each puzzle comes with event details, so you walk away knowing more than when you started.</li>
                <li>📊 <strong>Track your progress</strong> – Stats and streaks let you see how your knowledge (and intuition) grows over time.</li>
                <li>🎉 <strong>Celebrate wins</strong> – Animated hamster companions cheer you on when you succeed.</li>
              </ul>
            </section>

            <section>
              <p>
                Elementle is built to be fun, fair, and educational — whether you're a history buff, a casual player, or just love a good daily challenge.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">Credits</h2>
              <p>
                Elementle was created by <strong>dobl Ltd</strong>, a team dedicated to helping people get the very best from technology in ways that feel simple, engaging, and enjoyable. The game reflects that mission — blending thoughtful design, playful interaction, and a touch of curiosity to make learning history both accessible and fun.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">Privacy</h2>
              <p>
                Elementle uses Supabase authentication and stores puzzle attempts to track your progress. For details on how your data is handled, please see{" "}
                <a 
                  href="https://www.microsoft.com/en-us/privacy/privacystatement" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                  data-testid="link-privacy"
                >
                  Microsoft's privacy statement
                </a>.
              </p>
            </section>
          </CardContent>
        </Card>
      </ScrollArea>
      {adBannerActive && <ScreenAdBanner screenId="about" />}
    </div>
  );
}
