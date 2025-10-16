import { useState, useEffect } from "react";
import { WelcomePage } from "@/components/WelcomePage";
import { GameSelectionPage } from "@/components/GameSelectionPage";
import { PlayPage } from "@/components/PlayPage";
import { StatsPage } from "@/components/StatsPage";
import { ArchivePage } from "@/components/ArchivePage";
import { SettingsPage } from "@/components/SettingsPage";
import { OptionsPage } from "@/components/OptionsPage";
import { SplashScreen } from "@/components/SplashScreen";
import { useAuth } from "@/hooks/useAuth";

const puzzles = [
  {
    date_id: "day1",
    target_date: "251015",
    event_title: "Battle of Agincourt",
    event_description: "Henry V's English army defeats the French in one of the most famous battles of the Hundred Years' War.",
    clue1: "An English king's triumph in France",
    clue2: "Longbowmen dominated armored knights"
  },
  {
    date_id: "day2",
    target_date: "020966",
    event_title: "Great Fire of London",
    event_description: "A massive fire sweeps through London, destroying much of the medieval city over four days.",
    clue1: "Started in a bakery on Pudding Lane",
    clue2: "Led to rebuild with stone instead of wood"
  },
  {
    date_id: "day3",
    target_date: "040776",
    event_title: "Declaration of Independence",
    event_description: "The United States Declaration of Independence is adopted in Philadelphia.",
    clue1: "Thomas Jefferson penned the document",
    clue2: "Thirteen colonies declared freedom"
  },
  {
    date_id: "day4",
    target_date: "180615",
    event_title: "Battle of Waterloo",
    event_description: "Napoleon Bonaparte meets his final defeat at the Battle of Waterloo, ending his rule as Emperor of the French.",
    clue1: "Napoleon's final battle",
    clue2: "Wellington led the allied forces"
  },
  {
    date_id: "day5",
    target_date: "171203",
    event_title: "First Powered Flight",
    event_description: "The Wright brothers achieve the first powered flight at Kitty Hawk, North Carolina.",
    clue1: "Two brothers achieved the impossible",
    clue2: "12 seconds in the air changed history"
  },
  {
    date_id: "day6",
    target_date: "200769",
    event_title: "Apollo 11 Moon Landing",
    event_description: "Neil Armstrong becomes the first human to set foot on the Moon.",
    clue1: "One small step for man",
    clue2: "Eagle landed in the Sea of Tranquility"
  },
  {
    date_id: "day7",
    target_date: "091189",
    event_title: "Fall of the Berlin Wall",
    event_description: "East and West Berliners begin dismantling the wall that divided the city for decades.",
    clue1: "A divided city reunited",
    clue2: "The Iron Curtain fell"
  }
];

type Screen = "splash" | "welcome" | "selection" | "play" | "stats" | "archive" | "settings" | "options";

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth();
  const [currentScreen, setCurrentScreen] = useState<Screen>("splash");
  const [selectedPuzzleId, setSelectedPuzzleId] = useState<string | null>(null);
  const [showSplash, setShowSplash] = useState(true);
  
  useEffect(() => {
    if (isLoading) return;
    
    if (isAuthenticated && showSplash) {
      setTimeout(() => {
        setShowSplash(false);
        setCurrentScreen("selection");
      }, 1500);
    } else if (!isAuthenticated) {
      setCurrentScreen("welcome");
    }
  }, [isAuthenticated, isLoading, showSplash]);

  const getDailyPuzzle = () => {
    const today = new Date();
    const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000);
    return puzzles[dayOfYear % puzzles.length];
  };

  const currentPuzzle = selectedPuzzleId 
    ? puzzles.find(p => p.date_id === selectedPuzzleId) || getDailyPuzzle()
    : getDailyPuzzle();

  const handlePlayPuzzle = (puzzleId: string) => {
    setSelectedPuzzleId(puzzleId);
    setCurrentScreen("play");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (isAuthenticated && showSplash) {
    return <SplashScreen />;
  }

  return (
    <div className="relative">
      {currentScreen === "welcome" && (
        <WelcomePage 
          onPlayWithoutSignIn={() => setCurrentScreen("selection")}
          onLogin={() => window.location.href = "/api/login"}
        />
      )}

      {currentScreen === "selection" && (
        <GameSelectionPage 
          onPlayGame={() => {
            setSelectedPuzzleId(null);
            setCurrentScreen("play");
          }}
          onViewStats={() => setCurrentScreen("stats")}
          onViewArchive={() => setCurrentScreen("archive")}
          onOpenSettings={() => setCurrentScreen("settings")}
          onOpenOptions={() => setCurrentScreen("options")}
        />
      )}

      {currentScreen === "play" && (
        <PlayPage
          targetDate={currentPuzzle.target_date}
          eventTitle={currentPuzzle.event_title}
          eventDescription={currentPuzzle.event_description}
          clue1={currentPuzzle.clue1}
          clue2={currentPuzzle.clue2}
          maxGuesses={5}
          onBack={() => setCurrentScreen("selection")}
          onViewStats={() => setCurrentScreen("stats")}
          onViewArchive={() => setCurrentScreen("archive")}
        />
      )}

      {currentScreen === "stats" && (
        <StatsPage onBack={() => setCurrentScreen("selection")} />
      )}

      {currentScreen === "archive" && (
        <ArchivePage 
          onBack={() => setCurrentScreen("selection")}
          onPlayPuzzle={handlePlayPuzzle}
          puzzles={puzzles}
        />
      )}

      {currentScreen === "settings" && (
        <SettingsPage 
          onBack={() => setCurrentScreen("selection")}
          onOpenOptions={() => setCurrentScreen("options")}
        />
      )}

      {currentScreen === "options" && (
        <OptionsPage 
          onBack={() => setCurrentScreen("settings")}
        />
      )}
    </div>
  );
}
