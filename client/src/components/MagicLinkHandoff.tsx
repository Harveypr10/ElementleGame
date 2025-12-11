import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Smartphone, ArrowRight, Check } from 'lucide-react';
import { storeMagicLinkTokenInCookie } from '@/lib/pwaContext';

export function MagicLinkHandoff() {
  const [tokenStored, setTokenStored] = useState(false);
  const [showContinueSafari, setShowContinueSafari] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get('token_hash');
    const type = params.get('type');

    if (tokenHash && type === 'magiclink') {
      storeMagicLinkTokenInCookie(tokenHash, type);
      setTokenStored(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleContinueInSafari = async () => {
    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get('token_hash');
    const type = params.get('type');
    
    if (tokenHash && type) {
      try {
        const response = await fetch('/api/supabase-config');
        const config = await response.json();
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(config.url, config.anonKey, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
        });
        
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: 'magiclink',
        });
        
        if (!error) {
          window.location.href = window.location.origin;
        }
      } catch (e) {
        console.error('Safari auth failed:', e);
      }
    }
  };

  if (!tokenStored) {
    return (
      <div 
        className="fixed inset-0 flex items-center justify-center"
        style={{ backgroundColor: '#7DAAE8' }}
      >
        <div className="text-white text-lg">Setting up sign-in...</div>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center p-6"
      style={{ backgroundColor: '#7DAAE8' }}
    >
      <Card className="w-full max-w-sm shadow-lg">
        <CardContent className="pt-6 pb-6 text-center space-y-5">
          <div className="flex justify-center">
            <div 
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'rgba(125, 170, 232, 0.2)' }}
            >
              <Smartphone className="w-8 h-8" style={{ color: '#7DAAE8' }} />
            </div>
          </div>
          
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">
              Almost there!
            </h2>
            <p className="text-muted-foreground text-sm">
              Your sign-in is ready. Now open the <strong>Elementle app</strong> from your home screen to complete sign-in.
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 text-green-600 bg-green-50 rounded-lg py-3 px-4">
            <Check className="w-5 h-5" />
            <span className="text-sm font-medium">Sign-in token saved</span>
          </div>

          <p className="text-xs text-muted-foreground">
            Go to your home screen and tap the Elementle icon to continue.
          </p>

          <div className="pt-4 border-t">
            {!showContinueSafari ? (
              <button
                className="text-xs text-muted-foreground underline"
                onClick={() => setShowContinueSafari(true)}
                data-testid="link-show-safari-option"
              >
                Don't have the app installed?
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  You can continue in Safari, but you'll need to sign in again when using the app.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  data-testid="button-continue-safari"
                  onClick={handleContinueInSafari}
                >
                  <ArrowRight className="w-3 h-3 mr-2" />
                  Continue in Safari
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
