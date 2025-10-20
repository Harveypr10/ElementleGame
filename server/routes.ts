// Server routes for Elementle app with Supabase Auth
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { verifySupabaseAuth, requireAdmin } from "./supabaseAuth";
import { supabaseAdmin } from "./supabase";

export async function registerRoutes(app: Express): Promise<Server> {
  // Supabase config endpoint (public - anon key is safe to expose)
  app.get("/api/supabase-config", (req, res) => {
    res.json({
      url: process.env.SUPABASE_URL,
      anonKey: process.env.SUPABASE_ANON_KEY,
    });
  });

  // Server-side signup endpoint - creates both Supabase Auth user and profile
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { email, password, firstName, lastName } = req.body;

      // Create auth user
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Auto-confirm email in development
        user_metadata: {
          first_name: firstName,
          last_name: lastName,
        },
      });

      if (authError || !authData.user) {
        return res.status(400).json({ error: authError?.message || 'Failed to create user' });
      }

      // Create user profile
      await storage.upsertUserProfile({
        id: authData.user.id,
        email: authData.user.email!,
        firstName,
        lastName,
      });

      res.json({ user: authData.user });
    } catch (error) {
      console.error("Signup error:", error);
      res.status(500).json({ error: "Failed to sign up" });
    }
  });

  // Auth routes - Supabase handles these client-side mostly,
  // but we need profile endpoints
  app.get("/api/auth/profile", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const profile = await storage.getUserProfile(userId);
      if (!profile) {
        return res.status(404).json({ error: "Profile not found" });
      }
      res.json(profile);
    } catch (error) {
      console.error("Error fetching profile:", error);
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  // Puzzle routes (public)
  app.get("/api/puzzles", async (req, res) => {
    try {
      const puzzles = await storage.getAllPuzzles();
      res.json(puzzles);
    } catch (error) {
      console.error("Error fetching puzzles:", error);
      res.status(500).json({ error: "Failed to fetch puzzles" });
    }
  });

  app.get("/api/puzzles/:date", async (req, res) => {
    try {
      const puzzle = await storage.getPuzzleByDate(req.params.date);
      if (!puzzle) {
        return res.status(404).json({ error: "Puzzle not found" });
      }
      res.json(puzzle);
    } catch (error) {
      console.error("Error fetching puzzle:", error);
      res.status(500).json({ error: "Failed to fetch puzzle" });
    }
  });

  // User settings routes
  app.get("/api/settings", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const settings = await storage.getUserSettings(userId);
      res.json(settings || {});
    } catch (error) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.post("/api/settings", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const settings = await storage.upsertUserSettings({
        userId,
        ...req.body,
      });
      res.json(settings);
    } catch (error) {
      console.error("Error saving settings:", error);
      res.status(500).json({ error: "Failed to save settings" });
    }
  });

  // Game attempt routes
  app.post("/api/game-attempts", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const gameAttempt = await storage.createGameAttempt({
        userId,
        puzzleId: req.body.puzzleId,
        result: req.body.result,
        numGuesses: req.body.numGuesses,
      });
      res.json(gameAttempt);
    } catch (error) {
      console.error("Error creating game attempt:", error);
      res.status(500).json({ error: "Failed to create game attempt" });
    }
  });

  app.get("/api/game-attempts/user", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const attempts = await storage.getGameAttemptsByUser(userId);
      res.json(attempts);
    } catch (error) {
      console.error("Error fetching game attempts:", error);
      res.status(500).json({ error: "Failed to fetch game attempts" });
    }
  });

  app.patch("/api/game-attempts/:id", verifySupabaseAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const gameAttempt = await storage.updateGameAttempt(id, req.body);
      res.json(gameAttempt);
    } catch (error) {
      console.error("Error updating game attempt:", error);
      res.status(500).json({ error: "Failed to update game attempt" });
    }
  });

  // Guess routes
  app.post("/api/guesses", verifySupabaseAuth, async (req: any, res) => {
    try {
      const guess = await storage.createGuess({
        gameAttemptId: req.body.gameAttemptId,
        guessValue: req.body.guessValue,
        feedbackResult: req.body.feedbackResult,
      });
      res.json(guess);
    } catch (error) {
      console.error("Error creating guess:", error);
      res.status(500).json({ error: "Failed to create guess" });
    }
  });

  app.get("/api/guesses/:gameAttemptId", verifySupabaseAuth, async (req: any, res) => {
    try {
      const guesses = await storage.getGuessesByGameAttempt(
        parseInt(req.params.gameAttemptId)
      );
      res.json(guesses);
    } catch (error) {
      console.error("Error fetching guesses:", error);
      res.status(500).json({ error: "Failed to fetch guesses" });
    }
  });

  // Stats routes
  app.get("/api/stats", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const stats = await storage.getUserStats(userId);
      res.json(stats || {});
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  app.post("/api/stats", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const stats = await storage.upsertUserStats({
        userId,
        ...req.body,
      });
      res.json(stats);
    } catch (error) {
      console.error("Error updating stats:", error);
      res.status(500).json({ error: "Failed to update stats" });
    }
  });

  // Admin export route
  app.get("/api/admin/export", verifySupabaseAuth, requireAdmin, async (req, res) => {
    try {
      const format = (req.query.format as string) || "json";
      const data = await storage.getAllGameAttemptsForExport();

      if (format === "csv") {
        // Convert to CSV
        const headers = ["User Email", "Puzzle Date", "Target Date", "Event Title", "Result", "Guesses", "Completed At", "Guess Details"];
        const rows = data.map((row: any) => [
          row.userEmail || "guest",
          row.puzzleDate,
          row.targetDate,
          row.eventTitle,
          row.result,
          row.numGuesses,
          row.completedAt,
          JSON.stringify(row.guesses),
        ]);

        const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename="elementle-export-${Date.now()}.csv"`);
        res.send(csv);
      } else {
        res.json(data);
      }
    } catch (error) {
      console.error("Error exporting data:", error);
      res.status(500).json({ error: "Failed to export data" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
