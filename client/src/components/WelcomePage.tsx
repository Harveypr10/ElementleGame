import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import hamsterLogo from "@assets/generated_images/Hamster_logo_icon_5c761af3.png";

interface WelcomePageProps {
  onPlayWithoutSignIn: () => void;
  onLogin: () => void;
  onSignup: () => void;
}

export function WelcomePage({ onPlayWithoutSignIn, onLogin, onSignup }: WelcomePageProps) {

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-lg p-8 space-y-8">
        <div className="text-center space-y-4">
          <img
            src={hamsterLogo}
            alt="Elementle Logo"
            className="w-24 h-24 mx-auto"
          />
          <h1 className="text-4xl md:text-5xl font-bold">Elementle</h1>
          <p className="text-muted-foreground">
            Guess the historical date. A new puzzle every day!
          </p>
        </div>

        <div className="space-y-4">
          <Button
            className="w-full h-14"
            size="lg"
            onClick={onLogin}
            data-testid="button-login"
          >
            Login
          </Button>

          <Button
            className="w-full h-14"
            size="lg"
            variant="outline"
            onClick={onSignup}
            data-testid="button-signup"
          >
            Sign Up
          </Button>

          <div className="text-center pt-2">
            <Button
              variant="ghost"
              onClick={onPlayWithoutSignIn}
              data-testid="button-play-without-signin"
              className="text-sm text-muted-foreground"
            >
              Play without signing in
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
