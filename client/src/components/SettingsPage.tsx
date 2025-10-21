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
}

export function SettingsPage({ onBack, onOpenOptions, onAccountInfo, onPrivacy, onTerms }: SettingsPageProps) {
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
      onClick: () => alert("About page coming soon"),
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
      await signOut();
      // Redirect to login page after sign out
      setLocation("/");
    } catch (error) {
      console.error("Error signing out:", error);
      alert("Failed to sign out. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col p-4">
      <div className="w-full max-w-md mx-auto space-y-4">
        <div className="flex items-center gap-2 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            data-testid="button-back-from-settings"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Settings</h1>
            {isAuthenticated && user && (
              <p className="text-sm text-muted-foreground" data-testid="text-settings-user-name">
                {user.user_metadata?.first_name || "User"}
              </p>
            )}
          </div>
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
