import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, User, Settings as SettingsIcon, Bug, MessageSquare, Info, Lock, FileText, LogOut, Crown, Grid } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { clearUserCache } from "@/lib/localCache";
import { motion } from "framer-motion";
import { pageVariants, pageTransition } from "@/lib/pageAnimations";
import { useSubscription } from "@/hooks/useSubscription";
import { ProSubscriptionDialog } from "@/components/ProSubscriptionDialog";
import { CategorySelectionScreen } from "@/components/CategorySelectionScreen";
import { GuestRestrictionPopup } from "@/components/GuestRestrictionPopup";

interface SettingsPageProps {
  onBack: () => void;
  onOpenOptions: () => void;
  onAccountInfo: () => void;
  onBugReport?: () => void;
  onFeedback?: () => void;
  onPrivacy?: () => void;
  onTerms?: () => void;
  onAbout?: () => void;
  onSignOut?: () => void;
  onLogin?: () => void;
  onRegister?: () => void;
}

export function SettingsPage({ onBack, onOpenOptions, onAccountInfo, onBugReport, onFeedback, onPrivacy, onTerms, onAbout, onSignOut, onLogin, onRegister }: SettingsPageProps) {
  const { user, isAuthenticated, signOut } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { subscription, isPro, isLoading: subscriptionLoading } = useSubscription();
  const [showProDialog, setShowProDialog] = useState(false);
  const [showCategorySelection, setShowCategorySelection] = useState(false);
  const [showGuestRestriction, setShowGuestRestriction] = useState(false);
  
  // Subscription-related items - show Go Pro for all users (including guests)
  const subscriptionItems = [
    {
      icon: Crown,
      label: isPro ? "Pro" : "Go Pro",
      inlineLabel: isPro ? "Manage your subscription" : null,
      sublabel: !isPro ? "Remove ads & customize categories" : null,
      onClick: () => setShowProDialog(true),
      testId: "button-subscription",
      highlight: !isPro,
      proItem: isPro,
    },
    ...(isPro ? [{
      icon: Grid,
      label: "Select Categories",
      inlineLabel: null,
      sublabel: null,
      onClick: () => setShowCategorySelection(true),
      testId: "button-select-categories",
      highlight: false,
      proItem: true,
    }] : []),
  ];
  
  const menuItems = [
    {
      icon: User,
      label: "Account Info",
      onClick: () => {
        if (isAuthenticated && user) {
          onAccountInfo();
        } else {
          setShowGuestRestriction(true);
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
      
      // Navigate to login screen using callback (if provided) or fallback to reload
      if (onSignOut) {
        onSignOut();
      } else {
        window.location.href = "/";
      }
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
          {menuItems.map((item) => {
            const isProItem = (item as any).proItem;
            const inlineLabel = (item as any).inlineLabel;
            const sublabel = (item as any).sublabel;
            const highlight = (item as any).highlight;
            
            return (
              <button
                key={item.label}
                onClick={item.onClick}
                className={`w-full flex items-center justify-between p-3 rounded-md transition-colors ${
                  isProItem 
                    ? "bg-gradient-to-r from-orange-400 to-orange-500 text-white hover:from-orange-500 hover:to-orange-600" 
                    : highlight 
                      ? "bg-amber-50 dark:bg-amber-950/30 hover-elevate active-elevate-2" 
                      : "hover-elevate active-elevate-2"
                }`}
                data-testid={item.testId}
              >
                <div className="flex items-center gap-3">
                  <item.icon className={`h-5 w-5 ${
                    isProItem ? "text-white" : highlight ? "text-amber-500" : "text-muted-foreground"
                  }`} />
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${isProItem ? "text-white" : ""}`}>{item.label}</span>
                    {inlineLabel && (
                      <span className={`text-sm ${isProItem ? "text-white/90" : "text-muted-foreground"}`}>{inlineLabel}</span>
                    )}
                  </div>
                  {sublabel && (
                    <div className="text-sm text-muted-foreground ml-0">{sublabel}</div>
                  )}
                </div>
                <ChevronRight className={`h-5 w-5 ${isProItem ? "text-white" : "text-muted-foreground"}`} />
              </button>
            );
          })}
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
        isOpen={showProDialog}
        onClose={() => setShowProDialog(false)}
        onSuccess={() => setShowProDialog(false)}
      />
      
      {/* Category Selection Screen (for Pro users) */}
      <CategorySelectionScreen
        isOpen={showCategorySelection}
        onClose={() => setShowCategorySelection(false)}
        onGenerate={() => setShowCategorySelection(false)}
        isRegeneration={true}
      />
      
      {/* Guest Restriction Popup for Account Info */}
      <GuestRestrictionPopup
        isOpen={showGuestRestriction}
        type="personal"
        onClose={() => setShowGuestRestriction(false)}
        onRegister={() => {
          setShowGuestRestriction(false);
          if (onRegister) onRegister();
        }}
        onLogin={() => {
          setShowGuestRestriction(false);
          if (onLogin) onLogin();
        }}
      />
    </div>
  );
}
