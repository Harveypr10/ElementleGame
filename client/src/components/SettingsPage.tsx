import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, User, Settings as SettingsIcon, Bug, MessageSquare, Info, Lock, FileText, LogOut, Crown, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { clearUserCache } from "@/lib/localCache";
import { motion } from "framer-motion";
import { pageVariants, pageTransition } from "@/lib/pageAnimations";
import { useSubscription } from "@/hooks/useSubscription";
import { ProSubscriptionDialog } from "@/components/ProSubscriptionDialog";
import { CategorySelectionScreen } from "@/components/CategorySelectionScreen";

interface SettingsPageProps {
  onBack: () => void;
  onOpenOptions: () => void;
  onAccountInfo: () => void;
  onBugReport?: () => void;
  onFeedback?: () => void;
  onPrivacy?: () => void;
  onTerms?: () => void;
  onAbout?: () => void;
}

export function SettingsPage({ onBack, onOpenOptions, onAccountInfo, onBugReport, onFeedback, onPrivacy, onTerms, onAbout }: SettingsPageProps) {
  const { user, isAuthenticated, signOut } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { subscription, isPro, isLoading: subscriptionLoading } = useSubscription();
  const [showProDialog, setShowProDialog] = useState(false);
  const [showCategorySelection, setShowCategorySelection] = useState(false);
  
  // Get subscription tier display name
  const getTierDisplayName = () => {
    if (!isPro) return "Free";
    switch (subscription?.tier) {
      case "bronze": return "Bronze";
      case "silver": return "Silver";
      case "gold": return "Gold";
      default: return "Pro";
    }
  };

  // Subscription-related items (only for authenticated users)
  const subscriptionItems = isAuthenticated ? [
    {
      icon: Crown,
      label: isPro ? `Subscription (${getTierDisplayName()})` : "Go Pro",
      sublabel: isPro ? "Manage your subscription" : "Remove ads & customize categories",
      onClick: () => setShowProDialog(true),
      testId: "button-subscription",
      highlight: !isPro, // Highlight if not Pro
    },
    ...(isPro ? [{
      icon: RefreshCw,
      label: "Regenerate Questions",
      sublabel: "Choose new categories for your puzzles",
      onClick: () => setShowCategorySelection(true),
      testId: "button-regenerate-questions",
    }] : []),
  ] : [];
  
  const menuItems = [
    {
      icon: User,
      label: "Account Info",
      onClick: () => {
        if (isAuthenticated && user) {
          onAccountInfo();
        } else {
          alert("Please sign in to view account info");
        }
      },
      testId: "button-account-info",
    },
    ...subscriptionItems,
    {
      icon: SettingsIcon,
      label: "Options",
      onClick: onOpenOptions,
      testId: "button-options-from-settings",
    },
    {
      icon: Bug,
      label: "Report a Bug",
      onClick: onBugReport || (() => alert("Bug report coming soon")),
      testId: "button-bug-report",
    },
    {
      icon: MessageSquare,
      label: "Feedback",
      onClick: onFeedback || (() => alert("Feedback form coming soon")),
      testId: "button-feedback",
    },
    {
      icon: Info,
      label: "About",
      onClick: onAbout || (() => alert("About page coming soon")),
      testId: "button-about",
    },
    {
      icon: Lock,
      label: "Privacy",
      onClick: onPrivacy || (() => alert("Privacy page coming soon")),
      testId: "button-privacy",
    },
    {
      icon: FileText,
      label: "Terms",
      onClick: onTerms || (() => alert("Terms page coming soon")),
      testId: "button-terms",
    },
  ];

  const handleSignOut = async () => {
    try {
      // Clear user-specific cached data from localStorage
      clearUserCache();
      
      // Clear ALL React Query caches to prevent data leaks between users
      // Using clear() removes all cached data, not just invalidating it
      queryClient.clear();
      
      // Sign out from Supabase
      await signOut();
      
      // Immediately redirect to login page
      window.location.href = "/";
    } catch (error) {
      console.error("Error signing out:", error);
      alert("Failed to sign out. Please try again.");
    }
  };

  return (
    <div 
      className="min-h-screen flex flex-col p-4 pb-[60px]"
    >
      <div className="w-full max-w-md mx-auto space-y-4">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={onBack}
            data-testid="button-back-from-settings"
            className="w-14 h-14 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <ChevronLeft className="h-9 w-9 text-gray-700" />
          </button>

          <div className="flex flex-col items-center">
            <h1 className="text-4xl font-bold">Settings</h1>
          </div>

          {/* Spacer to balance layout */}
          <div className="w-14" />
        </div>

        <Card className="p-4 space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.label}
              onClick={item.onClick}
              className={`w-full flex items-center justify-between p-3 rounded-md hover-elevate active-elevate-2 transition-colors ${
                (item as any).highlight ? "bg-amber-50 dark:bg-amber-950/30" : ""
              }`}
              data-testid={item.testId}
            >
              <div className="flex items-center gap-3">
                <item.icon className={`h-5 w-5 ${(item as any).highlight ? "text-amber-500" : "text-muted-foreground"}`} />
                <div className="text-left">
                  <div className="font-medium">{item.label}</div>
                  {(item as any).sublabel && (
                    <div className="text-sm text-muted-foreground">{(item as any).sublabel}</div>
                  )}
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
          ))}
        </Card>

        {isAuthenticated && (
          <Button
            variant="destructive"
            className="w-full"
            onClick={handleSignOut}
            data-testid="button-sign-out"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        )}
      </div>
      
      {/* Pro Subscription Dialog */}
      <ProSubscriptionDialog
        open={showProDialog}
        onOpenChange={setShowProDialog}
      />
      
      {/* Category Selection Screen (for Pro users) */}
      {showCategorySelection && user && (
        <div className="fixed inset-0 z-50 bg-background">
          <CategorySelectionScreen
            userId={user.id}
            selectedCategories={[]}
            onComplete={() => setShowCategorySelection(false)}
            onBack={() => setShowCategorySelection(false)}
          />
        </div>
      )}
    </div>
  );
}
