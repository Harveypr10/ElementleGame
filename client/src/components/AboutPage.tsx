import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AboutPageProps {
  onBack: () => void;
}

export function AboutPage({ onBack }: AboutPageProps) {
  return (
    <div className="min-h-screen flex flex-col p-4">
      <div className="flex items-center gap-2 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          data-testid="button-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">About Elementle</h1>
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
    </div>
  );
}
