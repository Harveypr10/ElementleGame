import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Smartphone, ExternalLink } from 'lucide-react';

export function MagicLinkHandoff() {
  const [pwaUrl, setPwaUrl] = useState<string>('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get('token_hash');
    const type = params.get('type');

    if (tokenHash && type === 'magiclink') {
      const url = `${window.location.origin}/?token_hash=${encodeURIComponent(tokenHash)}&type=magiclink`;
      setPwaUrl(url);
    }
  }, []);

  if (!pwaUrl) {
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
        <CardContent className="pt-6 pb-6 text-center space-y-6">
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
              Open in Elementle App
            </h2>
            <p className="text-muted-foreground text-sm">
              To complete sign-in, tap the button below to open the Elementle app on your home screen.
            </p>
          </div>

          <Button
            asChild
            className="w-full"
            style={{ backgroundColor: '#7DAAE8' }}
            data-testid="button-open-pwa"
          >
            <a href={pwaUrl}>
              <Smartphone className="w-4 h-4 mr-2" />
              Open Elementle App
            </a>
          </Button>

          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-3">
              Don't have the app installed? You can also continue in Safari.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              data-testid="button-continue-safari"
              onClick={() => {
                window.location.href = pwaUrl;
              }}
            >
              <ExternalLink className="w-3 h-3 mr-2" />
              Continue in Safari
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
