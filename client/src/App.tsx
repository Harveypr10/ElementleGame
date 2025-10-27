import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SupabaseProvider } from "@/lib/SupabaseProvider";
import { PreloadProvider } from "@/lib/PreloadProvider";
import { SettingsProvider } from "@/lib/SettingsProvider";
import { GuessCacheProvider } from "@/contexts/GuessCacheContext";
import Home from "@/pages/Home";
import NotFound from "@/pages/not-found";
import { AnimatePresence } from "framer-motion";

import { OptionsPage } from "@/components/OptionsPage";
import { SettingsPage } from "@/components/SettingsPage";
import { PlayPage } from "@/components/PlayPage";
import { StatsPage } from "@/components/StatsPage";
import { ArchivePage } from "@/components/ArchivePage";
import { StreakCelebrationPopup } from "@/components/StreakCelebrationPopup";
import { RoutePersistence } from "./lib/RoutePersistence";

function Router() {
  const [location] = useLocation();
  
  return (
    <AnimatePresence mode="wait" initial={false}>
      <Switch location={location} key={location}>
        <Route path="/" component={Home} />

      {/* 🔹 Preview routes for direct access */}
      <Route path="/options">
        <OptionsPage onBack={() => console.log("Back from Options")} />
      </Route>

      <Route path="/settings">
        <SettingsPage
          onBack={() => console.log("Back from Settings")}
          onOpenOptions={() => console.log("Open Options")}
          onAccountInfo={() => console.log("Account Info")}
        />
      </Route>

      <Route path="/play">
        <PlayPage
          onBack={() => console.log("Back from Play")}
          viewOnly={false}
          eventTitle="Battle of Hastings"
          guesses={[]}
          currentInput=""
          maxGuesses={6}
        />
      </Route>

      <Route path="/stats">
        <StatsPage onBack={() => console.log("Back from Stats")} />
      </Route>

      <Route path="/archive">
        <ArchivePage onBack={() => console.log("Back from Archive")} />
      </Route>

      <Route path="/streak">
        <StreakCelebrationPopup streak={2} onClose={() => console.log("Closed streak popup")} />
      </Route>

      <Route component={NotFound} />
      </Switch>
    </AnimatePresence>
  );
}

function App() {
  return (
    <SupabaseProvider>
      <QueryClientProvider client={queryClient}>
        <PreloadProvider>
          <SettingsProvider>
            <GuessCacheProvider>
              <TooltipProvider>
                <Toaster />
                  <RoutePersistence />
                <Router />
              </TooltipProvider>
            </GuessCacheProvider>
          </SettingsProvider>
        </PreloadProvider>
      </QueryClientProvider>
    </SupabaseProvider>
  );
}

export default App;
