import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { StreakSaverPopup } from "./StreakSaverPopup";
import { BadgeCelebrationPopup } from "./badges/BadgeCelebrationPopup";
import { GuestRestrictionPopup } from "./GuestRestrictionPopup";
import { GeneratingQuestionsScreen } from "./GeneratingQuestionsScreen";
import { IntroScreen } from "./IntroScreen";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import type { UserBadgeWithDetails } from "@shared/schema";

interface AdminScreenNavigatorProps {
  onBack: () => void;
}

const MOCK_BADGE: UserBadgeWithDetails = {
  id: 1,
  userId: "test",
  badge: {
    id: 1,
    name: "Test Badge",
    category: "streak",
    threshold: 7,
    createdAt: null,
    iconUrl: "/assets/badges/streak-7.png",
  },
  isAwarded: true,
  awardedAt: new Date(),
};

export function AdminScreenNavigator({ onBack }: AdminScreenNavigatorProps) {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [activeScreen, setActiveScreen] = useState<string | null>(null);
  const [selectedGameType, setSelectedGameType] = useState<"region" | "user">("region");

  const handleClose = () => setActiveScreen(null);
  const handleBack = () => {
    if (activeScreen) {
      setActiveScreen(null);
    } else {
      onBack();
    }
  };

  if (activeScreen === "streak-saver-region" || activeScreen === "streak-saver-user") {
    const gameType = activeScreen === "streak-saver-region" ? "region" : "user";
    return (
      <div className="fixed inset-0 bg-background flex flex-col z-50">
        <div className="flex items-center justify-between p-4 border-b">
          <h1 className="text-lg font-bold">Streak Saver Popup - {gameType === "region" ? "Global" : "Personal"}</h1>
          <button
            onClick={handleBack}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            data-testid="button-back"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <StreakSaverPopup
            open={true}
            onClose={handleClose}
            gameType={gameType}
            currentStreak={15}
            onPlayYesterdaysPuzzle={() => {}}
          />
        </div>
      </div>
    );
  }

  if (activeScreen === "badge-celebration-region" || activeScreen === "badge-celebration-user") {
    return (
      <div className="fixed inset-0 bg-background flex flex-col z-50">
        <div className="flex items-center justify-between p-4 border-b">
          <h1 className="text-lg font-bold">Badge Celebration - {activeScreen === "badge-celebration-region" ? "Global" : "Personal"}</h1>
          <button
            onClick={handleBack}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            data-testid="button-back"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <BadgeCelebrationPopup
            badge={MOCK_BADGE}
            onDismiss={handleClose}
          />
        </div>
      </div>
    );
  }

  if (activeScreen === "guest-restriction-archive" || activeScreen === "guest-restriction-personal" || activeScreen === "guest-restriction-pro") {
    const typeMap = {
      "guest-restriction-archive": "archive" as const,
      "guest-restriction-personal": "personal" as const,
      "guest-restriction-pro": "pro" as const,
    };
    const type = typeMap[activeScreen as keyof typeof typeMap];
    const titles = { archive: "Archive", personal: "Personal", pro: "Pro" };
    
    return (
      <div className="fixed inset-0 bg-background flex flex-col z-50">
        <div className="flex items-center justify-between p-4 border-b">
          <h1 className="text-lg font-bold">Guest Restriction - {titles[type]}</h1>
          <button
            onClick={handleBack}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            data-testid="button-back"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        </div>
        <div className="flex-1">
          <GuestRestrictionPopup
            isOpen={true}
            type={type}
            onClose={handleClose}
            onRegister={() => {}}
            onLogin={() => {}}
          />
        </div>
      </div>
    );
  }

  if (activeScreen === "generating-questions-region" || activeScreen === "generating-questions-user") {
    if (!user || !profile) {
      return (
        <div className="fixed inset-0 bg-background flex flex-col z-50">
          <div className="flex items-center justify-between p-4 border-b">
            <h1 className="text-lg font-bold">Generating Questions</h1>
            <button
              onClick={handleBack}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              data-testid="button-back"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      );
    }
    
    return (
      <div className="fixed inset-0 bg-background flex flex-col z-50">
        <div className="flex items-center justify-between p-4 border-b">
          <h1 className="text-lg font-bold">Generating Questions - {activeScreen === "generating-questions-region" ? "Global" : "Personal"}</h1>
          <button
            onClick={handleBack}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            data-testid="button-back"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        </div>
        <div className="flex-1">
          <GeneratingQuestionsScreen
            userId={user.id}
            region={profile.region || "UK"}
            postcode={profile.postcode ?? ""}
            onComplete={handleClose}
            regenerationType="first_login"
          />
        </div>
      </div>
    );
  }

  if (activeScreen === "intro-region" || activeScreen === "intro-user") {
    return (
      <div className="fixed inset-0 bg-background flex flex-col z-50">
        <div className="flex items-center justify-between p-4 border-b">
          <h1 className="text-lg font-bold">Intro Screen - {activeScreen === "intro-region" ? "Global" : "Personal"}</h1>
          <button
            onClick={handleBack}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            data-testid="button-back"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        </div>
        <div className="flex-1">
          <IntroScreen
            puzzleDateCanonical="2024-12-05"
            eventTitle="Test Historical Event"
            hasCluesEnabled={true}
            isLocalMode={activeScreen === "intro-user"}
            categoryName={activeScreen === "intro-user" ? "Science" : undefined}
            locationName={activeScreen === "intro-user" ? "London" : undefined}
            onPlayClick={handleClose}
            onBack={handleBack}
            formatDateForDisplay={(date) => date}
            currentStreak={5}
            isStreakGame={true}
          />
        </div>
      </div>
    );
  }

  // Main menu
  return (
    <div className="fixed inset-0 bg-background flex flex-col z-50">
      <div className="flex items-center justify-between p-4 border-b">
        <h1 className="text-lg font-bold">Admin Screen Navigator</h1>
        <button
          onClick={onBack}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          data-testid="button-back"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-3 max-w-2xl">
          <div className="space-y-2">
            <h2 className="font-semibold text-sm text-muted-foreground">Streak Saver</h2>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => setActiveScreen("streak-saver-region")}
                data-testid="button-streak-saver-region"
              >
                Global Streak Saver
              </Button>
              <Button
                variant="outline"
                onClick={() => setActiveScreen("streak-saver-user")}
                data-testid="button-streak-saver-user"
              >
                Personal Streak Saver
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="font-semibold text-sm text-muted-foreground">Badge Celebration</h2>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => setActiveScreen("badge-celebration-region")}
                data-testid="button-badge-region"
              >
                Global Badge Celebration
              </Button>
              <Button
                variant="outline"
                onClick={() => setActiveScreen("badge-celebration-user")}
                data-testid="button-badge-user"
              >
                Personal Badge Celebration
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="font-semibold text-sm text-muted-foreground">Guest Restriction Popup</h2>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                onClick={() => setActiveScreen("guest-restriction-archive")}
                data-testid="button-guest-archive"
              >
                Archive
              </Button>
              <Button
                variant="outline"
                onClick={() => setActiveScreen("guest-restriction-personal")}
                data-testid="button-guest-personal"
              >
                Personal
              </Button>
              <Button
                variant="outline"
                onClick={() => setActiveScreen("guest-restriction-pro")}
                data-testid="button-guest-pro"
              >
                Pro
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="font-semibold text-sm text-muted-foreground">Generating Questions Screen</h2>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => setActiveScreen("generating-questions-region")}
                data-testid="button-generating-region"
              >
                Global Generating
              </Button>
              <Button
                variant="outline"
                onClick={() => setActiveScreen("generating-questions-user")}
                data-testid="button-generating-user"
              >
                Personal Generating
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="font-semibold text-sm text-muted-foreground">Intro Screen</h2>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => setActiveScreen("intro-region")}
                data-testid="button-intro-region"
              >
                Global Intro
              </Button>
              <Button
                variant="outline"
                onClick={() => setActiveScreen("intro-user")}
                data-testid="button-intro-user"
              >
                Personal Intro
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
