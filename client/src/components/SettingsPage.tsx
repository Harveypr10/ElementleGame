import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, User, Settings as SettingsIcon, Bug, MessageSquare, Info, Lock, FileText, LogOut, Crown, Grid, Shield, Flame } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { clearUserCache } from "@/lib/localCache";
import { motion } from "framer-motion";
import { pageVariants, pageTransition } from "@/lib/pageAnimations";
import { useSubscription } from "@/hooks/useSubscription";
import { useCategoryRestriction } from "@/hooks/useCategoryRestriction";
import { ProSubscriptionDialog } from "@/components/ProSubscriptionDialog";
import { CategorySelectionScreen } from "@/components/CategorySelectionScreen";
import { GuestRestrictionPopup } from "@/components/GuestRestrictionPopup";
import { useAdBannerActive } from "@/components/AdBanner";
import { AdminPage } from "@/components/AdminPage";
import { ManageSubscriptionPage } from "@/components/ManageSubscriptionPage";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogAction } from "@/components/ui/alert-dialog";

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
  const { profile } = useProfile();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { subscription, isPro, isLoading: subscriptionLoading } = useSubscription();
  const { isChecking: categoryRestrictionChecking, isRestricted: categoryRestricted, restrictionMessage: categoryRestrictionMessage } = useCategoryRestriction();
  const adBannerActive = useAdBannerActive();
  const [showProDialog, setShowProDialog] = useState(false);
  const [showCategorySelection, setShowCategorySelection] = useState(false);
  const [showGuestRestriction, setShowGuestRestriction] = useState(false);
  const [showGuestRestrictionPro, setShowGuestRestrictionPro] = useState(false);
  const [showAdminPage, setShowAdminPage] = useState(false);
  const [showManageSubscription, setShowManageSubscription] = useState(false);
  const [showCategoryRestrictionPopup, setShowCategoryRestrictionPopup] = useState(false);
  
  const isAdmin = profile?.isAdmin === true;
  
  const handleCategorySelectionClick = () => {
    if (categoryRestricted) {
      setShowCategoryRestrictionPopup(true);
    } else {
      setShowCategorySelection(true);
    }
  };
  
  // Subscription-related items - show Go Pro for all users (including guests)
  const subscriptionItems = [
    {
      icon: Crown,
      label: isPro ? "Pro" : "Go Pro",
      inlineLabel: isPro ? "Manage your subscription" : null,
      sublabel: !isPro ? "Remove ads & customize categories" : null,
      onClick: () => {
        if (isAuthenticated && user) {
          if (isPro) {
            setShowManageSubscription(true);
          } else {
            setShowProDialog(true);
          }
        } else {
          setShowGuestRestrictionPro(true);
        }
      },
      testId: "button-subscription",
      highlight: !isPro,
      proItem: isPro,
      disabled: false,
    },
    ...(isPro ? [{
      icon: Grid,
      label: "Select Categories",
      inlineLabel: null,
      sublabel: null,
      onClick: handleCategorySelectionClick,
      testId: "button-select-categories",
      highlight: false,
      proItem: true,
      disabled: categoryRestrictionChecking,
    }] : []),
    ...(!isPro && isAuthenticated ? [{
      icon: Flame,
      label: "Streak Saver",
      inlineLabel: null,
      sublabel: null,
      onClick: () => setShowManageSubscription(true),
      testId: "button-streak-saver",
      highlight: false,
      proItem: false,
      disabled: false,
    }] : []),
  ];
  
  // Admin menu item - only visible for admin users
  const adminItems = isAdmin ? [{
    icon: Shield,
    label: "Admin",
    onClick: () => setShowAdminPage(true),
    testId: "button-admin",
    adminItem: true,
  }] : [];

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
    ...adminItems,
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

  // Show AdminPage if selected
  if (showAdminPage) {
    return <AdminPage onBack={() => setShowAdminPage(false)} />;
  }

  // Show ManageSubscriptionPage if selected
  if (showManageSubscription) {
    return (
      <ManageSubscriptionPage 
        onBack={() => setShowManageSubscription(false)}
        onGoProClick={() => {
          setShowManageSubscription(false);
          setShowProDialog(true);
        }}
      />
    );
  }

  return (
    <div 
      className={`min-h-screen flex flex-col p-4 ${adBannerActive ? 'pb-[50px]' : ''}`}
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
            const isAdminItem = (item as any).adminItem;
            const inlineLabel = (item as any).inlineLabel;
            const sublabel = (item as any).sublabel;
            const highlight = (item as any).highlight;
            const isDisabled = (item as any).disabled;
            
            return (
              <button
                key={item.label}
                onClick={item.onClick}
                disabled={isDisabled}
                className={`w-full flex items-center justify-between p-3 rounded-md transition-colors ${
                  isDisabled 
                    ? "opacity-50 cursor-not-allowed" 
                    : ""
                } ${
                  isAdminItem
                    ? "bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700"
                    : isProItem 
                      ? "bg-gradient-to-r from-orange-400 to-orange-500 text-white hover:from-orange-500 hover:to-orange-600" 
                      : highlight 
                        ? "bg-amber-50 dark:bg-amber-950/30 hover-elevate active-elevate-2" 
                        : "hover-elevate active-elevate-2"
                }`}
                data-testid={item.testId}
              >
                <div className="flex items-center gap-3 flex-1">
                  <item.icon className={`h-5 w-5 flex-shrink-0 ${
                    isAdminItem ? "text-white" : isProItem ? "text-white" : highlight ? "text-amber-500" : "text-muted-foreground"
                  }`} />
                  <span className={`font-medium whitespace-nowrap ${isAdminItem || isProItem ? "text-white" : ""}`}>{item.label}</span>
                  {inlineLabel && (
                    <span className={`text-sm ${isAdminItem || isProItem ? "text-white/90" : "text-muted-foreground"}`}>{inlineLabel}</span>
                  )}
                  {sublabel && (
                    <div className={`flex-1 flex justify-center`}>
                      <div className={`text-sm max-w-[150px] text-center ${isAdminItem || isProItem ? "text-white/90" : "text-muted-foreground"}`}>{sublabel}</div>
                    </div>
                  )}
                </div>
                <ChevronRight className={`h-5 w-5 flex-shrink-0 ${isAdminItem || isProItem ? "text-white" : "text-muted-foreground"}`} />
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
      
      {/* Guest Restriction Popup for Go Pro */}
      <GuestRestrictionPopup
        isOpen={showGuestRestrictionPro}
        type="pro"
        onClose={() => setShowGuestRestrictionPro(false)}
        onRegister={() => {
          setShowGuestRestrictionPro(false);
          if (onRegister) onRegister();
        }}
        onLogin={() => {
          setShowGuestRestrictionPro(false);
          if (onLogin) onLogin();
        }}
      />
      
      {/* Category Restriction Popup */}
      <AlertDialog open={showCategoryRestrictionPopup} onOpenChange={setShowCategoryRestrictionPopup}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Categories Recently Updated</AlertDialogTitle>
            <AlertDialogDescription>
              {categoryRestrictionMessage || "You cannot update your categories at this time."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowCategoryRestrictionPopup(false)}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
