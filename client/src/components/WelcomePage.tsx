import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import hamsterLogo from "@assets/Login-Hamster-White.svg";

interface WelcomePageProps {
  onLogin?: () => void;
  onSignup?: () => void;
  onContinueAsGuest?: () => void;
  showAuthButtons?: boolean;
}

export function WelcomePage({ onLogin, onSignup, onContinueAsGuest, showAuthButtons = false }: WelcomePageProps) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-lg p-8">
        <div className="text-center space-y-4">
          <img
            src={hamsterLogo}
            alt="Elementle Logo"
            className="w-24 h-24 mx-auto"
          />
          <h1 className="text-4xl md:text-5xl font-bold">Elementle</h1>
          <p className="text-muted-foreground">
            Guess the historical date.<br />
            A new puzzle every day!
          </p>
          
          {showAuthButtons && (
            <div className="space-y-3 pt-4">
              <Button 
                onClick={onSignup} 
                className="w-full"
                data-testid="button-register"
              >
                Register
              </Button>
              <Button 
                onClick={onLogin} 
                variant="outline"
                className="w-full"
                data-testid="button-login"
              >
                Login
              </Button>
              <button
                onClick={onContinueAsGuest}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                data-testid="button-continue-guest"
              >
                Continue without logging in
              </button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
