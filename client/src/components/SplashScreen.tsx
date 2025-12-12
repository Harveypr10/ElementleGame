import { useEffect, useState } from "react";
import welcomeHamster from "@assets/Welcome-Hamster-Cutout.png";
import historianHamsterBlue from "@assets/Historian-Hamster-Blue.svg";
import librarianHamsterYellow from "@assets/Librarian-Hamster-Yellow.svg";
import mathsHamsterGreen from "@assets/Maths-Hamster-Green.svg";
import mechanicHamsterGrey from "@assets/Mechanic-Hamster-Grey.svg";
import whiteTickBlue from "@assets/Win-Hamster-Blue.svg";
import questionHamsterBlue from "@assets/Question-Hamster-Blue.svg";

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [fadeIn, setFadeIn] = useState(false);
  const [imageReady, setImageReady] = useState(false);

  // Preload the welcome hamster image before showing anything
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setImageReady(true);
    };
    img.src = welcomeHamster;

    // Preload other GameSelection screen images in background
    const imagesToPreload = [
      historianHamsterBlue,
      librarianHamsterYellow,
      mathsHamsterGreen,
      mechanicHamsterGrey,
      whiteTickBlue,
      questionHamsterBlue
    ];

    imagesToPreload.forEach(src => {
      const preloadImg = new Image();
      preloadImg.src = src;
    });
  }, []);

  // Only trigger fade-in and timer after image is ready
  useEffect(() => {
    if (!imageReady) return;

    // Trigger fade-in animation
    requestAnimationFrame(() => {
      setFadeIn(true);
    });

    // Show splash screen for 3 seconds after image loads, then notify parent
    const timer = setTimeout(() => {
      onComplete();
    }, 3000);

    return () => clearTimeout(timer);
  }, [imageReady, onComplete]);

  // Add app-loaded class to html after fade-in completes to switch from splash blue to app background
  useEffect(() => {
    if (fadeIn) {
      const timer = setTimeout(() => {
        document.documentElement.classList.add('app-loaded');
      }, 1100);
      return () => clearTimeout(timer);
    }
  }, [fadeIn]);

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
