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
    const puzzleId = req.body.puzzleId;

    console.log('[POST /api/game-attempts] Request:', { userId, puzzleId, numGuesses: req.body.numGuesses, result: req.body.result });

    if (!puzzleId) {
      return res.status(400).json({ error: "Missing puzzleId in body" });
    }

    // Defensive normalization: convert legacy "win"/"loss" to "won"/"lost"
    let result = req.body.result;
    if (result === "win") result = "won";
    if (result === "loss") result = "lost";

    // Try to find an existing open attempt
    const existing = await storage.getOpenAttemptByUserAndPuzzle(userId, puzzleId);

    if (existing) {
      console.log('[POST /api/game-attempts] Found existing open attempt:', { id: existing.id, numGuesses: existing.numGuesses });
      
      // If client sends completion data (result), apply it along with numGuesses
      // This handles cases where POST is used for completion instead of PATCH
      const updates: any = {};
      
      if (result && result !== null) {
        updates.result = result;
        console.log('[POST /api/game-attempts] Client sent result in POST:', result);
      }
      
      if (typeof req.body.numGuesses === "number" && req.body.numGuesses > (existing.numGuesses ?? 0)) {
        updates.numGuesses = req.body.numGuesses;
      }
      
      if (Object.keys(updates).length > 0) {
        const updated = await storage.updateGameAttempt(existing.id, updates);
        console.log('[POST /api/game-attempts] Updated existing attempt:', { result: updated.result, numGuesses: updated.numGuesses });
        return res.json(updated);
      }
      
      return res.json(existing);
    }

    console.log('[POST /api/game-attempts] No existing open attempt found, checking for ANY attempt...');
    
    // Check if ANY attempt exists for this user/puzzle (including completed ones)
    const anyAttempt = await storage.getGameAttemptByUserAndPuzzle(userId, puzzleId);
    
    if (anyAttempt) {
      // An attempt exists (likely completed) - don't create a new one or overwrite it
      console.log('[POST /api/game-attempts] Found existing attempt (possibly completed):', { 
        id: anyAttempt.id, 
        result: anyAttempt.result, 
        numGuesses: anyAttempt.numGuesses 
      });
      
      // If it's completed, don't allow mutation - just return it
      if (anyAttempt.result !== null) {
        console.log('[POST /api/game-attempts] Attempt is completed, returning without mutation');
        return res.json(anyAttempt);
      }
      
      // If somehow result is null but we didn't find it in getOpenAttemptByUserAndPuzzle
      // (shouldn't happen, but defensive), update numGuesses if needed
      if (typeof req.body.numGuesses === "number" && req.body.numGuesses > (anyAttempt.numGuesses ?? 0)) {
        await storage.updateGameAttempt(anyAttempt.id, { numGuesses: req.body.numGuesses });
      }
      return res.json({ ...anyAttempt, numGuesses: Math.max(anyAttempt.numGuesses ?? 0, req.body.numGuesses ?? 0) });
    }
    
    // No attempt exists at all - create a fresh one
    console.log('[POST /api/game-attempts] No attempt exists, creating fresh one');
    const gameAttempt = await storage.createGameAttempt({
      userId,
      puzzleId,
      result: result ?? null,
      numGuesses: req.body.numGuesses ?? 0,
    });

    console.log('[POST /api/game-attempts] Created attempt:', { id: gameAttempt.id, numGuesses: gameAttempt.numGuesses });

    res.json(gameAttempt);
  } catch (error) {
    console.error("[POST /api/game-attempts] Error:", error);
    res.status(500).json({ error: "Failed to create/upsert game attempt" });
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

    console.log('[PATCH /api/game-attempts/:id] Request:', { id, userId, updates: req.body });

    // Verify ownership
    const allAttempts = await storage.getGameAttemptsByUser(userId);
    const ownedAttempt = allAttempts.find(a => a.id === id);

    if (!ownedAttempt) {
      console.error('[PATCH /api/game-attempts/:id] Attempt not owned by user:', id);
      return res.status(403).json({ error: "Forbidden: You do not own this game attempt" });
    }

    console.log('[PATCH /api/game-attempts/:id] Current state:', {
      result: ownedAttempt.result,
      numGuesses: ownedAttempt.numGuesses,
      completedAt: ownedAttempt.completedAt
    });

    // Defensive normalization
    const updates: any = { ...req.body };
    if (updates.result === "win") updates.result = "won";
    if (updates.result === "loss") updates.result = "lost";

    // Prevent mutating identity columns
    delete updates.userId;
    delete updates.user_id;
    delete updates.puzzleId;
    delete updates.puzzle_id;

    // Ensure numGuesses never decreases
    if (typeof updates.numGuesses === "number") {
      const previousNumGuesses = ownedAttempt.numGuesses ?? 0;
      updates.numGuesses = Math.max(updates.numGuesses, previousNumGuesses);
      console.log('[PATCH /api/game-attempts/:id] numGuesses:', { previous: previousNumGuesses, requested: req.body.numGuesses, final: updates.numGuesses });
    }

    const gameAttempt = await storage.updateGameAttempt(id, updates);
    console.log('[PATCH /api/game-attempts/:id] Updated:', { result: gameAttempt.result, numGuesses: gameAttempt.numGuesses, completedAt: gameAttempt.completedAt });
    
    res.json(gameAttempt);
  } catch (error) {
    console.error("[PATCH /api/game-attempts/:id] Error:", error);
    res.status(500).json({ error: "Failed to update game attempt" });
  }
});

// Guess routes
app.post("/api/guesses", verifySupabaseAuth, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const gameAttemptId = req.body.gameAttemptId;

    console.log('[POST /api/guesses] Request:', { userId, gameAttemptId, guessValue: req.body.guessValue });

    if (!gameAttemptId) {
      return res.status(400).json({ error: "Missing gameAttemptId in body" });
    }

    // Verify ownership
    const allAttempts = await storage.getGameAttemptsByUser(userId);
    const ownedAttempt = allAttempts.find(a => a.id === gameAttemptId);

    if (!ownedAttempt) {
      console.error('[POST /api/guesses] Attempt not owned by user:', gameAttemptId);
      return res.status(403).json({ error: "Forbidden: You do not own this game attempt" });
    }

    // Block guesses if attempt already completed
    if (ownedAttempt.result !== null) {
      console.error('[POST /api/guesses] Attempt already completed with result:', ownedAttempt.result);
      return res.status(409).json({ error: "Attempt already completed; no further guesses allowed" });
    }

    console.log('[POST /api/guesses] Saving guess to database...');
    
    // Save the guess
    const guess = await storage.createGuess({
      gameAttemptId,
      guessValue: req.body.guessValue,
      feedbackResult: req.body.feedbackResult,
    });

    console.log('[POST /api/guesses] Guess saved:', guess.id);
    
    // Increment num_guesses
    await storage.incrementAttemptGuesses(gameAttemptId);
    
    // Read back to verify
    const updatedAttempt = await storage.getGameAttempt(gameAttemptId);
    console.log('[POST /api/guesses] After increment, numGuesses:', updatedAttempt?.numGuesses);

    res.json(guess);
  } catch (error) {
    console.error("[POST /api/guesses] Error:", error);
    res.status(500).json({ error: "Failed to create guess" });
  }
});

// Get recent guesses with puzzle IDs for caching
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

  app.get("/api/guesses/all", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const guesses = await storage.getAllGuessesWithPuzzleIds(userId);
      res.json(guesses);
    } catch (error) {
      console.error("Error fetching all guesses:", error);
      res.status(500).json({ error: "Failed to fetch all guesses" });
    }
  });


app.get("/api/guesses/:gameAttemptId", verifySupabaseAuth, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const gameAttemptId = parseInt(req.params.gameAttemptId);

    // Verify ownership
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

  app.post("/api/stats/recalculate", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const stats = await storage.recalculateUserStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error recalculating stats:", error);
      res.status(500).json({ error: "Failed to recalculate stats" });
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
