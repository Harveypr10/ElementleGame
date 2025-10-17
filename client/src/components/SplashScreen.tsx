import happyHamster from "@assets/generated_images/Celebrating_hamster_dark-mode_compatible_97e4ff48.png";

interface SplashScreenProps {
  firstName?: string;
}

export function SplashScreen({ firstName }: SplashScreenProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-blue-200 to-blue-100 dark:from-blue-900 dark:to-blue-800">
      <h1 className="text-6xl font-bold text-foreground mb-8">
        Elementle
      </h1>
      {firstName && (
        <p className="text-2xl text-foreground mb-8" data-testid="text-welcome-back">
          Welcome back, {firstName}!
        </p>
      )}
      <div className="bg-gradient-to-b from-blue-200 to-blue-100 dark:from-blue-900 dark:to-blue-800 rounded-full p-4">
        <img
          src={happyHamster}
          alt="Happy Hamster"
          className="w-48 h-48 object-contain"
        />
      </div>
    </div>
  );
}
