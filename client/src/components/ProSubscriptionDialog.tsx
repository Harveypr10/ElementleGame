import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Check, Crown, Sparkles, Star, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import signupHamsterGrey from '@assets/Signup-Hamster-Grey.svg';

interface ProSubscriptionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (tierName: string) => void;
  onLoginRequired?: () => void;
}

// Tier data from user_tier table
interface TierData {
  id: string;
  region: string;
  tier: string;
  subscriptionCost: number | null;
  currency: string | null;
  subscriptionDurationMonths: number | null;
  streakSavers: number;
  holidaySavers: number;
  holidayDurationDays: number;
  description: string | null;
  sortOrder: number;
}

// Helper to format price
function formatPrice(amount: number | null, currency: string | null): string {
  if (amount === null) return 'Free';
  const symbol = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : currency || '';
  return `${symbol}${parseFloat(String(amount)).toFixed(2)}`;
}

// Get icon and styling based on tier type
function getTierStyle(tierName: string) {
  switch (tierName) {
    case 'pro_monthly':
      return { 
        icon: Star, 
        color: 'text-amber-700', 
        bgColor: 'bg-amber-100 dark:bg-amber-900/30',
        displayName: 'Monthly'
      };
    case 'pro_annual':
      return { 
        icon: Sparkles, 
        color: 'text-gray-500', 
        bgColor: 'bg-gray-100 dark:bg-gray-800',
        displayName: 'Annual'
      };
    case 'pro_lifetime':
      return { 
        icon: Crown, 
        color: 'text-yellow-600', 
        bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
        displayName: 'Lifetime*'
      };
    default:
      return { 
        icon: Star, 
        color: 'text-gray-500', 
        bgColor: 'bg-gray-100 dark:bg-gray-800',
        displayName: tierName
      };
  }
}

export function ProSubscriptionDialog({
  isOpen,
  onClose,
  onSuccess,
  onLoginRequired,
}: ProSubscriptionDialogProps) {
  const [selectedTier, setSelectedTier] = useState<TierData | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  // Fetch available tiers from API
  const { data: tiers, isLoading: tiersLoading } = useQuery<TierData[]>({
    queryKey: ['/api/tiers'],
    queryFn: async () => {
      const supabase = await getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];

      const response = await fetch('/api/tiers', {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to fetch tiers');
      return response.json();
    },
    enabled: isOpen && isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });

  const handleTierClick = (tier: TierData) => {
    if (!isAuthenticated) {
      if (onLoginRequired) {
        onLoginRequired();
      } else {
        toast({
          title: 'Login Required',
          description: 'Please log in to purchase a Pro subscription.',
          variant: 'destructive',
        });
      }
      return;
    }

    setSelectedTier(tier);
    setShowConfirmDialog(true);
  };

  const handleConfirmSubscription = async () => {
    if (!selectedTier) return;
    
    setIsProcessing(true);
    setShowConfirmDialog(false);

    try {
      const supabase = await getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session');
      }

      const response = await fetch('/api/subscription/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        credentials: 'include',
        body: JSON.stringify({ tierId: selectedTier.id }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create subscription');
      }

      const result = await response.json();
      
      if (result.success) {
        // Invalidate subscription query to refresh UI
        queryClient.invalidateQueries({ queryKey: ['/api/subscription'] });
        toast({
          title: 'Success!',
          description: 'Your subscription has been activated.',
        });
        onSuccess(selectedTier.tier);
      }
    } catch (error: any) {
      console.error('Subscription error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create subscription. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
      setSelectedTier(null);
    }
  };

  return (
    <>
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="pro-subscription-dialog"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[100] bg-background flex flex-col"
          data-testid="pro-subscription-dialog"
        >
          <div className="absolute top-0 left-0 right-0 flex items-center p-4 z-[101]">
            <button
              onClick={onClose}
              className="w-14 h-14 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              data-testid="button-close-pro-dialog"
            >
              <ChevronLeft className="h-9 w-9 text-gray-700 dark:text-gray-300" />
            </button>
          </div>

          <div className="flex-1 flex flex-col items-center px-4 pt-16 pb-4 overflow-y-auto">
            <div className="max-w-md w-full max-h-screen flex flex-col" style={{ gap: 'clamp(1rem, 2vh, 1.5rem)' }}>
              <div className="text-center flex flex-col items-center" style={{ gap: 'clamp(0.5rem, 1vh, 0.75rem)' }}>
                <img src={signupHamsterGrey} alt="Pro" className="h-24 w-auto object-contain" />
                <h1 className="text-2xl font-bold text-foreground" data-testid="text-pro-title">
                  Go Ad Free and Play Limitless Personalised Games!
                </h1>
              </div>

              <div style={{ gap: 'clamp(0.75rem, 1.5vh, 1rem)' }} className="flex flex-col">
                {tiersLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {(tiers || []).map((tier) => {
                      const style = getTierStyle(tier.tier);
                      const Icon = style.icon;
                      const isSelected = selectedTier?.id === tier.id;
                      
                      return (
                        <button
                          key={tier.id}
                          onClick={() => handleTierClick(tier)}
                          disabled={isProcessing}
                          className={`
                            relative flex flex-col items-center p-4 rounded-2xl transition-all
                            ${isSelected ? 'ring-2 ring-primary/20' : ''}
                            ${style.bgColor}
                            disabled:opacity-50 disabled:cursor-not-allowed
                          `}
                          data-testid={`button-tier-${tier.tier}`}
                        >
                          <Icon className={`h-8 w-8 mb-2 ${style.color}`} />
                          <span className="font-bold text-sm text-foreground">{style.displayName}</span>
                          <span className="text-lg font-bold text-foreground mt-1">
                            {formatPrice(tier.subscriptionCost, tier.currency)}
                          </span>
                          
                          {isSelected && isProcessing && (
                            <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-2xl">
                              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div style={{ gap: 'clamp(0.75rem, 1vh, 1rem)' }} className="flex flex-col items-center max-w-sm">
                <h3 className="font-semibold text-foreground text-xl">Benefits of Pro:</h3>
                <ul style={{ gap: 'clamp(0.5rem, 1vh, 0.75rem)' }} className="flex flex-col w-full">
                  {[
                    'No banner ads anywhere',
                    'No ads after completing puzzles',
                    'Unlimited personalised games',
                    'Choose your own categories',
                    '3 monthly Streak Savers per game',
                    '4 streak protecting holiday periods per year',
                  ].map((benefit, index) => (
                    <li key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-gray-400 dark:text-gray-600 mt-4 text-center">
                  *always a pro member for the full serviceable life of the game
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>

    <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
      <AlertDialogContent data-testid="confirm-subscription-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm Subscription</AlertDialogTitle>
          <AlertDialogDescription>
            {selectedTier && (
              <>
                You are about to subscribe to <strong>{getTierStyle(selectedTier.tier).displayName}</strong> for{' '}
                <strong>{formatPrice(selectedTier.subscriptionCost, selectedTier.currency)}</strong>.
                <br /><br />
                Do you want to continue?
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel 
            onClick={() => setSelectedTier(null)}
            data-testid="button-cancel-subscription"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleConfirmSubscription}
            data-testid="button-confirm-subscription"
          >
            Yes
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
