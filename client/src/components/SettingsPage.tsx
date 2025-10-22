import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, User, Settings as SettingsIcon, Mail, Info, Lock, FileText, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";

interface SettingsPageProps {
  onBack: () => void;
  onOpenOptions: () => void;
  onAccountInfo: () => void;
  onPrivacy?: () => void;
  onTerms?: () => void;
  onAbout?: () => void;
}

export function SettingsPage({ onBack, onOpenOptions, onAccountInfo, onPrivacy, onTerms, onAbout }: SettingsPageProps) {
  const { user, isAuthenticated, signOut } = useAuth();
  const [, setLocation] = useLocation();

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
    {
      icon: SettingsIcon,
      label: "Options",
      onClick: onOpenOptions,
      testId: "button-options-from-settings",
    },
    {
      icon: Mail,
      label: "Support",
      description: "Bug report & feedback",
      onClick: () => alert("Support page coming soon"),
      testId: "button-support",
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
      // Clear any cached data first
      localStorage.clear();
      
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
    <div className="min-h-screen flex flex-col p-4">
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
            <h1 className="text-4xl font-bold text-gray-700">Settings</h1>
          </div>

          {/* Spacer to balance layout */}
          <div className="w-14" />
        </div>

        <Card className="p-4 space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.label}
              onClick={item.onClick}
              className="w-full flex items-center justify-between p-3 rounded-md hover-elevate active-elevate-2 transition-colors"
              data-testid={item.testId}
            >
              <div className="flex items-center gap-3">
                <item.icon className="h-5 w-5 text-muted-foreground" />
                <div className="text-left">
                  <div className="font-medium">{item.label}</div>
                  {item.description && (
                    <div className="text-sm text-muted-foreground">{item.description}</div>
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
    </div>
  );
}
