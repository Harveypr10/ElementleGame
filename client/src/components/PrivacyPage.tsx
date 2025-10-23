import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useProfile } from "@/hooks/useProfile";
import { useState } from "react";

interface PrivacyPageProps {
  onBack: () => void;
}

export function PrivacyPage({ onBack }: PrivacyPageProps) {
  const { profile, isLoading, updateProfile } = useProfile();
  const [saving, setSaving] = useState(false);

  const handleAdsConsentChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setSaving(true);
    try {
      await updateProfile({ adsConsent: e.target.checked });
    } finally {
      setSaving(false);
    }
  };

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
            <p className="text-sm text-muted-foreground">
              Last updated: October 2025
            </p>
          </CardHeader>
          <CardContent className="space-y-6 prose dark:prose-invert max-w-none">
            <section>
              <h2 className="text-xl font-semibold mb-2">
                1. Information We Collect
              </h2>
              <p>
                When you create an account, we collect the following information
                as part of providing the game service:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Email address</li>
                <li>First and last name</li>
                <li>
                  Game progress and guess data (including your daily guesses,
                  streaks, and statistics)
                </li>
              </ul>
              <p>
                We may also collect optional information if you provide consent
                (see Section 4).
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">
                2. How We Use Your Information
              </h2>
              <p>We use your information to:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Provide and maintain the Elementle game service</li>
                <li>
                  Track your game progress, guesses, and statistics to power
                  features such as streaks and leaderboards
                </li>
                <li>
                  Send important service updates (e.g. account or security
                  notifications)
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">3. Data Storage</h2>
              <p>
                Your data is securely stored using Supabase, a trusted database
                platform. We retain your data only as long as necessary to
                provide the service or comply with legal obligations.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">
                4. Optional Data Use (Consent-Based)
              </h2>
              <p>
                With your explicit consent, we may also use your data to tailor
                advertising and promotional content to your interests. This
                consent is optional and not required to play the game. You can
                withdraw consent at any time in the app’s Settings.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">5. Data Sharing</h2>
              <p>
                We do not sell, trade, or otherwise transfer your personal
                information to third parties. Your game statistics may be
                aggregated and anonymised for global leaderboards. Advertising
                partners will only receive data if you have explicitly opted in
                under Section 4.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">6. Your Rights</h2>
              <p>Under GDPR and UK GDPR, you have the right to:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Access your personal data</li>
                <li>Request correction of inaccurate data</li>
                <li>Request deletion of your account and associated data</li>
                <li>Withdraw consent for optional data uses at any time</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">7. Contact Us</h2>
              <p>
                If you have questions about this Privacy Policy or your data
                rights, please contact us through the Feedback section in
                Settings.
              </p>
            </section>

            {/* ✅ Ads consent toggle */}
            <section className="mt-8 border-t pt-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={profile?.adsConsent ?? false}
                  onChange={handleAdsConsentChange}
                  disabled={saving}
                />
                <span>
                  I consent to my data being used to tailor ads.{" "}
                  <strong>
                    If you do not consent, your ads will not be tailored.
                  </strong>
                </span>
              </label>
            </section>
          </CardContent>
        </Card>
      </ScrollArea>
    </div>
  );
}
