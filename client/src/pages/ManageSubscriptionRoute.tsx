import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { ManageSubscriptionPage } from "@/components/ManageSubscriptionPage";
import { CategorySelectionScreen } from "@/components/CategorySelectionScreen";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { AdBanner, AdBannerContext } from "@/components/AdBanner";

const SUBSCRIPTION_SUCCESS_FLAG = "elementle-subscription-success-pending";

export default function ManageSubscriptionRoute() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading, signOut } = useAuth();
  const { isPro, isLoading: subLoading } = useSubscription();
  
  const [showCategorySelection, setShowCategorySelection] = useState(false);
  const [isFirstTimeProFromCheckout, setIsFirstTimeProFromCheckout] = useState(false);
  const hasShownSuccessToast = useRef(false);
  
  useEffect(() => {
    if (authLoading || subLoading) return;
    
    if (!isAuthenticated) {
      setLocation("/");
      return;
    }
    
    const urlParams = new URLSearchParams(window.location.search);
    const isSuccess = urlParams.get("success") === "true";
    
    if (isSuccess && !hasShownSuccessToast.current) {
      hasShownSuccessToast.current = true;
      
      const pendingFlag = sessionStorage.getItem(SUBSCRIPTION_SUCCESS_FLAG);
      if (!pendingFlag) {
        sessionStorage.setItem(SUBSCRIPTION_SUCCESS_FLAG, "true");
        
        toast({
          title: "Subscription successfully activated",
          description: "Welcome to Elementle Pro! Enjoy all premium features.",
        });
        
        setIsFirstTimeProFromCheckout(true);
      }
      
      urlParams.delete("success");
      const newSearch = urlParams.toString();
      const newUrl = "/manage-subscription" + (newSearch ? "?" + newSearch : "");
      window.history.replaceState({}, document.title, newUrl);
    }
  }, [authLoading, subLoading, isAuthenticated, toast, setLocation]);
  
  const handleBack = () => {
    if (isFirstTimeProFromCheckout && isPro) {
      setShowCategorySelection(true);
      setIsFirstTimeProFromCheckout(false);
    } else {
      setLocation("/");
    }
  };
  
  const handleCategoryClose = () => {
    sessionStorage.removeItem(SUBSCRIPTION_SUCCESS_FLAG);
    setShowCategorySelection(false);
    setLocation("/");
  };
  
  const handleCategoryGenerate = () => {
    sessionStorage.removeItem(SUBSCRIPTION_SUCCESS_FLAG);
    setShowCategorySelection(false);
    setLocation("/");
  };
  
  if (authLoading || subLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }
  
  return (
    <AdBannerContext.Provider value={true}>
      <ManageSubscriptionPage
        onBack={handleBack}
        onGoProClick={() => {}}
      />
      
      <CategorySelectionScreen
        isOpen={showCategorySelection}
        onClose={handleCategoryClose}
        onGenerate={handleCategoryGenerate}
      />
      
      <AdBanner />
    </AdBannerContext.Provider>
  );
}
