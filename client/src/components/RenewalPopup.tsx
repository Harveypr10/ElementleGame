import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ProSubscriptionDialog } from "./ProSubscriptionDialog";
import { useSubscription } from "@/hooks/useSubscription";
import { useToast } from "@/hooks/use-toast";
import { Crown, X, RefreshCw } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import hamsterPro from "@assets/Historian-Hamster-Blue.svg";

interface RenewalPopupProps {
  open: boolean;
  onClose: () => void;
}

export function RenewalPopup({ open, onClose }: RenewalPopupProps) {
  const { toast } = useToast();
  const { tierName, tierType, endDate, refetch } = useSubscription();
  const [showProDialog, setShowProDialog] = useState(false);
  const [isDowngrading, setIsDowngrading] = useState(false);

  const displayTierName = tierType === 'monthly' ? 'Pro Monthly' 
    : tierType === 'annual' ? 'Pro Annual' 
    : tierType === 'lifetime' ? 'Pro Lifetime' 
    : tierName;

  const formattedEndDate = endDate ? new Date(endDate).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }) : 'Unknown';

  const handleRenew = () => {
    setShowProDialog(true);
  };

  const handleDontRenew = async () => {
    setIsDowngrading(true);
    try {
      const response = await apiRequest('POST', '/api/subscription/downgrade');
      if (!response.ok) {
        throw new Error('Failed to downgrade subscription');
      }
      
      queryClient.invalidateQueries({ queryKey: ['/api/subscription'] });
      
      toast({
        title: "Subscription Updated",
        description: "You've been moved to the Standard tier. You can upgrade again anytime.",
      });
      onClose();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to update subscription",
        variant: "destructive",
      });
    } finally {
      setIsDowngrading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={() => onClose()}>
        <DialogContent className="max-w-sm" data-testid="renewal-popup">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Crown className="h-6 w-6 text-amber-500" />
              Subscription Expired
            </DialogTitle>
            <DialogDescription className="text-center">
              Your {displayTierName} subscription ended on {formattedEndDate}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-4 py-4">
            <img 
              src={hamsterPro} 
              alt="Hamster" 
              className="w-24 h-24"
            />
            
            <div className="text-center">
              <p className="text-lg font-medium">Want to continue enjoying Pro features?</p>
              <p className="text-sm text-muted-foreground mt-2">
                Renew now to keep ad-free puzzles, custom categories, streak savers, and more.
              </p>
            </div>

            <div className="w-full space-y-3">
              <Button
                onClick={handleRenew}
                className="w-full bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600"
                data-testid="button-renew-subscription"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Renew Subscription
              </Button>

              <Button
                onClick={handleDontRenew}
                disabled={isDowngrading}
                variant="ghost"
                className="w-full text-muted-foreground"
                data-testid="button-dont-renew"
              >
                <X className="h-4 w-4 mr-2" />
                {isDowngrading ? "Processing..." : "Don't Go Pro"}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Choosing "Don't Go Pro" will move you to the free Standard tier.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <ProSubscriptionDialog
        isOpen={showProDialog}
        onClose={() => {
          setShowProDialog(false);
        }}
        onSuccess={() => {
          setShowProDialog(false);
          queryClient.invalidateQueries({ queryKey: ['/api/subscription'] });
          onClose();
        }}
      />
    </>
  );
}
