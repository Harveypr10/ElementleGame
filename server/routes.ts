// Server routes for Elementle app with Supabase Auth
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { verifySupabaseAuth, requireAdmin } from "./supabaseAuth";
import { supabaseAdmin } from "./supabase";
import { db } from "./db";
import { sql } from "drizzle-orm";

// Helper to calculate subscription end date
function calculateEndDate(tier: string): Date | null {
  const now = new Date();
  if (tier === 'bronze') {
    return new Date(now.setMonth(now.getMonth() + 1));
  } else if (tier === 'silver') {
    return new Date(now.setFullYear(now.getFullYear() + 1));
  }
  return null; // Gold is lifetime
}

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

  // PUBLIC puzzle endpoint for guests (defaults to UK region)
  app.get("/api/puzzles/guest", async (req, res) => {
    try {
      const region = 'UK'; // Default region for guests
      
      console.log('[GET /api/puzzles/guest] Fetching puzzles for guest with region:', region);
      
      // Set a timeout for the database query to prevent hanging
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Database query timeout')), 5000)
      );
      
      const allocatedQuestions = await Promise.race([
        storage.getAllocatedQuestionsByRegion(region),
        timeoutPromise
      ]);
      
      console.log('[GET /api/puzzles/guest] Found allocated questions:', allocatedQuestions.length);
      
      // Transform to frontend-compatible format - avoid N+1 queries by not fetching categories
      const puzzles = allocatedQuestions.map((aq) => {
        const categoriesArray = aq.masterQuestion.categories as number[] | null;
        const categoryId = categoriesArray && categoriesArray.length > 0 ? categoriesArray[0] : null;
        
        return {
          id: aq.id,
          date: aq.puzzleDate,
          answerDateCanonical: aq.masterQuestion.answerDateCanonical,
          eventTitle: aq.masterQuestion.eventTitle,
          eventDescription: aq.masterQuestion.eventDescription,
          category: null, // Skip category name lookup for guests to improve performance
          clue1: null,
          clue2: null,
          region: aq.region,
          allocatedRegionId: aq.id,
          masterQuestionId: aq.questionId,
        };
      });
      
      res.json(puzzles);
    } catch (error) {
      console.error("Error fetching guest puzzles:", error);
      res.status(500).json({ error: "Failed to fetch puzzles" });
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
      
      // If no profile exists, create a new one (upsert behavior for new signups)
      if (!existing) {
        console.log("Profile not found, creating new profile for user:", userId);
        const now = new Date();
        
        // Get the region's default date format
        const regions = await storage.getRegions();
        const finalRegion = region || (regions.length > 0 ? regions[0].code : null);
        const selectedRegion = regions.find(r => r.code === finalRegion);
        const defaultDateFormat = selectedRegion?.defaultDateFormat ?? 'ddmmyy';
        
        const newProfile = await storage.upsertUserProfile({
          id: userId,
          email: email || req.user.email,
          firstName: firstName || '',
          lastName: lastName || '',
          region: finalRegion,
          postcode: postcode || null,
          acceptedTerms: acceptedTerms ?? false,
          adsConsent: adsConsent ?? false,
          acceptedTermsAt: acceptedTerms ? now : null,
          adsConsentUpdatedAt: adsConsent ? now : null,
          emailVerified: false,
        });
        
        // Also create default user settings
        await storage.upsertUserSettings({
          userId,
          dateFormatPreference: defaultDateFormat,
          useRegionDefault: true,
          digitPreference: '8',
          soundsEnabled: true,
          darkMode: false,
          cluesEnabled: true,
          categoryPreferences: null,
        });
        
        return res.json(newProfile);
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
    } catch (error: any) {
      console.error("Error updating profile:", error);
      
      // Check for postcode guard trigger error (14-day restriction)
      if (error?.message?.includes('postcode once every 14 days')) {
        return res.status(400).json({ 
          error: "You can only change your postcode once every 14 days. Please try again later.",
          code: "POSTCODE_COOLDOWN"
        });
      }
      
      // Check for RLS policy violations
      if (error?.code === '42501' || error?.message?.includes('permission denied') || error?.message?.includes('row-level security')) {
        return res.status(403).json({ 
          error: "You don't have permission to update this profile.",
          code: "PERMISSION_DENIED"
        });
      }
      
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
      const puzzles = await Promise.all(allocatedQuestions.map(async (aq) => {
        // Extract first category ID from categories jsonb array and look up the name
        const categoriesArray = aq.masterQuestion.categories as number[] | null;
        let categoryName: string | null = null;
        if (categoriesArray && categoriesArray.length > 0) {
          const category = await storage.getCategoryById(categoriesArray[0]);
          categoryName = category?.name || null;
        }
        
        return {
          id: aq.id, // This is now allocatedRegionId
          date: aq.puzzleDate,
          answerDateCanonical: aq.masterQuestion.answerDateCanonical,
          eventTitle: aq.masterQuestion.eventTitle,
          eventDescription: aq.masterQuestion.eventDescription,
          category: categoryName, // Add category name for IntroScreen
          clue1: null, // Clues removed in new schema
          clue2: null, // Clues removed in new schema
          // Region-specific fields
          region: aq.region,
          allocatedRegionId: aq.id,
          masterQuestionId: aq.questionId,
        };
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
      
      // Extract first category ID from categories jsonb array and look up the name
      const categoriesArray = allocatedQuestion.masterQuestion.categories as number[] | null;
      let categoryName: string | null = null;
      if (categoriesArray && categoriesArray.length > 0) {
        const category = await storage.getCategoryById(categoriesArray[0]);
        categoryName = category?.name || null;
      }
      
      // Transform to frontend-compatible format
      const puzzle = {
        id: allocatedQuestion.id,
        date: allocatedQuestion.puzzleDate,
        answerDateCanonical: allocatedQuestion.masterQuestion.answerDateCanonical,
        eventTitle: allocatedQuestion.masterQuestion.eventTitle,
        eventDescription: allocatedQuestion.masterQuestion.eventDescription,
        category: categoryName, // Add category name for IntroScreen
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
      const puzzles = allocatedQuestions.map(aq => {
        // For Local History (category 999), append place name if available
        let categoryDisplay = aq.categoryName;
        if (aq.categoryId === 999 && aq.placeName) {
          categoryDisplay = `${aq.categoryName}: ${aq.placeName}`;
        }
        
        return {
          id: aq.id, // This is now allocatedUserId
          date: aq.puzzleDate,
          answerDateCanonical: aq.masterQuestion.answerDateCanonical,
          eventTitle: aq.masterQuestion.eventTitle,
          eventDescription: aq.masterQuestion.eventDescription,
          category: categoryDisplay, // Category name, with place for Local History
          clue1: null, // Clues removed in new schema
          clue2: null, // Clues removed in new schema
          // User-specific fields
          userId: aq.userId,
          allocatedUserId: aq.id,
          masterQuestionId: aq.questionId,
        };
      });
      
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
      
      // For Local History (category 999), append place name if available
      let categoryDisplay = allocatedQuestion.categoryName;
      if (allocatedQuestion.categoryId === 999 && allocatedQuestion.placeName) {
        categoryDisplay = `${allocatedQuestion.categoryName}: ${allocatedQuestion.placeName}`;
      }
      
      // Transform to frontend-compatible format
      const puzzle = {
        id: allocatedQuestion.id,
        date: allocatedQuestion.puzzleDate,
        answerDateCanonical: allocatedQuestion.masterQuestion.answerDateCanonical,
        eventTitle: allocatedQuestion.masterQuestion.eventTitle,
        eventDescription: allocatedQuestion.masterQuestion.eventDescription,
        category: categoryDisplay, // Category name, with place for Local History
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

  // ============================================================================
  // SUBSCRIPTION & PRO ROUTES
  // ============================================================================

  // Get user subscription - uses user_active_tier_view for tier resolution with fallback
  app.get("/api/subscription", verifySupabaseAuth, async (req: any, res) => {
    const userId = req.user.id;
    console.log('[subscription] Checking subscription for userId:', userId);
    
    // Helper to return legacy profile-based tier
    const getLegacyTier = async () => {
      const profile = await storage.getUserProfile(userId);
      if (profile) {
        const userTier = profile.tier;
        const isPro = userTier === 'pro' || (userTier && userTier.startsWith('pro_'));
        return {
          tier: isPro ? 'pro' : 'free',
          tierName: userTier || 'standard',
          tierId: null,
          startDate: null,
          endDate: null,
          autoRenew: false,
          isActive: isPro,
          metadata: null
        };
      }
      return { 
        tier: 'free',
        tierName: 'standard',
        tierId: null,
        startDate: null,
        endDate: null,
        autoRenew: false,
        isActive: false,
        metadata: null
      };
    };
    
    // Try the new tier view first
    try {
      const activeTier = await storage.getUserActiveTier(userId);
      
      if (activeTier) {
        console.log('[subscription] Active tier found:', activeTier.tier);
        
        // Map tier names for frontend compatibility
        const isPro = activeTier.tier !== 'standard';
        const displayTier = isPro ? 'pro' : 'free';
        
        return res.json({
          tier: displayTier,
          tierName: activeTier.tier,
          tierId: activeTier.tierId,
          startDate: null,
          endDate: activeTier.expiresAt,
          autoRenew: activeTier.autoRenew,
          isActive: isPro,
          metadata: {
            streakSavers: activeTier.streakSavers,
            holidaySavers: activeTier.holidaySavers,
            holidayDurationDays: activeTier.holidayDurationDays,
            subscriptionCost: activeTier.subscriptionCost,
            currency: activeTier.currency,
            subscriptionDurationMonths: activeTier.subscriptionDurationMonths,
            description: activeTier.description,
          }
        });
      }
      
      // View query returned no rows - fall back to legacy
      console.log('[subscription] No active tier in view, checking user_profiles.tier');
      return res.json(await getLegacyTier());
      
    } catch (viewError: any) {
      // Check if view doesn't exist (42P01) - fall back to legacy
      if (viewError?.code === '42P01' || viewError?.message?.includes('does not exist')) {
        console.log('[subscription] user_active_tier_view not available, using legacy fallback');
        try {
          return res.json(await getLegacyTier());
        } catch (profileError) {
          console.error("Error fetching profile for fallback:", profileError);
          return res.status(500).json({ error: "Failed to fetch subscription" });
        }
      }
      
      // Other DB errors - propagate as 500
      console.error("Error querying user_active_tier_view:", viewError);
      return res.status(500).json({ error: "Failed to fetch subscription" });
    }
  });

  // Get available tiers for a region (for subscription UI)
  app.get("/api/tiers", verifySupabaseAuth, async (req: any, res) => {
    const userId = req.user.id;
    
    // Get user's region from profile (fallback to UK)
    let region = 'UK';
    try {
      const profile = await storage.getUserProfile(userId);
      region = profile?.region || 'UK';
    } catch (profileError) {
      console.log('[tiers] Could not fetch profile, using default region UK');
    }
    
    console.log('[tiers] Fetching available tiers for region:', region);
    
    // Legacy fallback tiers
    const getLegacyTiers = () => [
      { id: 'legacy-monthly', region, tier: 'pro_monthly', subscriptionCost: 79, currency: 'GBP', subscriptionDurationMonths: 1, streakSavers: 0, holidaySavers: 0, holidayDurationDays: 0, description: 'Auto-renews monthly', sortOrder: 1 },
      { id: 'legacy-annual', region, tier: 'pro_annual', subscriptionCost: 699, currency: 'GBP', subscriptionDurationMonths: 12, streakSavers: 0, holidaySavers: 0, holidayDurationDays: 0, description: 'Auto-renews annually', sortOrder: 2 },
      { id: 'legacy-lifetime', region, tier: 'pro_lifetime', subscriptionCost: 1199, currency: 'GBP', subscriptionDurationMonths: null, streakSavers: 0, holidaySavers: 0, holidayDurationDays: 0, description: 'One off - Best value', sortOrder: 3 },
    ];
    
    try {
      const tiers = await storage.getAvailableTiers(region);
      
      // Filter out 'standard' tier (that's the free tier, not purchasable)
      const purchasableTiers = tiers.filter(t => t.tier !== 'standard');
      
      console.log('[tiers] Found purchasable tiers:', purchasableTiers.length);
      console.log('[tiers] Tier data:', purchasableTiers.map(t => ({ tier: t.tier, subscriptionCost: t.subscriptionCost, currency: t.currency })));
      
      return res.json(purchasableTiers);
    } catch (tableError: any) {
      // Check if table doesn't exist (42P01) - fall back to legacy
      if (tableError?.code === '42P01' || tableError?.message?.includes('does not exist')) {
        console.log('[tiers] user_tier table not available, using legacy tiers');
        return res.json(getLegacyTiers());
      }
      
      // Other DB errors - propagate as 500
      console.error("Error fetching tiers:", tableError);
      return res.status(500).json({ error: "Failed to fetch tiers" });
    }
  });

  // Create subscription - inserts into user_subscriptions with user_tier_id (or legacy fallback)
  app.post("/api/subscription/create-checkout", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { tierId, tier: legacyTier } = req.body; // Support both new tierId and legacy tier name

      console.log('[checkout] Creating subscription for userId:', userId, 'tierId:', tierId, 'legacyTier:', legacyTier);

      // Handle legacy tier IDs (e.g., 'legacy-monthly') or tier names
      if (!tierId && !legacyTier) {
        return res.status(400).json({ error: "tierId or tier is required" });
      }

      // Check if this is a legacy tier ID or the table doesn't exist
      const isLegacyTier = tierId?.startsWith('legacy-') || (!tierId && legacyTier);
      
      if (isLegacyTier) {
        // Legacy fallback - update user_profiles.tier directly
        console.log('[checkout] Using legacy fallback for tier:', tierId || legacyTier);
        
        try {
          await db.execute(
            sql`UPDATE user_profiles SET tier = 'pro' WHERE id = ${userId}`
          );
        } catch (tableError: any) {
          console.log('[checkout] user_profiles.tier update error:', tableError?.code || tableError);
        }

        const tierName = tierId?.replace('legacy-', 'pro_') || (legacyTier ? `pro_${legacyTier}` : 'pro_monthly');
        
        res.json({ 
          success: true, 
          subscription: { 
            userId, 
            tier: tierName, 
            tierId: null,
            isActive: true,
            expiresAt: null,
            autoRenew: tierName !== 'pro_lifetime',
          } 
        });
        return;
      }

      // New tier system - get tier details and create subscription
      try {
        const result = await db.execute(sql`
          SELECT id, tier, subscription_cost, currency, subscription_duration_months
          FROM user_tier
          WHERE id = ${tierId} AND active = true
        `);
        
        const rows = Array.isArray(result) ? result : (result as any).rows || [];
        if (!rows || rows.length === 0) {
          return res.status(400).json({ error: "Invalid tier" });
        }
        
        const tierData = rows[0];
        
        // Calculate expiration date based on subscription duration
        let expiresAt: Date | undefined;
        const autoRenew = tierData.tier !== 'pro_lifetime';
        
        if (tierData.subscription_duration_months) {
          expiresAt = new Date();
          expiresAt.setMonth(expiresAt.getMonth() + tierData.subscription_duration_months);
        }
        
        // Create the subscription - Supabase trigger will sync user_profiles
        await storage.createUserSubscription({
          userId,
          userTierId: tierId,
          amountPaid: tierData.subscription_cost,
          currency: tierData.currency,
          expiresAt,
          autoRenew,
          source: 'web',
        });

        console.log('[checkout] Subscription created successfully');

        res.json({ 
          success: true, 
          subscription: { 
            userId, 
            tier: tierData.tier, 
            tierId,
            isActive: true,
            expiresAt: expiresAt?.toISOString(),
            autoRenew,
          } 
        });
      } catch (tableError: any) {
        // Log the actual error for debugging
        console.error('[checkout] Error creating subscription:', tableError?.message || tableError);
        console.error('[checkout] Error code:', tableError?.code);
        
        // Table doesn't exist - fall back to legacy
        console.log('[checkout] Falling back to legacy mode');
        
        await db.execute(
          sql`UPDATE user_profiles SET tier = 'pro' WHERE id = ${userId}`
        );

        res.json({ 
          success: true, 
          subscription: { 
            userId, 
            tier: 'pro_monthly',
            tierId: null,
            isActive: true,
            expiresAt: null,
            autoRenew: true,
          } 
        });
      }
    } catch (error: any) {
      console.error("Error creating checkout:", error);
      res.status(500).json({ error: "Failed to create subscription", details: error.message });
    }
  });

  // Update auto-renewal setting for subscription
  app.post("/api/subscription/auto-renew", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { autoRenew } = req.body;

      console.log('[subscription/auto-renew] Updating for userId:', userId, 'autoRenew:', autoRenew);

      if (typeof autoRenew !== 'boolean') {
        return res.status(400).json({ error: "autoRenew must be a boolean" });
      }

      // Update the user's active subscription auto_renew flag
      // Find the most recent subscription that is still valid (not expired)
      try {
        const result = await db.execute(sql`
          UPDATE user_subscriptions 
          SET auto_renew = ${autoRenew}
          WHERE id = (
            SELECT id FROM user_subscriptions 
            WHERE user_id = ${userId}
              AND (expires_at IS NULL OR expires_at > NOW())
            ORDER BY created_at DESC
            LIMIT 1
          )
          RETURNING id, auto_renew
        `);

        const rows = Array.isArray(result) ? result : (result as any).rows || [];
        
        if (!rows || rows.length === 0) {
          // Try to update in user_active_tier_view directly (fallback)
          console.log('[subscription/auto-renew] No active subscription found, checking for legacy');
          return res.status(404).json({ error: "No active subscription found" });
        }

        console.log('[subscription/auto-renew] Updated successfully:', rows[0]);
        res.json({ success: true, autoRenew: rows[0].auto_renew });
      } catch (tableError: any) {
        if (tableError?.code === '42P01' || tableError?.message?.includes('does not exist')) {
          console.log('[subscription/auto-renew] user_subscriptions table not available');
          return res.status(404).json({ error: "Subscription system not available" });
        }
        throw tableError;
      }
    } catch (error: any) {
      console.error("Error updating auto-renew:", error);
      res.status(500).json({ error: "Failed to update auto-renewal", details: error.message });
    }
  });

  // ============================================================================
  // STREAK SAVER & HOLIDAY ROUTES
  // ============================================================================

  // Get streak saver status (missed flags, holiday state, allowances)
  app.get("/api/streak-saver/status", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      console.log('[streak-saver/status] Checking status for userId:', userId);
      
      // Get streak saver status from database
      const status = await storage.getStreakSaverStatus(userId);
      
      // Get tier to determine allowances - handle undefined/new users
      let activeTier: any = null;
      try {
        activeTier = await storage.getUserActiveTier(userId);
      } catch (tierError) {
        console.log('[streak-saver/status] Could not fetch tier, using defaults');
      }
      
      // Determine if user is Pro - handle various tier name variants
      // The 'tier' field from user_active_tier_view contains values like 'standard', 'pro_monthly', 'pro_annual', 'pro_lifetime'
      const tierName = activeTier?.tier?.toLowerCase() || 'standard';
      const isPro = tierName.startsWith('pro') || tierName === 'pro';
      
      // Determine allowances - use tier metadata if available, else defaults
      // For Pro: use metadata from tier, For Standard: 1 streak saver/month, no holidays
      let streakSaverAllowance = 1;
      let holidaySaverAllowance = 0;
      let holidayDurationDays = 0;
      
      if (isPro && activeTier) {
        // Pro user with valid tier - use metadata or sensible Pro defaults
        streakSaverAllowance = activeTier.streakSavers ?? 3;
        holidaySaverAllowance = activeTier.holidaySavers ?? 2;
        holidayDurationDays = activeTier.holidayDurationDays ?? 7;
      } else if (activeTier && !isPro) {
        // Standard tier with metadata
        streakSaverAllowance = activeTier.streakSavers ?? 1;
        holidaySaverAllowance = 0;
        holidayDurationDays = 0;
      }
      
      // Get holiday usage this year
      const holidaysUsedThisYear = await storage.countHolidayEventsThisYear(userId);
      
      console.log('[streak-saver/status] Status:', { status, isPro, streakSaverAllowance, holidaysUsedThisYear });
      
      // Return safe defaults if status is null (new user without stats)
      const safeStatus = status || {
        region: { currentStreak: 0, streakSaversUsedMonth: 0, missedYesterdayFlag: false },
        user: { currentStreak: 0, streakSaversUsedMonth: 0, holidayActive: false, holidayStartDate: null, holidayEndDate: null, missedYesterdayFlag: false }
      };
      
      res.json({
        ...safeStatus,
        allowances: {
          streakSaversPerMonth: streakSaverAllowance,
          holidaySaversPerYear: holidaySaverAllowance,
          holidaysUsedThisYear,
          holidayDurationDays,
          isPro,
        }
      });
    } catch (error: any) {
      console.error("Error fetching streak saver status:", error);
      res.status(500).json({ error: "Failed to fetch streak saver status" });
    }
  });

  // Use a streak saver
  app.post("/api/streak-saver/use", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { gameType } = req.body; // 'region' or 'user'
      
      if (!gameType || !['region', 'user'].includes(gameType)) {
        return res.status(400).json({ error: "gameType must be 'region' or 'user'" });
      }
      
      console.log('[streak-saver/use] User:', userId, 'gameType:', gameType);
      
      // Get tier to determine allowance - handle undefined/new users
      let activeTier: any = null;
      try {
        activeTier = await storage.getUserActiveTier(userId);
      } catch (tierError) {
        console.log('[streak-saver/use] Could not fetch tier, using defaults');
      }
      
      // Determine allowance based on tier
      const tierName = activeTier?.tier?.toLowerCase() || 'standard';
      const isPro = tierName.startsWith('pro') || tierName === 'pro';
      
      let allowance = 1; // Default for Standard tier
      if (isPro && activeTier) {
        allowance = activeTier.streakSavers ?? 3;
      } else if (activeTier) {
        allowance = activeTier.streakSavers ?? 1;
      }
      
      // Use the streak saver
      const result = await storage.useStreakSaver(userId, gameType, allowance);
      
      if (!result.success) {
        console.log('[streak-saver/use] Failed:', result.error);
        return res.status(400).json({ error: result.error, needsSubscription: result.error?.includes('remaining') });
      }
      
      console.log('[streak-saver/use] Success!');
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error using streak saver:", error);
      res.status(500).json({ error: "Failed to use streak saver" });
    }
  });

  // Decline streak saver (reset streak to 0)
  app.post("/api/streak-saver/decline", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { gameType } = req.body; // 'region' or 'user'
      
      if (!gameType || !['region', 'user'].includes(gameType)) {
        return res.status(400).json({ error: "gameType must be 'region' or 'user'" });
      }
      
      console.log('[streak-saver/decline] User:', userId, 'gameType:', gameType);
      
      // Reset streak to 0 and clear the missed flag
      const table = gameType === 'region' ? 'user_stats_region' : 'user_stats_user';
      const flagColumn = gameType === 'region' ? 'missed_yesterday_flag_region' : 'missed_yesterday_flag_user';
      
      await db.execute(sql.raw(`
        UPDATE ${table}
        SET 
          current_streak = 0,
          ${flagColumn} = false,
          updated_at = NOW()
        WHERE user_id = '${userId}'
      `));
      
      console.log('[streak-saver/decline] Streak reset to 0');
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error declining streak saver:", error);
      res.status(500).json({ error: "Failed to decline streak saver" });
    }
  });

  // Start a holiday (Pro users only)
  app.post("/api/holiday/start", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      console.log('[holiday/start] User:', userId);
      
      // Check tier and holiday allowance - handle undefined/new users
      let activeTier: any = null;
      try {
        activeTier = await storage.getUserActiveTier(userId);
      } catch (tierError) {
        console.log('[holiday/start] Could not fetch tier, denying access');
        return res.status(403).json({ error: "Holiday feature is Pro-only", needsSubscription: true });
      }
      
      // Determine if user is Pro
      const tierName = activeTier?.tier?.toLowerCase() || 'standard';
      const isPro = tierName.startsWith('pro') || tierName === 'pro';
      
      if (!isPro || !activeTier) {
        return res.status(403).json({ error: "Holiday feature is Pro-only", needsSubscription: true });
      }
      
      // Get holiday allowances from tier metadata
      const holidayAllowance = activeTier.holidaySavers ?? 2;
      const holidayDurationDays = activeTier.holidayDurationDays ?? 7;
      
      if (holidayAllowance === 0 || holidayDurationDays === 0) {
        return res.status(403).json({ error: "Your tier does not include holidays" });
      }
      
      // Check annual holiday usage
      const holidaysUsedThisYear = await storage.countHolidayEventsThisYear(userId);
      
      if (holidaysUsedThisYear >= holidayAllowance) {
        return res.status(400).json({ error: "No holidays remaining this year" });
      }
      
      // Start the holiday
      const result = await storage.startHoliday(userId, holidayDurationDays);
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      
      console.log('[holiday/start] Holiday started');
      res.json({ success: true, holidayDurationDays });
    } catch (error: any) {
      console.error("Error starting holiday:", error);
      res.status(500).json({ error: "Failed to start holiday" });
    }
  });

  // End a holiday early
  app.post("/api/holiday/end", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      console.log('[holiday/end] User:', userId);
      
      const result = await storage.endHoliday(userId);
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      
      console.log('[holiday/end] Holiday ended');
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error ending holiday:", error);
      res.status(500).json({ error: "Failed to end holiday" });
    }
  });

  // Get all categories (excluding Local History - id 999)
  app.get("/api/categories", async (req, res) => {
    try {
      console.log("[GET /api/categories] Fetching categories...");
      const categories = await storage.getAllCategories();
      console.log("[GET /api/categories] Found categories:", categories?.length);
      const filtered = categories.filter(c => c.id !== 999);
      console.log("[GET /api/categories] After filtering id 999:", filtered?.length);
      res.json(filtered);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  // Get user's Pro category selections
  app.get("/api/user/pro-categories", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const categoryIds = await storage.getUserProCategories(userId);
      res.json({ categoryIds });
    } catch (error) {
      console.error("Error fetching pro categories:", error);
      res.status(500).json({ error: "Failed to fetch pro categories" });
    }
  });

  // Save user's Pro category selections
  app.post("/api/user/pro-categories", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { categoryIds } = req.body;

      if (!Array.isArray(categoryIds) || categoryIds.length < 3) {
        return res.status(400).json({ error: "Must select at least 3 categories" });
      }

      await storage.saveUserProCategories(userId, categoryIds);
      res.json({ success: true, categoryIds });
    } catch (error) {
      console.error("Error saving pro categories:", error);
      res.status(500).json({ error: "Failed to save pro categories" });
    }
  });

  // Mark first login as completed
  app.post("/api/user/first-login-completed", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      await storage.markFirstLoginCompleted(userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking first login:", error);
      res.status(500).json({ error: "Failed to mark first login" });
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

  // Admin settings routes
  app.get("/api/admin/settings", verifySupabaseAuth, requireAdmin, async (req, res) => {
    try {
      const settings = await storage.getAdminSettings();
      res.json(settings);
    } catch (error) {
      console.error("Error fetching admin settings:", error);
      res.status(500).json({ error: "Failed to fetch admin settings" });
    }
  });

  app.put("/api/admin/settings", verifySupabaseAuth, requireAdmin, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { key, value, description } = req.body;

      if (!key || value === undefined) {
        return res.status(400).json({ error: "Key and value are required" });
      }

      const setting = await storage.upsertAdminSetting({
        key,
        value: String(value),
        description: description || null,
        updatedBy: userId,
      });

      res.json(setting);
    } catch (error) {
      console.error("Error updating admin setting:", error);
      res.status(500).json({ error: "Failed to update admin setting" });
    }
  });

  // Get postcode restriction days (public endpoint for validation)
  app.get("/api/settings/postcode-restriction-days", async (req, res) => {
    try {
      const setting = await storage.getAdminSetting('postcode_restriction_days');
      const days = setting ? parseInt(setting.value, 10) : 14; // Default to 14 days
      res.json({ days });
    } catch (error) {
      console.error("Error fetching postcode restriction:", error);
      res.json({ days: 14 }); // Default to 14 on error
    }
  });

  // Demand scheduler config routes (admin only)
  app.get("/api/admin/demand-scheduler", verifySupabaseAuth, requireAdmin, async (req, res) => {
    try {
      const config = await storage.getDemandSchedulerConfig();
      if (!config) {
        // Return default values if no config exists
        return res.json({ 
          start_time: "01:00", 
          frequency_hours: 24,
          exists: false 
        });
      }
      res.json({ ...config, exists: true });
    } catch (error) {
      console.error("Error fetching demand scheduler config:", error);
      res.status(500).json({ error: "Failed to fetch demand scheduler config" });
    }
  });

  app.put("/api/admin/demand-scheduler", verifySupabaseAuth, requireAdmin, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { start_time, frequency_hours } = req.body;

      // Validate inputs
      if (!start_time || !frequency_hours) {
        return res.status(400).json({ error: "start_time and frequency_hours are required" });
      }

      // Validate start_time format (HH:mm)
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      if (!timeRegex.test(start_time)) {
        return res.status(400).json({ error: "start_time must be in HH:mm format (24-hour)" });
      }

      // Validate frequency_hours (must be positive integer)
      const freqHours = parseInt(frequency_hours, 10);
      if (isNaN(freqHours) || freqHours <= 0 || freqHours > 24) {
        return res.status(400).json({ error: "frequency_hours must be a positive integer between 1 and 24" });
      }

      // Validate that 24 is divisible by frequency_hours
      if (24 % freqHours !== 0) {
        return res.status(400).json({ error: "frequency_hours must divide evenly into 24 (1, 2, 3, 4, 6, 8, 12, or 24)" });
      }

      const config = await storage.upsertDemandSchedulerConfig({
        start_time,
        frequency_hours: freqHours,
        updated_by: userId,
      });

      res.json(config);
    } catch (error) {
      console.error("Error updating demand scheduler config:", error);
      res.status(500).json({ error: "Failed to update demand scheduler config" });
    }
  });

  // Trigger the update-demand-schedule Edge Function
  app.post("/api/admin/demand-scheduler/apply", verifySupabaseAuth, requireAdmin, async (req: any, res) => {
    try {
      const userAccessToken = req.headers.authorization?.replace('Bearer ', '');
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables");
        return res.status(500).json({ error: "Server configuration error" });
      }

      if (!userAccessToken) {
        return res.status(401).json({ error: "No access token available" });
      }

      // Call the Edge Function using the anon key for auth, and pass user token for admin verification
      const edgeFunctionUrl = `${supabaseUrl}/functions/v1/update-demand-schedule`;
      
      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'x-user-access-token': userAccessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Edge Function error:", errorText);
        return res.status(response.status).json({ 
          error: "Failed to apply schedule", 
          details: errorText 
        });
      }

      const result = await response.json();
      res.json({ success: true, ...result });
    } catch (error: any) {
      console.error("Error calling update-demand-schedule:", error);
      res.status(500).json({ error: "Failed to apply schedule", details: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
