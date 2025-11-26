import { Card } from "@/components/ui/card";
import hamsterLogo from "@assets/Login-Hamster-White.svg";

interface WelcomePageProps {
  onLogin?: () => void;
  onSignup?: () => void;
}

export function WelcomePage({ onLogin, onSignup }: WelcomePageProps) {
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
            Guess the historical date. A new puzzle every day!
          </p>
        </div>
      </Card>
    </div>
  );
}
