import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, Loader2, ChevronLeft, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { getSupabaseClient } from '@/lib/supabaseClient';

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

export default function Subscriptions() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  
  const urlParams = new URLSearchParams(window.location.search);
  const isSuccess = urlParams.get('success') === 'true';
  const isCanceled = urlParams.get('canceled') === 'true';
  
  const [pollCount, setPollCount] = useState(0);
  const [hasShownToast, setHasShownToast] = useState(false);
  const [subscriptionFound, setSubscriptionFound] = useState(false);
  const maxPolls = 10;
  const pollInterval = 3000;

  const shouldPoll = isSuccess && 
    isAuthenticated && 
    !subscriptionFound && 
    pollCount < maxPolls;

  const { data: subscriptionStatus, isLoading } = useQuery<SubscriptionStatus>({
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
    enabled: isAuthenticated && isSuccess,
    refetchInterval: shouldPoll ? pollInterval : false,
  });

  useEffect(() => {
    if (isSuccess && subscriptionStatus?.hasActiveSubscription && !hasShownToast) {
      setSubscriptionFound(true);
      setHasShownToast(true);
      queryClient.invalidateQueries({ queryKey: ['/api/subscription'] });
      queryClient.invalidateQueries({ queryKey: ['/api/streak-saver/status'] });
      
      toast({
        title: 'Subscription Activated!',
        description: `Welcome to ${subscriptionStatus.subscription?.tierName || 'Pro'}!`,
      });
    }
  }, [subscriptionStatus, isSuccess, queryClient, toast, hasShownToast]);

  const handleBackToGame = () => {
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, '', cleanUrl);
    setLocation('/');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isSuccess) {
    const isActivated = subscriptionStatus?.hasActiveSubscription;
    const isPolling = !isActivated && pollCount < maxPolls;
    const pollingTimedOut = !isActivated && pollCount >= maxPolls;

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen flex flex-col items-center justify-center bg-background p-4"
        data-testid="subscription-success-page"
      >
        <div className="max-w-md w-full text-center space-y-6">
          {isPolling ? (
            <>
              <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto" />
              <h1 className="text-2xl font-bold text-foreground">
                Activating Your Subscription...
              </h1>
              <p className="text-muted-foreground">
                Please wait while we confirm your payment.
              </p>
            </>
          ) : isActivated ? (
            <>
              <div className="relative">
                <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
                <Crown className="h-6 w-6 text-yellow-500 absolute top-0 right-1/3 -translate-y-1" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">
                Welcome to Pro!
              </h1>
              <p className="text-muted-foreground">
                Your subscription is now active. Enjoy ad-free gameplay and unlimited personalized games!
              </p>
              <Button 
                onClick={handleBackToGame}
                className="mt-4"
                data-testid="button-back-to-game"
              >
                Start Playing
              </Button>
            </>
          ) : pollingTimedOut ? (
            <>
              <Loader2 className="h-16 w-16 text-amber-500 mx-auto" />
              <h1 className="text-2xl font-bold text-foreground">
                Processing Your Payment
              </h1>
              <p className="text-muted-foreground">
                Your payment is being processed. This may take a few moments. You can start playing and your subscription will be activated shortly.
              </p>
              <Button 
                onClick={handleBackToGame}
                className="mt-4"
                data-testid="button-back-to-game-pending"
              >
                Continue to Game
              </Button>
            </>
          ) : null}
        </div>
      </motion.div>
    );
  }

  if (isCanceled) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen flex flex-col items-center justify-center bg-background p-4"
        data-testid="subscription-canceled-page"
      >
        <div className="max-w-md w-full text-center space-y-6">
          <XCircle className="h-16 w-16 text-muted-foreground mx-auto" />
          <h1 className="text-2xl font-bold text-foreground">
            Subscription Not Completed
          </h1>
          <p className="text-muted-foreground">
            No worries! You can subscribe anytime from the settings menu.
          </p>
          <Button 
            onClick={handleBackToGame}
            className="mt-4"
            data-testid="button-back-to-game-canceled"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Game
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen flex flex-col items-center justify-center bg-background p-4"
      data-testid="subscriptions-page"
    >
      <div className="max-w-md w-full text-center space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Subscriptions</h1>
        <p className="text-muted-foreground">
          Manage your subscription from the settings menu.
        </p>
        <Button 
          onClick={handleBackToGame}
          data-testid="button-back-to-home"
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back to Game
        </Button>
      </div>
    </motion.div>
  );
}
