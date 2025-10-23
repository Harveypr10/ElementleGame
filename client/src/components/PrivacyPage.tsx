import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, ChevronLeft } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface PrivacyPageProps {
  onBack: () => void;
}

export function PrivacyPage({ onBack }: PrivacyPageProps) {
  return (
    <div className="min-h-screen flex flex-col p-4">
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          data-testid="button-back-from-privacy"
          className="w-14 h-14 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <ChevronLeft className="h-9 w-9 text-gray-700" />
        </button>

        <div className="flex flex-col items-center">
          <h1 className="text-4xl font-bold">Privacy Policy</h1>
        </div>

        {/* Spacer to balance layout */}
        <div className="w-14" />
      </div>


      <ScrollArea className="flex-1">
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle>Privacy Policy for Elementle</CardTitle>
            <p className="text-sm text-muted-foreground">Last updated: October 2025</p>
          </CardHeader>
          <CardContent className="space-y-6 prose dark:prose-invert max-w-none">
            <section>
              <h2 className="text-xl font-semibold mb-2">1. Information We Collect</h2>
              <p>When you create an account, we collect:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Email address</li>
                <li>First and last name</li>
                <li>Game progress and statistics</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">2. How We Use Your Information</h2>
              <p>We use your information to:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Provide and maintain the game service</li>
                <li>Track your game progress and statistics</li>
                <li>Send important service updates (if applicable)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">3. Data Storage</h2>
              <p>
                Your data is securely stored using Supabase, a trusted database platform. 
                Guest users' data is stored locally on their device only.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">4. Data Sharing</h2>
              <p>
                We do not sell, trade, or otherwise transfer your personal information to third parties. 
                Your game statistics may be aggregated anonymously for global leaderboards.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">5. Your Rights</h2>
              <p>You have the right to:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Access your personal data</li>
                <li>Request deletion of your account and data</li>
                <li>Opt out of data collection by playing as a guest</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">6. Contact Us</h2>
              <p>
                If you have questions about this Privacy Policy, please contact us through the Support section in Settings.
              </p>
            </section>
          </CardContent>
        </Card>
      </ScrollArea>
    </div>
  );
}
