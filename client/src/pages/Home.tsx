import { useState, useEffect } from "react";
import { WelcomePage } from "@/components/WelcomePage";
import { GameSelectionPage } from "@/components/GameSelectionPage";
import { PlayPage } from "@/components/PlayPage";
import { StatsPage } from "@/components/StatsPage";
import { ArchivePage } from "@/components/ArchivePage";
import { SettingsPage } from "@/components/SettingsPage";
import { OptionsPage } from "@/components/OptionsPage";
import { SplashScreen } from "@/components/SplashScreen";
import AuthPage from "@/components/AuthPage";
import ForgotPasswordPage from "@/components/ForgotPasswordPage";
import AccountInfoPage from "@/components/AccountInfoPage";
import { PrivacyPage } from "@/components/PrivacyPage";
import { TermsPage } from "@/components/TermsPage";
import { useAuth } from "@/hooks/useAuth";
import { useGameData } from "@/hooks/useGameData";
import { useQuery } from "@tanstack/react-query";

type Screen = "splash" | "welcome" | "login" | "signup" | "forgot-password" | "selection" | "play" | "stats" | "archive" | "settings" | "options" | "account-info" | "privacy" | "terms";

interface Puzzle {
  id: number;
  date: string;
  targetDate: string;
  eventTitle: string;
  eventDescription: string;
  clue1?: string;
  clue2?: string;
}

export default function Home() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { gameAttempts, loadingAttempts } = useGameData();
  const [currentScreen, setCurrentScreen] = useState<Screen>("splash");
  const [selectedPuzzleId, setSelectedPuzzleId] = useState<string | null>(null);
  const [showSplash, setShowSplash] = useState(true);
  const [previousScreen, setPreviousScreen] = useState<Screen>("selection");
  const [statsReturnScreen, setStatsReturnScreen] = useState<Screen>("selection");
  const [showCelebrationFirst, setShowCelebrationFirst] = useState(false);
  const [hasOpenedCelebration, setHasOpenedCelebration] = useState(false);
  
  // Fetch puzzles from API
  const { data: puzzles = [], isLoading: puzzlesLoading } = useQuery<Puzzle[]>({
    queryKey: ['/api/puzzles'],
  });
  
  useEffect(() => {
    if (isLoading) return;
    
    if (isAuthenticated && showSplash) {
      // Skip splash and go directly to selection for logged-in users
      setTimeout(() => {
        setShowSplash(false);
        setCurrentScreen("selection");
      }, 3000);
    } else if (!isAuthenticated && showSplash) {
      // Show splash, then welcome page for non-authenticated users
      setTimeout(() => {
        setShowSplash(false);
        setCurrentScreen("welcome");
      }, 3000);
    }
  }, [isAuthenticated, isLoading, showSplash]);

  const getDailyPuzzle = (): Puzzle | undefined => {
    if (puzzles.length === 0) return undefined;
    
    // Get today's date in YYYY-MM-DD format
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayDate = `${year}-${month}-${day}`;
    
    // Try to find today's puzzle
    const todayPuzzle = puzzles.find(p => p.date === todayDate);
    if (todayPuzzle) return todayPuzzle;
    
    // Fallback to first puzzle
    return puzzles[0];
  };

  const currentPuzzle = selectedPuzzleId 
    ? puzzles.find(p => p.id.toString() === selectedPuzzleId) || getDailyPuzzle()
    : getDailyPuzzle();

  const handlePlayPuzzle = (puzzleId: string) => {
    const puzzle = puzzles.find(p => p.id.toString() === puzzleId);
    if (!puzzle) return;
    
    // Check if this puzzle is already completed
    let isCompleted = false;
    
    if (isAuthenticated && !loadingAttempts && gameAttempts) {
      // For authenticated users, check Supabase data using result !== null as completion check
      const numericPuzzleId = parseInt(puzzleId);
      const completedAttempt = gameAttempts.find(
        attempt => attempt.puzzleId === numericPuzzleId && attempt.result !== null
      );
      isCompleted = !!completedAttempt;
    } else if (!isAuthenticated) {
      // For guest users, check localStorage
      const storedStats = localStorage.getItem("elementle-stats");
      if (storedStats) {
        const stats = JSON.parse(storedStats);
        const completion = stats.puzzleCompletions?.[puzzle.targetDate];
        isCompleted = !!(completion && completion.completed);
      }
    }
    // If loadingAttempts is true, we wait before determining completion
    
    if (isCompleted) {
      // Show game screen first, then celebration
      setShowCelebrationFirst(true);
      setHasOpenedCelebration(false);
    } else {
      setShowCelebrationFirst(false);
      setHasOpenedCelebration(false);
    }
    
    setSelectedPuzzleId(puzzleId);
    setPreviousScreen("archive");
    setCurrentScreen("play");
  };
  
  const handlePlayToday = () => {
    setSelectedPuzzleId(null);
    setPreviousScreen("selection");
    setShowCelebrationFirst(false);
    setHasOpenedCelebration(false);
    setCurrentScreen("play");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (showSplash) {
    return (
      <SplashScreen 
        onLogin={() => setCurrentScreen("login")}
        onSignup={() => setCurrentScreen("signup")}
      />
    );
  }

  return (
    <div className="relative">
      {currentScreen === "welcome" && (
        <WelcomePage 
          onLogin={() => setCurrentScreen("login")}
          onSignup={() => setCurrentScreen("signup")}
        />
      )}

      {currentScreen === "login" && (
        <AuthPage 
          mode="login"
          onSuccess={() => setCurrentScreen("selection")}
          onSwitchMode={() => setCurrentScreen("signup")}
          onBack={() => setCurrentScreen("welcome")}
          onForgotPassword={() => setCurrentScreen("forgot-password")}
        />
      )}

      {currentScreen === "signup" && (
        <AuthPage 
          mode="signup"
          onSuccess={() => setCurrentScreen("selection")}
          onSwitchMode={() => setCurrentScreen("login")}
          onBack={() => setCurrentScreen("welcome")}
        />
      )}

      {currentScreen === "forgot-password" && (
        <ForgotPasswordPage 
          onBack={() => setCurrentScreen("login")}
        />
      )}

      {currentScreen === "selection" && (
        <GameSelectionPage 
          onPlayGame={handlePlayToday}
          onViewStats={() => {
            setStatsReturnScreen("selection");
            setCurrentScreen("stats");
          }}
          onViewArchive={() => setCurrentScreen("archive")}
          onOpenSettings={() => setCurrentScreen("settings")}
          onOpenOptions={() => {
            setPreviousScreen("selection");
            setCurrentScreen("options");
          }}
          onLogin={() => setCurrentScreen("login")}
          todayPuzzleId={getDailyPuzzle()?.id}
          todayPuzzleTargetDate={getDailyPuzzle()?.targetDate}
        />
      )}

      {currentScreen === "play" && currentPuzzle && (
        <PlayPage
          puzzleId={currentPuzzle.id}
          targetDate={currentPuzzle.targetDate}
          eventTitle={currentPuzzle.eventTitle}
          eventDescription={currentPuzzle.eventDescription}
          clue1={currentPuzzle.clue1}
          clue2={currentPuzzle.clue2}
          maxGuesses={5}
          fromArchive={previousScreen === "archive"}
          showCelebrationFirst={showCelebrationFirst}
          hasOpenedCelebration={hasOpenedCelebration}
          onSetHasOpenedCelebration={setHasOpenedCelebration}
          onBack={() => setCurrentScreen(previousScreen === "archive" ? "archive" : "selection")}
          onHomeFromCelebration={() => {
            setShowCelebrationFirst(false);
            setCurrentScreen("selection");
          }}
          onViewStats={() => {
            setStatsReturnScreen("play");
            setCurrentScreen("stats");
          }}
          onViewArchive={() => setCurrentScreen("archive")}
        />
      )}

      {currentScreen === "play" && !currentPuzzle && (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-lg">Loading puzzle...</div>
        </div>
      )}

      {currentScreen === "stats" && (
        <StatsPage 
          onBack={() => setCurrentScreen(statsReturnScreen)}
        />
      )}

      {currentScreen === "archive" && (
        <ArchivePage 
          onBack={() => setCurrentScreen("selection")}
          onPlayPuzzle={handlePlayPuzzle}
          puzzles={puzzles as any[]}
        />
      )}

      {currentScreen === "settings" && (
        <SettingsPage 
          onBack={() => setCurrentScreen("selection")}
          onOpenOptions={() => {
            setPreviousScreen("settings");
            setCurrentScreen("options");
          }}
          onAccountInfo={() => setCurrentScreen("account-info")}
          onPrivacy={() => setCurrentScreen("privacy")}
          onTerms={() => setCurrentScreen("terms")}
        />
      )}

      {currentScreen === "options" && (
        <OptionsPage 
          onBack={() => setCurrentScreen(previousScreen)}
        />
      )}

      {currentScreen === "account-info" && (
        <AccountInfoPage 
          onBack={() => setCurrentScreen("settings")}
        />
      )}

      {currentScreen === "privacy" && (
        <PrivacyPage onBack={() => setCurrentScreen("settings")} />
      )}

      {currentScreen === "terms" && (
        <TermsPage onBack={() => setCurrentScreen("settings")} />
      )}
    </div>
  );
}
