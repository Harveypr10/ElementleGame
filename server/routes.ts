// Server routes for Elementle app with Supabase Auth
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { verifySupabaseAuth, requireAdmin } from "./supabaseAuth";
import { supabaseAdmin } from "./supabase";
import { db } from "./db";
import { sql } from "drizzle-orm";

export async function registerRoutes(app: Express): Promise<Server> {
  // Supabase config endpoint (public - anon key is safe to expose)
  app.get("/api/supabase-config", (req, res) => {
    res.json({
      url: process.env.SUPABASE_URL,
      anonKey: process.env.SUPABASE_ANON_KEY,
    });
  });

  // Get all available regions
  app.get("/api/regions", async (req, res) => {
    try {
      const regions = await storage.getRegions();
      res.json(regions);
    } catch (error) {
      console.error("Error fetching regions:", error);
      res.status(500).json({ error: "Failed to fetch regions" });
    }
  });

  // Server-side signup endpoint - creates both Supabase Auth user and profile
  app.post("/api/auth/signup", async (req, res) => {
    try {
      // Accept camelCase from frontend (TypeScript convention)
      const { email, password, firstName, lastName, region, acceptedTerms, adsConsent } = req.body;

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

      const now = new Date();

      // Get the region's default date format
      const regions = await storage.getRegions();
      const finalRegion = region || (regions.length > 0 ? regions[0].code : null);
      const selectedRegion = regions.find(r => r.code === finalRegion);
      const defaultDateFormat = selectedRegion?.defaultDateFormat ?? 'ddmmyy';

      // Create user profile with consent fields and region
      const profileData: any = {
        id: authData.user.id,
        email: authData.user.email!,
        firstName,
        lastName,
        region: finalRegion,
        acceptedTerms: acceptedTerms ?? false,
        adsConsent: adsConsent ?? false,
      };

      // Set timestamps for consents that were accepted
      if (acceptedTerms) {
        profileData.acceptedTermsAt = now;
      }
      if (adsConsent) {
        profileData.adsConsentUpdatedAt = now;
      }

      await storage.upsertUserProfile(profileData);

      // Create user settings with default date format preference based on region
      await storage.upsertUserSettings({
        userId: authData.user.id,
        dateFormatPreference: defaultDateFormat,
        useRegionDefault: true,
        digitPreference: '6',
        soundsEnabled: true,
        darkMode: false,
        cluesEnabled: true,
        categoryPreferences: null,
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

      res.json(profile);
    } catch (error) {
      console.error("Error fetching profile:", error);
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  app.patch("/api/auth/profile", verifySupabaseAuth, async (req: any, res) => {
    try {
      console.log("PATCH /api/auth/profile body:", req.body);

      const userId = req.user.id;
      const { firstName, lastName, email, region, postcode, acceptedTerms, adsConsent } = req.body;

      const existing = await storage.getUserProfile(userId);
      if (!existing) {
        return res.status(404).json({ error: "Profile not found" });
      }

      const now = new Date();

      const updatedProfile = await storage.upsertUserProfile({
        id: userId,
        email: email ?? existing.email,
        firstName: firstName ?? existing.firstName,
        lastName: lastName ?? existing.lastName,
        region: region ?? existing.region ?? null,
        postcode: postcode !== undefined ? postcode : existing.postcode,
        acceptedTerms:
          acceptedTerms ?? existing.acceptedTerms ?? false,
        adsConsent:
          adsConsent ?? existing.adsConsent ?? false,
        acceptedTermsAt:
          acceptedTerms !== undefined &&
          acceptedTerms !== existing.acceptedTerms
            ? now
            : existing.acceptedTermsAt
            ? new Date(existing.acceptedTermsAt)
            : null,
        adsConsentUpdatedAt:
          adsConsent !== undefined &&
          adsConsent !== existing.adsConsent
            ? now
            : existing.adsConsentUpdatedAt
            ? new Date(existing.adsConsentUpdatedAt)
            : null,
        emailVerified: existing.emailVerified ?? false,
      });

      res.json(updatedProfile);
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });


  // Puzzle routes - REGION MODE (requires authentication for region context)
  app.get("/api/puzzles", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const profile = await storage.getUserProfile(userId);
      
      // Default to 'UK' if no region set
      const region = profile?.region || 'UK';
      
      console.log('[GET /api/puzzles] User profile region:', profile?.region, '| Using region:', region, '| userId:', userId);
      
      const allocatedQuestions = await storage.getAllocatedQuestionsByRegion(region);
      
      console.log('[GET /api/puzzles] Found allocated questions:', allocatedQuestions.length);
      
      // Transform to frontend-compatible format (keeping backward compatibility)
      const puzzles = allocatedQuestions.map(aq => ({
        id: aq.id, // This is now allocatedRegionId
        date: aq.puzzleDate,
        answerDateCanonical: aq.masterQuestion.answerDateCanonical,
        eventTitle: aq.masterQuestion.eventTitle,
        eventDescription: aq.masterQuestion.eventDescription,
        clue1: null, // Clues removed in new schema
        clue2: null, // Clues removed in new schema
        // Region-specific fields
        region: aq.region,
        allocatedRegionId: aq.id,
        masterQuestionId: aq.questionId,
      }));
      
      res.json(puzzles);
    } catch (error) {
      console.error("Error fetching puzzles:", error);
      res.status(500).json({ error: "Failed to fetch puzzles" });
    }
  });

  app.get("/api/puzzles/:date", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const profile = await storage.getUserProfile(userId);
      
      const region = profile?.region || 'UK';
      const allocatedQuestion = await storage.getAllocatedQuestionByRegionAndDate(region, req.params.date);
      
      if (!allocatedQuestion) {
        return res.status(404).json({ error: "Puzzle not found" });
      }
      
      // Transform to frontend-compatible format
      const puzzle = {
        id: allocatedQuestion.id,
        date: allocatedQuestion.puzzleDate,
        answerDateCanonical: allocatedQuestion.masterQuestion.answerDateCanonical,
        eventTitle: allocatedQuestion.masterQuestion.eventTitle,
        eventDescription: allocatedQuestion.masterQuestion.eventDescription,
        clue1: null, // Clues removed in new schema
        clue2: null, // Clues removed in new schema
        region: allocatedQuestion.region,
        allocatedRegionId: allocatedQuestion.id,
        masterQuestionId: allocatedQuestion.questionId,
      };
      
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
    
    // If dateFormatPreference is not provided, get it from user's region default
    let dateFormatPreference = req.body.dateFormatPreference;
    if (!dateFormatPreference && req.body.useRegionDefault !== false) {
      const profile = await storage.getUserProfile(userId);
      if (profile?.region) {
        const regions = await storage.getRegions();
        const userRegion = regions.find(r => r.code === profile.region);
        if (userRegion) {
          dateFormatPreference = userRegion.defaultDateFormat;
        }
      }
    }
    
    const settings = await storage.upsertUserSettings({
      userId,
      ...req.body,
      dateFormatPreference: dateFormatPreference || req.body.dateFormatPreference || 'ddmmyy',
    });
    res.json(settings);
  } catch (error) {
    console.error("Error saving settings:", error);
    res.status(500).json({ error: "Failed to save settings" });
  }
});

// Game attempt routes - REGION MODE
app.post("/api/game-attempts", verifySupabaseAuth, async (req: any, res) => {
  try {
    const userId = req.user.id;
    // Frontend now sends allocatedRegionId (but may still send puzzleId for compatibility)
    const allocatedRegionId = req.body.allocatedRegionId || req.body.puzzleId;

    console.log('[POST /api/game-attempts] Request:', { userId, allocatedRegionId, numGuesses: req.body.numGuesses, result: req.body.result });

    if (!allocatedRegionId) {
      return res.status(400).json({ error: "Missing allocatedRegionId in body" });
    }

    // Defensive normalization: convert legacy "win"/"loss" to "won"/"lost"
    let result = req.body.result;
    if (result === "win") result = "won";
    if (result === "loss") result = "lost";

    // Try to find an existing attempt
    const existing = await storage.getGameAttemptByUserAndAllocated(userId, allocatedRegionId);

    if (existing) {
      console.log('[POST /api/game-attempts] Found existing attempt:', { id: existing.id, numGuesses: existing.numGuesses, result: existing.result });
      
      // If attempt is already completed, don't allow mutation
      if (existing.result !== null) {
        console.log('[POST /api/game-attempts] Attempt is completed, returning without mutation');
        return res.json(existing);
      }
      
      // Update in-progress attempt
      const updates: any = {};
      
      if (result && result !== null) {
        updates.result = result;
        console.log('[POST /api/game-attempts] Client sent result in POST:', result);
      }
      
      if (typeof req.body.numGuesses === "number" && req.body.numGuesses > (existing.numGuesses ?? 0)) {
        updates.numGuesses = req.body.numGuesses;
      }
      
      if (Object.keys(updates).length > 0) {
        const updated = await storage.updateGameAttemptRegion(existing.id, updates);
        console.log('[POST /api/game-attempts] Updated existing attempt:', { result: updated.result, numGuesses: updated.numGuesses });
        return res.json(updated);
      }
      
      return res.json(existing);
    }
    
    // No attempt exists - create a fresh one
    console.log('[POST /api/game-attempts] No attempt exists, creating fresh one');
    const gameAttempt = await storage.createGameAttemptRegion({
      userId,
      allocatedRegionId,
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
    const attempts = await storage.getGameAttemptsByUserRegion(userId);
    
    // Transform to include puzzle-like fields for backward compatibility
    const transformedAttempts = attempts.map(attempt => ({
      ...attempt,
      puzzleId: attempt.allocatedRegionId, // Backward compat
      puzzle: {
        id: attempt.allocatedQuestion.id,
        date: attempt.allocatedQuestion.puzzleDate,
        answerDateCanonical: attempt.allocatedQuestion.masterQuestion.answerDateCanonical,
        eventTitle: attempt.allocatedQuestion.masterQuestion.eventTitle,
        eventDescription: attempt.allocatedQuestion.masterQuestion.eventDescription,
      },
    }));
    
    res.json(transformedAttempts);
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
    const allAttempts = await storage.getGameAttemptsByUserRegion(userId);
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
    delete updates.allocatedRegionId;
    delete updates.allocated_region_id;

    // Ensure numGuesses never decreases
    if (typeof updates.numGuesses === "number") {
      const previousNumGuesses = ownedAttempt.numGuesses ?? 0;
      updates.numGuesses = Math.max(updates.numGuesses, previousNumGuesses);
      console.log('[PATCH /api/game-attempts/:id] numGuesses:', { previous: previousNumGuesses, requested: req.body.numGuesses, final: updates.numGuesses });
    }

    const gameAttempt = await storage.updateGameAttemptRegion(id, updates);
    console.log('[PATCH /api/game-attempts/:id] Updated:', { result: gameAttempt.result, numGuesses: gameAttempt.numGuesses, completedAt: gameAttempt.completedAt });
    
    res.json(gameAttempt);
  } catch (error) {
    console.error("[PATCH /api/game-attempts/:id] Error:", error);
    res.status(500).json({ error: "Failed to update game attempt" });
  }
});

// Guess routes - REGION MODE
app.post("/api/guesses", verifySupabaseAuth, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const gameAttemptId = req.body.gameAttemptId;

    console.log('[POST /api/guesses] Request:', { userId, gameAttemptId, guessValue: req.body.guessValue });

    if (!gameAttemptId) {
      return res.status(400).json({ error: "Missing gameAttemptId in body" });
    }

    // Verify ownership
    const allAttempts = await storage.getGameAttemptsByUserRegion(userId);
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
    
    // Save the guess (feedback is calculated client-side, not stored)
    const guess = await storage.createGuessRegion({
      gameAttemptId: gameAttemptId,
      guessValue: req.body.guessValue,
    });

    console.log('[POST /api/guesses] Guess saved:', guess.id);
    
    // Lock digit mode on first guess if not already locked
    if (ownedAttempt.digits === null || ownedAttempt.digits === undefined) {
      const userSettings = await storage.getUserSettings(userId);
      const digitPreference = userSettings?.digitPreference || '8';
      
      await storage.updateGameAttemptRegion(gameAttemptId, {
        digits: digitPreference
      });
      
      console.log('[POST /api/guesses] Locked digit mode to:', digitPreference);
    }
    
    // Increment num_guesses
    await storage.incrementAttemptGuessesRegion(gameAttemptId);
    
    // Read back to verify
    const updatedAttempt = await storage.getGameAttemptRegion(gameAttemptId);
    console.log('[POST /api/guesses] After increment, numGuesses:', updatedAttempt?.numGuesses);

    res.json(guess);
  } catch (error) {
    console.error("[POST /api/guesses] Error:", error);
    res.status(500).json({ error: "Failed to create guess" });
  }
});

// Get recent guesses with allocated IDs for caching - REGION MODE
app.get("/api/guesses/recent", verifySupabaseAuth, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const since = req.query.since as string;

    if (!since) {
      return res.status(400).json({ error: "Missing 'since' query parameter" });
    }

    const guesses = await storage.getRecentGuessesWithAllocatedIdsRegion(userId, since);
    
    // Transform for backward compatibility
    const transformedGuesses = guesses.map(g => ({
      ...g,
      puzzleId: g.allocatedRegionId, // Backward compat
    }));
    
    res.json(transformedGuesses);
  } catch (error) {
    console.error("Error fetching recent guesses:", error);
    res.status(500).json({ error: "Failed to fetch recent guesses" });
  }
});

  app.get("/api/guesses/all", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const guesses = await storage.getAllGuessesWithAllocatedIdsRegion(userId);
      
      // Transform for backward compatibility
      const transformedGuesses = guesses.map(g => ({
        ...g,
        puzzleId: g.allocatedRegionId, // Backward compat
      }));
      
      res.json(transformedGuesses);
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
    const allAttempts = await storage.getGameAttemptsByUserRegion(userId);
    const ownedAttempt = allAttempts.find(a => a.id === gameAttemptId);

    if (!ownedAttempt) {
      return res.status(403).json({ error: "Forbidden: You do not own this game attempt" });
    }

    const guesses = await storage.getGuessesByGameAttemptRegion(gameAttemptId);
    res.json(guesses);
  } catch (error) {
    console.error("Error fetching guesses:", error);
    res.status(500).json({ error: "Failed to fetch guesses" });
  }
});

// Stats routes - REGION MODE
app.get("/api/stats", verifySupabaseAuth, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const stats = await storage.getUserStatsRegion(userId);
    res.json(stats || {});
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

  app.post("/api/stats", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const stats = await storage.upsertUserStatsRegion({
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
      const stats = await storage.recalculateUserStatsRegion(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error recalculating stats:", error);
      res.status(500).json({ error: "Failed to recalculate stats" });
    }
  });

  app.get("/api/stats/percentile", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const percentile = await storage.getUserPercentileRankingRegion(userId);
      res.json({ percentile });
    } catch (error) {
      console.error("Error fetching percentile:", error);
      res.status(500).json({ error: "Failed to fetch percentile" });
    }
  });

  // ========================================================================
  // USER GAME MODE ROUTES
  // ========================================================================

  // Puzzle routes - USER MODE
  app.get("/api/user/puzzles", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      console.log('[GET /api/user/puzzles] userId:', userId);
      
      const allocatedQuestions = await storage.getAllocatedQuestionsByUser(userId);
      
      console.log('[GET /api/user/puzzles] Found allocated questions:', allocatedQuestions.length);
      
      // Transform to frontend-compatible format
      const puzzles = allocatedQuestions.map(aq => ({
        id: aq.id, // This is now allocatedUserId
        date: aq.puzzleDate,
        answerDateCanonical: aq.masterQuestion.answerDateCanonical,
        eventTitle: aq.masterQuestion.eventTitle,
        eventDescription: aq.masterQuestion.eventDescription,
        category: aq.categoryName, // Category name from categories table
        clue1: null, // Clues removed in new schema
        clue2: null, // Clues removed in new schema
        // User-specific fields
        userId: aq.userId,
        allocatedUserId: aq.id,
        masterQuestionId: aq.questionId,
      }));
      
      res.json(puzzles);
    } catch (error) {
      console.error("Error fetching user puzzles:", error);
      res.status(500).json({ error: "Failed to fetch user puzzles" });
    }
  });

  app.get("/api/user/puzzles/:date", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      const allocatedQuestion = await storage.getAllocatedQuestionByUserAndDate(userId, req.params.date);
      
      if (!allocatedQuestion) {
        return res.status(404).json({ error: "Puzzle not found" });
      }
      
      // Transform to frontend-compatible format
      const puzzle = {
        id: allocatedQuestion.id,
        date: allocatedQuestion.puzzleDate,
        answerDateCanonical: allocatedQuestion.masterQuestion.answerDateCanonical,
        eventTitle: allocatedQuestion.masterQuestion.eventTitle,
        eventDescription: allocatedQuestion.masterQuestion.eventDescription,
        category: allocatedQuestion.categoryName, // Category name from categories table
        clue1: null, // Clues removed in new schema
        clue2: null, // Clues removed in new schema
        userId: allocatedQuestion.userId,
        allocatedUserId: allocatedQuestion.id,
        masterQuestionId: allocatedQuestion.questionId,
      };
      
      res.json(puzzle);
    } catch (error) {
      console.error("Error fetching user puzzle:", error);
      res.status(500).json({ error: "Failed to fetch user puzzle" });
    }
  });

  // Game attempt routes - USER MODE
  app.post("/api/user/game-attempts", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      // Frontend sends allocatedUserId
      const allocatedUserId = req.body.allocatedUserId || req.body.puzzleId;

      console.log('[POST /api/user/game-attempts] Request:', { userId, allocatedUserId, numGuesses: req.body.numGuesses, result: req.body.result });

      if (!allocatedUserId) {
        return res.status(400).json({ error: "Missing allocatedUserId in body" });
      }

      // Defensive normalization: convert legacy "win"/"loss" to "won"/"lost"
      let result = req.body.result;
      if (result === "win") result = "won";
      if (result === "loss") result = "lost";

      // Try to find an existing attempt
      const existing = await storage.getGameAttemptByUserAndAllocatedUser(userId, allocatedUserId);

      if (existing) {
        console.log('[POST /api/user/game-attempts] Found existing attempt:', { id: existing.id, numGuesses: existing.numGuesses, result: existing.result });
        
        // If attempt is already completed, don't allow mutation
        if (existing.result !== null) {
          console.log('[POST /api/user/game-attempts] Attempt is completed, returning without mutation');
          return res.json(existing);
        }
        
        // Update in-progress attempt
        const updates: any = {};
        
        if (result && result !== null) {
          updates.result = result;
          console.log('[POST /api/user/game-attempts] Client sent result in POST:', result);
        }
        
        if (typeof req.body.numGuesses === "number" && req.body.numGuesses > (existing.numGuesses ?? 0)) {
          updates.numGuesses = req.body.numGuesses;
        }
        
        if (Object.keys(updates).length > 0) {
          const updated = await storage.updateGameAttemptUser(existing.id, updates);
          console.log('[POST /api/user/game-attempts] Updated existing attempt:', { result: updated.result, numGuesses: updated.numGuesses });
          return res.json(updated);
        }
        
        return res.json(existing);
      }
      
      // No attempt exists - create a fresh one
      console.log('[POST /api/user/game-attempts] No attempt exists, creating fresh one');
      const gameAttempt = await storage.createGameAttemptUser({
        userId,
        allocatedUserId,
        result: result ?? null,
        numGuesses: req.body.numGuesses ?? 0,
      });

      console.log('[POST /api/user/game-attempts] Created attempt:', { id: gameAttempt.id, numGuesses: gameAttempt.numGuesses });

      res.json(gameAttempt);
    } catch (error) {
      console.error("[POST /api/user/game-attempts] Error:", error);
      res.status(500).json({ error: "Failed to create/upsert user game attempt" });
    }
  });

  app.get("/api/user/game-attempts/user", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const attempts = await storage.getGameAttemptsByUserUser(userId);
      
      // Transform to include puzzle-like fields for backward compatibility
      const transformedAttempts = attempts.map(attempt => ({
        ...attempt,
        puzzleId: attempt.allocatedUserId, // Backward compat
        puzzle: {
          id: attempt.allocatedQuestion.id,
          date: attempt.allocatedQuestion.puzzleDate,
          answerDateCanonical: attempt.allocatedQuestion.masterQuestion.answerDateCanonical,
          eventTitle: attempt.allocatedQuestion.masterQuestion.eventTitle,
          eventDescription: attempt.allocatedQuestion.masterQuestion.eventDescription,
        },
      }));
      
      res.json(transformedAttempts);
    } catch (error) {
      console.error("Error fetching user game attempts:", error);
      res.status(500).json({ error: "Failed to fetch user game attempts" });
    }
  });

  app.patch("/api/user/game-attempts/:id", verifySupabaseAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.id;

      console.log('[PATCH /api/user/game-attempts/:id] Request:', { id, userId, updates: req.body });

      // Verify ownership
      const allAttempts = await storage.getGameAttemptsByUserUser(userId);
      const ownedAttempt = allAttempts.find(a => a.id === id);

      if (!ownedAttempt) {
        console.error('[PATCH /api/user/game-attempts/:id] Attempt not owned by user:', id);
        return res.status(403).json({ error: "Forbidden: You do not own this game attempt" });
      }

      console.log('[PATCH /api/user/game-attempts/:id] Current state:', {
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
      delete updates.allocatedUserId;
      delete updates.allocated_user_id;

      // Ensure numGuesses never decreases
      if (typeof updates.numGuesses === "number") {
        const previousNumGuesses = ownedAttempt.numGuesses ?? 0;
        updates.numGuesses = Math.max(updates.numGuesses, previousNumGuesses);
        console.log('[PATCH /api/user/game-attempts/:id] numGuesses:', { previous: previousNumGuesses, requested: req.body.numGuesses, final: updates.numGuesses });
      }

      const gameAttempt = await storage.updateGameAttemptUser(id, updates);
      console.log('[PATCH /api/user/game-attempts/:id] Updated:', { result: gameAttempt.result, numGuesses: gameAttempt.numGuesses, completedAt: gameAttempt.completedAt });
      
      res.json(gameAttempt);
    } catch (error) {
      console.error("[PATCH /api/user/game-attempts/:id] Error:", error);
      res.status(500).json({ error: "Failed to update user game attempt" });
    }
  });

  // Guess routes - USER MODE
  app.post("/api/user/guesses", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const gameAttemptId = req.body.gameAttemptId;

      console.log('[POST /api/user/guesses] Request:', { userId, gameAttemptId, guessValue: req.body.guessValue });

      if (!gameAttemptId) {
        return res.status(400).json({ error: "Missing gameAttemptId in body" });
      }

      // Verify ownership
      const allAttempts = await storage.getGameAttemptsByUserUser(userId);
      const ownedAttempt = allAttempts.find(a => a.id === gameAttemptId);

      if (!ownedAttempt) {
        console.error('[POST /api/user/guesses] Attempt not owned by user:', gameAttemptId);
        return res.status(403).json({ error: "Forbidden: You do not own this game attempt" });
      }

      // Block guesses if attempt already completed
      if (ownedAttempt.result !== null) {
        console.error('[POST /api/user/guesses] Attempt already completed with result:', ownedAttempt.result);
        return res.status(409).json({ error: "Attempt already completed; no further guesses allowed" });
      }

      console.log('[POST /api/user/guesses] Saving guess to database...');
      
      // Save the guess (feedback is calculated client-side, not stored)
      const guess = await storage.createGuessUser({
        gameAttemptId: gameAttemptId,
        guessValue: req.body.guessValue,
      });

      console.log('[POST /api/user/guesses] Guess saved:', guess.id);
      
      // Lock digit mode on first guess if not already locked
      if (ownedAttempt.digits === null || ownedAttempt.digits === undefined) {
        const userSettings = await storage.getUserSettings(userId);
        const digitPreference = userSettings?.digitPreference || '8';
        
        await storage.updateGameAttemptUser(gameAttemptId, {
          digits: digitPreference
        });
        
        console.log('[POST /api/user/guesses] Locked digit mode to:', digitPreference);
      }
      
      // Increment num_guesses
      await storage.incrementAttemptGuessesUser(gameAttemptId);
      
      // Read back to verify
      const updatedAttempt = await storage.getGameAttemptUser(gameAttemptId);
      console.log('[POST /api/user/guesses] After increment, numGuesses:', updatedAttempt?.numGuesses);

      res.json(guess);
    } catch (error) {
      console.error("[POST /api/user/guesses] Error:", error);
      res.status(500).json({ error: "Failed to create user guess" });
    }
  });

  // Get recent guesses with allocated IDs for caching - USER MODE
  app.get("/api/user/guesses/recent", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const since = req.query.since as string;

      if (!since) {
        return res.status(400).json({ error: "Missing 'since' query parameter" });
      }

      const guesses = await storage.getRecentGuessesWithAllocatedIdsUser(userId, since);
      
      // Transform for backward compatibility
      const transformedGuesses = guesses.map(g => ({
        ...g,
        puzzleId: g.allocatedUserId, // Backward compat
      }));
      
      res.json(transformedGuesses);
    } catch (error) {
      console.error("Error fetching recent user guesses:", error);
      res.status(500).json({ error: "Failed to fetch recent user guesses" });
    }
  });

  app.get("/api/user/guesses/all", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const guesses = await storage.getAllGuessesWithAllocatedIdsUser(userId);
      
      // Transform for backward compatibility
      const transformedGuesses = guesses.map(g => ({
        ...g,
        puzzleId: g.allocatedUserId, // Backward compat
      }));
      
      res.json(transformedGuesses);
    } catch (error) {
      console.error("Error fetching all user guesses:", error);
      res.status(500).json({ error: "Failed to fetch all user guesses" });
    }
  });

  app.get("/api/user/guesses/:gameAttemptId", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const gameAttemptId = parseInt(req.params.gameAttemptId);

      // Verify ownership
      const allAttempts = await storage.getGameAttemptsByUserUser(userId);
      const ownedAttempt = allAttempts.find(a => a.id === gameAttemptId);

      if (!ownedAttempt) {
        return res.status(403).json({ error: "Forbidden: You do not own this game attempt" });
      }

      const guesses = await storage.getGuessesByGameAttemptUser(gameAttemptId);
      res.json(guesses);
    } catch (error) {
      console.error("Error fetching user guesses:", error);
      res.status(500).json({ error: "Failed to fetch user guesses" });
    }
  });

  // Stats routes - USER MODE
  app.get("/api/user/stats", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const stats = await storage.getUserStatsUser(userId);
      res.json(stats || {});
    } catch (error) {
      console.error("Error fetching user stats:", error);
      res.status(500).json({ error: "Failed to fetch user stats" });
    }
  });

  app.post("/api/user/stats", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const stats = await storage.upsertUserStatsUser({
        userId,
        ...req.body,
      });
      res.json(stats);
    } catch (error) {
      console.error("Error updating user stats:", error);
      res.status(500).json({ error: "Failed to update user stats" });
    }
  });

  app.post("/api/user/stats/recalculate", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const stats = await storage.recalculateUserStatsUser(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error recalculating user stats:", error);
      res.status(500).json({ error: "Failed to recalculate user stats" });
    }
  });

  app.get("/api/user/stats/percentile", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const percentile = await storage.getUserPercentileRankingUser(userId);
      res.json({ percentile });
    } catch (error) {
      console.error("Error fetching user percentile:", error);
      res.status(500).json({ error: "Failed to fetch user percentile" });
    }
  });

  // Admin export route
  app.get("/api/admin/export", verifySupabaseAuth, requireAdmin, async (req, res) => {
    try {
      const format = (req.query.format as string) || "json";
      const data = await storage.getAllGameAttemptsForExport();

      if (format === "csv") {
        // Convert to CSV
        const headers = ["User Email", "Puzzle Date", "Answer Date (Canonical)", "Event Title", "Result", "Guesses", "Completed At", "Guess Details"];
        const rows = data.map((row: any) => [
          row.userEmail || "guest",
          row.puzzleDate,
          row.answerDateCanonical || "",
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
