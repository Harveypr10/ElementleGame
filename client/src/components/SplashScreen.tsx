import { useEffect, useState } from "react";
import { WelcomePage } from "./WelcomePage";
import welcomeHamster from "@assets/Welcome-Hamster-Blue.svg";
import historianHamsterBlue from "@assets/Historian-Hamster-Blue.svg";
import librarianHamsterYellow from "@assets/Librarian-Hamster-Yellow.svg";
import mathsHamsterGreen from "@assets/Maths-Hamster-Green.svg";
import mechanicHamsterGrey from "@assets/Mechanic-Hamster-Grey.svg";
import whiteTickBlue from "@assets/White-Tick-Blue.svg";

interface SplashScreenProps {
  onLogin: () => void;
  onSignup: () => void;
}

export function SplashScreen({ onLogin, onSignup }: SplashScreenProps) {
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    // Preload GameSelection screen images
    const imagesToPreload = [
      historianHamsterBlue,
      librarianHamsterYellow,
      mathsHamsterGreen,
      mechanicHamsterGrey,
      whiteTickBlue
    ];

    imagesToPreload.forEach(src => {
      const img = new Image();
      img.src = src;
    });

    // Show splash screen for 3 seconds
    const timer = setTimeout(() => {
      setFinished(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  if (finished) {
    return <WelcomePage onLogin={onLogin} onSignup={onSignup} />;
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ backgroundColor: '#7DAAE8' }}
    >
      <div className="flex flex-col items-center gap-8">
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
