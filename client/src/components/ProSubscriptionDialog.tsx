import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Check, Crown, Sparkles, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { getSupabaseClient } from '@/lib/supabaseClient';
import signupHamsterGrey from '@assets/Signup-Hamster-Grey.svg';
import type { ProTier } from '@shared/schema';

interface ProSubscriptionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (tier: ProTier) => void;
  onLoginRequired?: () => void;
}

type TierOption = {
  id: Exclude<ProTier, 'free'>;
  name: string;
  price: string;
  period: string;
  description: string;
  icon: typeof Crown;
  color: string;
  bgColor: string;
};

const tiers: TierOption[] = [
  {
    id: 'bronze',
    name: 'Bronze',
    price: '$3.99',
    period: '/month',
    description: 'Auto-renewing monthly',
    icon: Star,
    color: 'text-amber-700',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
  },
  {
    id: 'silver',
    name: 'Silver',
    price: '$6.99',
    period: '/month',
    description: 'Best value - monthly',
    icon: Sparkles,
    color: 'text-gray-500',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
  },
  {
    id: 'gold',
    name: 'Gold',
    price: '$9.99',
    period: '/month',
    description: 'Premium - monthly',
    icon: Crown,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
  },
];

export function ProSubscriptionDialog({
  isOpen,
  onClose,
  onSuccess,
  onLoginRequired,
}: ProSubscriptionDialogProps) {
  const [selectedTier, setSelectedTier] = useState<TierOption | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();

  const handlePurchase = async (tier: TierOption) => {
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
    setIsProcessing(true);

    try {
      // Get auth session for API call
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
        body: JSON.stringify({ tier: tier.id }),
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const { url } = await response.json();
      
      if (url) {
        window.location.href = url;
      } else {
        onSuccess(tier.id);
      }
    } catch (error) {
      console.error('Checkout error:', error);
      toast({
        title: 'Error',
        description: 'Failed to start checkout. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
      setSelectedTier(null);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
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

          <div className="flex-1 flex flex-col items-center px-4 pt-24 pb-8 overflow-y-auto">
            <div className="max-w-md w-full space-y-8">
              <div className="text-center space-y-2">
                <img src={signupHamsterGrey} alt="Pro" className="h-32 w-auto mx-auto object-contain" />
                <h1 className="text-2xl font-bold text-foreground" data-testid="text-pro-title">
                  Go Ad Free and Play Limitless Personalised Games!
                </h1>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  {tiers.map((tier) => {
                    const Icon = tier.icon;
                    const isSelected = selectedTier?.id === tier.id;
                    
                    return (
                      <button
                        key={tier.id}
                        onClick={() => handlePurchase(tier)}
                        disabled={isProcessing}
                        className={`
                          relative flex flex-col items-center p-4 rounded-2xl border-2 transition-all
                          ${isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/50'}
                          ${tier.bgColor}
                          disabled:opacity-50 disabled:cursor-not-allowed
                        `}
                        data-testid={`button-tier-${tier.id}`}
                      >
                        {tier.id === 'gold' && (
                          <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-yellow-500 rounded-full">
                            <span className="text-[10px] font-bold text-white uppercase">Best Value</span>
                          </div>
                        )}
                        
                        <Icon className={`h-8 w-8 mb-2 ${tier.color}`} />
                        <span className="font-bold text-sm text-foreground">{tier.name}</span>
                        <span className="text-lg font-bold text-foreground mt-1">
                          {tier.price}
                          <span className="text-xs font-normal text-muted-foreground">{tier.period}</span>
                        </span>
                        <span className="text-[10px] text-muted-foreground mt-1 text-center">
                          {tier.description}
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
              </div>

              <div className="space-y-3 pt-4">
                <h3 className="font-semibold text-center text-foreground">What you get with Pro:</h3>
                <ul className="space-y-2">
                  {[
                    'No banner ads anywhere',
                    'No ads after completing puzzles',
                    'Unlimited personalised games',
                    'Choose your own categories',
                    'Extended personal archive',
                  ].map((benefit, index) => (
                    <li key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
