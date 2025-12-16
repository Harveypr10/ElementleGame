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

  // Validate postcode exists in the location-based postcode table
  // This checks against the same dataset used by populate_user_locations RPC
  app.get("/api/postcodes/validate", async (req, res) => {
    try {
      const postcode = req.query.postcode as string;
      
      if (!postcode) {
        return res.json({ valid: true }); // Empty postcode is valid (optional field)
      }
      
      // Sanitize: remove all non-alphanumeric characters and uppercase
      const sanitizedPostcode = postcode.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
      
      // Validate UK postcode pattern (basic format: 2-4 chars, then 1 digit, then 2 alphanumerics)
      // UK postcodes are 5-7 characters without spaces
      const ukPostcodePattern = /^[A-Z]{1,2}[0-9][0-9A-Z]?[0-9][A-Z]{2}$/;
      if (!ukPostcodePattern.test(sanitizedPostcode)) {
        console.log("[GET /api/postcodes/validate] Invalid UK postcode format:", sanitizedPostcode);
        return res.json({ valid: false, reason: "Invalid postcode format" });
      }
      
      console.log("[GET /api/postcodes/validate] Checking postcode:", sanitizedPostcode);
      
      // Format postcode with space for database lookup (outward + inward code)
      // UK postcodes have 3-character inward code at the end
      const outward = sanitizedPostcode.slice(0, -3);
      const inward = sanitizedPostcode.slice(-3);
      const formattedPostcode = `${outward} ${inward}`;
      
      // Helper function to query the postcodes table with retry logic
      // Uses .eq() with formatted postcode (canonical format) for better query performance
      const queryPostcode = async (attempt: number = 1): Promise<{ data: any; error: any }> => {
        const result = await supabaseAdmin
          .from("postcodes")
          .select("name1")
          .eq("name1", formattedPostcode)
          .limit(1);
        
        // If timeout error (57014) and first attempt, retry once after short delay
        if (result.error?.code === '57014' && attempt === 1) {
          console.log("[GET /api/postcodes/validate] Query timeout, retrying...");
          await new Promise(resolve => setTimeout(resolve, 500));
          return queryPostcode(2);
        }
        
        return result;
      };
      
      const { data, error } = await queryPostcode();
      
      if (error) {
        console.error("[GET /api/postcodes/validate] Database error:", error);
        // FAIL CLOSED: On database errors, reject the postcode for safety
        return res.json({ valid: false, reason: "Could not validate postcode" });
      }
      
      const isValid = data && data.length > 0;
      console.log("[GET /api/postcodes/validate] Postcode valid:", isValid, "Result:", data);
      
      res.json({ valid: isValid });
    } catch (error: any) {
      console.error("[GET /api/postcodes/validate] Error:", error);
      // FAIL CLOSED: On any error, reject the postcode
      res.json({ valid: false, reason: "Validation error" });
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
      // Explicitly set first_login_completed to false to ensure GeneratingQuestionsScreen runs
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: false, // Require email verification
        user_metadata: {
          first_name: firstName,
          last_name: lastName,
          first_login_completed: false, // Ensure onboarding screen runs for new users
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

  // Check if user exists and their auth method (for login page)
  app.get("/api/auth/check-user", async (req, res) => {
    try {
      const email = req.query.email as string;
      
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      // Check if user profile exists in our database first (fast lookup)
      const { data: profiles, error: profileError } = await supabaseAdmin
        .from("user_profiles")
        .select("id, email, password_created, google_linked, apple_linked")
        .eq("email", email.toLowerCase())
        .limit(1);

      if (profileError) {
        console.error("[GET /api/auth/check-user] Profile lookup error:", profileError);
      }

      // If no profile found in our database, user hasn't signed up through our app
      if (!profiles || profiles.length === 0) {
        console.log("[GET /api/auth/check-user] User not found in profiles:", email);
        return res.json({ exists: false, hasPassword: false, hasMagicLink: false, magicLinkEnabled: true });
      }

      // Check actual fields from user_profiles
      const hasPassword = profiles[0].password_created === true;
      const googleLinked = profiles[0].google_linked === true;
      const appleLinked = profiles[0].apple_linked === true;
      
      // Fetch magic_link separately to avoid breaking if column doesn't exist
      let magicLinkEnabled = true; // Default to true
      try {
        const { data: mlData } = await supabaseAdmin
          .from("user_profiles")
          .select("magic_link")
          .eq("id", profiles[0].id)
          .single();
        if (mlData && mlData.magic_link !== undefined) {
          magicLinkEnabled = mlData.magic_link !== false;
        }
      } catch (e) {
        // Column might not exist yet, default to true
        console.log("[GET /api/auth/check-user] magic_link column not available, defaulting to true");
      }
      
      console.log("[GET /api/auth/check-user] User found:", email, "hasPassword:", hasPassword, "googleLinked:", googleLinked, "appleLinked:", appleLinked, "magicLinkEnabled:", magicLinkEnabled);
      
      res.json({ 
        exists: true, 
        hasPassword: hasPassword,
        hasMagicLink: true, // Magic link is available for all email users
        magicLinkEnabled: magicLinkEnabled, // Whether user has enabled magic link login
        googleLinked: googleLinked,
        appleLinked: appleLinked,
      });
    } catch (error: any) {
      console.error("[GET /api/auth/check-user] Error:", error);
      res.status(500).json({ error: "Failed to check user" });
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
        
        // Look up the Standard tier ID for the user's region
        const standardTierId = await storage.getStandardTierId(finalRegion || 'UK');
        if (!standardTierId) {
          console.error(`[PATCH /api/auth/profile] No Standard tier found for region: ${finalRegion}`);
        } else {
          console.log(`[PATCH /api/auth/profile] Using Standard tier ID: ${standardTierId} for region: ${finalRegion}`);
        }
        
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
          userTierId: standardTierId, // Set the Standard tier for the user's region
          // postcodeLastChangedAt remains NULL - will be set by GeneratingQuestionsScreen after first question generation
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
      
      // Check if postcode or region is being changed
      const postcodeChanging = postcode !== undefined && postcode !== existing.postcode;
      const regionChanging = region !== undefined && region !== existing.region;
      const locationChanging = postcodeChanging || regionChanging;
      
      // If location is changing, check the restriction
      if (locationChanging) {
        // Fetch the restriction setting
        const restrictionSetting = await storage.getAdminSetting('postcode_restriction_days');
        const restrictionDays = restrictionSetting ? parseInt(restrictionSetting.value, 10) : 14;
        
        // Check if user can change (only if restriction > 0)
        // Skip restriction if user has no postcode - allow them to add one without restriction
        const hasExistingPostcode = existing.postcode && existing.postcode.trim() !== '';
        if (restrictionDays > 0 && existing.postcodeLastChangedAt && hasExistingPostcode) {
          const lastChanged = new Date(existing.postcodeLastChangedAt);
          const allowedAfter = new Date(lastChanged);
          allowedAfter.setDate(allowedAfter.getDate() + restrictionDays);
          
          if (now < allowedAfter) {
            console.log(`[PATCH /api/auth/profile] Location change blocked - last changed: ${lastChanged}, allowed after: ${allowedAfter}`);
            
            // Still save name/email changes if provided
            if (firstName !== undefined || lastName !== undefined || email !== undefined) {
              const partialUpdate = await storage.upsertUserProfile({
                id: userId,
                email: email ?? existing.email,
                firstName: firstName ?? existing.firstName,
                lastName: lastName ?? existing.lastName,
                region: existing.region, // Keep existing
                postcode: existing.postcode, // Keep existing
                acceptedTerms: acceptedTerms ?? existing.acceptedTerms ?? false,
                adsConsent: adsConsent ?? existing.adsConsent ?? false,
                acceptedTermsAt: existing.acceptedTermsAt ? new Date(existing.acceptedTermsAt) : null,
                adsConsentUpdatedAt: existing.adsConsentUpdatedAt ? new Date(existing.adsConsentUpdatedAt) : null,
                emailVerified: existing.emailVerified ?? false,
              });
              
              // Return success with restriction notice
              return res.status(200).json({
                ...partialUpdate,
                _restrictionBlocked: true,
                _restrictionMessage: `You can update your postcode or region once every ${restrictionDays} days and Hammie will regenerate your questions`,
                _restrictionDays: restrictionDays,
              });
            }
            
            // If only location changes were requested and blocked
            return res.status(400).json({
              error: `You can update your postcode or region once every ${restrictionDays} days and Hammie will regenerate your questions`,
              code: "LOCATION_COOLDOWN",
              restrictionDays,
            });
          }
        }
      }

      // If user_tier_id is missing (e.g., profile created by Supabase trigger), set it now
      let userTierId = existing.userTierId;
      if (!userTierId) {
        const finalRegion = region ?? existing.region ?? 'UK';
        const standardTierId = await storage.getStandardTierId(finalRegion);
        if (standardTierId) {
          console.log(`[PATCH /api/auth/profile] Setting missing user_tier_id to Standard tier: ${standardTierId} for region: ${finalRegion}`);
          userTierId = standardTierId;
        } else {
          console.error(`[PATCH /api/auth/profile] No Standard tier found for region: ${finalRegion}`);
        }
      }

      // Build profile update with location change timestamp if needed
      const profileUpdate: any = {
        id: userId,
        email: email ?? existing.email,
        firstName: firstName ?? existing.firstName,
        lastName: lastName ?? existing.lastName,
        region: region ?? existing.region ?? null,
        postcode: postcode !== undefined ? postcode : existing.postcode,
        acceptedTerms: acceptedTerms ?? existing.acceptedTerms ?? false,
        adsConsent: adsConsent ?? existing.adsConsent ?? false,
        acceptedTermsAt:
          acceptedTerms !== undefined && acceptedTerms !== existing.acceptedTerms
            ? now
            : existing.acceptedTermsAt ? new Date(existing.acceptedTermsAt) : null,
        adsConsentUpdatedAt:
          adsConsent !== undefined && adsConsent !== existing.adsConsent
            ? now
            : existing.adsConsentUpdatedAt ? new Date(existing.adsConsentUpdatedAt) : null,
        emailVerified: existing.emailVerified ?? false,
        userTierId: userTierId, // Ensure user_tier_id is set
      };
      
      // Note: postcodeLastChangedAt is updated by GeneratingQuestionsScreen after question regeneration completes
      // This ensures the timestamp reflects when questions were actually regenerated, not just when profile was saved

      const updatedProfile = await storage.upsertUserProfile(profileUpdate);

      res.json(updatedProfile);
    } catch (error: any) {
      console.error("Error updating profile:", error);
      
      // Check for postcode guard trigger error (legacy 14-day restriction from Supabase)
      if (error?.message?.includes('postcode once every')) {
        const match = error.message.match(/postcode once every (\d+) days/);
        const days = match ? match[1] : '14';
        return res.status(400).json({ 
          error: `You can update your postcode or region once every ${days} days and Hammie will regenerate your questions`,
          code: "LOCATION_COOLDOWN"
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

  // Set signup method and password_created on first login (only sets if not already set)
  app.post("/api/auth/profile/signup-method", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { signupMethod, passwordCreated } = req.body;
      
      console.log(`[POST /api/auth/profile/signup-method] userId: ${userId}, signupMethod: ${signupMethod}, passwordCreated: ${passwordCreated}`);
      
      const existing = await storage.getUserProfile(userId);
      if (!existing) {
        return res.status(404).json({ error: "Profile not found" });
      }
      
      // Only set signup_method if not already set (first time only)
      if (existing.signupMethod) {
        console.log(`[POST /api/auth/profile/signup-method] Signup method already set to: ${existing.signupMethod}, skipping`);
        return res.json({ 
          signupMethod: existing.signupMethod, 
          passwordCreated: existing.passwordCreated,
          alreadySet: true 
        });
      }
      
      // Update profile with signup method and password_created
      const updatedProfile = await storage.updateSignupMethod(userId, signupMethod, passwordCreated);
      
      res.json({ 
        signupMethod: updatedProfile.signupMethod, 
        passwordCreated: updatedProfile.passwordCreated,
        alreadySet: false 
      });
    } catch (error: any) {
      console.error("Error setting signup method:", error);
      res.status(500).json({ error: "Failed to set signup method" });
    }
  });
  
  // Update password_created status (called when user creates a password)
  app.post("/api/auth/profile/password-created", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { setSignupMethod } = req.body; // Optional: also set signup_method to 'password'
      
      console.log(`[POST /api/auth/profile/password-created] userId: ${userId}, setSignupMethod: ${setSignupMethod}`);
      
      const existing = await storage.getUserProfile(userId);
      if (!existing) {
        return res.status(404).json({ error: "Profile not found" });
      }
      
      // If signup_method is not already set and setSignupMethod is true, set it to 'password'
      if (setSignupMethod && !existing.signupMethod) {
        await storage.updateSignupMethod(userId, 'password', true);
        const finalProfile = await storage.getUserProfile(userId);
        res.json({ passwordCreated: finalProfile?.passwordCreated, signupMethod: finalProfile?.signupMethod });
      } else {
        // Just update password_created to true
        const updatedProfile = await storage.updatePasswordCreated(userId, true);
        res.json({ passwordCreated: updatedProfile.passwordCreated });
      }
    } catch (error: any) {
      console.error("Error updating password_created:", error);
      res.status(500).json({ error: "Failed to update password status" });
    }
  });

  // Update OAuth provider linking status
  app.post("/api/auth/profile/oauth-linked", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { provider, linked } = req.body;
      
      if (!provider || !['google', 'apple'].includes(provider)) {
        return res.status(400).json({ error: "Invalid provider. Must be 'google' or 'apple'" });
      }
      
      if (typeof linked !== 'boolean') {
        return res.status(400).json({ error: "linked must be a boolean" });
      }
      
      console.log(`[POST /api/auth/profile/oauth-linked] userId: ${userId}, provider: ${provider}, linked: ${linked}`);
      
      const existing = await storage.getUserProfile(userId);
      if (!existing) {
        return res.status(404).json({ error: "Profile not found" });
      }
      
      // Also set signup_method if this is the first time and linked is true
      if (linked && !existing.signupMethod) {
        await storage.updateSignupMethod(userId, provider, false);
      }
      
      const updatedProfile = await storage.updateOAuthLinked(userId, provider, linked);
      
      res.json({ 
        googleLinked: updatedProfile.googleLinked, 
        appleLinked: updatedProfile.appleLinked,
        signupMethod: updatedProfile.signupMethod,
      });
    } catch (error: any) {
      console.error("Error updating OAuth linked status:", error);
      res.status(500).json({ error: "Failed to update OAuth status" });
    }
  });

  // Get magic link login enabled/disabled status
  app.get("/api/auth/profile/magic-link-status", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      // Fetch magic_link from user_profiles
      const { data, error } = await supabaseAdmin
        .from("user_profiles")
        .select("magic_link")
        .eq("id", userId)
        .single();
      
      if (error) {
        // Column might not exist yet, default to true
        console.log("[GET /api/auth/profile/magic-link-status] Error or column not found, defaulting to true");
        return res.json({ enabled: true });
      }
      
      res.json({ enabled: data?.magic_link !== false });
    } catch (error: any) {
      console.error("Error fetching magic link status:", error);
      res.json({ enabled: true }); // Default to true on error
    }
  });

  // Update magic link login enabled/disabled status
  app.post("/api/auth/profile/magic-link", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { enabled } = req.body;
      
      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ error: "enabled must be a boolean" });
      }
      
      console.log(`[POST /api/auth/profile/magic-link] userId: ${userId}, enabled: ${enabled}`);
      
      const existing = await storage.getUserProfile(userId);
      if (!existing) {
        return res.status(404).json({ error: "Profile not found" });
      }
      
      // Update the magic_link field in user_profiles
      const { data, error } = await supabaseAdmin
        .from("user_profiles")
        .update({ magic_link: enabled })
        .eq("id", userId)
        .select()
        .single();
      
      if (error) {
        console.error("[POST /api/auth/profile/magic-link] Error:", error);
        throw error;
      }
      
      res.json({ magicLink: data.magic_link });
    } catch (error: any) {
      console.error("Error updating magic link status:", error);
      res.status(500).json({ error: "Failed to update magic link status" });
    }
  });

  // Send password reset email for iOS PWA users who need to set a password
  // This is a secure alternative to directly setting passwords
  app.post("/api/auth/send-password-reset", async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }
      
      console.log(`[POST /api/auth/send-password-reset] Sending reset email to: ${email}`);
      
      // Use Supabase's built-in password reset which sends a secure email
      const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.replit.app` : 'http://localhost:5000'}/reset-password`,
      });
      
      if (error) {
        console.error("[POST /api/auth/send-password-reset] Error:", error);
        // Don't reveal if email exists or not for security
        return res.json({ success: true, message: "If an account exists, a password reset email has been sent." });
      }
      
      console.log(`[POST /api/auth/send-password-reset] Reset email sent to: ${email}`);
      res.json({ success: true, message: "Password reset email sent. Check your inbox." });
    } catch (error: any) {
      console.error("[POST /api/auth/send-password-reset] Error:", error);
      res.status(500).json({ error: "Failed to send reset email" });
    }
  });
  
  // Set password for authenticated user only (requires valid session)
  app.post("/api/auth/set-password", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { password } = req.body;
      
      if (!password) {
        return res.status(400).json({ error: "Password is required" });
      }
      
      console.log(`[POST /api/auth/set-password] Setting password for authenticated user: ${userId}`);
      
      // Update the user's password using admin API
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        { password }
      );
      
      if (updateError) {
        console.error("[POST /api/auth/set-password] Error updating password:", updateError);
        return res.status(500).json({ error: "Failed to set password" });
      }
      
      // Update password_created in user_profiles
      await storage.updatePasswordCreated(userId, true);
      
      console.log(`[POST /api/auth/set-password] Password set successfully for: ${userId}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[POST /api/auth/set-password] Error:", error);
      res.status(500).json({ error: "Failed to set password" });
    }
  });

  // Puzzle routes - REGION MODE (requires authentication for region context)
  app.get("/api/puzzles", verifySupabaseAuth, async (req: any, res) => {
    try {
      const startTime = Date.now();
      const userId = req.user.id;
      const profile = await storage.getUserProfile(userId);
      
      // Default to 'UK' if no region set
      const region = profile?.region || 'UK';
      
      console.log('[GET /api/puzzles] User profile region:', profile?.region, '| Using region:', region, '| userId:', userId);
      
      const allocatedQuestions = await storage.getAllocatedQuestionsByRegion(region);
      
      console.log('[GET /api/puzzles] Found allocated questions:', allocatedQuestions.length);
      
      // Batch load all categories upfront to avoid N+1 queries
      // Collect all unique category IDs first
      const categoryIds = new Set<number>();
      for (const aq of allocatedQuestions) {
        const categoriesArray = aq.masterQuestion.categories as number[] | null;
        if (categoriesArray && categoriesArray.length > 0) {
          categoryIds.add(categoriesArray[0]);
        }
      }
      
      // Fetch all categories in one batch
      const allCategories = await storage.getAllCategories();
      const categoryMap = new Map<number, string>();
      for (const cat of allCategories) {
        categoryMap.set(cat.id, cat.name);
      }
      
      // Transform to frontend-compatible format using the category map
      const puzzles = allocatedQuestions.map((aq) => {
        const categoriesArray = aq.masterQuestion.categories as number[] | null;
        let categoryName: string | null = null;
        if (categoriesArray && categoriesArray.length > 0) {
          categoryName = categoryMap.get(categoriesArray[0]) || null;
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
      });
      
      console.log('[GET /api/puzzles] Completed in', Date.now() - startTime, 'ms');
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

    // Handle streak_day_status for today's puzzle or streak saver (yesterday's puzzle)
    // IMPORTANT: Only update streak_day_status for yesterday's puzzle if isStreakSaverPlay is true
    // Archive plays should NOT update streak_day_status (preserve holiday protection, etc.)
    const puzzleDate = ownedAttempt.allocatedQuestion?.puzzleDate;
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0];
    const isTodaysPuzzle = puzzleDate === today;
    const isYesterdaysPuzzle = puzzleDate === yesterday;
    const isStreakSaverPlay = req.body.isStreakSaverPlay === true;
    
    // Server-side validation for streak saver: puzzle must be within last 2 days
    // (yesterday or 2 days ago to account for timezone edge cases)
    const isValidStreakSaverWindow = puzzleDate === yesterday || puzzleDate === twoDaysAgo;
    const isValidatedStreakSaverPlay = isStreakSaverPlay && isValidStreakSaverWindow;
    
    // Remove isStreakSaverPlay from updates as it's not a database column
    delete updates.isStreakSaverPlay;
    
    if (updates.result === "won" && isTodaysPuzzle) {
      // Today's puzzle win - always set streak_day_status = 1
      updates.streakDayStatus = 1;
      console.log('[PATCH /api/game-attempts/:id] Setting streak_day_status = 1 (today)');
    } else if (updates.result === "won" && isValidatedStreakSaverPlay) {
      // Streak saver win - set streak_day_status = 1
      // Validate: isStreakSaverPlay flag from frontend + puzzle date within last 2 days
      updates.streakDayStatus = 1;
      console.log('[PATCH /api/game-attempts/:id] Setting streak_day_status = 1 (streak saver)', { puzzleDate, today, yesterday, twoDaysAgo });
    } else if (updates.result === "lost" && isValidatedStreakSaverPlay) {
      // Streak saver loss: leave streak_day_status as NULL, reset streak to 0
      // streak_day_status stays NULL (don't set to 0) so streak calculation breaks
      console.log('[PATCH /api/game-attempts/:id] Streak saver lost - streak_day_status stays NULL, streak resets');
    } else if (updates.result === "lost" && isTodaysPuzzle) {
      // Today's puzzle loss: if streak_day_status was 0 (holiday day), set to NULL to break streak
      // This handles the case where user exits holiday mode and loses today's puzzle
      const currentStreakDayStatus = ownedAttempt.streakDayStatus;
      if (currentStreakDayStatus === 0) {
        updates.streakDayStatus = null;
        console.log('[PATCH /api/game-attempts/:id] Today puzzle lost after holiday - setting streak_day_status = NULL to break streak');
      }
    } else if (isYesterdaysPuzzle && !isStreakSaverPlay) {
      // Archive play of yesterday's puzzle - do NOT change streak_day_status
      console.log('[PATCH /api/game-attempts/:id] Archive play of yesterday - streak_day_status preserved');
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
// Stats are now scoped by region (user_id, region) to preserve history when users change regions
app.get("/api/stats", verifySupabaseAuth, async (req: any, res) => {
  try {
    const userId = req.user.id;
    // Get user's current region from profile
    const profile = await storage.getUserProfile(userId);
    const region = profile?.region || "UK";
    
    const stats = await storage.getUserStatsRegion(userId, region);
    res.json(stats || {});
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

  app.post("/api/stats", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      // Get user's current region from profile
      const profile = await storage.getUserProfile(userId);
      const region = profile?.region || "UK";
      
      const stats = await storage.upsertUserStatsRegion({
        userId,
        region, // Include region for composite unique constraint
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
      // Get user's current region from profile
      const profile = await storage.getUserProfile(userId);
      const region = profile?.region || "UK";
      
      const stats = await storage.recalculateUserStatsRegion(userId, region);
      res.json(stats);
    } catch (error) {
      console.error("[POST /api/stats/recalculate] Error:", error);
      res.status(500).json({ error: "Failed to recalculate stats" });
    }
  });

  app.get("/api/stats/percentile", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      // Get user's current region from profile
      const profile = await storage.getUserProfile(userId);
      const region = profile?.region || "UK";
      
      const percentile = await storage.getUserPercentileRankingRegion(userId, region);
      res.json({ percentile });
    } catch (error) {
      console.error("Error fetching percentile:", error);
      res.status(500).json({ error: "Failed to fetch percentile" });
    }
  });

  // ========================================================================
  // BADGE ROUTES - REGION GAME MODE
  // ========================================================================

  // Get all badges (for reference)
  app.get("/api/badges", async (req, res) => {
    try {
      const allBadges = await storage.getAllBadges();
      res.json(allBadges);
    } catch (error) {
      console.error("[GET /api/badges] Error:", error);
      res.status(500).json({ error: "Failed to fetch badges" });
    }
  });

  // Get user's earned badges for Region game mode (for Stats screen display)
  app.get("/api/badges/earned", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const profile = await storage.getUserProfile(userId);
      const region = profile?.region || "UK";
      
      console.log(`[GET /api/badges/earned] userId: ${userId}, region: ${region}, gameType: REGION`);
      
      const highestBadges = await storage.getHighestBadgePerCategory(userId, 'REGION', region);
      res.json(highestBadges);
    } catch (error) {
      console.error("[GET /api/badges/earned] Error:", error);
      res.status(500).json({ error: "Failed to fetch earned badges" });
    }
  });

  // Get ALL user's earned badges for Region game mode (for AllBadgesPopup - exact badge ID matching)
  app.get("/api/badges/earned/all", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const profile = await storage.getUserProfile(userId);
      const region = profile?.region || "UK";
      
      console.log(`[GET /api/badges/earned/all] userId: ${userId}, region: ${region}, gameType: REGION`);
      
      const allEarnedBadges = await storage.getUserBadges(userId, 'REGION', region, true);
      res.json(allEarnedBadges);
    } catch (error) {
      console.error("[GET /api/badges/earned/all] Error:", error);
      res.status(500).json({ error: "Failed to fetch all earned badges" });
    }
  });

  // Get pending badges for Region game mode (for popup animation)
  app.get("/api/badges/pending", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const profile = await storage.getUserProfile(userId);
      const region = profile?.region || "UK";
      
      console.log(`[GET /api/badges/pending] userId: ${userId}, region: ${region}, gameType: REGION`);
      
      const pendingBadges = await storage.getPendingBadges(userId, 'REGION', region);
      
      // For percentile badges, only return the highest (lowest threshold)
      const categorized: Record<string, typeof pendingBadges[0] | null> = {};
      const result: typeof pendingBadges = [];
      
      for (const badge of pendingBadges) {
        const cat = badge.badge.category;
        if (cat === 'percentile') {
          if (!categorized[cat] || badge.badge.threshold < categorized[cat]!.badge.threshold) {
            categorized[cat] = badge;
          }
        } else {
          result.push(badge);
        }
      }
      
      if (categorized.percentile) {
        result.push(categorized.percentile);
      }
      
      res.json(result);
    } catch (error) {
      console.error("[GET /api/badges/pending] Error:", error);
      res.status(500).json({ error: "Failed to fetch pending badges" });
    }
  });

  // Mark a badge as awarded (after popup shown)
  app.post("/api/badges/:userBadgeId/award", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userBadgeId = parseInt(req.params.userBadgeId, 10);
      if (isNaN(userBadgeId)) {
        return res.status(400).json({ error: "Invalid badge ID" });
      }
      
      await storage.markBadgeAwarded(userBadgeId);
      res.json({ success: true });
    } catch (error) {
      console.error("[POST /api/badges/:userBadgeId/award] Error:", error);
      res.status(500).json({ error: "Failed to mark badge as awarded" });
    }
  });

  // Check and award streak badge
  app.post("/api/badges/check-streak", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { streak } = req.body;
      const profile = await storage.getUserProfile(userId);
      const region = profile?.region || "UK";
      
      if (typeof streak !== 'number') {
        return res.status(400).json({ error: "Streak must be a number" });
      }
      
      console.log(`[POST /api/badges/check-streak] userId: ${userId}, streak: ${streak}, gameType: REGION, region: ${region}`);
      
      const newBadge = await storage.checkAndAwardStreakBadge(userId, streak, 'REGION', region);
      res.json({ badge: newBadge, awarded: !!newBadge });
    } catch (error) {
      console.error("[POST /api/badges/check-streak] Error:", error);
      res.status(500).json({ error: "Failed to check streak badge" });
    }
  });

  // Check and award elementle badge
  app.post("/api/badges/check-elementle", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { guessCount } = req.body;
      const profile = await storage.getUserProfile(userId);
      const region = profile?.region || "UK";
      
      if (typeof guessCount !== 'number') {
        return res.status(400).json({ error: "guessCount must be a number" });
      }
      
      console.log(`[POST /api/badges/check-elementle] userId: ${userId}, guessCount: ${guessCount}, gameType: REGION, region: ${region}`);
      
      const newBadge = await storage.checkAndAwardElementleBadge(userId, guessCount, 'REGION', region);
      res.json({ badge: newBadge, awarded: !!newBadge });
    } catch (error) {
      console.error("[POST /api/badges/check-elementle] Error:", error);
      res.status(500).json({ error: "Failed to check elementle badge" });
    }
  });

  // Check and award percentile badge (REGION mode)
  app.post("/api/badges/check-percentile", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const profile = await storage.getUserProfile(userId);
      const region = profile?.region || "UK";
      
      console.log(`[POST /api/badges/check-percentile] userId: ${userId}, gameType: REGION, region: ${region}`);
      
      const newBadge = await storage.checkAndAwardPercentileBadge(userId, 'REGION', region);
      res.json({ badge: newBadge, awarded: !!newBadge });
    } catch (error) {
      console.error("[POST /api/badges/check-percentile] Error:", error);
      res.status(500).json({ error: "Failed to check percentile badge" });
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

      // Handle streak_day_status for today's puzzle or streak saver (yesterday's puzzle)
      // IMPORTANT: Only update streak_day_status for yesterday's puzzle if isStreakSaverPlay is true
      // Archive plays should NOT update streak_day_status (preserve holiday protection, etc.)
      const puzzleDate = ownedAttempt.allocatedQuestion?.puzzleDate;
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0];
      const isTodaysPuzzle = puzzleDate === today;
      const isYesterdaysPuzzle = puzzleDate === yesterday;
      const isStreakSaverPlay = req.body.isStreakSaverPlay === true;
      
      // Server-side validation for streak saver: puzzle must be within last 2 days
      // (yesterday or 2 days ago to account for timezone edge cases)
      const isValidStreakSaverWindow = puzzleDate === yesterday || puzzleDate === twoDaysAgo;
      const isValidatedStreakSaverPlay = isStreakSaverPlay && isValidStreakSaverWindow;
      
      // Remove isStreakSaverPlay from updates as it's not a database column
      delete updates.isStreakSaverPlay;
      
      if (updates.result === "won" && isTodaysPuzzle) {
        // Check if holiday mode is active for today's puzzle
        const streakStatus = await storage.getStreakSaverStatus(userId);
        const holidayActive = streakStatus?.user?.holidayActive ?? false;
        
        if (!holidayActive) {
          updates.streakDayStatus = 1;
          console.log('[PATCH /api/user/game-attempts/:id] Setting streak_day_status = 1 (today)');
        } else {
          console.log('[PATCH /api/user/game-attempts/:id] Holiday active, streak_day_status remains as-is');
        }
      } else if (updates.result === "won" && isValidatedStreakSaverPlay) {
        // Streak saver win - set streak_day_status = 1
        // Validate: isStreakSaverPlay flag from frontend + puzzle date within last 2 days
        updates.streakDayStatus = 1;
        console.log('[PATCH /api/user/game-attempts/:id] Setting streak_day_status = 1 (streak saver)', { puzzleDate, today, yesterday, twoDaysAgo });
      } else if (updates.result === "lost" && isValidatedStreakSaverPlay) {
        // Streak saver loss: leave streak_day_status as NULL, reset streak to 0
        // streak_day_status stays NULL (don't set to 0) so streak calculation breaks
        console.log('[PATCH /api/user/game-attempts/:id] Streak saver lost - streak_day_status stays NULL, streak resets');
      } else if (updates.result === "lost" && isTodaysPuzzle) {
        // Today's puzzle loss: if streak_day_status was 0 (holiday day), set to NULL to break streak
        // This handles the case where user exits holiday mode and loses today's puzzle
        const currentStreakDayStatus = ownedAttempt.streakDayStatus;
        if (currentStreakDayStatus === 0) {
          updates.streakDayStatus = null;
          console.log('[PATCH /api/user/game-attempts/:id] Today puzzle lost after holiday - setting streak_day_status = NULL to break streak');
        }
      } else if (isYesterdaysPuzzle && !isStreakSaverPlay) {
        // Archive play of yesterday's puzzle - do NOT change streak_day_status
        console.log('[PATCH /api/user/game-attempts/:id] Archive play of yesterday - streak_day_status preserved');
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
      console.error("[POST /api/user/stats/recalculate] Error:", error);
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

  // ========================================================================
  // BADGE ROUTES - USER GAME MODE
  // ========================================================================

  // Get user's earned badges for User game mode (for Stats screen display)
  app.get("/api/user/badges/earned", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      console.log(`[GET /api/user/badges/earned] userId: ${userId}, gameType: USER, region: GLOBAL`);
      
      const highestBadges = await storage.getHighestBadgePerCategory(userId, 'USER', 'GLOBAL');
      res.json(highestBadges);
    } catch (error) {
      console.error("[GET /api/user/badges/earned] Error:", error);
      res.status(500).json({ error: "Failed to fetch earned badges" });
    }
  });

  // Get ALL user's earned badges for User game mode (for AllBadgesPopup - exact badge ID matching)
  app.get("/api/user/badges/earned/all", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      console.log(`[GET /api/user/badges/earned/all] userId: ${userId}, gameType: USER, region: GLOBAL`);
      
      const allEarnedBadges = await storage.getUserBadges(userId, 'USER', 'GLOBAL', true);
      res.json(allEarnedBadges);
    } catch (error) {
      console.error("[GET /api/user/badges/earned/all] Error:", error);
      res.status(500).json({ error: "Failed to fetch all earned badges" });
    }
  });

  // Get pending badges for User game mode (for popup animation)
  app.get("/api/user/badges/pending", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      console.log(`[GET /api/user/badges/pending] userId: ${userId}, gameType: USER, region: GLOBAL`);
      
      const pendingBadges = await storage.getPendingBadges(userId, 'USER', 'GLOBAL');
      
      // For percentile badges, only return the highest (lowest threshold)
      const categorized: Record<string, typeof pendingBadges[0] | null> = {};
      const result: typeof pendingBadges = [];
      
      for (const badge of pendingBadges) {
        const cat = badge.badge.category;
        if (cat === 'percentile') {
          if (!categorized[cat] || badge.badge.threshold < categorized[cat]!.badge.threshold) {
            categorized[cat] = badge;
          }
        } else {
          result.push(badge);
        }
      }
      
      if (categorized.percentile) {
        result.push(categorized.percentile);
      }
      
      res.json(result);
    } catch (error) {
      console.error("[GET /api/user/badges/pending] Error:", error);
      res.status(500).json({ error: "Failed to fetch pending badges" });
    }
  });

  // Check and award streak badge for User mode
  app.post("/api/user/badges/check-streak", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { streak } = req.body;
      
      if (typeof streak !== 'number') {
        return res.status(400).json({ error: "Streak must be a number" });
      }
      
      console.log(`[POST /api/user/badges/check-streak] userId: ${userId}, streak: ${streak}, gameType: USER, region: GLOBAL`);
      
      const newBadge = await storage.checkAndAwardStreakBadge(userId, streak, 'USER', 'GLOBAL');
      res.json({ badge: newBadge, awarded: !!newBadge });
    } catch (error) {
      console.error("[POST /api/user/badges/check-streak] Error:", error);
      res.status(500).json({ error: "Failed to check streak badge" });
    }
  });

  // Check and award elementle badge for User mode
  app.post("/api/user/badges/check-elementle", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { guessCount } = req.body;
      
      if (typeof guessCount !== 'number') {
        return res.status(400).json({ error: "guessCount must be a number" });
      }
      
      console.log(`[POST /api/user/badges/check-elementle] userId: ${userId}, guessCount: ${guessCount}, gameType: USER, region: GLOBAL`);
      
      const newBadge = await storage.checkAndAwardElementleBadge(userId, guessCount, 'USER', 'GLOBAL');
      res.json({ badge: newBadge, awarded: !!newBadge });
    } catch (error) {
      console.error("[POST /api/user/badges/check-elementle] Error:", error);
      res.status(500).json({ error: "Failed to check elementle badge" });
    }
  });

  // Check and award percentile badge for User mode
  app.post("/api/user/badges/check-percentile", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      console.log(`[POST /api/user/badges/check-percentile] userId: ${userId}, gameType: USER, region: GLOBAL`);
      
      const newBadge = await storage.checkAndAwardPercentileBadge(userId, 'USER', 'GLOBAL');
      res.json({ badge: newBadge, awarded: !!newBadge });
    } catch (error) {
      console.error("[POST /api/user/badges/check-percentile] Error:", error);
      res.status(500).json({ error: "Failed to check percentile badge" });
    }
  });

  // ============================================================================
  // SUBSCRIPTION & PRO ROUTES
  // ============================================================================

  // Get user subscription - reads from user_profiles + user_tier (new workflow)
  app.get("/api/subscription", verifySupabaseAuth, async (req: any, res) => {
    const userId = req.user.id;
    console.log('[subscription] Checking subscription for userId:', userId);
    
    try {
      const subscriptionData = await storage.getSubscriptionData(userId);
      
      if (subscriptionData) {
        console.log('[subscription] Subscription data found:', {
          tier: subscriptionData.tier,
          tierName: subscriptionData.tierName,
          tierType: subscriptionData.tierType,
          isActive: subscriptionData.isActive,
          isExpired: subscriptionData.isExpired,
        });
        
        return res.json(subscriptionData);
      }
      
      // No subscription data found - return default Standard tier response
      console.log('[subscription] No subscription data found, returning Standard tier');
      return res.json({
        tier: 'free',
        tierName: 'Standard',
        tierType: 'default',
        tierId: null,
        userId: userId,
        endDate: null,
        autoRenew: false,
        isActive: false,
        isExpired: false,
        metadata: {
          streakSavers: 1,
          holidaySavers: 0,
          holidayDurationDays: 14,
          subscriptionCost: 0,
          currency: 'GBP',
          subscriptionDurationMonths: null,
          description: 'Free tier',
          sortOrder: 0,
        }
      });
      
    } catch (error: any) {
      console.error("[subscription] Error fetching subscription:", error);
      return res.status(500).json({ error: "Failed to fetch subscription" });
    }
  });

  // Get purchasable tiers for a region (for subscription/renewal UI)
  // Uses tier + tier_type from user_tier, excludes Standard tier
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
    
    console.log('[tiers] Fetching purchasable tiers for region:', region);
    
    try {
      const tiers = await storage.getPurchasableTiers(region);
      
      console.log('[tiers] Found purchasable tiers:', tiers.length);
      console.log('[tiers] Tier data:', tiers.map(t => ({ 
        tier: t.tier, 
        tierType: t.tierType,
        subscriptionCost: t.subscriptionCost, 
        currency: t.currency 
      })));
      
      return res.json(tiers);
    } catch (error: any) {
      console.error("[tiers] Error fetching tiers:", error);
      return res.status(500).json({ error: "Failed to fetch tiers" });
    }
  });

  // Create Stripe Checkout session via Supabase Edge Function
  // Returns Stripe Checkout URL for frontend redirect
  app.post("/api/subscription/create-checkout", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { tierId, promotionCode } = req.body;

      console.log('[checkout] Creating Stripe checkout for userId:', userId, 'tierId:', tierId);

      if (!tierId) {
        return res.status(400).json({ error: "tierId is required" });
      }

      // Validate tier exists and is active
      const result = await db.execute(sql`
        SELECT id, tier, tier_type, stripe_price_id
        FROM user_tier
        WHERE id = ${tierId} AND active = true
      `);
      
      const rows = Array.isArray(result) ? result : (result as any).rows || [];
      if (!rows || rows.length === 0) {
        return res.status(400).json({ error: "Invalid tier" });
      }
      
      const tierData = rows[0];
      
      if (!tierData.stripe_price_id) {
        console.error('[checkout] Tier missing stripe_price_id:', tierId);
        return res.status(400).json({ error: "This tier is not available for purchase" });
      }

      // Call Supabase Edge Function to create Stripe Checkout session
      const supabaseUrl = process.env.SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error("SUPABASE_URL not configured");
      }

      const edgeFunctionUrl = `${supabaseUrl}/functions/v1/create_checkout_session`;
      
      console.log('[checkout] Calling Edge Function:', edgeFunctionUrl);
      
      const edgeResponse = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          user_id: userId,
          tier_id: tierId,
          promotion_code: promotionCode || null,
        }),
      });

      if (!edgeResponse.ok) {
        const errorText = await edgeResponse.text();
        console.error('[checkout] Edge Function error:', edgeResponse.status, errorText);
        throw new Error(`Checkout session creation failed: ${errorText}`);
      }

      const checkoutData = await edgeResponse.json();
      
      if (!checkoutData.url) {
        console.error('[checkout] No checkout URL returned:', checkoutData);
        throw new Error("No checkout URL returned from payment provider");
      }

      console.log('[checkout] Stripe checkout session created, redirecting to:', checkoutData.url);

      // Note: Pending subscription is inserted by the Edge Function via insert_pending_subscription RPC
      // Webhook will update the pending row to active status upon successful payment

      res.json({ 
        success: true,
        url: checkoutData.url,
        sessionId: checkoutData.session_id,
      });
    } catch (error: any) {
      console.error("[checkout] Error creating checkout session:", error);
      res.status(500).json({ error: "Failed to create checkout session", details: error.message });
    }
  });

  // Get current subscription status (for post-checkout polling)
  app.get("/api/subscription/status", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      console.log('[subscription/status] Checking subscription status for userId:', userId);

      // Check user_subscriptions table for active subscription
      const result = await db.execute(sql`
        SELECT 
          us.id,
          us.user_tier_id,
          us.status,
          us.expires_at,
          us.auto_renew,
          ut.tier,
          ut.tier_type
        FROM user_subscriptions us
        JOIN user_tier ut ON us.user_tier_id = ut.id
        WHERE us.user_id = ${userId}
          AND us.status = 'active'
          AND (us.expires_at IS NULL OR us.expires_at > NOW())
        ORDER BY us.created_at DESC
        LIMIT 1
      `);

      const rows = Array.isArray(result) ? result : (result as any).rows || [];
      
      if (rows.length === 0) {
        console.log('[subscription/status] No active subscription found for user:', userId);
        return res.json({
          hasActiveSubscription: false,
        });
      }

      const subscription = rows[0];
      console.log('[subscription/status] Found active subscription:', subscription);

      res.json({
        hasActiveSubscription: true,
        subscription: {
          id: subscription.id,
          tierId: subscription.user_tier_id,
          tierName: subscription.tier,
          tierType: subscription.tier_type,
          status: subscription.status,
          expiresAt: subscription.expires_at,
          autoRenew: subscription.auto_renew,
        },
      });
    } catch (error: any) {
      console.error("[subscription/status] Error fetching subscription status:", error);
      res.status(500).json({ error: "Failed to fetch subscription status", details: error.message });
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

      // Use storage method to update auto_renew on most recent subscription
      await storage.updateAutoRenew(userId, autoRenew);

      console.log('[subscription/auto-renew] Updated successfully');
      res.json({ success: true, autoRenew });
    } catch (error: any) {
      console.error("[subscription/auto-renew] Error updating auto-renew:", error);
      res.status(500).json({ error: "Failed to update auto-renewal", details: error.message });
    }
  });

  // Downgrade subscription to Standard tier
  app.post("/api/subscription/downgrade", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      console.log('[subscription/downgrade] Downgrading user:', userId);

      // Get user's region from profile
      const profile = await storage.getUserProfile(userId);
      const region = profile?.region || 'UK';

      // Downgrade user to Standard tier
      await storage.downgradeToStandard(userId, region);

      console.log('[subscription/downgrade] Successfully downgraded to Standard');
      res.json({ 
        success: true, 
        message: 'Successfully downgraded to Standard tier',
        tier: 'free',
        tierName: 'Standard',
        tierType: 'default',
      });
    } catch (error: any) {
      console.error("[subscription/downgrade] Error downgrading subscription:", error);
      res.status(500).json({ error: "Failed to downgrade subscription", details: error.message });
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
      
      // Get subscription data to determine allowances
      let subscriptionData = null;
      try {
        subscriptionData = await storage.getSubscriptionData(userId);
      } catch (subError) {
        console.log('[streak-saver/status] Could not fetch subscription, using defaults');
      }
      
      // Determine if user is Pro
      const isPro = subscriptionData?.tier === 'pro' && subscriptionData?.isActive;
      
      // Determine allowances from tier metadata
      let streakSaverAllowance = 1;
      let holidaySaverAllowance = 0;
      let holidayDurationDays = 0;
      
      if (isPro && subscriptionData?.metadata) {
        // Pro user with valid tier - use metadata or sensible Pro defaults
        streakSaverAllowance = subscriptionData.metadata.streakSavers ?? 3;
        holidaySaverAllowance = subscriptionData.metadata.holidaySavers ?? 2;
        holidayDurationDays = subscriptionData.metadata.holidayDurationDays ?? 7;
      } else if (subscriptionData?.metadata) {
        // Standard tier with metadata
        streakSaverAllowance = subscriptionData.metadata.streakSavers ?? 1;
        holidaySaverAllowance = 0;
        holidayDurationDays = 0;
      }
      
      // Get holiday usage this year from the status (stored in user_stats_user.holidays_used_year)
      const holidaysUsedThisYear = status?.user?.holidaysUsedYear ?? 0;
      
      console.log('[streak-saver/status] Status:', { status, isPro, streakSaverAllowance, holidaysUsedThisYear });
      
      // Return safe defaults if status is null (new user without stats)
      const safeStatus = status || {
        region: { currentStreak: 0, streakSaversUsedMonth: 0, missedYesterdayFlag: false },
        user: { currentStreak: 0, streakSaversUsedMonth: 0, holidayActive: false, holidayStartDate: null, holidayEndDate: null, holidayDaysTakenCurrentPeriod: 0, holidayEnded: false, missedYesterdayFlag: false, holidaysUsedYear: 0 }
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
      
      // Get subscription data to determine allowance
      let subscriptionData = null;
      try {
        subscriptionData = await storage.getSubscriptionData(userId);
      } catch (subError) {
        console.log('[streak-saver/use] Could not fetch subscription, using defaults');
      }
      
      // Determine allowance based on subscription
      const isPro = subscriptionData?.tier === 'pro' && subscriptionData?.isActive;
      
      let allowance = 1; // Default for Standard tier
      if (isPro && subscriptionData?.metadata) {
        allowance = subscriptionData.metadata.streakSavers ?? 3;
      } else if (subscriptionData?.metadata) {
        allowance = subscriptionData.metadata.streakSavers ?? 1;
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

  // Clear missed_yesterday flags when user is in holiday mode (no streak reset)
  app.post("/api/streak-saver/clear-holiday", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      console.log('[streak-saver/clear-holiday] User:', userId);
      
      // Clear both missed_yesterday flags without resetting streaks
      await db.execute(sql.raw(`
        UPDATE user_stats_region
        SET missed_yesterday_flag_region = false, updated_at = NOW()
        WHERE user_id = '${userId}'
      `));
      
      await db.execute(sql.raw(`
        UPDATE user_stats_user
        SET missed_yesterday_flag_user = false, updated_at = NOW()
        WHERE user_id = '${userId}'
      `));
      
      console.log('[streak-saver/clear-holiday] Cleared missed flags for holiday user');
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error clearing holiday missed flags:", error);
      res.status(500).json({ error: "Failed to clear missed flags" });
    }
  });

  // Start a holiday (Pro users only)
  app.post("/api/holiday/start", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      console.log('[holiday/start] User:', userId);
      
      // Get subscription data to check tier and holiday allowance
      let subscriptionData = null;
      try {
        subscriptionData = await storage.getSubscriptionData(userId);
        console.log('[holiday/start] Subscription data:', JSON.stringify({
          tier: subscriptionData?.tier,
          isActive: subscriptionData?.isActive,
          metadata: subscriptionData?.metadata
        }));
      } catch (subError) {
        console.log('[holiday/start] Could not fetch subscription, denying access');
        return res.status(403).json({ error: "Holiday feature is Pro-only", needsSubscription: true });
      }
      
      // Determine if user is Pro
      const isPro = subscriptionData?.tier === 'pro' && subscriptionData?.isActive;
      
      if (!isPro || !subscriptionData?.metadata) {
        console.log('[holiday/start] Not Pro or no metadata. isPro:', isPro, 'hasMetadata:', !!subscriptionData?.metadata);
        return res.status(403).json({ error: "Holiday feature is Pro-only", needsSubscription: true });
      }
      
      // Get holiday allowances from tier metadata
      const holidayAllowance = subscriptionData.metadata.holidaySavers ?? 2;
      const holidayDurationDays = subscriptionData.metadata.holidayDurationDays ?? 7;
      
      console.log('[holiday/start] Allowances - savers:', holidayAllowance, 'durationDays:', holidayDurationDays);
      
      if (holidayAllowance === 0 || holidayDurationDays === 0) {
        return res.status(403).json({ error: "Your tier does not include holidays" });
      }
      
      // Check annual holiday usage from user_stats_user.holidays_used_year
      const status = await storage.getStreakSaverStatus(userId);
      const holidaysUsedThisYear = status?.user?.holidaysUsedYear ?? 0;
      const holidayActive = status?.user?.holidayActive ?? false;
      
      console.log('[holiday/start] Status - usedThisYear:', holidaysUsedThisYear, 'allowance:', holidayAllowance, 'alreadyActive:', holidayActive);
      
      if (holidaysUsedThisYear >= holidayAllowance) {
        return res.status(400).json({ error: "No holidays remaining this year" });
      }
      
      // Start the holiday
      const result = await storage.startHoliday(userId, holidayDurationDays);
      
      if (!result.success) {
        console.log('[holiday/start] RPC failed:', result.error);
        return res.status(400).json({ error: result.error });
      }
      
      console.log('[holiday/start] Holiday started successfully');
      res.json({ success: true, holidayDurationDays });
    } catch (error: any) {
      console.error("Error starting holiday:", error);
      res.status(500).json({ error: "Failed to start holiday" });
    }
  });

  // End a holiday early (or acknowledge auto-ended holiday)
  app.post("/api/holiday/end", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { acknowledge } = req.body || {};
      console.log('[holiday/end] User:', userId, 'acknowledge:', acknowledge);
      
      const result = await storage.endHoliday(userId, acknowledge === true);
      
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

  // Get holiday animation data - determines which games should show the calendar animation
  app.get("/api/holiday/animation-data", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      console.log('[holiday/animation-data] Fetching for user:', userId);
      
      const data = await storage.getHolidayAnimationData(userId);
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching holiday animation data:", error);
      res.status(500).json({ error: "Failed to fetch holiday animation data" });
    }
  });

  // Get all categories (excluding Local History - id 999)
  app.get("/api/categories", async (req, res) => {
    try {
      const startTime = Date.now();
      console.log("[GET /api/categories] Fetching categories...");
      const categories = await storage.getAllCategories();
      const dbTime = Date.now() - startTime;
      console.log("[GET /api/categories] Found categories:", categories?.length, "in", dbTime, "ms");
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
      const startTime = Date.now();
      const userId = req.user.id;
      const categoryIds = await storage.getUserProCategories(userId);
      const dbTime = Date.now() - startTime;
      console.log("[getUserProCategories] Completed in", dbTime, "ms for user:", userId);
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

      // Save categories
      await storage.saveUserProCategories(userId, categoryIds);
      
      // Note: categoriesLastChangedAt is updated by GeneratingQuestionsScreen after question regeneration completes
      // This ensures the timestamp reflects when questions were actually regenerated, not just when categories were saved
      
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

  // Get category restriction days (public endpoint for validation - Pro users)
  app.get("/api/settings/category-restriction-days", async (req, res) => {
    try {
      const setting = await storage.getAdminSetting('category_restriction_days');
      const days = setting ? parseInt(setting.value, 10) : 14; // Default to 14 days
      res.json({ days });
    } catch (error) {
      console.error("Error fetching category restriction:", error);
      res.json({ days: 14 }); // Default to 14 on error
    }
  });

  // Get category restriction status for authenticated user (computed server-side)
  // Returns: { status: 'allowed' | 'restricted', restrictionDays, lastChangedAt, message }
  app.get("/api/category-restriction-status", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      // Get the restriction days setting
      const setting = await storage.getAdminSetting('category_restriction_days');
      const restrictionDays = setting ? parseInt(setting.value, 10) : 14;
      
      // Get user profile to check categoriesLastChangedAt
      const profile = await storage.getUserProfile(userId);
      
      if (!profile) {
        // No profile found - allow access (new user)
        return res.json({
          status: 'allowed',
          restrictionDays,
          lastChangedAt: null,
          message: null
        });
      }
      
      // If restriction is disabled (0 days), always allow
      if (restrictionDays === 0) {
        return res.json({
          status: 'allowed',
          restrictionDays: 0,
          lastChangedAt: profile.categoriesLastChangedAt || null,
          message: null
        });
      }
      
      // If no previous change, allow
      const lastChangedAt = profile.categoriesLastChangedAt;
      if (!lastChangedAt) {
        return res.json({
          status: 'allowed',
          restrictionDays,
          lastChangedAt: null,
          message: null
        });
      }
      
      // Calculate if within restriction window
      const lastChangedDate = new Date(lastChangedAt);
      const allowedAfter = new Date(lastChangedDate);
      allowedAfter.setDate(allowedAfter.getDate() + restrictionDays);
      
      const now = new Date();
      const isRestricted = now < allowedAfter;
      
      if (isRestricted) {
        return res.json({
          status: 'restricted',
          restrictionDays,
          lastChangedAt: lastChangedAt,
          message: `You can update your categories once every ${restrictionDays} days and Hammie will regenerate your questions.`
        });
      }
      
      return res.json({
        status: 'allowed',
        restrictionDays,
        lastChangedAt: lastChangedAt,
        message: null
      });
    } catch (error) {
      console.error("Error checking category restriction status:", error);
      // On error, return restricted to be safe
      res.status(500).json({ 
        status: 'error',
        error: "Failed to check restriction status" 
      });
    }
  });

  // Update restriction timestamps after question generation completes
  // Called by GeneratingQuestionsScreen after generation finishes
  app.post("/api/generation-complete", verifySupabaseAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { regenerationType } = req.body;
      
      console.log(`[POST /api/generation-complete] userId=${userId}, regenerationType=${regenerationType}`);
      
      if (!regenerationType || !['first_login', 'postcode_change', 'category_change'].includes(regenerationType)) {
        return res.status(400).json({ error: "Invalid regenerationType" });
      }
      
      const profile = await storage.getUserProfile(userId);
      if (!profile) {
        console.log(`[POST /api/generation-complete] No profile found for user ${userId}`);
        return res.status(404).json({ error: "User profile not found" });
      }
      
      const now = new Date();
      let updated = false;
      
      if (regenerationType === 'first_login') {
        // Initial signup flow: only set postcode_last_changed_at if user has a postcode
        // If postcode is empty, leave it NULL so user can add one later without restriction
        if (!profile.postcodeLastChangedAt && profile.postcode) {
          await storage.upsertUserProfile({
            id: userId,
            email: profile.email,
            postcodeLastChangedAt: now,
          });
          console.log(`[POST /api/generation-complete] Set postcodeLastChangedAt to ${now} for first_login (has postcode)`);
          updated = true;
        } else if (!profile.postcode) {
          console.log(`[POST /api/generation-complete] No postcode set, leaving postcodeLastChangedAt NULL for first_login`);
        } else {
          console.log(`[POST /api/generation-complete] postcodeLastChangedAt already set, skipping for first_login`);
        }
      } else if (regenerationType === 'postcode_change') {
        // Postcode/region change: always update postcodeLastChangedAt
        await storage.upsertUserProfile({
          id: userId,
          email: profile.email,
          postcodeLastChangedAt: now,
        });
        console.log(`[POST /api/generation-complete] Updated postcodeLastChangedAt to ${now} for postcode_change`);
        updated = true;
      } else if (regenerationType === 'category_change') {
        // Category change: set categories_last_changed_at
        // On first run (NULL), initialize it; on subsequent runs, update it
        if (!profile.categoriesLastChangedAt) {
          await storage.upsertUserProfile({
            id: userId,
            email: profile.email,
            categoriesLastChangedAt: now,
          });
          console.log(`[POST /api/generation-complete] Set categoriesLastChangedAt to ${now} for category_change (was NULL)`);
          updated = true;
        } else {
          // Subsequent category changes - also update the timestamp
          await storage.upsertUserProfile({
            id: userId,
            email: profile.email,
            categoriesLastChangedAt: now,
          });
          console.log(`[POST /api/generation-complete] Updated categoriesLastChangedAt to ${now} for category_change`);
          updated = true;
        }
      }
      
      res.json({ success: true, updated, regenerationType });
    } catch (error) {
      console.error("Error in generation-complete:", error);
      res.status(500).json({ error: "Failed to update timestamps" });
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

  // Admin endpoint to fix/drop the postcode guard trigger (if it exists)
  // This trigger may be blocking postcode changes with hardcoded 14-day restriction
  app.post("/api/admin/fix-postcode-trigger", verifySupabaseAuth, requireAdmin, async (req, res) => {
    try {
      console.log("[POST /api/admin/fix-postcode-trigger] Attempting to drop postcode guard trigger...");
      
      // First, get the current restriction setting
      const setting = await storage.getAdminSetting('postcode_restriction_days');
      const restrictionDays = setting ? parseInt(setting.value, 10) : 14;
      
      // Drop ALL triggers that might be using the postcode guard function
      // There may be multiple trigger names pointing to the same function
      await db.execute(sql`DROP TRIGGER IF EXISTS trg_postcode_guard ON public.user_profiles`);
      console.log("[POST /api/admin/fix-postcode-trigger] Dropped trigger trg_postcode_guard (if existed)");
      
      await db.execute(sql`DROP TRIGGER IF EXISTS user_profiles_postcode_guard ON public.user_profiles`);
      console.log("[POST /api/admin/fix-postcode-trigger] Dropped trigger user_profiles_postcode_guard (if existed)");
      
      // Also try other possible trigger names
      await db.execute(sql`DROP TRIGGER IF EXISTS postcode_guard ON public.user_profiles`);
      await db.execute(sql`DROP TRIGGER IF EXISTS postcode_change_guard ON public.user_profiles`);
      console.log("[POST /api/admin/fix-postcode-trigger] Dropped all known postcode guard triggers");
      
      // Now drop the function with CASCADE to remove any remaining dependencies
      await db.execute(sql`DROP FUNCTION IF EXISTS trg_postcode_guard() CASCADE`);
      console.log("[POST /api/admin/fix-postcode-trigger] Dropped function trg_postcode_guard() with CASCADE");
      
      // If restriction is > 0, create a new trigger that reads from admin_settings
      if (restrictionDays > 0) {
        // Create a function that reads the restriction from admin_settings table
        await db.execute(sql`
          CREATE OR REPLACE FUNCTION trg_postcode_guard()
          RETURNS TRIGGER AS $$
          DECLARE
            restriction_days INTEGER;
            last_changed TIMESTAMP;
            allowed_after TIMESTAMP;
          BEGIN
            -- Get the restriction setting, default to 14 if not found
            SELECT COALESCE((value::INTEGER), 14) INTO restriction_days
            FROM admin_settings WHERE key = 'postcode_restriction_days';
            
            -- If restriction is 0 (no restriction), allow the change
            IF restriction_days = 0 THEN
              RETURN NEW;
            END IF;
            
            -- Check if postcode is actually changing
            IF NEW.postcode IS DISTINCT FROM OLD.postcode THEN
              -- Get the last changed timestamp
              last_changed := OLD.postcode_last_changed_at;
              
              -- If never changed before, allow it
              IF last_changed IS NULL THEN
                RETURN NEW;
              END IF;
              
              -- Calculate when change is allowed
              allowed_after := last_changed + (restriction_days || ' days')::INTERVAL;
              
              -- Block if within restriction window
              IF NOW() < allowed_after THEN
                RAISE EXCEPTION 'You can only change your postcode once every % days', restriction_days;
              END IF;
            END IF;
            
            RETURN NEW;
          END;
          $$ LANGUAGE plpgsql
        `);
        
        // Create the trigger
        await db.execute(sql`
          CREATE TRIGGER trg_postcode_guard
          BEFORE UPDATE ON public.user_profiles
          FOR EACH ROW
          EXECUTE FUNCTION trg_postcode_guard()
        `);
        
        console.log("[POST /api/admin/fix-postcode-trigger] Created new trigger with dynamic restriction setting");
        res.json({ 
          success: true, 
          message: `Trigger recreated with dynamic restriction (currently ${restrictionDays} days from admin settings)`,
          restrictionDays
        });
      } else {
        console.log("[POST /api/admin/fix-postcode-trigger] Restriction is 0, trigger removed completely");
        res.json({ 
          success: true, 
          message: "Trigger removed (restriction is set to 'No restriction')",
          restrictionDays: 0
        });
      }
    } catch (error: any) {
      console.error("[POST /api/admin/fix-postcode-trigger] Error:", error);
      res.status(500).json({ 
        error: "Failed to fix trigger", 
        details: error.message,
        hint: "You may need to run this SQL directly in Supabase SQL Editor:\n" +
              "DROP TRIGGER IF EXISTS trg_postcode_guard ON public.user_profiles;\n" +
              "DROP TRIGGER IF EXISTS user_profiles_postcode_guard ON public.user_profiles;\n" +
              "DROP FUNCTION IF EXISTS trg_postcode_guard() CASCADE;"
      });
    }
  });

  // Get all subscription tiers for admin visibility management
  app.get("/api/admin/tiers", verifySupabaseAuth, requireAdmin, async (req: any, res) => {
    try {
      const result = await db.execute(sql`
        SELECT 
          id,
          region,
          tier,
          tier_type as "tierType",
          active
        FROM user_tier
        WHERE tier != 'Standard'
        ORDER BY region, sort_order ASC
      `);
      
      const rows = Array.isArray(result) ? result : (result as any).rows || [];
      return res.json(rows);
    } catch (error: any) {
      console.error("[GET /api/admin/tiers] Error:", error);
      return res.status(500).json({ error: "Failed to fetch tiers" });
    }
  });

  // Update tier visibility (active status)
  app.put("/api/admin/tiers", verifySupabaseAuth, requireAdmin, async (req: any, res) => {
    try {
      const { updates } = req.body;
      
      if (!updates || !Array.isArray(updates)) {
        return res.status(400).json({ error: "Invalid updates format" });
      }

      // Update each tier's active status
      const results = await Promise.all(
        updates.map(({ tierId, active }: { tierId: string; active: boolean }) =>
          db.execute(sql`
            UPDATE user_tier 
            SET active = ${active}, updated_at = NOW()
            WHERE id = ${tierId} AND tier != 'Standard'
          `)
        )
      );

      console.log("[PUT /api/admin/tiers] Updated tier visibility:", updates.length, "tiers");
      return res.json({ 
        success: true, 
        message: `Updated ${updates.length} tier visibility settings` 
      });
    } catch (error: any) {
      console.error("[PUT /api/admin/tiers] Error:", error);
      return res.status(500).json({ error: "Failed to update tier visibility" });
    }
  });

  // Debug endpoint to check user data (admin only)
  app.get("/api/admin/debug-user/:userId", verifySupabaseAuth, requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      console.log("[GET /api/admin/debug-user] Checking user:", userId);
      
      // Get user profile from Supabase
      const { data: profile, error: profileError } = await supabaseAdmin
        .from("user_profiles")
        .select("*")
        .eq("id", userId)
        .single();
      
      if (profileError) {
        console.error("[GET /api/admin/debug-user] Profile error:", profileError);
      }
      
      // Get location_allocation entries
      const { data: locations, error: locError } = await supabaseAdmin
        .from("location_allocation")
        .select("*")
        .eq("user_id", userId);
      
      if (locError) {
        console.error("[GET /api/admin/debug-user] Location allocation error:", locError);
      }
      
      // Get user_question_allocation entries (count only)
      const { data: questions, error: questionsError, count } = await supabaseAdmin
        .from("user_question_allocation")
        .select("id", { count: 'exact' })
        .eq("user_id", userId);
      
      if (questionsError) {
        console.error("[GET /api/admin/debug-user] Questions error:", questionsError);
      }
      
      res.json({
        userId,
        profile: profile || null,
        profileError: profileError?.message || null,
        locationAllocation: locations || [],
        locationAllocationCount: locations?.length || 0,
        locationError: locError?.message || null,
        questionAllocationCount: count || 0,
        questionsError: questionsError?.message || null,
      });
    } catch (error: any) {
      console.error("[GET /api/admin/debug-user] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Debug endpoint to check streak data
  app.get("/api/admin/debug-streak/:userId", verifySupabaseAuth, requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      console.log("[GET /api/admin/debug-streak] Checking streak for user:", userId);
      
      // Get raw game attempts with streak_day_status for region mode
      const regionAttempts = await db.execute(sql`
        SELECT 
          ga.id,
          ga.result,
          ga.streak_day_status,
          ga.completed_at,
          qa.puzzle_date,
          qa.region
        FROM game_attempts_region ga
        INNER JOIN questions_allocated_region qa ON ga.allocated_region_id = qa.id
        WHERE ga.user_id = ${userId}
        ORDER BY qa.puzzle_date DESC
        LIMIT 20
      `);
      
      // Get user stats region
      const regionStats = await db.execute(sql`
        SELECT * FROM user_stats_region WHERE user_id = ${userId}
      `);
      
      const regionRows = Array.isArray(regionAttempts) ? regionAttempts : (regionAttempts as any).rows || [];
      const regionStatsRows = Array.isArray(regionStats) ? regionStats : (regionStats as any).rows || [];
      
      res.json({
        userId,
        regionGameAttempts: regionRows,
        regionStats: regionStatsRows[0] || null,
      });
    } catch (error: any) {
      console.error("[GET /api/admin/debug-streak] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Debug endpoint to trigger stats recalculation for any user (admin only)
  app.post("/api/admin/recalculate-stats/:userId", verifySupabaseAuth, requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const { region } = req.query;
      console.log("[POST /api/admin/recalculate-stats] Recalculating for user:", userId, "region:", region);
      
      const stats = await storage.recalculateUserStatsRegion(userId, (region as string) || undefined);
      res.json(stats);
    } catch (error: any) {
      console.error("[POST /api/admin/recalculate-stats] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Bulk recalculate stats for ALL users (admin only) - both Region and User modes
  app.post("/api/admin/recalculate-all-stats", verifySupabaseAuth, requireAdmin, async (req, res) => {
    try {
      console.log("[POST /api/admin/recalculate-all-stats] Starting bulk recalculation...");
      
      // Get all unique user IDs from both game modes
      const regionUsersResult = await db.execute(sql`
        SELECT DISTINCT user_id FROM user_stats_region WHERE user_id IS NOT NULL
      `);
      const userModeUsersResult = await db.execute(sql`
        SELECT DISTINCT user_id FROM user_stats_user WHERE user_id IS NOT NULL
      `);
      
      const regionRows = Array.isArray(regionUsersResult) ? regionUsersResult : (regionUsersResult as any).rows || [];
      const userRows = Array.isArray(userModeUsersResult) ? userModeUsersResult : (userModeUsersResult as any).rows || [];
      
      // Combine unique user IDs from both tables
      const allUserIds = new Set<string>();
      for (const row of regionRows) {
        if (row.user_id) allUserIds.add(row.user_id);
      }
      for (const row of userRows) {
        if (row.user_id) allUserIds.add(row.user_id);
      }
      
      const userIdArray = Array.from(allUserIds);
      console.log(`[POST /api/admin/recalculate-all-stats] Found ${userIdArray.length} unique users to recalculate`);
      
      const results: { userId: string; regionStats?: any; userStats?: any; error?: string }[] = [];
      
      for (const userId of userIdArray) {
        try {
          console.log(`[POST /api/admin/recalculate-all-stats] Recalculating for user: ${userId}`);
          
          // Recalculate Region mode stats
          let regionStats = null;
          try {
            regionStats = await storage.recalculateUserStatsRegion(userId);
          } catch (e) {
            console.log(`[POST /api/admin/recalculate-all-stats] No region stats for user ${userId}`);
          }
          
          // Recalculate User mode stats
          let userStats = null;
          try {
            userStats = await storage.recalculateUserStatsUser(userId);
          } catch (e) {
            console.log(`[POST /api/admin/recalculate-all-stats] No user stats for user ${userId}`);
          }
          
          results.push({ userId, regionStats, userStats });
        } catch (error: any) {
          console.error(`[POST /api/admin/recalculate-all-stats] Error for user ${userId}:`, error.message);
          results.push({ userId, error: error.message });
        }
      }
      
      console.log(`[POST /api/admin/recalculate-all-stats] Completed. Processed ${results.length} users.`);
      res.json({
        success: true,
        totalUsers: userIdArray.length,
        results,
      });
    } catch (error: any) {
      console.error("[POST /api/admin/recalculate-all-stats] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
