import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, ChevronLeft } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TermsPageProps {
  onBack: () => void;
}

export function TermsPage({ onBack }: TermsPageProps) {
  return (
    <div className="min-h-screen flex flex-col p-4">
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          data-testid="button-back-from-terms"
          className="w-14 h-14 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <ChevronLeft className="h-9 w-9 text-gray-700" />
        </button>

        <div className="flex flex-col items-center">
          <h1 className="text-4xl font-bold">Terms of Use</h1>
        </div>

        {/* Spacer to balance layout */}
        <div className="w-14" />
      </div>


      <ScrollArea className="flex-1">
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle>Terms of Use for Elementle</CardTitle>
            <p className="text-sm text-muted-foreground">Last updated: October 2025</p>
          </CardHeader>
          <CardContent className="space-y-6 prose dark:prose-invert max-w-none">
            <section>
              <h2 className="text-xl font-semibold mb-2">1. Acceptance of Terms</h2>
              <p>
                By accessing and using Elementle, you accept and agree to be bound by these Terms of Use. 
                If you do not agree to these terms, please do not use the service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">2. Use of Service</h2>
              <p>Elementle is a daily historical date-guessing puzzle game. You may:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Play as a guest with local storage only</li>
                <li>Create an account to save progress permanently</li>
                <li>Access daily puzzles and archived puzzles</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">3. User Accounts</h2>
              <p>
                When creating an account, you agree to provide accurate information and maintain the 
                security of your password. You are responsible for all activities under your account.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">4. Intellectual Property</h2>
              <p>
                All content, including puzzles, design, and code, is owned by the service provider. 
                You may not reproduce, distribute, or create derivative works without permission.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">5. User Conduct</h2>
              <p>You agree not to:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Use automated tools or bots to play the game</li>
                <li>Attempt to hack or disrupt the service</li>
                <li>Share solutions publicly before the daily puzzle expires</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">6. Limitation of Liability</h2>
              <p>
                The service is provided "as is" without warranties of any kind. We are not liable for 
                any damages arising from your use of the service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">7. Changes to Terms</h2>
              <p>
                We reserve the right to modify these terms at any time. Continued use of the service 
                constitutes acceptance of any changes.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">8. Contact</h2>
              <p>
                For questions about these Terms of Use, please contact us through the Support section in Settings.
              </p>
            </section>
          </CardContent>
        </Card>
      </ScrollArea>
    </div>
  );
}
