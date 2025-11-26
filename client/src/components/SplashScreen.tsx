import { useEffect, useState } from "react";
import { WelcomePage } from "./WelcomePage";
import { usePreload } from "@/lib/PreloadProvider";
import welcomeHamster from "@assets/Welcome-Hamster-Blue.svg";

interface SplashScreenProps {
  onLogin: () => void;
  onSignup: () => void;
}

export function SplashScreen({ onLogin, onSignup }: SplashScreenProps) {
  const [finished, setFinished] = useState(false);
  const [fadeIn, setFadeIn] = useState(false);
  const [minTimePassed, setMinTimePassed] = useState(false);
  const { isPreloaded, imagesReady } = usePreload();

  useEffect(() => {
    // Trigger fade-in animation
    requestAnimationFrame(() => {
      setFadeIn(true);
    });

    // Minimum splash screen time of 2.5 seconds
    const timer = setTimeout(() => {
      setMinTimePassed(true);
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  // Only finish when both minimum time passed AND preloading is complete
  useEffect(() => {
    if (minTimePassed && isPreloaded && imagesReady) {
      setFinished(true);
    }
  }, [minTimePassed, isPreloaded, imagesReady]);

  if (finished) {
    return <WelcomePage onLogin={onSignup} onSignup={onSignup} />;
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ backgroundColor: '#7DAAE8' }}
    >
      <div 
        className="flex flex-col items-center gap-8 transition-opacity duration-1000"
        style={{ opacity: fadeIn ? 1 : 0 }}
      >
        <h1 className="text-5xl font-bold text-white">
          Elementle
        </h1>

        <img 
          src={welcomeHamster} 
          alt="Welcome Hamster" 
          className="w-4/5 max-w-xs"
        />

        <p className="text-3xl text-white">
          Welcome back
        </p>
      </div>
    </div>
  );
}
