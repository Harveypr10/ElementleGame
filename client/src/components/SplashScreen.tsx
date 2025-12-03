import { useEffect, useState } from "react";
import { WelcomePage } from "./WelcomePage";
import welcomeHamster from "@assets/Welcome-Hamster-Blue.svg";
import historianHamsterBlue from "@assets/Historian-Hamster-Blue.svg";
import librarianHamsterYellow from "@assets/Librarian-Hamster-Yellow.svg";
import mathsHamsterGreen from "@assets/Maths-Hamster-Green.svg";
import mechanicHamsterGrey from "@assets/Mechanic-Hamster-Grey.svg";
import whiteTickBlue from "@assets/Win-Hamster-Blue.svg";
import questionHamsterBlue from "@assets/Question-Hamster-Blue.svg";

interface SplashScreenProps {
  onLogin: () => void;
  onSignup: () => void;
}

export function SplashScreen({ onLogin, onSignup }: SplashScreenProps) {
  const [finished, setFinished] = useState(false);
  const [fadeIn, setFadeIn] = useState(false);

  useEffect(() => {
    // Reset body background to white now that React has loaded
    // (index.html sets it to blue for initial loading)
    document.body.style.backgroundColor = '';
    document.documentElement.style.backgroundColor = '';
    
    // Preload GameSelection screen images and auth/generating screens
    const imagesToPreload = [
      historianHamsterBlue,
      librarianHamsterYellow,
      mathsHamsterGreen,
      mechanicHamsterGrey,
      whiteTickBlue,
      questionHamsterBlue  // Preload GeneratingQuestionsScreen hamster
    ];

    imagesToPreload.forEach(src => {
      const img = new Image();
      img.src = src;
    });

    // Trigger fade-in animation
    requestAnimationFrame(() => {
      setFadeIn(true);
    });

    // Show splash screen for 3 seconds
    const timer = setTimeout(() => {
      setFinished(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  if (finished) {
    return <WelcomePage onLogin={onSignup} onSignup={onSignup} />;
  }

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center p-4"
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
