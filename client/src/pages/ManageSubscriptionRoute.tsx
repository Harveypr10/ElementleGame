import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ManageSubscriptionPage } from "@/components/ManageSubscriptionPage";
import { CategorySelectionScreen } from "@/components/CategorySelectionScreen";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { AdBanner, AdBannerContext } from "@/components/AdBanner";
import { getSupabaseClient } from "@/lib/supabaseClient";

const SUBSCRIPTION_SUCCESS_FLAG = "elementle-subscription-success-pending";

interface SubscriptionStatus {
  hasActiveSubscription: boolean;
  subscription?: {
    id: string;
    tierId: string;
    tierName: string;
    status: string;
    expiresAt: string | null;
    autoRenew: boolean;
  };
}

export default function ManageSubscriptionRoute() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading: authLoading, signOut } = useAuth();
  const { isPro, isLoading: subLoading, refetch: refetchSubscription } = useSubscription();
  
  const [showCategorySelection, setShowCategorySelection] = useState(false);
  const [isFirstTimeProFromCheckout, setIsFirstTimeProFromCheckout] = useState(false);
  const hasShownSuccessToast = useRef(false);
  
  // Polling state for subscription activation
  const [pollCount, setPollCount] = useState(0);
  const [subscriptionFound, setSubscriptionFound] = useState(false);
  const maxPolls = 10;
  const pollInterval = 3000;
  
  // Check if we have success param in URL
  const urlParams = new URLSearchParams(window.location.search);
  const isSuccess = urlParams.get("success") === "true";
  
  // Should poll while waiting for subscription to activate
  const shouldPoll = isSuccess && 
    isAuthenticated && 
    !subscriptionFound && 
    pollCount < maxPolls;
  
  // Poll for subscription status after checkout success
  const { data: subscriptionStatus, isLoading: statusLoading } = useQuery<SubscriptionStatus>({
    queryKey: ['/api/subscription/status'],
    queryFn: async () => {
      const supabase = await getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/api/subscription/status', {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to fetch subscription status');
      
      setPollCount(prev => prev + 1);
      return response.json();
    },
    enabled: isAuthenticated && isSuccess && !subscriptionFound,
    refetchInterval: shouldPoll ? pollInterval : false,
  });
  
  // When subscription is found, update state and show success
  useEffect(() => {
    if (isSuccess && subscriptionStatus?.hasActiveSubscription && !hasShownSuccessToast.current) {
      hasShownSuccessToast.current = true;
      setSubscriptionFound(true);
      
      // Invalidate subscription queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/subscription'] });
      queryClient.invalidateQueries({ queryKey: ['/api/subscription/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/streak-saver/status'] });
      
      // Refetch subscription to update isPro state
      refetchSubscription();
      
      const pendingFlag = sessionStorage.getItem(SUBSCRIPTION_SUCCESS_FLAG);
      if (!pendingFlag) {
        sessionStorage.setItem(SUBSCRIPTION_SUCCESS_FLAG, "true");
        
        toast({
          title: "Subscription successfully activated",
          description: "Welcome to Elementle Pro! Enjoy all premium features.",
        });
        
        setIsFirstTimeProFromCheckout(true);
      }
      
      // Clean up URL
      urlParams.delete("success");
      const newSearch = urlParams.toString();
      const newUrl = "/manage-subscription" + (newSearch ? "?" + newSearch : "");
      window.history.replaceState({}, document.title, newUrl);
    }
  }, [isSuccess, subscriptionStatus, queryClient, toast, refetchSubscription]);
  
  // Redirect if not authenticated
  useEffect(() => {
    if (authLoading) return;
    
    if (!isAuthenticated) {
      setLocation("/");
      return;
    }
  }, [authLoading, isAuthenticated, setLocation]);
  
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
  
  // Show spinner while polling for subscription activation
  const isPollingForActivation = isSuccess && !subscriptionFound && pollCount < maxPolls;
  const pollingTimedOut = isSuccess && !subscriptionFound && pollCount >= maxPolls;
  
  if (authLoading || subLoading || isPollingForActivation) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4" />
        {isPollingForActivation && (
          <p className="text-muted-foreground text-center">
            Activating your subscription...
          </p>
        )}
      </div>
    );
  }
  
  // Show error if polling timed out
  if (pollingTimedOut) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <p className="text-muted-foreground text-center mb-4">
          Taking longer than expected. Please refresh the page.
        </p>
        <button 
          onClick={() => window.location.reload()}
          className="text-primary underline"
        >
          Refresh
        </button>
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
