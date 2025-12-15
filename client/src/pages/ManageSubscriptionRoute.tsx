import { useEffect } from "react";
import { useLocation } from "wouter";
import { ManageSubscriptionPage } from "@/components/ManageSubscriptionPage";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { AdBanner, AdBannerContext } from "@/components/AdBanner";

export default function ManageSubscriptionRoute() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { isLoading: subLoading } = useSubscription();
  
  // Redirect if not authenticated
  useEffect(() => {
    if (authLoading) return;
    
    if (!isAuthenticated) {
      setLocation("/");
      return;
    }
  }, [authLoading, isAuthenticated, setLocation]);
  
  const handleBack = () => {
    setLocation("/");
  };
  
  if (authLoading || subLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4" />
      </div>
    );
  }
  
  return (
    <AdBannerContext.Provider value={true}>
      <ManageSubscriptionPage
        onBack={handleBack}
        onGoProClick={() => {}}
      />
      <AdBanner />
    </AdBannerContext.Provider>
  );
}
