import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Smartphone, ArrowRight, Check, Loader2 } from 'lucide-react';
import { storeMagicLinkTokenInCookie } from '@/lib/pwaContext';

export function MagicLinkHandoff() {
  const [tokenStored, setTokenStored] = useState(false);
  const [showContinueSafari, setShowContinueSafari] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const tokenDataRef = useRef<{ tokenHash: string; type: string } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get('token_hash');
    const type = params.get('type');

    if (tokenHash && type === 'magiclink') {
      // Store token data for Safari fallback
      tokenDataRef.current = { tokenHash, type };
      // Store in cookie for PWA handoff
      storeMagicLinkTokenInCookie(tokenHash, type);
      setTokenStored(true);
      // Clean URL but keep token data in ref for Safari option
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleContinueInSafari = async () => {
    const tokenData = tokenDataRef.current;
    
    if (!tokenData) {
      console.error('[MagicLinkHandoff] No token data available for Safari auth');
      return;
    }

    setIsAuthenticating(true);
    
    try {
      const response = await fetch('/api/supabase-config');
      const config = await response.json();
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(config.url, config.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      });
      
      console.log('[MagicLinkHandoff] Verifying token in Safari...');
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: tokenData.tokenHash,
        type: 'magiclink',
      });
      
      if (error) {
        console.error('[MagicLinkHandoff] Safari auth error:', error);
        setIsAuthenticating(false);
        return;
      }
      
      if (data.session) {
        console.log('[MagicLinkHandoff] Safari auth successful, redirecting...');
        // Clear the cookie since we consumed the token in Safari
        document.cookie = 'elementle_magic_link_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        window.location.href = window.location.origin;
      }
    } catch (e) {
      console.error('[MagicLinkHandoff] Safari auth failed:', e);
      setIsAuthenticating(false);
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
                  disabled={isAuthenticating}
                >
                  {isAuthenticating ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      <ArrowRight className="w-3 h-3 mr-2" />
                      Continue in Safari
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
