import { motion } from "framer-motion";
import { useState, useEffect, useMemo } from "react";
import welcomeHamsterGrey from "@assets/Welcome-Hamster-Grey.svg";
import { formatCanonicalDateWithOrdinal } from "@/lib/dateFormat";

interface OnboardingScreenProps {
  eventTitle: string;
  puzzleDateCanonical: string;
  onPlay: () => void;
  onLogin: () => void;
  onSubscribe: () => void;
}

export function OnboardingScreen({
  eventTitle,
  puzzleDateCanonical,
  onPlay,
  onLogin,
  onSubscribe,
}: OnboardingScreenProps) {
  const [fadeIn, setFadeIn] = useState(false);
  
  // Format date as "10th December 2025"
  const displayDate = formatCanonicalDateWithOrdinal(puzzleDateCanonical);
  
  const [isDarkMode, setIsDarkMode] = useState(() => 
    document.documentElement.classList.contains('dark')
  );
  
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          setIsDarkMode(document.documentElement.classList.contains('dark'));
        }
      });
    });
    
    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, []);
  
  const backgroundColor = useMemo(() => {
    return isDarkMode ? 'hsl(222, 47%, 11%)' : '#FAFAFA';
  }, [isDarkMode]);
  
  const textColor = useMemo(() => {
    return isDarkMode ? '#FAFAFA' : '#54524F';
  }, [isDarkMode]);
  
  useEffect(() => {
    requestAnimationFrame(() => {
      setFadeIn(true);
    });
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: fadeIn ? 1 : 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="fixed inset-0 flex flex-col items-center justify-center p-4 z-50"
      style={{ backgroundColor }}
      data-testid="onboarding-screen"
    >
      <div className="flex flex-col items-center justify-center max-w-md w-full space-y-6">
        <h1 
          className="text-4xl font-bold"
          style={{ color: textColor }}
          data-testid="text-onboarding-title"
        >
          Elementle
        </h1>
        
        <div className="h-32 w-32 flex items-center justify-center">
          <img
            src={welcomeHamsterGrey}
            alt="Welcome Hamster"
            className="h-32 w-auto object-contain"
            data-testid="img-onboarding-hamster"
          />
        </div>

        <div className="text-center space-y-4">
          <p 
            className="font-bold text-lg"
            style={{ color: textColor, maxWidth: '280px', margin: '0 auto' }}
            data-testid="text-onboarding-prompt"
          >
            On what date did this historical event occur?
          </p>
          
          <p 
            className="text-xl font-bold"
            style={{ color: textColor }}
            data-testid="text-onboarding-event"
          >
            {eventTitle}
          </p>
        </div>

        <div className="flex flex-col items-center gap-3 w-full pt-2">
          <button
            onClick={onPlay}
            className="w-3/5 text-white font-bold text-xl py-4 rounded-full hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#7DAAE8' }}
            data-testid="button-onboarding-play"
          >
            Play
          </button>
          
          <button
            onClick={onLogin}
            className="w-3/5 text-white font-bold text-xl py-4 rounded-full hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#8A8A8A' }}
            data-testid="button-onboarding-login"
          >
            Log in
          </button>
          
          <button
            onClick={onSubscribe}
            className="w-3/5 text-white font-bold text-xl py-4 rounded-full hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#8A8A8A' }}
            data-testid="button-onboarding-subscribe"
            disabled
          >
            Subscribe
          </button>
        </div>

        <p 
          className="text-sm pt-4"
          style={{ color: isDarkMode ? 'rgba(255, 255, 255, 0.6)' : '#999' }}
          data-testid="text-onboarding-date"
        >
          Puzzle date: {displayDate}
        </p>
      </div>
    </motion.div>
  );
}
