import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SupabaseProvider } from "@/lib/SupabaseProvider";
import { GuessCacheProvider } from "@/contexts/GuessCacheContext";
import Home from "@/pages/Home";
import NotFound from "@/pages/not-found";

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
        <GuessCacheProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </GuessCacheProvider>
      </QueryClientProvider>
    </SupabaseProvider>
  );
}

export default App;
