import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { pageVariants, pageTransition } from "@/lib/pageAnimations";
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
import { AboutPage } from "@/components/AboutPage";
import { BugReportForm } from "@/components/BugReportForm";
import { FeedbackForm } from "@/components/FeedbackForm";
import { GeneratingQuestionsScreen } from "@/components/GeneratingQuestionsScreen";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useGameData } from "@/hooks/useGameData";
import { useUserDateFormat } from "@/hooks/useUserDateFormat";
import { useGameMode } from "@/contexts/GameModeContext";
import { useQuery } from "@tanstack/react-query";
import { AdBanner, AdBannerContext } from "@/components/AdBanner";

type Screen = "splash" | "welcome" | "login" | "signup" | "forgot-password" | "selection" | "play" | "stats" | "archive" | "settings" | "options" | "account-info" | "privacy" | "terms" | "about" | "bug-report" | "feedback" | "generating-questions";

interface Puzzle {
  id: number;
  date: string;
  answerDateCanonical: string; // YYYY-MM-DD format - the canonical historical date
  eventTitle: string;
  eventDescription: string;
  clue1?: string;
  clue2?: string;
  category?: string; // Only present in Local mode (user-specific puzzles)
}

export default function Home() {
  const { isAuthenticated, isLoading, user, hasCompletedFirstLogin, markFirstLoginCompleted } = useAuth();
  const { profile } = useProfile();
  const { gameAttempts, loadingAttempts } = useGameData();
  const { formatCanonicalDate } = useUserDateFormat();
  const { isLocalMode, setGameMode } = useGameMode();
  const [currentScreen, setCurrentScreen] = useState<Screen>("splash");
  const [selectedPuzzleId, setSelectedPuzzleId] = useState<string | null>(null);
  const [showSplash, setShowSplash] = useState(true);
  const [previousScreen, setPreviousScreen] = useState<Screen>("selection");
  const [statsReturnScreen, setStatsReturnScreen] = useState<Screen>("selection");
  const [showCelebrationFirst, setShowCelebrationFirst] = useState(false);
  const [hasOpenedCelebration, setHasOpenedCelebration] = useState(false);
  const [archiveMonthContext, setArchiveMonthContext] = useState<Date | null>(null);
  const [hasExistingProgress, setHasExistingProgress] = useState(false);
  const [needsFirstLoginSetup, setNeedsFirstLoginSetup] = useState(false);
  const [showAuthButtons, setShowAuthButtons] = useState(false);
  
  // Fetch puzzles from API (mode-aware, guest-aware)
  // Guests use /api/puzzles/guest, authenticated users use mode-specific endpoints
  const puzzlesEndpoint = isAuthenticated 
    ? (isLocalMode ? '/api/user/puzzles' : '/api/puzzles')
    : '/api/puzzles/guest';
  const { data: puzzles = [], isLoading: puzzlesLoading } = useQuery<Puzzle[]>({
    queryKey: [puzzlesEndpoint],
    // Endpoint includes authentication state in its path, no need for separate cache key
  });
  
  // Track if we've shown welcome page and auto-navigated to selection
  const [hasAutoNavigated, setHasAutoNavigated] = useState(false);
  
  useEffect(() => {
    if (isLoading) return;
    
    if (showSplash) {
      // Show splash, then welcome page briefly, then auto-navigate to selection
      setTimeout(() => {
        setShowSplash(false);
        setCurrentScreen("welcome");
      }, 3000);
    }
  }, [isLoading, showSplash]);
  
  // Auto-navigate from welcome to selection after a brief display (2 seconds)
  // Only auto-navigate if we're not showing auth buttons (after sign-out, we show buttons)
  useEffect(() => {
    if (currentScreen === "welcome" && !hasAutoNavigated && !showAuthButtons) {
      const timer = setTimeout(() => {
        setCurrentScreen("selection");
        setHasAutoNavigated(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [currentScreen, hasAutoNavigated, showAuthButtons]);
  
  // Check for first login when user becomes authenticated and is on selection screen
  // This catches cases where onSuccess callback ran before auth state was fully updated
  useEffect(() => {
    if (currentScreen === "selection" && isAuthenticated && user && !needsFirstLoginSetup) {
      if (!hasCompletedFirstLogin()) {
        setNeedsFirstLoginSetup(true);
        setCurrentScreen("generating-questions");
      }
    }
  }, [currentScreen, isAuthenticated, user, needsFirstLoginSetup, hasCompletedFirstLogin]);

  const getDailyPuzzle = (): Puzzle | undefined => {
    if (puzzles.length === 0) return undefined;
    
    // Get today's date in YYYY-MM-DD format
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayDate = `${year}-${month}-${day}`;
    
    // Try to find today's puzzle - return undefined if no puzzle for today
    // This ensures the Play button is disabled when there's no puzzle available
    return puzzles.find(p => p.date === todayDate);
  };

  const currentPuzzle = selectedPuzzleId 
    ? puzzles.find(p => p.id.toString() === selectedPuzzleId) || getDailyPuzzle()
    : getDailyPuzzle();

  const handlePlayPuzzle = (puzzleId: string) => {
    const puzzle = puzzles.find(p => p.id.toString() === puzzleId);
    if (!puzzle) return;
    
    // Check if this puzzle has any existing progress (completed or in-progress)
    let isCompleted = false;
    let hasProgress = false;
    
    if (isAuthenticated && !loadingAttempts && gameAttempts) {
      // For authenticated users, check Supabase data
      const numericPuzzleId = parseInt(puzzleId);
      const existingAttempt = gameAttempts.find(
        attempt => attempt.puzzleId === numericPuzzleId
      );
      if (existingAttempt) {
        isCompleted = existingAttempt.result !== null;
        hasProgress = isCompleted || (existingAttempt.numGuesses ?? 0) > 0;
      }
    } else if (!isAuthenticated) {
      // For guest users, check localStorage
      const storedStats = localStorage.getItem("elementle-stats");
      if (storedStats) {
        const stats = JSON.parse(storedStats);
        // Format the canonical date to match the key format used in localStorage
        const formattedAnswer = formatCanonicalDate(puzzle.answerDateCanonical);
        const completion = stats.puzzleCompletions?.[formattedAnswer];
        isCompleted = !!(completion && completion.completed);
        hasProgress = isCompleted;
      }
      // Also check for in-progress games in localStorage
      const inProgressKey = `puzzle-progress-${formatCanonicalDate(puzzle.answerDateCanonical)}`;
      const savedProgress = localStorage.getItem(inProgressKey);
      if (savedProgress) {
        const progress = JSON.parse(savedProgress);
        if (progress.guessRecords && progress.guessRecords.length > 0) {
          hasProgress = true;
        }
      }
    }
    
    if (isCompleted) {
      // Show game screen first, then celebration
      setShowCelebrationFirst(true);
      setHasOpenedCelebration(false);
    } else {
      setShowCelebrationFirst(false);
      setHasOpenedCelebration(false);
    }
    
    setHasExistingProgress(hasProgress);
    setSelectedPuzzleId(puzzleId);
    setPreviousScreen("archive");
    setCurrentScreen("play");
  };
  
  const handlePlayToday = () => {
    setSelectedPuzzleId(null);
    setPreviousScreen("selection");
    
    // Check if today's puzzle has any existing progress (completed or in-progress)
    const todayPuzzle = getDailyPuzzle();
    let isCompleted = false;
    let hasProgress = false;
    
    if (todayPuzzle) {
      if (isAuthenticated && !loadingAttempts && gameAttempts) {
        // For authenticated users, check Supabase data
        const existingAttempt = gameAttempts.find(
          attempt => attempt.puzzleId === todayPuzzle.id
        );
        if (existingAttempt) {
          isCompleted = existingAttempt.result !== null;
          hasProgress = isCompleted || (existingAttempt.numGuesses ?? 0) > 0;
        }
      } else if (!isAuthenticated) {
        // For guest users, check localStorage
        const storedStats = localStorage.getItem("elementle-stats");
        if (storedStats) {
          const stats = JSON.parse(storedStats);
          // Format canonical date to match the key format used in localStorage
          const formattedAnswer = formatCanonicalDate(todayPuzzle.answerDateCanonical);
          const completion = stats.puzzleCompletions?.[formattedAnswer];
          isCompleted = !!(completion && completion.completed);
          hasProgress = isCompleted;
        }
        // Also check for in-progress games in localStorage
        const inProgressKey = `puzzle-progress-${formatCanonicalDate(todayPuzzle.answerDateCanonical)}`;
        const savedProgress = localStorage.getItem(inProgressKey);
        if (savedProgress) {
          const progress = JSON.parse(savedProgress);
          if (progress.guessRecords && progress.guessRecords.length > 0) {
            hasProgress = true;
          }
        }
      }
      
      if (isCompleted) {
        // Show game screen first, then celebration
        setShowCelebrationFirst(true);
        setHasOpenedCelebration(false);
      } else {
        setShowCelebrationFirst(false);
        setHasOpenedCelebration(false);
      }
    } else {
      setShowCelebrationFirst(false);
      setHasOpenedCelebration(false);
    }
    
    setHasExistingProgress(hasProgress);
    setCurrentScreen("play");
  };

  // Global mode handlers (always use region data)
  const handlePlayGlobal = () => {
    setGameMode('global');
    handlePlayToday();
  };

  const handleStatsGlobal = () => {
    setGameMode('global');
    setStatsReturnScreen("selection");
    setCurrentScreen("stats");
  };

  const handleArchiveGlobal = () => {
    setGameMode('global');
    setCurrentScreen("archive");
  };

  const handleOptionsGlobal = () => {
    setGameMode('global');
    setPreviousScreen("selection");
    setCurrentScreen("options");
  };

  // Local mode handlers (always use user data)
  const handlePlayLocal = () => {
    setGameMode('local');
    handlePlayToday();
  };

  const handleStatsLocal = () => {
    setGameMode('local');
    setStatsReturnScreen("selection");
    setCurrentScreen("stats");
  };

  const handleArchiveLocal = () => {
    setGameMode('local');
    setCurrentScreen("archive");
  };

  const handleOptionsLocal = () => {
    setGameMode('local');
    setPreviousScreen("selection");
    setCurrentScreen("options");
  };
  
  // Handle login success - check if user needs first login setup
  const handleLoginSuccess = () => {
    if (isAuthenticated && !hasCompletedFirstLogin()) {
      // User hasn't completed first login - show GeneratingQuestionsScreen
      setNeedsFirstLoginSetup(true);
      setCurrentScreen("generating-questions");
    } else {
      setCurrentScreen("selection");
    }
  };
  
  // Handle completion of GeneratingQuestionsScreen (from first login)
  const handleGeneratingQuestionsComplete = async () => {
    await markFirstLoginCompleted();
    setNeedsFirstLoginSetup(false);
    setCurrentScreen("selection");
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
      <AdBannerContext.Provider value={false}>
        <SplashScreen 
          onLogin={() => setCurrentScreen("login")}
          onSignup={() => setCurrentScreen("signup")}
        />
      </AdBannerContext.Provider>
    );
  }

  // Screens where ad banner should never appear (splash, welcome, play/intro, login, signup, forgot-password, generating-questions)
  const hideAdOnScreens: Screen[] = ["splash", "welcome", "play", "login", "signup", "forgot-password", "generating-questions"];
  const shouldShowAd = !hideAdOnScreens.includes(currentScreen);

  return (
    <AdBannerContext.Provider value={shouldShowAd}>
      <div className="relative w-full min-h-screen">
        <AnimatePresence mode="popLayout">
        {currentScreen === "welcome" && (
          <motion.div key="welcome" className="w-full" {...pageVariants.fadeIn} transition={pageTransition}>
            <WelcomePage 
              onLogin={() => {
                setShowAuthButtons(false);
                setCurrentScreen("login");
              }}
              onSignup={() => {
                setShowAuthButtons(false);
                setCurrentScreen("signup");
              }}
              onContinueAsGuest={() => {
                setShowAuthButtons(false);
                setCurrentScreen("selection");
              }}
              showAuthButtons={showAuthButtons}
            />
          </motion.div>
        )}

        {currentScreen === "login" && (
          <motion.div key="login" className="w-full" {...pageVariants.fadeIn} transition={pageTransition}>
            <AuthPage 
              mode="login"
              onSuccess={handleLoginSuccess}
              onSwitchMode={() => setCurrentScreen("signup")}
              onBack={() => setCurrentScreen("welcome")}
              onForgotPassword={() => setCurrentScreen("forgot-password")}
              onContinueAsGuest={() => setCurrentScreen("selection")}
            />
          </motion.div>
        )}

        {currentScreen === "signup" && (
          <motion.div key="signup" className="w-full" {...pageVariants.fadeIn} transition={pageTransition}>
            <AuthPage 
              mode="signup"
              onSuccess={() => setCurrentScreen("selection")}
              onSwitchMode={() => setCurrentScreen("login")}
              onBack={() => setCurrentScreen("welcome")}
              onContinueAsGuest={() => setCurrentScreen("selection")}
            />
          </motion.div>
        )}

        {currentScreen === "forgot-password" && (
          <motion.div key="forgot-password" className="absolute w-full top-0 left-0" {...pageVariants.slideRight} transition={pageTransition}>
            <ForgotPasswordPage 
              onBack={() => setCurrentScreen("login")}
            />
          </motion.div>
        )}

        {currentScreen === "generating-questions" && user && (
          <motion.div key="generating-questions" className="w-full" {...pageVariants.fadeIn} transition={pageTransition}>
            <GeneratingQuestionsScreen
              userId={user.id}
              region={profile?.region || "GB"}
              postcode={profile?.postcode || ""}
              onComplete={handleGeneratingQuestionsComplete}
            />
          </motion.div>
        )}

        {currentScreen === "selection" && (
          <motion.div key="selection" className="w-full" {...pageVariants.fadeIn} transition={pageTransition}>
            <GameSelectionPage 
              onPlayGame={handlePlayGlobal}
              onViewStats={handleStatsGlobal}
              onViewArchive={handleArchiveGlobal}
              onOpenSettings={() => setCurrentScreen("settings")}
              onOpenOptions={handleOptionsGlobal}
              onLogin={() => setCurrentScreen("login")}
              onRegister={() => setCurrentScreen("signup")}
              todayPuzzleId={getDailyPuzzle()?.id}
              todayPuzzleAnswerDateCanonical={getDailyPuzzle()?.answerDateCanonical}
              onPlayGameLocal={handlePlayLocal}
              onViewStatsLocal={handleStatsLocal}
              onViewArchiveLocal={handleArchiveLocal}
              onOpenOptionsLocal={handleOptionsLocal}
            />
          </motion.div>
        )}

        {currentScreen === "play" && currentPuzzle && (
          <motion.div key="play" className="absolute w-full top-0 left-0" {...pageVariants.slideLeft} transition={pageTransition}>
            <PlayPage
              puzzleId={currentPuzzle.id}
              puzzleDate={currentPuzzle.date}
              answerDateCanonical={currentPuzzle.answerDateCanonical}
              eventTitle={currentPuzzle.eventTitle}
              eventDescription={currentPuzzle.eventDescription}
              category={currentPuzzle.category}
              clue1={currentPuzzle.clue1}
              clue2={currentPuzzle.clue2}
              maxGuesses={5}
              fromArchive={previousScreen === "archive"}
              hasExistingProgress={hasExistingProgress}
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
          </motion.div>
        )}

        {currentScreen === "play" && !currentPuzzle && (
          <motion.div key="play-loading" className="absolute w-full top-0 left-0" {...pageVariants.fadeIn} transition={pageTransition}>
            <div className="min-h-screen flex items-center justify-center">
              <div className="text-lg">Loading puzzle...</div>
            </div>
          </motion.div>
        )}

        {currentScreen === "stats" && (
          <motion.div key="stats" className="absolute w-full top-0 left-0" {...pageVariants.slideLeft} transition={pageTransition}>
            <StatsPage 
              onBack={() => setCurrentScreen(statsReturnScreen)}
            />
          </motion.div>
        )}

        {currentScreen === "archive" && (
          <motion.div key="archive" className="absolute w-full top-0 left-0" {...pageVariants.slideLeft} transition={pageTransition}>
            <ArchivePage 
              onBack={() => {
                setArchiveMonthContext(null);
                setCurrentScreen("selection");
              }}
              onPlayPuzzle={handlePlayPuzzle}
              puzzles={puzzles as any[]}
              initialMonth={archiveMonthContext}
              onMonthChange={setArchiveMonthContext}
            />
          </motion.div>
        )}

        {currentScreen === "settings" && (
          <motion.div key="settings" className="absolute w-full top-0 left-0" {...pageVariants.slideDown} transition={pageTransition}>
            <SettingsPage 
              onBack={() => setCurrentScreen("selection")}
              onOpenOptions={() => {
                setPreviousScreen("settings");
                setCurrentScreen("options");
              }}
              onAccountInfo={() => setCurrentScreen("account-info")}
              onBugReport={() => setCurrentScreen("bug-report")}
              onFeedback={() => setCurrentScreen("feedback")}
              onPrivacy={() => setCurrentScreen("privacy")}
              onTerms={() => setCurrentScreen("terms")}
              onAbout={() => setCurrentScreen("about")}
              onSignOut={() => {
                setShowAuthButtons(true);
                setCurrentScreen("welcome");
              }}
              onLogin={() => setCurrentScreen("login")}
              onRegister={() => setCurrentScreen("signup")}
            />
          </motion.div>
        )}

        {currentScreen === "options" && (
          <motion.div key="options" className="absolute w-full top-0 left-0" {...pageVariants.slideLeft} transition={pageTransition}>
            <OptionsPage 
              onBack={() => setCurrentScreen(previousScreen)}
            />
          </motion.div>
        )}

        {currentScreen === "account-info" && (
          <motion.div key="account-info" className="absolute w-full top-0 left-0" {...pageVariants.slideLeft} transition={pageTransition}>
            <AccountInfoPage 
              onBack={() => setCurrentScreen("settings")}
            />
          </motion.div>
        )}

        {currentScreen === "bug-report" && (
          <motion.div key="bug-report" className="absolute w-full top-0 left-0" {...pageVariants.slideLeft} transition={pageTransition}>
            <BugReportForm onBack={() => setCurrentScreen("settings")} />
          </motion.div>
        )}

        {currentScreen === "feedback" && (
          <motion.div key="feedback" className="absolute w-full top-0 left-0" {...pageVariants.slideLeft} transition={pageTransition}>
            <FeedbackForm onBack={() => setCurrentScreen("settings")} />
          </motion.div>
        )}

        {currentScreen === "privacy" && (
          <motion.div key="privacy" className="absolute w-full top-0 left-0" {...pageVariants.slideLeft} transition={pageTransition}>
            <PrivacyPage onBack={() => setCurrentScreen("settings")} />
          </motion.div>
        )}

        {currentScreen === "terms" && (
          <motion.div key="terms" className="absolute w-full top-0 left-0" {...pageVariants.slideLeft} transition={pageTransition}>
            <TermsPage onBack={() => setCurrentScreen("settings")} />
          </motion.div>
        )}

        {currentScreen === "about" && (
          <motion.div key="about" className="absolute w-full top-0 left-0" {...pageVariants.slideLeft} transition={pageTransition}>
            <AboutPage onBack={() => setCurrentScreen("settings")} />
          </motion.div>
        )}
      </AnimatePresence>
      </div>
      <AdBanner />
    </AdBannerContext.Provider>
  );
}
