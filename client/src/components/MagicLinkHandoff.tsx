import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Smartphone, ArrowRight, Copy, Check } from 'lucide-react';
import { markSkipHandoff } from '@/lib/pwaContext';

export function MagicLinkHandoff() {
  const [tokenHash, setTokenHash] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hash = params.get('token_hash');
    if (hash) {
      setTokenHash(hash);
    }
  }, []);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy link:', e);
    }
  };

  const handleContinueInSafari = () => {
    markSkipHandoff();
    window.location.reload();
  };

  if (!tokenHash) {
    return (
      <div 
        className="fixed inset-0 flex items-center justify-center p-6"
        style={{ backgroundColor: '#7DAAE8' }}
      >
        <Card className="w-full max-w-sm shadow-lg">
          <CardContent className="pt-6 pb-6 text-center">
            <p className="text-muted-foreground">Invalid magic link. Please request a new one.</p>
          </CardContent>
        </Card>
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
              Complete Sign-in
            </h2>
            <p className="text-muted-foreground text-sm">
              To sign in to the Elementle app on your home screen:
            </p>
          </div>

          <div className="text-left space-y-3 bg-muted/50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">1</div>
              <p className="text-sm text-foreground pt-0.5">Copy this magic link</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">2</div>
              <p className="text-sm text-foreground pt-0.5">Open the Elementle app from your home screen</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">3</div>
              <p className="text-sm text-foreground pt-0.5">Paste the link in Safari's address bar while in the app</p>
            </div>
          </div>

          <Button
            onClick={handleCopyLink}
            className="w-full"
            style={{ backgroundColor: '#7DAAE8' }}
            data-testid="button-copy-link"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-2" />
                Copy Magic Link
              </>
            )}
          </Button>

          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-3">
              Or continue signing in here in Safari
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
        </CardContent>
      </Card>
    </div>
  );
}
