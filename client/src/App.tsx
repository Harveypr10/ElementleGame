import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SupabaseProvider } from "@/lib/SupabaseProvider";
import { PreloadProvider } from "@/lib/PreloadProvider";
import { SettingsProvider } from "@/lib/SettingsProvider";
import { SpinnerProvider } from "@/lib/SpinnerProvider";
import { GuessCacheProvider } from "@/contexts/GuessCacheContext";
import { GameModeProvider } from "@/contexts/GameModeContext";
import Home from "@/pages/Home";
import NotFound from "@/pages/not-found";

import { OptionsPage } from "@/components/OptionsPage";
import { SettingsPage } from "@/components/SettingsPage";
import { PlayPage } from "@/components/PlayPage";
import { StatsPage } from "@/components/StatsPage";
import { ArchivePage } from "@/components/ArchivePage";
import { StreakCelebrationPopup } from "@/components/StreakCelebrationPopup";
import { RoutePersistence } from "./lib/RoutePersistence";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <SupabaseProvider>
      <QueryClientProvider client={queryClient}>
        <SpinnerProvider>
          <PreloadProvider>
            <SettingsProvider>
              <GameModeProvider>
                <GuessCacheProvider>
                  <TooltipProvider>
                    <Toaster />
                    <RoutePersistence />
                    <Router />
                  </TooltipProvider>
                </GuessCacheProvider>
              </GameModeProvider>
            </SettingsProvider>
          </PreloadProvider>
        </SpinnerProvider>
      </QueryClientProvider>
    </SupabaseProvider>
  );
}

export default App;
