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

      // Create auth user - email verification will be required
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: false, // Require email verification
        user_metadata: {
          first_name: firstName,
          last_name: lastName,
        },
      });

      if (authError || !authData.user) {
        return res.status(400).json({ error: authError?.message || 'Failed to create user' });
      }

      // Create user profile with email verification status
      await storage.upsertUserProfile({
        id: authData.user.id,
        email: authData.user.email!,
        firstName,
        lastName,
        emailVerified: !!authData.user.email_confirmed_at,
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
      
      // Get profile from database
      const profile = await storage.getUserProfile(userId);
      if (!profile) {
        return res.status(404).json({ error: "Profile not found" });
      }

      // Sync email verification status from Supabase Auth
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (authUser?.user && authUser.user.email_confirmed_at) {
        const emailVerified = !!authUser.user.email_confirmed_at;
        if (profile.emailVerified !== emailVerified) {
          // Update profile with verified status
          await storage.upsertUserProfile({
            ...profile,
            emailVerified,
          });
          profile.emailVerified = emailVerified;
        }
      }

      res.json(profile);
    } catch (error) {
      console.error("Error fetching profile:", error);
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  app.patch("/api/auth/profile", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { firstName, lastName, email } = req.body;

      // Get current profile to check if email changed
      const currentProfile = await storage.getUserProfile(userId);
      const emailChanged = currentProfile && currentProfile.email !== email;

      // Update profile in database
      // IMPORTANT: Never trust client-provided emailVerified
      // Always set to false if email changed, let Supabase Auth sync handle verification
      const updatedProfile = await storage.upsertUserProfile({
        id: userId,
        email,
        firstName,
        lastName,
        emailVerified: emailChanged ? false : (currentProfile?.emailVerified ?? false),
      });

      res.json(updatedProfile);
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ error: "Failed to update profile" });
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
      
      // Defensive normalization: convert legacy "win"/"loss" to "won"/"lost"
      let result = req.body.result;
      if (result === "win") result = "won";
      if (result === "loss") result = "lost";
      
      const gameAttempt = await storage.createGameAttempt({
        userId,
        puzzleId: req.body.puzzleId,
        result,
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
      const userId = req.user.id;
      
      // Verify ownership before updating
      const allAttempts = await storage.getGameAttemptsByUser(userId);
      const ownedAttempt = allAttempts.find(a => a.id === id);
      
      if (!ownedAttempt) {
        return res.status(403).json({ error: "Forbidden: You do not own this game attempt" });
      }
      
      // Defensive normalization: convert legacy "win"/"loss" to "won"/"lost"
      const updates = { ...req.body };
      if (updates.result === "win") updates.result = "won";
      if (updates.result === "loss") updates.result = "lost";
      
      const gameAttempt = await storage.updateGameAttempt(id, updates);
      res.json(gameAttempt);
    } catch (error) {
      console.error("Error updating game attempt:", error);
      res.status(500).json({ error: "Failed to update game attempt" });
    }
  });

  // Guess routes
  app.post("/api/guesses", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const gameAttemptId = req.body.gameAttemptId;
      
      // Verify ownership of the game attempt before creating guess
      const allAttempts = await storage.getGameAttemptsByUser(userId);
      const ownedAttempt = allAttempts.find(a => a.id === gameAttemptId);
      
      if (!ownedAttempt) {
        return res.status(403).json({ error: "Forbidden: You do not own this game attempt" });
      }
      
      const guess = await storage.createGuess({
        gameAttemptId,
        guessValue: req.body.guessValue,
        feedbackResult: req.body.feedbackResult,
      });
      res.json(guess);
    } catch (error) {
      console.error("Error creating guess:", error);
      res.status(500).json({ error: "Failed to create guess" });
    }
  });

  // Get recent guesses with puzzle IDs for caching (must be before parameterized route)
  app.get("/api/guesses/recent", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const since = req.query.since as string;
      
      if (!since) {
        return res.status(400).json({ error: "Missing 'since' query parameter" });
      }
      
      const guesses = await storage.getRecentGuessesWithPuzzleIds(userId, since);
      res.json(guesses);
    } catch (error) {
      console.error("Error fetching recent guesses:", error);
      res.status(500).json({ error: "Failed to fetch recent guesses" });
    }
  });

  app.get("/api/guesses/:gameAttemptId", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const gameAttemptId = parseInt(req.params.gameAttemptId);
      
      // Verify ownership of the game attempt before fetching guesses
      const allAttempts = await storage.getGameAttemptsByUser(userId);
      const ownedAttempt = allAttempts.find(a => a.id === gameAttemptId);
      
      if (!ownedAttempt) {
        return res.status(403).json({ error: "Forbidden: You do not own this game attempt" });
      }
      
      const guesses = await storage.getGuessesByGameAttempt(gameAttemptId);
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
        const headers = ["User Email", "Puzzle Date", "Target Date", "Answer Date","Event Title", "Result", "Guesses", "Completed At", "Guess Details"];
        const rows = data.map((row: any) => [
          row.userEmail || "guest",
          row.puzzleDate,
          row.targetDate,
          row.answerDate || "",
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
