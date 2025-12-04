import {
  userProfiles,
  userSettings,
  regions,
  categories,
  populatedPlaces,
  questionsMasterRegion,
  questionsAllocatedRegion,
  gameAttemptsRegion,
  guessesRegion,
  userStatsRegion,
  questionsMasterUser,
  questionsAllocatedUser,
  gameAttemptsUser,
  guessesUser,
  userStatsUser,
  adminSettings,
  userTier,
  userHolidayEvents,
  badges,
  userBadges,
  type UserProfile,
  type InsertUserProfile,
  type Puzzle,
  type UserSettings,
  type InsertUserSettings,
  type Region,
  type Category,
  type PopulatedPlace,
  type QuestionMasterRegion,
  type InsertQuestionMasterRegion,
  type QuestionAllocatedRegion,
  type InsertQuestionAllocatedRegion,
  type GameAttemptRegion,
  type InsertGameAttemptRegion,
  type GuessRegion,
  type InsertGuessRegion,
  type UserStatsRegion,
  type InsertUserStatsRegion,
  type QuestionMasterUser,
  type InsertQuestionMasterUser,
  type QuestionAllocatedUser,
  type InsertQuestionAllocatedUser,
  type GameAttemptUser,
  type InsertGameAttemptUser,
  type GuessUser,
  type InsertGuessUser,
  type UserStatsUser,
  type InsertUserStatsUser,
  type AdminSetting,
  type InsertAdminSetting,
  type DemandSchedulerConfig,
  type InsertDemandSchedulerConfig,
  type UserTier,
  type UserActiveTier,
  type SubscriptionResponse,
  type UserHolidayEvent,
  type InsertUserHolidayEvent,
  type Badge,
  type UserBadge,
  type UserBadgeWithDetails,
  type InsertUserBadge,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, desc, isNull, sql, notInArray } from "drizzle-orm";

// Type for allocated question with master question data (Region mode)
export type AllocatedQuestionWithMaster = QuestionAllocatedRegion & {
  masterQuestion: QuestionMasterRegion;
};

// Type for game attempt with allocated question data (Region mode)
export type GameAttemptWithAllocatedQuestion = GameAttemptRegion & {
  allocatedQuestion: AllocatedQuestionWithMaster;
};

// Type for allocated question with master question data (User mode)
export type AllocatedUserQuestionWithMaster = QuestionAllocatedUser & {
  categoryName: string; // Category name from categories table join
  placeName: string | null; // Place name for Local History (category 999)
  masterQuestion: QuestionMasterUser;
};

// Type for game attempt with allocated question data (User mode)
export type GameAttemptUserWithAllocatedQuestion = GameAttemptUser & {
  allocatedQuestion: AllocatedUserQuestionWithMaster;
};

// Interface for storage operations
export interface IStorage {
  // Region operations
  getRegions(): Promise<Region[]>;
  
  // Category operations
  getCategoryById(id: number): Promise<Category | undefined>;

  // User profile operations
  getUserProfile(id: string): Promise<UserProfile | undefined>;
  upsertUserProfile(profile: InsertUserProfile): Promise<UserProfile>;

  // User tier operations (new subscription system)
  // LEGACY - kept for backward compatibility, use getSubscriptionData instead
  getUserActiveTier(userId: string): Promise<UserActiveTier | undefined>;
  
  // New subscription system - reads from user_profiles + user_tier
  getSubscriptionData(userId: string): Promise<SubscriptionResponse | null>;
  getAvailableTiers(region: string): Promise<UserTier[]>;
  getPurchasableTiers(region: string): Promise<UserTier[]>; // Excludes Standard
  getStandardTierId(region: string): Promise<string | null>;
  createUserSubscription(subscription: { userId: string; userTierId: string; amountPaid?: number; currency?: string; expiresAt?: Date; autoRenew?: boolean; source?: string }): Promise<void>;
  createDefaultSubscription(userId: string, region: string): Promise<void>; // For signup
  downgradeToStandard(userId: string, region: string): Promise<void>;
  updateAutoRenew(userId: string, autoRenew: boolean): Promise<void>;

  // Puzzle operations (LEGACY - will be deprecated)
  getPuzzle(id: number): Promise<Puzzle | undefined>;
  getPuzzleByDate(date: string): Promise<Puzzle | undefined>;
  getAllPuzzles(): Promise<Puzzle[]>;
  getPuzzlesSince(date: string): Promise<Puzzle[]>;
  createPuzzle(puzzle: InsertPuzzle): Promise<Puzzle>;

  // User settings operations
  getUserSettings(userId: string): Promise<UserSettings | undefined>;
  upsertUserSettings(settings: InsertUserSettings): Promise<UserSettings>;

  // Game attempt operations (LEGACY - will be deprecated)
  getGameAttempt(id: number): Promise<GameAttempt | undefined>;
  getGameAttemptsByUser(userId: string): Promise<GameAttempt[]>;
  getGameAttemptByUserAndPuzzle(userId: string | null, puzzleId: number): Promise<GameAttempt | undefined>;
  getOpenAttemptByUserAndPuzzle(userId: string, puzzleId: number): Promise<GameAttempt | undefined>;
  createGameAttempt(attempt: InsertGameAttempt): Promise<GameAttempt>;
  upsertGameAttempt(attempt: InsertGameAttempt): Promise<GameAttempt>;
  updateGameAttempt(id: number, updateData: Partial<Omit<GameAttempt, 'id' | 'userId' | 'puzzleId' | 'startedAt'>>): Promise<GameAttempt>;
  incrementAttemptGuesses(gameAttemptId: number): Promise<void>;

  // Guess operations (LEGACY - will be deprecated)
  getGuessesByGameAttempt(gameAttemptId: number): Promise<Guess[]>;
  createGuess(guess: InsertGuess): Promise<Guess>;
  getRecentGuessesWithPuzzleIds(userId: string, since: string): Promise<Array<Guess & { puzzleId: number }>>;
  getAllGuessesWithPuzzleIds(userId: string): Promise<Array<Guess & { puzzleId: number; result: string | null }>>;

  // User stats operations (LEGACY - will be deprecated)
  getUserStats(userId: string): Promise<UserStats | undefined>;
  upsertUserStats(stats: InsertUserStats): Promise<UserStats>;
  recalculateUserStats(userId: string): Promise<UserStats>;
  getUserPercentileRanking(userId: string): Promise<number>;

  // Admin export operations
  getAllGameAttemptsForExport(): Promise<any[]>;

  // Admin settings operations
  getAdminSettings(): Promise<AdminSetting[]>;
  getAdminSetting(key: string): Promise<AdminSetting | undefined>;
  upsertAdminSetting(setting: InsertAdminSetting): Promise<AdminSetting>;

  // Demand scheduler config operations
  getDemandSchedulerConfig(): Promise<DemandSchedulerConfig | undefined>;
  upsertDemandSchedulerConfig(config: InsertDemandSchedulerConfig & { updated_by?: string }): Promise<DemandSchedulerConfig>;

  // ========================================================================
  // REGION GAME MODE OPERATIONS
  // ========================================================================

  // Question master operations (region)
  getQuestionMasterRegion(id: number): Promise<QuestionMasterRegion | undefined>;
  createQuestionMasterRegion(question: InsertQuestionMasterRegion): Promise<QuestionMasterRegion>;

  // Question allocated operations (region)
  getAllocatedQuestionByRegionAndDate(region: string, date: string): Promise<AllocatedQuestionWithMaster | undefined>;
  getAllocatedQuestionsByRegion(region: string): Promise<AllocatedQuestionWithMaster[]>;
  getAllocatedQuestionsSinceByRegion(region: string, since: string): Promise<AllocatedQuestionWithMaster[]>;
  createQuestionAllocatedRegion(allocation: InsertQuestionAllocatedRegion): Promise<QuestionAllocatedRegion>;

  // Game attempt operations (region)
  getGameAttemptRegion(id: number): Promise<GameAttemptRegion | undefined>;
  getGameAttemptRegionWithQuestion(id: number): Promise<GameAttemptWithAllocatedQuestion | undefined>;
  getGameAttemptsByUserRegion(userId: string): Promise<GameAttemptWithAllocatedQuestion[]>;
  getGameAttemptByUserAndAllocated(userId: string | null, allocatedRegionId: number): Promise<GameAttemptRegion | undefined>;
  createGameAttemptRegion(attempt: InsertGameAttemptRegion): Promise<GameAttemptRegion>;
  updateGameAttemptRegion(id: number, updateData: Partial<Omit<GameAttemptRegion, 'id' | 'userId' | 'allocatedRegionId' | 'startedAt'>>): Promise<GameAttemptRegion>;
  incrementAttemptGuessesRegion(gameAttemptId: number): Promise<void>;

  // Guess operations (region)
  getGuessesByGameAttemptRegion(gameAttemptId: number): Promise<GuessRegion[]>;
  createGuessRegion(guess: InsertGuessRegion): Promise<GuessRegion>;
  getRecentGuessesWithAllocatedIdsRegion(userId: string, since: string): Promise<Array<GuessRegion & { allocatedRegionId: number }>>;
  getAllGuessesWithAllocatedIdsRegion(userId: string): Promise<Array<GuessRegion & { allocatedRegionId: number; result: string | null }>>;

  // User stats operations (region)
  getUserStatsRegion(userId: string): Promise<UserStatsRegion | undefined>;
  upsertUserStatsRegion(stats: InsertUserStatsRegion): Promise<UserStatsRegion>;
  recalculateUserStatsRegion(userId: string): Promise<UserStatsRegion>;
  getUserPercentileRankingRegion(userId: string): Promise<number>;

  // ========================================================================
  // USER GAME MODE OPERATIONS
  // ========================================================================

  // Question master operations (user)
  getQuestionMasterUser(id: number): Promise<QuestionMasterUser | undefined>;
  createQuestionMasterUser(question: InsertQuestionMasterUser): Promise<QuestionMasterUser>;

  // Question allocated operations (user)
  getAllocatedQuestionByUserAndDate(userId: string, date: string): Promise<AllocatedUserQuestionWithMaster | undefined>;
  getAllocatedQuestionsByUser(userId: string): Promise<AllocatedUserQuestionWithMaster[]>;
  getAllocatedQuestionsSinceByUser(userId: string, since: string): Promise<AllocatedUserQuestionWithMaster[]>;
  createQuestionAllocatedUser(allocation: InsertQuestionAllocatedUser): Promise<QuestionAllocatedUser>;
  ensureUserAllocations(userId: string, minCount?: number): Promise<void>;

  // Game attempt operations (user)
  getGameAttemptUser(id: number): Promise<GameAttemptUser | undefined>;
  getGameAttemptUserWithQuestion(id: number): Promise<GameAttemptUserWithAllocatedQuestion | undefined>;
  getGameAttemptsByUserUser(userId: string): Promise<GameAttemptUserWithAllocatedQuestion[]>;
  getGameAttemptByUserAndAllocatedUser(userId: string, allocatedUserId: number): Promise<GameAttemptUser | undefined>;
  createGameAttemptUser(attempt: InsertGameAttemptUser): Promise<GameAttemptUser>;
  updateGameAttemptUser(id: number, updateData: Partial<Omit<GameAttemptUser, 'id' | 'userId' | 'allocatedUserId' | 'startedAt'>>): Promise<GameAttemptUser>;
  incrementAttemptGuessesUser(gameAttemptId: number): Promise<void>;

  // Guess operations (user)
  getGuessesByGameAttemptUser(gameAttemptId: number): Promise<GuessUser[]>;
  createGuessUser(guess: InsertGuessUser): Promise<GuessUser>;
  getRecentGuessesWithAllocatedIdsUser(userId: string, since: string): Promise<Array<GuessUser & { allocatedUserId: number }>>;
  getAllGuessesWithAllocatedIdsUser(userId: string): Promise<Array<GuessUser & { allocatedUserId: number; result: string | null }>>;

  // User stats operations (user)
  getUserStatsUser(userId: string): Promise<UserStatsUser | undefined>;
  upsertUserStatsUser(stats: InsertUserStatsUser): Promise<UserStatsUser>;
  recalculateUserStatsUser(userId: string): Promise<UserStatsUser>;
  getUserPercentileRankingUser(userId: string): Promise<number>;

  // ========================================================================
  // SUBSCRIPTION & PRO CATEGORY OPERATIONS
  // ========================================================================
  
  // Subscription operations
  getUserSubscription(userId: string): Promise<any | undefined>;
  // Note: Use createUserSubscription() for new subscriptions (uses user_tier_id)
  // The legacy upsertUserSubscription that used a 'tier' column has been removed
  
  // Category operations
  getAllCategories(): Promise<Category[]>;
  
  // Pro category preferences
  getUserProCategories(userId: string): Promise<number[]>;
  saveUserProCategories(userId: string, categoryIds: number[]): Promise<void>;
  
  // First login tracking
  markFirstLoginCompleted(userId: string): Promise<void>;

  // ========================================================================
  // STREAK SAVER & HOLIDAY OPERATIONS
  // ========================================================================
  
  // Streak saver status - returns stats with flags for both game modes
  getStreakSaverStatus(userId: string): Promise<{
    region: {
      currentStreak: number;
      streakSaversUsedMonth: number;
      missedYesterdayFlag: boolean;
    };
    user: {
      currentStreak: number;
      streakSaversUsedMonth: number;
      holidayActive: boolean;
      holidayStartDate: string | null;
      holidayEndDate: string | null;
      missedYesterdayFlag: boolean;
    };
  } | null>;
  
  // Use a streak saver for a game mode
  useStreakSaver(userId: string, gameType: 'region' | 'user', allowance: number): Promise<{ success: boolean; error?: string }>;
  
  // Start a holiday (Pro users only)
  startHoliday(userId: string, holidayDurationDays: number): Promise<{ success: boolean; error?: string }>;
  
  // End a holiday early
  endHoliday(userId: string): Promise<{ success: boolean; error?: string }>;
  
  // Count holiday events used this year
  countHolidayEventsThisYear(userId: string): Promise<number>;
  
  // Insert a holiday event record
  insertHolidayEvent(userId: string, mode: 'region' | 'user', startedAt: Date, endedAt?: Date): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Region operations
  async getRegions(): Promise<Region[]> {
    return await db.select().from(regions).orderBy(regions.name);
  }

  // Category operations
  async getCategoryById(id: number): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.id, id));
    return category;
  }

  // User profile operations
  async getUserProfile(id: string): Promise<UserProfile | undefined> {
    const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.id, id));
    return profile;
  }

  async upsertUserProfile(profileData: InsertUserProfile): Promise<UserProfile> {
    // Strip out undefined values so they don’t clobber existing DB values
    const cleanData = Object.fromEntries(
      Object.entries(profileData).filter(([_, v]) => v !== undefined)
    ) as Partial<InsertUserProfile>;

    console.log('[upsertUserProfile] Input userTierId:', profileData.userTierId);
    console.log('[upsertUserProfile] Clean data keys:', Object.keys(cleanData));
    console.log('[upsertUserProfile] Clean data userTierId:', cleanData.userTierId);

    const [profile] = await db
      .insert(userProfiles)
      .values(cleanData as InsertUserProfile)
      .onConflictDoUpdate({
        target: [userProfiles.id],
        set: {
          ...cleanData,
          updatedAt: new Date(),
        },
      })
      .returning();

    console.log('[upsertUserProfile] Returned profile userTierId:', profile.userTierId);
    return profile;
  }

  // User tier operations (new subscription system)
  // LEGACY: Uses user_active_tier_view - kept for backward compatibility
  async getUserActiveTier(userId: string): Promise<UserActiveTier | undefined> {
    // Query the user_active_tier_view which resolves active subscription or falls back to standard tier
    const result = await db.execute(sql`
      SELECT 
        user_id as "userId",
        tier_id as "tierId",
        tier,
        region,
        subscription_cost as "subscriptionCost",
        currency,
        subscription_duration_months as "subscriptionDurationMonths",
        streak_savers as "streakSavers",
        holiday_savers as "holidaySavers",
        holiday_duration_days as "holidayDurationDays",
        description,
        expires_at as "expiresAt",
        auto_renew as "autoRenew",
        is_active as "isActive"
      FROM user_active_tier_view
      WHERE user_id = ${userId}
    `);
    
    const rows = Array.isArray(result) ? result : (result as any).rows || [];
    if (!rows || rows.length === 0) {
      return undefined;
    }
    
    const row = rows[0];
    return {
      userId: row.userId,
      tierId: row.tierId,
      tier: row.tier,
      region: row.region,
      subscriptionCost: row.subscriptionCost,
      currency: row.currency,
      subscriptionDurationMonths: row.subscriptionDurationMonths,
      streakSavers: row.streakSavers || 0,
      holidaySavers: row.holidaySavers || 0,
      holidayDurationDays: row.holidayDurationDays || 0,
      description: row.description,
      expiresAt: row.expiresAt?.toISOString?.() || row.expiresAt,
      autoRenew: row.autoRenew || false,
      isActive: row.isActive || false,
    };
  }

  // NEW: Get subscription data from user_profiles + user_tier (replaces getUserActiveTier)
  async getSubscriptionData(userId: string): Promise<SubscriptionResponse | null> {
    // Query user_profiles joined with user_tier to get current tier and expiry
    const result = await db.execute(sql`
      SELECT 
        up.id as "userId",
        ut.id as "tierId",
        ut.tier as "tierName",
        ut.tier_type as "tierType",
        ut.subscription_cost as "subscriptionCost",
        ut.currency,
        ut.subscription_duration_months as "subscriptionDurationMonths",
        ut.streak_savers as "streakSavers",
        ut.holiday_savers as "holidaySavers",
        ut.holiday_duration_days as "holidayDurationDays",
        ut.description,
        ut.sort_order as "sortOrder",
        up.subscription_end_date as "endDate",
        up.user_tier_id as "userTierId",
        (
          SELECT us.auto_renew 
          FROM user_subscriptions us 
          WHERE us.user_id = up.id 
          ORDER BY us.created_at DESC 
          LIMIT 1
        ) as "autoRenew"
      FROM user_profiles up
      LEFT JOIN user_tier ut ON ut.id = up.user_tier_id
      WHERE up.id = ${userId}
    `);
    
    const rows = Array.isArray(result) ? result : (result as any).rows || [];
    if (!rows || rows.length === 0) {
      return null;
    }
    
    const row = rows[0];
    const tierName = row.tierName || 'Standard';
    const rawTierType = row.tierType || 'default';
    
    // Normalize tierType to valid union type - always clamp to 'default' for unknown values
    const validTierTypes = new Set(['monthly', 'annual', 'lifetime', 'default']);
    let tierType: 'monthly' | 'annual' | 'lifetime' | 'default' = 'default';
    if (validTierTypes.has(rawTierType)) {
      tierType = rawTierType as 'monthly' | 'annual' | 'lifetime' | 'default';
    } else if (rawTierType) {
      // Log unexpected tier_type for diagnostics
      console.warn(`[getSubscriptionData] Unknown tier_type "${rawTierType}" for user ${userId}, defaulting to 'default'`);
    }
    
    // Display tier: 'pro' if tier != 'Standard', else 'free'
    const isPro = tierName.toLowerCase() !== 'standard';
    const displayTier = isPro ? 'pro' : 'free';
    
    // Calculate isActive and isExpired based on tier type and end date
    // For Standard tier: always active, never expired
    // For lifetime Pro: always active, never expired
    // For monthly/annual Pro: check end date
    let isActive = false;
    let isExpired = false;
    
    if (!isPro) {
      // Standard tier is always active
      isActive = true;
      isExpired = false;
    } else if (tierType === 'lifetime') {
      // Lifetime Pro is always active
      isActive = true;
      isExpired = false;
    } else if (row.endDate) {
      // Monthly/annual Pro: check end date
      const endDate = new Date(row.endDate);
      const now = new Date();
      isActive = endDate > now;
      isExpired = endDate < now;
    } else {
      // Pro without end date (shouldn't happen for monthly/annual, but handle gracefully)
      isActive = false;
      isExpired = false;
    }
    
    return {
      tier: displayTier as 'free' | 'pro',
      tierName: tierName,
      tierType: tierType as 'monthly' | 'annual' | 'lifetime' | 'default',
      tierId: row.tierId || null,
      userId: row.userId || null,
      endDate: row.endDate ? new Date(row.endDate).toISOString() : null,
      autoRenew: row.autoRenew ?? false,
      isActive,
      isExpired,
      metadata: row.tierId ? {
        streakSavers: row.streakSavers ?? 1,
        holidaySavers: row.holidaySavers ?? 0,
        holidayDurationDays: row.holidayDurationDays ?? 14,
        subscriptionCost: row.subscriptionCost ? parseFloat(row.subscriptionCost) : null,
        currency: row.currency || 'GBP',
        subscriptionDurationMonths: row.subscriptionDurationMonths,
        description: row.description,
        sortOrder: row.sortOrder,
      } : null,
    };
  }

  async getAvailableTiers(region: string): Promise<UserTier[]> {
    // Query available tiers for the given region, ordered by sort_order
    const tiers = await db
      .select()
      .from(userTier)
      .where(and(eq(userTier.region, region), eq(userTier.active, true)))
      .orderBy(userTier.sortOrder);
    
    return tiers;
  }

  // Get purchasable tiers (excludes Standard tier)
  async getPurchasableTiers(region: string): Promise<UserTier[]> {
    const result = await db.execute(sql`
      SELECT 
        id,
        region,
        tier,
        tier_type as "tierType",
        subscription_cost as "subscriptionCost",
        currency,
        subscription_duration_months as "subscriptionDurationMonths",
        streak_savers as "streakSavers",
        holiday_savers as "holidaySavers",
        holiday_duration_days as "holidayDurationDays",
        created_at as "createdAt",
        updated_at as "updatedAt",
        active,
        description,
        sort_order as "sortOrder"
      FROM user_tier
      WHERE region = ${region}
        AND active = true
        AND tier != 'Standard'
      ORDER BY sort_order ASC
    `);
    
    const rows = Array.isArray(result) ? result : (result as any).rows || [];
    return rows as UserTier[];
  }

  // Get the Standard tier ID for a region
  async getStandardTierId(region: string): Promise<string | null> {
    // Use ILIKE for case-insensitive matching (database stores 'standard' lowercase)
    const result = await db.execute(sql`
      SELECT id 
      FROM user_tier 
      WHERE LOWER(tier) = 'standard' 
        AND region = ${region}
        AND active = true 
      LIMIT 1
    `);
    
    const rows = Array.isArray(result) ? result : (result as any).rows || [];
    if (!rows || rows.length === 0) {
      console.log(`[getStandardTierId] No Standard tier found for region: ${region}`);
      return null;
    }
    console.log(`[getStandardTierId] Found Standard tier ID: ${rows[0].id} for region: ${region}`);
    return rows[0].id;
  }

  // Create default Standard subscription on signup
  async createDefaultSubscription(userId: string, region: string): Promise<void> {
    const standardTierId = await this.getStandardTierId(region);
    if (!standardTierId) {
      console.error(`[createDefaultSubscription] No Standard tier found for region: ${region}`);
      return;
    }
    
    await db.execute(sql`
      INSERT INTO user_subscriptions (
        user_id,
        amount_paid,
        currency,
        expires_at,
        source,
        user_tier_id,
        auto_renew,
        effective_start_at
      )
      VALUES (
        ${userId},
        0.00,
        'GBP',
        NULL,
        'signup',
        ${standardTierId},
        false,
        NOW()
      )
    `);
    
    console.log(`[createDefaultSubscription] Created default subscription for user ${userId} with tier ${standardTierId}`);
  }

  // Downgrade user to Standard tier
  async downgradeToStandard(userId: string, region: string): Promise<void> {
    const standardTierId = await this.getStandardTierId(region);
    if (!standardTierId) {
      throw new Error(`No Standard tier found for region: ${region}`);
    }
    
    // Update user_profiles to point to Standard tier with null end date
    await db.execute(sql`
      UPDATE user_profiles
      SET 
        user_tier_id = ${standardTierId},
        subscription_end_date = NULL,
        updated_at = NOW()
      WHERE id = ${userId}
    `);
    
    // Insert audit record into user_subscriptions
    await db.execute(sql`
      INSERT INTO user_subscriptions (
        user_id,
        amount_paid,
        currency,
        expires_at,
        source,
        user_tier_id,
        auto_renew,
        effective_start_at
      )
      VALUES (
        ${userId},
        0.00,
        'GBP',
        NULL,
        'downgrade',
        ${standardTierId},
        false,
        NOW()
      )
    `);
    
    console.log(`[downgradeToStandard] Downgraded user ${userId} to Standard tier`);
  }

  // Update auto-renew setting on most recent subscription
  async updateAutoRenew(userId: string, autoRenew: boolean): Promise<void> {
    // Update the most recent subscription record for this user
    await db.execute(sql`
      UPDATE user_subscriptions
      SET auto_renew = ${autoRenew}
      WHERE id = (
        SELECT id FROM user_subscriptions
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT 1
      )
    `);
    
    console.log(`[updateAutoRenew] Updated auto_renew to ${autoRenew} for user ${userId}`);
  }

  async createUserSubscription(subscription: { 
    userId: string; 
    userTierId: string; 
    amountPaid?: number; 
    currency?: string; 
    expiresAt?: Date; 
    autoRenew?: boolean; 
    source?: string;
  }): Promise<void> {
    // Insert new subscription - let database auto-generate the ID
    // Note: Don't include 'validity' column - database uses tstzrange type as GENERATED ALWAYS
    // Convert Date to ISO string for SQL compatibility
    const expiresAtStr = subscription.expiresAt ? subscription.expiresAt.toISOString() : null;
    // Format amount_paid as decimal string for numeric(10,2) column
    const amountPaidStr = subscription.amountPaid !== undefined ? subscription.amountPaid.toFixed(2) : null;
    
    await db.execute(sql`
      INSERT INTO user_subscriptions (
        user_id, user_tier_id, amount_paid, currency, expires_at, auto_renew, source, effective_start_at
      )
      VALUES (
        ${subscription.userId},
        ${subscription.userTierId},
        ${amountPaidStr},
        ${subscription.currency || 'GBP'},
        ${expiresAtStr},
        ${subscription.autoRenew !== false},
        ${subscription.source || 'web'},
        NOW()
      )
    `);
    
    // Also update user_profiles directly to ensure sync (backup for Supabase trigger)
    // This matches the approach used in downgradeToStandard for consistency
    await db.execute(sql`
      UPDATE user_profiles
      SET 
        user_tier_id = ${subscription.userTierId},
        subscription_end_date = ${expiresAtStr},
        updated_at = NOW()
      WHERE id = ${subscription.userId}
    `);
    
    console.log(`[createUserSubscription] Created subscription for user ${subscription.userId} with tier ${subscription.userTierId}, expires: ${expiresAtStr}`);
  }

  // Puzzle operations
  async getPuzzle(id: number): Promise<Puzzle | undefined> {
    const [puzzle] = await db.select().from(puzzles).where(eq(puzzles.id, id));
    return puzzle;
  }

  async getPuzzleByDate(date: string): Promise<Puzzle | undefined> {
    const [puzzle] = await db.select().from(puzzles).where(eq(puzzles.date, date));
    return puzzle;
  }

  async getAllPuzzles(): Promise<Puzzle[]> {
    return await db.select().from(puzzles).orderBy(puzzles.date);
  }

  async getPuzzlesSince(date: string): Promise<Puzzle[]> {
    return await db
      .select()
      .from(puzzles)
      .where(gte(puzzles.date, date))
      .orderBy(puzzles.date);
  }

  async createPuzzle(puzzleData: InsertPuzzle): Promise<Puzzle> {
    const [puzzle] = await db.insert(puzzles).values(puzzleData).returning();
    return puzzle;
  }

  // User settings operations
  async getUserSettings(userId: string): Promise<UserSettings | undefined> {
    const [settings] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId));
    return settings;
  }

  async upsertUserSettings(settingsData: InsertUserSettings): Promise<UserSettings> {
    // Check if settings exist for this user
    const existing = await this.getUserSettings(settingsData.userId);
    
    if (existing) {
      // Update existing settings
      const [settings] = await db
        .update(userSettings)
        .set({
          ...settingsData,
          updatedAt: new Date(),
        })
        .where(eq(userSettings.userId, settingsData.userId))
        .returning();
      return settings;
    } else {
      // Insert new settings
      const [settings] = await db
        .insert(userSettings)
        .values(settingsData)
        .returning();
      return settings;
    }
  }

  // Game attempt operations
  async getGameAttempt(id: number): Promise<GameAttempt | undefined> {
    const [attempt] = await db.select().from(gameAttempts).where(eq(gameAttempts.id, id));
    return attempt;
  }

  async getGameAttemptsByUser(userId: string): Promise<GameAttempt[]> {
    return await db
      .select()
      .from(gameAttempts)
      .where(eq(gameAttempts.userId, userId))
      .orderBy(desc(gameAttempts.completedAt));
  }

  async getGameAttemptByUserAndPuzzle(
    userId: string | null,
    puzzleId: number
  ): Promise<GameAttempt | undefined> {
    if (userId) {
      const [attempt] = await db
        .select()
        .from(gameAttempts)
        .where(
          and(
            eq(gameAttempts.userId, userId),
            eq(gameAttempts.puzzleId, puzzleId)
          )
        );
      return attempt;
    } else {
      const [attempt] = await db
        .select()
        .from(gameAttempts)
        .where(eq(gameAttempts.puzzleId, puzzleId));
      return attempt;
    }
  }

  async createGameAttempt(attemptData: InsertGameAttempt): Promise<GameAttempt> {
    const [attempt] = await db.insert(gameAttempts).values(attemptData).returning();
    return attempt;
  }

  async upsertGameAttempt(attemptData: InsertGameAttempt): Promise<GameAttempt> {
    const [attempt] = await db
      .insert(gameAttempts)
      .values(attemptData)
      .onConflictDoUpdate({
        target: [gameAttempts.userId, gameAttempts.puzzleId], // unique constraint
        set: {
          result: attemptData.result,
          numGuesses: attemptData.numGuesses,
        },
      })
      .returning();

    return attempt;
  }

  async getOpenAttemptByUserAndPuzzle(userId: string, puzzleId: number): Promise<GameAttempt | undefined> {
    const [attempt] = await db
      .select()
      .from(gameAttempts)
      .where(
        and(
          eq(gameAttempts.userId, userId),
          eq(gameAttempts.puzzleId, puzzleId),
          isNull(gameAttempts.result) // still in progress
        )
      );
    return attempt;
  }

  async incrementAttemptGuesses(gameAttemptId: number): Promise<void> {
    // Fetch current value
    const [current] = await db
      .select({ numGuesses: gameAttempts.numGuesses })
      .from(gameAttempts)
      .where(eq(gameAttempts.id, gameAttemptId));

    const next = (current?.numGuesses ?? 0) + 1;

    await db
      .update(gameAttempts)
      .set({ numGuesses: next })
      .where(eq(gameAttempts.id, gameAttemptId));
  }

  async updateGameAttempt(
    id: number,
    updateData: Partial<Omit<GameAttempt, 'id' | 'userId' | 'puzzleId' | 'startedAt'>>
  ): Promise<GameAttempt> {
    // Fetch current attempt to enforce numGuesses monotonicity
    const [current] = await db.select().from(gameAttempts).where(eq(gameAttempts.id, id));

    let safeUpdate = { ...updateData } as any;

    // Ensure numGuesses never decreases
    if (typeof safeUpdate.numGuesses === "number" && current) {
      safeUpdate.numGuesses = Math.max(safeUpdate.numGuesses, current.numGuesses ?? 0);
    }

    // If result is being set, mark completedAt
    if (safeUpdate.result && !current?.completedAt) {
      safeUpdate.completedAt = new Date();
    }

    const [attempt] = await db
      .update(gameAttempts)
      .set(safeUpdate)
      .where(eq(gameAttempts.id, id))
      .returning();

    return attempt;
  }


  // Guess operations
  async getGuessesByGameAttempt(gameAttemptId: number): Promise<Guess[]> {
    return await db
      .select()
      .from(guesses)
      .where(eq(guesses.gameAttemptId, gameAttemptId))
      .orderBy(guesses.guessedAt);
  }

  async createGuess(guessData: InsertGuess): Promise<Guess> {
    const [guess] = await db.insert(guesses).values(guessData).returning();
    return guess;
  }

  async getRecentGuessesWithPuzzleIds(userId: string, since: string): Promise<Array<Guess & { puzzleId: number }>> {
    // Join guesses with game_attempts to get puzzle IDs
    // Only return guesses for completed game attempts from the last N days
    const results = await db
      .select({
        id: guesses.id,
        gameAttemptId: guesses.gameAttemptId,
        guessValue: guesses.guessValue,
        guessedAt: guesses.guessedAt,
        puzzleId: gameAttempts.puzzleId,
      })
      .from(guesses)
      .innerJoin(gameAttempts, eq(guesses.gameAttemptId, gameAttempts.id))
      .innerJoin(puzzles, eq(gameAttempts.puzzleId, puzzles.id))
      .where(
        and(
          eq(gameAttempts.userId, userId),
          gte(puzzles.date, since)
        )
      )
      .orderBy(guesses.guessedAt);

    return results;
  }
  
  async getAllGuessesWithPuzzleIds(userId: string): Promise<Array<Guess & { puzzleId: number; result: string | null; categoryName?: string | null }>> {
    const results = await db
      .select({
        id: guesses.id,
        gameAttemptId: guesses.gameAttemptId,
        guessValue: guesses.guessValue,
        guessedAt: guesses.guessedAt,
        puzzleId: gameAttempts.puzzleId,
        result: gameAttempts.result,
        categoryName: categories.name,   // <-- join category name
      })
      .from(guesses)
      .innerJoin(gameAttempts, eq(guesses.gameAttemptId, gameAttempts.id))
      .leftJoin(categories, eq(gameAttempts.categoryId, categories.id)) // safe for NULL
      .where(eq(gameAttempts.userId, userId))
      .orderBy(guesses.guessedAt);

    return results;
  }

  // User stats operations
  async getUserStats(userId: string): Promise<UserStats | undefined> {
    const [stats] = await db.select().from(userStats).where(eq(userStats.userId, userId));
    return stats;
  }

  async upsertUserStats(statsData: InsertUserStats): Promise<UserStats> {
    const [stats] = await db
      .insert(userStats)
      .values(statsData)
      .onConflictDoUpdate({
        target: [userStats.userId],
        set: {
          ...statsData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return stats;
  }

  async recalculateUserStats(userId: string): Promise<UserStats> {
    // Get all completed game attempts for this user (result !== null means completed)
    const completedAttempts = await db
      .select({
        id: gameAttempts.id,
        result: gameAttempts.result,
        numGuesses: gameAttempts.numGuesses,
        completedAt: gameAttempts.completedAt,
        puzzleId: gameAttempts.puzzleId,
        puzzleDate: puzzles.date,
      })
      .from(gameAttempts)
      .innerJoin(puzzles, eq(gameAttempts.puzzleId, puzzles.id))
      .where(
        and(
          eq(gameAttempts.userId, userId),
          eq(gameAttempts.result, 'won') // Only count completed won games
        )
      )
      .orderBy(puzzles.date);

    // Also get lost games
    const lostAttempts = await db
      .select({
        id: gameAttempts.id,
        result: gameAttempts.result,
        puzzleDate: puzzles.date,
        completedAt: gameAttempts.completedAt,
      })
      .from(gameAttempts)
      .innerJoin(puzzles, eq(gameAttempts.puzzleId, puzzles.id))
      .where(
        and(
          eq(gameAttempts.userId, userId),
          eq(gameAttempts.result, 'lost')
        )
      );

    const gamesPlayed = completedAttempts.length + lostAttempts.length;
    const gamesWon = completedAttempts.length;

    // Calculate guess distribution (only for won games)
    const guessDistribution: any = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
    for (const attempt of completedAttempts) {
      const numGuesses = attempt.numGuesses || 0;
      if (numGuesses >= 1 && numGuesses <= 5) {
        guessDistribution[numGuesses.toString()] = (guessDistribution[numGuesses.toString()] || 0) + 1;
      }
    }

    // Calculate current streak - check consecutive days ending at or before today
    // IMPORTANT: Only count puzzles played on their actual date (not archive puzzles played later)
    const allCompletedAttempts = [...completedAttempts, ...lostAttempts].sort((a, b) => 
      new Date(b.puzzleDate).getTime() - new Date(a.puzzleDate).getTime()
    );

    let currentStreak = 0;
    let maxStreak = 0;
    let tempStreak = 0;
    
    // Build map of dates to results, filtering for puzzles played on their actual day
    const dateMap = new Map<string, string>();
    for (const attempt of allCompletedAttempts) {
      // Only count if puzzle was completed on the same day as its puzzle date
      const completedDate = new Date(attempt.completedAt || '');
      const puzzleDate = new Date(attempt.puzzleDate);
      
      // Normalize both dates to midnight for comparison
      completedDate.setHours(0, 0, 0, 0);
      puzzleDate.setHours(0, 0, 0, 0);
      
      // Only add to map if completed on the correct day (archive puzzles don't count)
      if (completedDate.getTime() === puzzleDate.getTime()) {
        dateMap.set(attempt.puzzleDate, attempt.result || '');
      }
    }

    // Calculate current streak from today backwards
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let checkDate = new Date(today);
    
    // Check if user played yesterday's puzzle - if not, streak is broken
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    // If today's puzzle isn't played yet, start checking from yesterday
    const todayStr = today.toISOString().split('T')[0];
    if (!dateMap.has(todayStr)) {
      checkDate = new Date(yesterday);
    }
    
    while (true) {
      const dateStr = checkDate.toISOString().split('T')[0];
      const result = dateMap.get(dateStr);
      
      if (!result) break; // No game played this day - streak broken
      if (result === 'won') {
        currentStreak++;
      } else {
        break; // Streak broken by a loss
      }
      
      // Move back one day
      checkDate.setDate(checkDate.getDate() - 1);
    }

    // Calculate max streak by going through all dates
    const sortedDates = Array.from(dateMap.keys()).sort();
    for (let i = 0; i < sortedDates.length; i++) {
      const result = dateMap.get(sortedDates[i]);
      if (result === 'won') {
        tempStreak++;
        maxStreak = Math.max(maxStreak, tempStreak);
      } else {
        tempStreak = 0;
      }
    }

    // Upsert the calculated stats
    return await this.upsertUserStats({
      userId,
      gamesPlayed,
      gamesWon,
      currentStreak,
      maxStreak,
      guessDistribution,
    });
  }

  async getUserPercentileRanking(userId: string): Promise<number> {
    // Get all users with their stats, ordered by games won (descending)
    const allUserStats = await db
      .select({
        userId: userStats.userId,
        gamesWon: userStats.gamesWon,
      })
      .from(userStats)
      .orderBy(desc(userStats.gamesWon));

    if (allUserStats.length === 0) {
      return 100; // If no stats, user is in top 100%
    }

    // Find user's position (1-based)
    const userPosition = allUserStats.findIndex(stat => stat.userId === userId);
    
    if (userPosition === -1) {
      // User not found in rankings
      return 100;
    }

    // Calculate percentile: (position / total) * 100
    // Position is 0-based, so add 1 for 1-based ranking
    const percentile = ((userPosition + 1) / allUserStats.length) * 100;
    
    // Round to 1 decimal place
    return Math.round(percentile * 10) / 10;
  }

  // Admin export operations
  async getAllGameAttemptsForExport(): Promise<any[]> {
    return await db
      .select({
        userId: gameAttempts.userId,
        puzzleId: gameAttempts.puzzleId,
        result: gameAttempts.result,
        numGuesses: gameAttempts.numGuesses,
        completedAt: gameAttempts.completedAt,
      })
      .from(gameAttempts)
      .orderBy(desc(gameAttempts.completedAt));
  }

  // Admin settings operations
  async getAdminSettings(): Promise<AdminSetting[]> {
    return await db
      .select()
      .from(adminSettings)
      .orderBy(adminSettings.key);
  }

  async getAdminSetting(key: string): Promise<AdminSetting | undefined> {
    const [setting] = await db
      .select()
      .from(adminSettings)
      .where(eq(adminSettings.key, key));
    return setting;
  }

  async upsertAdminSetting(setting: InsertAdminSetting): Promise<AdminSetting> {
    const existing = await this.getAdminSetting(setting.key);
    
    if (existing) {
      const [updated] = await db
        .update(adminSettings)
        .set({
          value: setting.value,
          description: setting.description,
          updatedAt: new Date(),
          updatedBy: setting.updatedBy,
        })
        .where(eq(adminSettings.key, setting.key))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(adminSettings)
        .values({
          key: setting.key,
          value: setting.value,
          description: setting.description,
          updatedBy: setting.updatedBy,
        })
        .returning();
      return created;
    }
  }

  // Demand scheduler config operations (uses raw SQL as table is in Supabase)
  // Uses singleton pattern - only ONE row should exist with fixed ID
  async getDemandSchedulerConfig(): Promise<DemandSchedulerConfig | undefined> {
    const result = await db.execute(sql`
      SELECT id, start_time, frequency_hours, updated_at, updated_by
      FROM demand_scheduler_config
      ORDER BY updated_at DESC
      LIMIT 1
    `);
    
    // Handle different result formats from drizzle execute
    const rows = Array.isArray(result) ? result : (result as any).rows || [];
    
    if (!rows || rows.length === 0) {
      return undefined;
    }
    
    const row = rows[0];
    return {
      id: row.id,
      start_time: row.start_time,
      frequency_hours: row.frequency_hours,
      updated_at: row.updated_at?.toISOString?.() || row.updated_at,
      updated_by: row.updated_by,
    };
  }

  async upsertDemandSchedulerConfig(config: InsertDemandSchedulerConfig & { updated_by?: string }): Promise<DemandSchedulerConfig> {
    // Use a singleton pattern with a fixed ID to ensure only ONE row ever exists
    const SINGLETON_ID = '00000000-0000-0000-0000-000000000001';
    
    // Use INSERT ... ON CONFLICT to ensure atomic upsert with single row
    await db.execute(sql`
      INSERT INTO demand_scheduler_config (id, start_time, frequency_hours, updated_at, updated_by)
      VALUES (${SINGLETON_ID}, ${config.start_time}, ${config.frequency_hours}, NOW(), ${config.updated_by || null})
      ON CONFLICT (id) DO UPDATE SET
        start_time = EXCLUDED.start_time,
        frequency_hours = EXCLUDED.frequency_hours,
        updated_at = NOW(),
        updated_by = EXCLUDED.updated_by
    `);
    
    // Fetch and return the updated config
    const result = await this.getDemandSchedulerConfig();
    if (!result) {
      throw new Error('Failed to upsert demand scheduler config');
    }
    return result;
  }

  // ========================================================================
  // REGION GAME MODE OPERATIONS
  // ========================================================================

  // Question master operations (region)
  async getQuestionMasterRegion(id: number): Promise<QuestionMasterRegion | undefined> {
    const [question] = await db
      .select()
      .from(questionsMasterRegion)
      .where(eq(questionsMasterRegion.id, id));
    return question;
  }

  async createQuestionMasterRegion(questionData: InsertQuestionMasterRegion): Promise<QuestionMasterRegion> {
    const [question] = await db
      .insert(questionsMasterRegion)
      .values(questionData)
      .returning();
    return question;
  }

  // Question allocated operations (region)
  async getAllocatedQuestionByRegionAndDate(
    region: string,
    date: string
  ): Promise<AllocatedQuestionWithMaster | undefined> {
    const results = await db
      .select({
        id: questionsAllocatedRegion.id,
        questionId: questionsAllocatedRegion.questionId,
        region: questionsAllocatedRegion.region,
        puzzleDate: questionsAllocatedRegion.puzzleDate,
        masterQuestion_id: questionsMasterRegion.id,
        masterQuestion_answerDateCanonical: questionsMasterRegion.answerDateCanonical,
        masterQuestion_eventTitle: questionsMasterRegion.eventTitle,
        masterQuestion_eventDescription: questionsMasterRegion.eventDescription,
        masterQuestion_regions: questionsMasterRegion.regions,
        masterQuestion_categories: questionsMasterRegion.categories,
        masterQuestion_createdAt: questionsMasterRegion.createdAt,
      })
      .from(questionsAllocatedRegion)
      .innerJoin(
        questionsMasterRegion,
        eq(questionsAllocatedRegion.questionId, questionsMasterRegion.id)
      )
      .where(
        and(
          eq(questionsAllocatedRegion.region, region),
          eq(questionsAllocatedRegion.puzzleDate, date)
        )
      );

    if (results.length === 0) return undefined;

    const result = results[0];
    return {
      id: result.id,
      questionId: result.questionId,
      region: result.region,
      puzzleDate: result.puzzleDate,
      masterQuestion: {
        id: result.masterQuestion_id,
        answerDateCanonical: result.masterQuestion_answerDateCanonical,
        eventTitle: result.masterQuestion_eventTitle,
        eventDescription: result.masterQuestion_eventDescription,
        regions: result.masterQuestion_regions,
        categories: result.masterQuestion_categories,
        createdAt: result.masterQuestion_createdAt,
      },
    };
  }

  async getAllocatedQuestionsByRegion(region: string): Promise<AllocatedQuestionWithMaster[]> {
    const results = await db
      .select({
        id: questionsAllocatedRegion.id,
        questionId: questionsAllocatedRegion.questionId,
        region: questionsAllocatedRegion.region,
        puzzleDate: questionsAllocatedRegion.puzzleDate,
        masterQuestion_id: questionsMasterRegion.id,
        masterQuestion_answerDateCanonical: questionsMasterRegion.answerDateCanonical,
        masterQuestion_eventTitle: questionsMasterRegion.eventTitle,
        masterQuestion_eventDescription: questionsMasterRegion.eventDescription,
        masterQuestion_regions: questionsMasterRegion.regions,
        masterQuestion_categories: questionsMasterRegion.categories,
        masterQuestion_createdAt: questionsMasterRegion.createdAt,
      })
      .from(questionsAllocatedRegion)
      .innerJoin(
        questionsMasterRegion,
        eq(questionsAllocatedRegion.questionId, questionsMasterRegion.id)
      )
      .where(eq(questionsAllocatedRegion.region, region))
      .orderBy(questionsAllocatedRegion.puzzleDate);

    return results.map(result => ({
      id: result.id,
      questionId: result.questionId,
      region: result.region,
      puzzleDate: result.puzzleDate,
      masterQuestion: {
        id: result.masterQuestion_id,
        answerDateCanonical: result.masterQuestion_answerDateCanonical,
        eventTitle: result.masterQuestion_eventTitle,
        eventDescription: result.masterQuestion_eventDescription,
        regions: result.masterQuestion_regions,
        categories: result.masterQuestion_categories,
        createdAt: result.masterQuestion_createdAt,
      },
    }));
  }

  async getAllocatedQuestionsSinceByRegion(
    region: string,
    since: string
  ): Promise<AllocatedQuestionWithMaster[]> {
    const results = await db
      .select({
        id: questionsAllocatedRegion.id,
        questionId: questionsAllocatedRegion.questionId,
        region: questionsAllocatedRegion.region,
        puzzleDate: questionsAllocatedRegion.puzzleDate,
        masterQuestion_id: questionsMasterRegion.id,
        masterQuestion_answerDateCanonical: questionsMasterRegion.answerDateCanonical,
        masterQuestion_eventTitle: questionsMasterRegion.eventTitle,
        masterQuestion_eventDescription: questionsMasterRegion.eventDescription,
        masterQuestion_regions: questionsMasterRegion.regions,
        masterQuestion_categories: questionsMasterRegion.categories,
        masterQuestion_createdAt: questionsMasterRegion.createdAt,
      })
      .from(questionsAllocatedRegion)
      .innerJoin(
        questionsMasterRegion,
        eq(questionsAllocatedRegion.questionId, questionsMasterRegion.id)
      )
      .where(
        and(
          eq(questionsAllocatedRegion.region, region),
          gte(questionsAllocatedRegion.puzzleDate, since)
        )
      )
      .orderBy(questionsAllocatedRegion.puzzleDate);

    return results.map(result => ({
      id: result.id,
      questionId: result.questionId,
      region: result.region,
      puzzleDate: result.puzzleDate,
      masterQuestion: {
        id: result.masterQuestion_id,
        answerDateCanonical: result.masterQuestion_answerDateCanonical,
        eventTitle: result.masterQuestion_eventTitle,
        eventDescription: result.masterQuestion_eventDescription,
        regions: result.masterQuestion_regions,
        categories: result.masterQuestion_categories,
        createdAt: result.masterQuestion_createdAt,
      },
    }));
  }

  async createQuestionAllocatedRegion(
    allocationData: InsertQuestionAllocatedRegion
  ): Promise<QuestionAllocatedRegion> {
    const [allocation] = await db
      .insert(questionsAllocatedRegion)
      .values(allocationData)
      .returning();
    return allocation;
  }

  // Game attempt operations (region)
  async getGameAttemptRegion(id: number): Promise<GameAttemptRegion | undefined> {
    const [attempt] = await db
      .select()
      .from(gameAttemptsRegion)
      .where(eq(gameAttemptsRegion.id, id));
    return attempt;
  }

  async getGameAttemptRegionWithQuestion(
    id: number
  ): Promise<GameAttemptWithAllocatedQuestion | undefined> {
    const results = await db
      .select({
        id: gameAttemptsRegion.id,
        userId: gameAttemptsRegion.userId,
        allocatedRegionId: gameAttemptsRegion.allocatedRegionId,
        result: gameAttemptsRegion.result,
        numGuesses: gameAttemptsRegion.numGuesses,
        startedAt: gameAttemptsRegion.startedAt,
        completedAt: gameAttemptsRegion.completedAt,
        allocated_id: questionsAllocatedRegion.id,
        allocated_questionId: questionsAllocatedRegion.questionId,
        allocated_region: questionsAllocatedRegion.region,
        allocated_puzzleDate: questionsAllocatedRegion.puzzleDate,
        master_id: questionsMasterRegion.id,
        master_answerDateCanonical: questionsMasterRegion.answerDateCanonical,
        master_eventTitle: questionsMasterRegion.eventTitle,
        master_eventDescription: questionsMasterRegion.eventDescription,
        master_regions: questionsMasterRegion.regions,
        master_categories: questionsMasterRegion.categories,
        master_createdAt: questionsMasterRegion.createdAt,
      })
      .from(gameAttemptsRegion)
      .innerJoin(
        questionsAllocatedRegion,
        eq(gameAttemptsRegion.allocatedRegionId, questionsAllocatedRegion.id)
      )
      .innerJoin(
        questionsMasterRegion,
        eq(questionsAllocatedRegion.questionId, questionsMasterRegion.id)
      )
      .where(eq(gameAttemptsRegion.id, id));

    if (results.length === 0) return undefined;

    const result = results[0];
    return {
      id: result.id,
      userId: result.userId,
      allocatedRegionId: result.allocatedRegionId,
      result: result.result,
      numGuesses: result.numGuesses,
      startedAt: result.startedAt,
      completedAt: result.completedAt,
      allocatedQuestion: {
        id: result.allocated_id,
        masterQuestionId: result.allocated_questionId,
        region: result.allocated_region,
        allocatedDate: result.allocated_puzzleDate,
        createdAt: result.allocated_createdAt,
        masterQuestion: {
          id: result.master_id,
          answerDateCanonical: result.master_answerDateCanonical,
          eventTitle: result.master_eventTitle,
          eventDescription: result.master_eventDescription,
          regions: result.master_clue1,
          categories: result.master_clue2,
          createdAt: result.master_createdAt,
        },
      },
    };
  }

  async getGameAttemptsByUserRegion(userId: string): Promise<GameAttemptWithAllocatedQuestion[]> {
    const results = await db
      .select({
        id: gameAttemptsRegion.id,
        userId: gameAttemptsRegion.userId,
        allocatedRegionId: gameAttemptsRegion.allocatedRegionId,
        result: gameAttemptsRegion.result,
        numGuesses: gameAttemptsRegion.numGuesses,
        digits: gameAttemptsRegion.digits,
        startedAt: gameAttemptsRegion.startedAt,
        completedAt: gameAttemptsRegion.completedAt,
        allocated_id: questionsAllocatedRegion.id,
        allocated_questionId: questionsAllocatedRegion.questionId,
        allocated_region: questionsAllocatedRegion.region,
        allocated_puzzleDate: questionsAllocatedRegion.puzzleDate,
        master_id: questionsMasterRegion.id,
        master_answerDateCanonical: questionsMasterRegion.answerDateCanonical,
        master_eventTitle: questionsMasterRegion.eventTitle,
        master_eventDescription: questionsMasterRegion.eventDescription,
        master_regions: questionsMasterRegion.regions,
        master_categories: questionsMasterRegion.categories,
        master_createdAt: questionsMasterRegion.createdAt,
      })
      .from(gameAttemptsRegion)
      .innerJoin(
        questionsAllocatedRegion,
        eq(gameAttemptsRegion.allocatedRegionId, questionsAllocatedRegion.id)
      )
      .innerJoin(
        questionsMasterRegion,
        eq(questionsAllocatedRegion.questionId, questionsMasterRegion.id)
      )
      .where(eq(gameAttemptsRegion.userId, userId))
      .orderBy(desc(questionsAllocatedRegion.puzzleDate));

    return results.map(result => ({
      id: result.id,
      userId: result.userId,
      allocatedRegionId: result.allocatedRegionId,
      result: result.result,
      numGuesses: result.numGuesses,
      digits: result.digits,
      startedAt: result.startedAt,
      completedAt: result.completedAt,
      allocatedQuestion: {
        id: result.allocated_id,
        questionId: result.allocated_questionId,
        region: result.allocated_region,
        puzzleDate: result.allocated_puzzleDate,
        masterQuestion: {
          id: result.master_id,
          answerDateCanonical: result.master_answerDateCanonical,
          eventTitle: result.master_eventTitle,
          eventDescription: result.master_eventDescription,
          regions: result.master_regions,
          categories: result.master_categories,
          createdAt: result.master_createdAt,
        },
      },
    }));
  }

  async getGameAttemptByUserAndAllocated(
    userId: string | null,
    allocatedRegionId: number
  ): Promise<GameAttemptRegion | undefined> {
    if (userId) {
      const [attempt] = await db
        .select()
        .from(gameAttemptsRegion)
        .where(
          and(
            eq(gameAttemptsRegion.userId, userId),
            eq(gameAttemptsRegion.allocatedRegionId, allocatedRegionId)
          )
        );
      return attempt;
    } else {
      const [attempt] = await db
        .select()
        .from(gameAttemptsRegion)
        .where(eq(gameAttemptsRegion.allocatedRegionId, allocatedRegionId));
      return attempt;
    }
  }

  async createGameAttemptRegion(attemptData: InsertGameAttemptRegion): Promise<GameAttemptRegion> {
    const [attempt] = await db
      .insert(gameAttemptsRegion)
      .values(attemptData)
      .returning();
    return attempt;
  }

  async updateGameAttemptRegion(
    id: number,
    updateData: Partial<Omit<GameAttemptRegion, 'id' | 'userId' | 'allocatedRegionId' | 'startedAt'>>
  ): Promise<GameAttemptRegion> {
    const [current] = await db
      .select()
      .from(gameAttemptsRegion)
      .where(eq(gameAttemptsRegion.id, id));

    let safeUpdate = { ...updateData } as any;

    // Ensure numGuesses never decreases
    if (typeof safeUpdate.numGuesses === "number" && current) {
      safeUpdate.numGuesses = Math.max(safeUpdate.numGuesses, current.numGuesses ?? 0);
    }

    // If result is being set, mark completedAt
    if (safeUpdate.result && !current?.completedAt) {
      safeUpdate.completedAt = new Date();
    }

    const [attempt] = await db
      .update(gameAttemptsRegion)
      .set(safeUpdate)
      .where(eq(gameAttemptsRegion.id, id))
      .returning();

    return attempt;
  }

  async incrementAttemptGuessesRegion(gameAttemptId: number): Promise<void> {
    const [current] = await db
      .select({ numGuesses: gameAttemptsRegion.numGuesses })
      .from(gameAttemptsRegion)
      .where(eq(gameAttemptsRegion.id, gameAttemptId));

    const next = (current?.numGuesses ?? 0) + 1;

    await db
      .update(gameAttemptsRegion)
      .set({ numGuesses: next })
      .where(eq(gameAttemptsRegion.id, gameAttemptId));
  }

  // Guess operations (region)
  async getGuessesByGameAttemptRegion(gameAttemptId: number): Promise<GuessRegion[]> {
    return await db
      .select()
      .from(guessesRegion)
      .where(eq(guessesRegion.gameAttemptId, gameAttemptId))
      .orderBy(guessesRegion.guessedAt);
  }

  async createGuessRegion(guessData: InsertGuessRegion): Promise<GuessRegion> {
    const [guess] = await db.insert(guessesRegion).values(guessData).returning();
    return guess;
  }

  async getRecentGuessesWithAllocatedIdsRegion(
    userId: string,
    since: string
  ): Promise<Array<GuessRegion & { allocatedRegionId: number }>> {
    const results = await db
      .select({
        id: guessesRegion.id,
        gameAttemptId: guessesRegion.gameAttemptId,
        guessValue: guessesRegion.guessValue,
        guessedAt: guessesRegion.guessedAt,
        allocatedRegionId: gameAttemptsRegion.allocatedRegionId,
      })
      .from(guessesRegion)
      .innerJoin(
        gameAttemptsRegion,
        eq(guessesRegion.gameAttemptId, gameAttemptsRegion.id)
      )
      .innerJoin(
        questionsAllocatedRegion,
        eq(gameAttemptsRegion.allocatedRegionId, questionsAllocatedRegion.id)
      )
      .where(
        and(
          eq(gameAttemptsRegion.userId, userId),
          gte(questionsAllocatedRegion.puzzleDate, since)
        )
      )
      .orderBy(guessesRegion.guessedAt);

    return results;
  }

  async getAllGuessesWithAllocatedIdsRegion(
    userId: string
  ): Promise<Array<GuessRegion & { allocatedRegionId: number; result: string | null }>> {
    const results = await db
      .select({
        id: guessesRegion.id,
        gameAttemptId: guessesRegion.gameAttemptId,
        guessValue: guessesRegion.guessValue,
        guessedAt: guessesRegion.guessedAt,
        allocatedRegionId: gameAttemptsRegion.allocatedRegionId,
        result: gameAttemptsRegion.result,
      })
      .from(guessesRegion)
      .innerJoin(
        gameAttemptsRegion,
        eq(guessesRegion.gameAttemptId, gameAttemptsRegion.id)
      )
      .where(eq(gameAttemptsRegion.userId, userId))
      .orderBy(guessesRegion.guessedAt);

    return results;
  }

  // User stats operations (region)
  // Now filters by both userId AND region to support per-region stats
  async getUserStatsRegion(userId: string, region?: string): Promise<UserStatsRegion | undefined> {
    // If region is provided, filter by both userId and region
    if (region) {
      const [stats] = await db
        .select()
        .from(userStatsRegion)
        .where(and(
          eq(userStatsRegion.userId, userId),
          eq(userStatsRegion.region, region)
        ));
      return stats;
    }
    
    // Legacy: if no region provided, get user's current region from profile
    const profile = await this.getUserProfile(userId);
    const userRegion = profile?.region || "UK";
    
    const [stats] = await db
      .select()
      .from(userStatsRegion)
      .where(and(
        eq(userStatsRegion.userId, userId),
        eq(userStatsRegion.region, userRegion)
      ));
    return stats;
  }

  async upsertUserStatsRegion(statsData: InsertUserStatsRegion): Promise<UserStatsRegion> {
    // Ensure region is set - required for the composite unique constraint
    const region = statsData.region || "UK";
    const dataWithRegion = { ...statsData, region };
    
    const [stats] = await db
      .insert(userStatsRegion)
      .values(dataWithRegion)
      .onConflictDoUpdate({
        target: [userStatsRegion.userId, userStatsRegion.region],
        set: {
          ...dataWithRegion,
          updatedAt: new Date(),
        },
      })
      .returning();
    return stats;
  }

  async recalculateUserStatsRegion(userId: string, region?: string): Promise<UserStatsRegion> {
    // Get user's current region if not provided
    let targetRegion = region;
    if (!targetRegion) {
      const profile = await this.getUserProfile(userId);
      targetRegion = profile?.region || "UK";
    }
    
    // Get all completed game attempts for this user in this region
    // Filter by region_code from questions_allocated_region
    const completedAttempts = await db
      .select({
        id: gameAttemptsRegion.id,
        result: gameAttemptsRegion.result,
        numGuesses: gameAttemptsRegion.numGuesses,
        completedAt: gameAttemptsRegion.completedAt,
        puzzleDate: questionsAllocatedRegion.puzzleDate,
      })
      .from(gameAttemptsRegion)
      .innerJoin(
        questionsAllocatedRegion,
        eq(gameAttemptsRegion.allocatedRegionId, questionsAllocatedRegion.id)
      )
      .where(
        and(
          eq(gameAttemptsRegion.userId, userId),
          eq(questionsAllocatedRegion.region, targetRegion),
          eq(gameAttemptsRegion.result, 'won')
        )
      )
      .orderBy(questionsAllocatedRegion.puzzleDate);

    // Get lost games for this region
    const lostAttempts = await db
      .select({
        id: gameAttemptsRegion.id,
        result: gameAttemptsRegion.result,
        puzzleDate: questionsAllocatedRegion.puzzleDate,
        completedAt: gameAttemptsRegion.completedAt,
      })
      .from(gameAttemptsRegion)
      .innerJoin(
        questionsAllocatedRegion,
        eq(gameAttemptsRegion.allocatedRegionId, questionsAllocatedRegion.id)
      )
      .where(
        and(
          eq(gameAttemptsRegion.userId, userId),
          eq(questionsAllocatedRegion.region, targetRegion),
          eq(gameAttemptsRegion.result, 'lost')
        )
      );

    const gamesPlayed = completedAttempts.length + lostAttempts.length;
    const gamesWon = completedAttempts.length;

    // Calculate guess distribution (only for won games)
    const guessDistribution: any = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
    for (const attempt of completedAttempts) {
      const numGuesses = attempt.numGuesses || 0;
      if (numGuesses >= 1 && numGuesses <= 5) {
        guessDistribution[numGuesses.toString()] = (guessDistribution[numGuesses.toString()] || 0) + 1;
      }
    }

    // Calculate current streak
    const allCompletedAttempts = [...completedAttempts, ...lostAttempts].sort((a, b) => 
      new Date(b.puzzleDate).getTime() - new Date(a.puzzleDate).getTime()
    );

    let currentStreak = 0;
    let maxStreak = 0;
    let tempStreak = 0;
    
    const dateMap = new Map<string, string>();
    for (const attempt of allCompletedAttempts) {
      const completedDate = new Date(attempt.completedAt || '');
      const puzzleDate = new Date(attempt.puzzleDate);
      
      completedDate.setHours(0, 0, 0, 0);
      puzzleDate.setHours(0, 0, 0, 0);
      
      if (completedDate.getTime() === puzzleDate.getTime()) {
        dateMap.set(attempt.puzzleDate, attempt.result || '');
      }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let checkDate = new Date(today);
    
    const todayStr = today.toISOString().split('T')[0];
    if (!dateMap.has(todayStr)) {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      checkDate = new Date(yesterday);
    }
    
    while (true) {
      const dateStr = checkDate.toISOString().split('T')[0];
      const result = dateMap.get(dateStr);
      
      if (!result) break;
      if (result === 'won') {
        currentStreak++;
      } else {
        break;
      }
      
      checkDate.setDate(checkDate.getDate() - 1);
    }

    const sortedDates = Array.from(dateMap.keys()).sort();
    for (let i = 0; i < sortedDates.length; i++) {
      const result = dateMap.get(sortedDates[i]);
      if (result === 'won') {
        tempStreak++;
        maxStreak = Math.max(maxStreak, tempStreak);
      } else {
        tempStreak = 0;
      }
    }

    return await this.upsertUserStatsRegion({
      userId,
      region: targetRegion,
      gamesPlayed,
      gamesWon,
      currentStreak,
      maxStreak,
      guessDistribution,
    });
  }

  async getUserPercentileRankingRegion(userId: string, region?: string): Promise<number> {
    // Get user's current region if not provided
    let targetRegion = region;
    if (!targetRegion) {
      const profile = await this.getUserProfile(userId);
      targetRegion = profile?.region || "UK";
    }
    
    // Get all stats for users IN THE SAME REGION only
    const allUserStats = await db
      .select({
        userId: userStatsRegion.userId,
        gamesWon: userStatsRegion.gamesWon,
      })
      .from(userStatsRegion)
      .where(eq(userStatsRegion.region, targetRegion))
      .orderBy(desc(userStatsRegion.gamesWon));

    if (allUserStats.length === 0) {
      return 100;
    }

    const userPosition = allUserStats.findIndex(stat => stat.userId === userId);
    
    if (userPosition === -1) {
      return 100;
    }

    const percentile = ((userPosition + 1) / allUserStats.length) * 100;
    return Math.round(percentile * 10) / 10;
  }

  // ========================================================================
  // USER GAME MODE OPERATIONS
  // ========================================================================

  // Question master operations (user)
  async getQuestionMasterUser(id: number): Promise<QuestionMasterUser | undefined> {
    const [question] = await db
      .select()
      .from(questionsMasterUser)
      .where(eq(questionsMasterUser.id, id));
    return question;
  }

  async createQuestionMasterUser(questionData: InsertQuestionMasterUser): Promise<QuestionMasterUser> {
    const [question] = await db
      .insert(questionsMasterUser)
      .values(questionData)
      .returning();
    return question;
  }

  // Question allocated operations (user)
  async getAllocatedQuestionByUserAndDate(
    userId: string,
    date: string
  ): Promise<AllocatedUserQuestionWithMaster | undefined> {
    const results = await db
      .select({
        id: questionsAllocatedUser.id,
        questionId: questionsAllocatedUser.questionId,
        userId: questionsAllocatedUser.userId,
        puzzleDate: questionsAllocatedUser.puzzleDate,
        categoryId: questionsAllocatedUser.categoryId,
        categoryName: categories.name,
        placeName: populatedPlaces.name1,
        masterQuestion_id: questionsMasterUser.id,
        masterQuestion_answerDateCanonical: questionsMasterUser.answerDateCanonical,
        masterQuestion_eventTitle: questionsMasterUser.eventTitle,
        masterQuestion_eventDescription: questionsMasterUser.eventDescription,
        masterQuestion_regions: questionsMasterUser.regions,
        masterQuestion_categories: questionsMasterUser.categories,
        masterQuestion_populatedPlaceId: questionsMasterUser.populatedPlaceId,
        masterQuestion_createdAt: questionsMasterUser.createdAt,
      })
      .from(questionsAllocatedUser)
      .innerJoin(
        questionsMasterUser,
        eq(questionsAllocatedUser.questionId, questionsMasterUser.id)
      )
      .innerJoin(
        categories,
        eq(questionsAllocatedUser.categoryId, categories.id)
      )
      .leftJoin(
        populatedPlaces,
        eq(questionsMasterUser.populatedPlaceId, populatedPlaces.id)
      )
      .where(
        and(
          eq(questionsAllocatedUser.userId, userId),
          eq(questionsAllocatedUser.puzzleDate, date)
        )
      );

    if (results.length === 0) return undefined;

    const result = results[0];
    return {
      id: result.id,
      questionId: result.questionId,
      userId: result.userId,
      puzzleDate: result.puzzleDate,
      categoryId: result.categoryId,
      categoryName: result.categoryName,
      placeName: result.placeName,
      masterQuestion: {
        id: result.masterQuestion_id,
        answerDateCanonical: result.masterQuestion_answerDateCanonical,
        eventTitle: result.masterQuestion_eventTitle,
        eventDescription: result.masterQuestion_eventDescription,
        regions: result.masterQuestion_regions,
        categories: result.masterQuestion_categories,
        populatedPlaceId: result.masterQuestion_populatedPlaceId,
        createdAt: result.masterQuestion_createdAt,
      },
    };
  }

  async getAllocatedQuestionsByUser(userId: string): Promise<AllocatedUserQuestionWithMaster[]> {
    const results = await db
      .select({
        id: questionsAllocatedUser.id,
        questionId: questionsAllocatedUser.questionId,
        userId: questionsAllocatedUser.userId,
        puzzleDate: questionsAllocatedUser.puzzleDate,
        categoryId: questionsAllocatedUser.categoryId,
        categoryName: categories.name,
        placeName: populatedPlaces.name1,
        masterQuestion_id: questionsMasterUser.id,
        masterQuestion_answerDateCanonical: questionsMasterUser.answerDateCanonical,
        masterQuestion_eventTitle: questionsMasterUser.eventTitle,
        masterQuestion_eventDescription: questionsMasterUser.eventDescription,
        masterQuestion_regions: questionsMasterUser.regions,
        masterQuestion_categories: questionsMasterUser.categories,
        masterQuestion_populatedPlaceId: questionsMasterUser.populatedPlaceId,
        masterQuestion_createdAt: questionsMasterUser.createdAt,
      })
      .from(questionsAllocatedUser)
      .innerJoin(
        questionsMasterUser,
        eq(questionsAllocatedUser.questionId, questionsMasterUser.id)
      )
      .innerJoin(
        categories,
        eq(questionsAllocatedUser.categoryId, categories.id)
      )
      .leftJoin(
        populatedPlaces,
        eq(questionsMasterUser.populatedPlaceId, populatedPlaces.id)
      )
      .where(eq(questionsAllocatedUser.userId, userId))
      .orderBy(questionsAllocatedUser.puzzleDate);

    return results.map(result => ({
      id: result.id,
      questionId: result.questionId,
      userId: result.userId,
      puzzleDate: result.puzzleDate,
      categoryId: result.categoryId,
      categoryName: result.categoryName,
      placeName: result.placeName,
      masterQuestion: {
        id: result.masterQuestion_id,
        answerDateCanonical: result.masterQuestion_answerDateCanonical,
        eventTitle: result.masterQuestion_eventTitle,
        eventDescription: result.masterQuestion_eventDescription,
        regions: result.masterQuestion_regions,
        categories: result.masterQuestion_categories,
        populatedPlaceId: result.masterQuestion_populatedPlaceId,
        createdAt: result.masterQuestion_createdAt,
      },
    }));
  }

  async getAllocatedQuestionsSinceByUser(
    userId: string,
    since: string
  ): Promise<AllocatedUserQuestionWithMaster[]> {
    const results = await db
      .select({
        id: questionsAllocatedUser.id,
        questionId: questionsAllocatedUser.questionId,
        userId: questionsAllocatedUser.userId,
        puzzleDate: questionsAllocatedUser.puzzleDate,
        categoryId: questionsAllocatedUser.categoryId,
        categoryName: categories.name,
        placeName: populatedPlaces.name1,
        masterQuestion_id: questionsMasterUser.id,
        masterQuestion_answerDateCanonical: questionsMasterUser.answerDateCanonical,
        masterQuestion_eventTitle: questionsMasterUser.eventTitle,
        masterQuestion_eventDescription: questionsMasterUser.eventDescription,
        masterQuestion_regions: questionsMasterUser.regions,
        masterQuestion_categories: questionsMasterUser.categories,
        masterQuestion_populatedPlaceId: questionsMasterUser.populatedPlaceId,
        masterQuestion_createdAt: questionsMasterUser.createdAt,
      })
      .from(questionsAllocatedUser)
      .innerJoin(
        questionsMasterUser,
        eq(questionsAllocatedUser.questionId, questionsMasterUser.id)
      )
      .innerJoin(
        categories,
        eq(questionsAllocatedUser.categoryId, categories.id)
      )
      .leftJoin(
        populatedPlaces,
        eq(questionsMasterUser.populatedPlaceId, populatedPlaces.id)
      )
      .where(
        and(
          eq(questionsAllocatedUser.userId, userId),
          gte(questionsAllocatedUser.puzzleDate, since)
        )
      )
      .orderBy(questionsAllocatedUser.puzzleDate);

    return results.map(result => ({
      id: result.id,
      questionId: result.questionId,
      userId: result.userId,
      puzzleDate: result.puzzleDate,
      categoryId: result.categoryId,
      categoryName: result.categoryName,
      placeName: result.placeName,
      masterQuestion: {
        id: result.masterQuestion_id,
        answerDateCanonical: result.masterQuestion_answerDateCanonical,
        eventTitle: result.masterQuestion_eventTitle,
        eventDescription: result.masterQuestion_eventDescription,
        regions: result.masterQuestion_regions,
        categories: result.masterQuestion_categories,
        populatedPlaceId: result.masterQuestion_populatedPlaceId,
        createdAt: result.masterQuestion_createdAt,
      },
    }));
  }

  async createQuestionAllocatedUser(
    allocationData: InsertQuestionAllocatedUser
  ): Promise<QuestionAllocatedUser> {
    const [allocation] = await db
      .insert(questionsAllocatedUser)
      .values(allocationData)
      .returning();
    return allocation;
  }

  async ensureUserAllocations(userId: string, minCount: number = 30): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    // Get all existing allocations for this user
    const allAllocations = await db
      .select()
      .from(questionsAllocatedUser)
      .where(eq(questionsAllocatedUser.userId, userId))
      .orderBy(questionsAllocatedUser.puzzleDate);

    // Count only FUTURE allocations (today or later)
    const futureAllocations = allAllocations.filter(a => a.puzzleDate >= todayStr);
    const futureCount = futureAllocations.length;

    console.log(`[ensureUserAllocations] User ${userId} has ${futureCount} future allocations (${allAllocations.length} total), target: ${minCount}`);

    if (futureCount >= minCount) {
      console.log(`[ensureUserAllocations] User already has enough future allocations`);
      return;
    }

    const needed = minCount - futureCount;
    console.log(`[ensureUserAllocations] Need to allocate ${needed} more questions`);

    // Get IDs of already-allocated questions to avoid duplicates
    const allocatedQuestionIds = allAllocations.map(a => a.questionId);

    // Fetch available master questions (excluding already allocated ones)
    const availableQuestions = await db
      .select()
      .from(questionsMasterUser)
      .where(
        allocatedQuestionIds.length > 0 
          ? notInArray(questionsMasterUser.id, allocatedQuestionIds)
          : sql`true`
      )
      .limit(needed);

    if (availableQuestions.length === 0) {
      console.log(`[ensureUserAllocations] No available questions to allocate`);
      return;
    }

    console.log(`[ensureUserAllocations] Found ${availableQuestions.length} available questions`);

    // Find the latest existing puzzle date, or use today if none exist
    let startDate: Date;
    if (allAllocations.length > 0) {
      const latestAllocation = allAllocations[allAllocations.length - 1];
      startDate = new Date(latestAllocation.puzzleDate);
      startDate.setDate(startDate.getDate() + 1); // Start from next day after latest
    } else {
      startDate = new Date(today);
    }

    const allocations = availableQuestions.map((question, index) => {
      const puzzleDate = new Date(startDate);
      puzzleDate.setDate(puzzleDate.getDate() + index);
      const puzzleDateStr = puzzleDate.toISOString().split('T')[0];

      // Pick a random category ID from the question's categories
      // categories is a JSONB array of category IDs
      const categoryId = question.categories && Array.isArray(question.categories) && question.categories.length > 0 
        ? question.categories[Math.floor(Math.random() * question.categories.length)]
        : 1; // Default to category ID 1 if no categories

      return {
        userId,
        questionId: question.id,
        puzzleDate: puzzleDateStr,
        categoryId,
      };
    });

    // Bulk insert allocations
    if (allocations.length > 0) {
      await db.insert(questionsAllocatedUser).values(allocations);
      console.log(`[ensureUserAllocations] Created ${allocations.length} new allocations starting from ${allocations[0].puzzleDate}`);
    }
  }

  // Game attempt operations (user)
  async getGameAttemptUser(id: number): Promise<GameAttemptUser | undefined> {
    const [attempt] = await db
      .select()
      .from(gameAttemptsUser)
      .where(eq(gameAttemptsUser.id, id));
    return attempt;
  }

  async getGameAttemptUserWithQuestion(
    id: number
  ): Promise<GameAttemptUserWithAllocatedQuestion | undefined> {
    const results = await db
      .select({
        id: gameAttemptsUser.id,
        userId: gameAttemptsUser.userId,
        allocatedUserId: gameAttemptsUser.allocatedUserId,
        result: gameAttemptsUser.result,
        numGuesses: gameAttemptsUser.numGuesses,
        digits: gameAttemptsUser.digits,
        startedAt: gameAttemptsUser.startedAt,
        completedAt: gameAttemptsUser.completedAt,
        allocated_id: questionsAllocatedUser.id,
        allocated_questionId: questionsAllocatedUser.questionId,
        allocated_userId: questionsAllocatedUser.userId,
        allocated_puzzleDate: questionsAllocatedUser.puzzleDate,
        allocated_categoryId: questionsAllocatedUser.categoryId,
        categoryName: categories.name,
        placeName: populatedPlaces.name1,
        master_id: questionsMasterUser.id,
        master_answerDateCanonical: questionsMasterUser.answerDateCanonical,
        master_eventTitle: questionsMasterUser.eventTitle,
        master_eventDescription: questionsMasterUser.eventDescription,
        master_regions: questionsMasterUser.regions,
        master_categories: questionsMasterUser.categories,
        master_populatedPlaceId: questionsMasterUser.populatedPlaceId,
        master_createdAt: questionsMasterUser.createdAt,
      })
      .from(gameAttemptsUser)
      .innerJoin(
        questionsAllocatedUser,
        eq(gameAttemptsUser.allocatedUserId, questionsAllocatedUser.id)
      )
      .innerJoin(
        questionsMasterUser,
        eq(questionsAllocatedUser.questionId, questionsMasterUser.id)
      )
      .innerJoin(
        categories,
        eq(questionsAllocatedUser.categoryId, categories.id)
      )
      .leftJoin(
        populatedPlaces,
        eq(questionsMasterUser.populatedPlaceId, populatedPlaces.id)
      )
      .where(eq(gameAttemptsUser.id, id));

    if (results.length === 0) return undefined;

    const result = results[0];
    return {
      id: result.id,
      userId: result.userId,
      allocatedUserId: result.allocatedUserId,
      result: result.result,
      numGuesses: result.numGuesses,
      digits: result.digits,
      startedAt: result.startedAt,
      completedAt: result.completedAt,
      allocatedQuestion: {
        id: result.allocated_id,
        questionId: result.allocated_questionId,
        userId: result.allocated_userId,
        puzzleDate: result.allocated_puzzleDate,
        categoryId: result.allocated_categoryId,
        categoryName: result.categoryName,
        placeName: result.placeName,
        masterQuestion: {
          id: result.master_id,
          answerDateCanonical: result.master_answerDateCanonical,
          eventTitle: result.master_eventTitle,
          eventDescription: result.master_eventDescription,
          regions: result.master_regions,
          categories: result.master_categories,
          populatedPlaceId: result.master_populatedPlaceId,
          createdAt: result.master_createdAt,
        },
      },
    };
  }

  async getGameAttemptsByUserUser(userId: string): Promise<GameAttemptUserWithAllocatedQuestion[]> {
    const results = await db
      .select({
        id: gameAttemptsUser.id,
        userId: gameAttemptsUser.userId,
        allocatedUserId: gameAttemptsUser.allocatedUserId,
        result: gameAttemptsUser.result,
        numGuesses: gameAttemptsUser.numGuesses,
        digits: gameAttemptsUser.digits,
        startedAt: gameAttemptsUser.startedAt,
        completedAt: gameAttemptsUser.completedAt,
        allocated_id: questionsAllocatedUser.id,
        allocated_questionId: questionsAllocatedUser.questionId,
        allocated_userId: questionsAllocatedUser.userId,
        allocated_puzzleDate: questionsAllocatedUser.puzzleDate,
        allocated_categoryId: questionsAllocatedUser.categoryId,
        categoryName: categories.name,
        placeName: populatedPlaces.name1,
        master_id: questionsMasterUser.id,
        master_answerDateCanonical: questionsMasterUser.answerDateCanonical,
        master_eventTitle: questionsMasterUser.eventTitle,
        master_eventDescription: questionsMasterUser.eventDescription,
        master_regions: questionsMasterUser.regions,
        master_categories: questionsMasterUser.categories,
        master_populatedPlaceId: questionsMasterUser.populatedPlaceId,
        master_createdAt: questionsMasterUser.createdAt,
      })
      .from(gameAttemptsUser)
      .innerJoin(
        questionsAllocatedUser,
        eq(gameAttemptsUser.allocatedUserId, questionsAllocatedUser.id)
      )
      .innerJoin(
        questionsMasterUser,
        eq(questionsAllocatedUser.questionId, questionsMasterUser.id)
      )
      .innerJoin(
        categories,
        eq(questionsAllocatedUser.categoryId, categories.id)
      )
      .leftJoin(
        populatedPlaces,
        eq(questionsMasterUser.populatedPlaceId, populatedPlaces.id)
      )
      .where(eq(gameAttemptsUser.userId, userId))
      .orderBy(desc(questionsAllocatedUser.puzzleDate));

    return results.map(result => ({
      id: result.id,
      userId: result.userId,
      allocatedUserId: result.allocatedUserId,
      result: result.result,
      numGuesses: result.numGuesses,
      digits: result.digits,
      startedAt: result.startedAt,
      completedAt: result.completedAt,
      allocatedQuestion: {
        id: result.allocated_id,
        questionId: result.allocated_questionId,
        userId: result.allocated_userId,
        puzzleDate: result.allocated_puzzleDate,
        categoryId: result.allocated_categoryId,
        categoryName: result.categoryName,
        placeName: result.placeName,
        masterQuestion: {
          id: result.master_id,
          answerDateCanonical: result.master_answerDateCanonical,
          eventTitle: result.master_eventTitle,
          eventDescription: result.master_eventDescription,
          regions: result.master_regions,
          categories: result.master_categories,
          populatedPlaceId: result.master_populatedPlaceId,
          createdAt: result.master_createdAt,
        },
      },
    }));
  }

  async getGameAttemptByUserAndAllocatedUser(
    userId: string,
    allocatedUserId: number
  ): Promise<GameAttemptUser | undefined> {
    const [attempt] = await db
      .select()
      .from(gameAttemptsUser)
      .where(
        and(
          eq(gameAttemptsUser.userId, userId),
          eq(gameAttemptsUser.allocatedUserId, allocatedUserId)
        )
      );
    return attempt;
  }

  async createGameAttemptUser(attemptData: InsertGameAttemptUser): Promise<GameAttemptUser> {
    const [attempt] = await db
      .insert(gameAttemptsUser)
      .values(attemptData)
      .returning();
    return attempt;
  }

  async updateGameAttemptUser(
    id: number,
    updateData: Partial<Omit<GameAttemptUser, 'id' | 'userId' | 'allocatedUserId' | 'startedAt'>>
  ): Promise<GameAttemptUser> {
    const [current] = await db
      .select()
      .from(gameAttemptsUser)
      .where(eq(gameAttemptsUser.id, id));

    let safeUpdate = { ...updateData } as any;

    // Ensure numGuesses never decreases
    if (typeof safeUpdate.numGuesses === "number" && current) {
      safeUpdate.numGuesses = Math.max(safeUpdate.numGuesses, current.numGuesses ?? 0);
    }

    // If result is being set, mark completedAt
    if (safeUpdate.result && !current?.completedAt) {
      safeUpdate.completedAt = new Date();
    }

    const [attempt] = await db
      .update(gameAttemptsUser)
      .set(safeUpdate)
      .where(eq(gameAttemptsUser.id, id))
      .returning();

    return attempt;
  }

  async incrementAttemptGuessesUser(gameAttemptId: number): Promise<void> {
    const [current] = await db
      .select({ numGuesses: gameAttemptsUser.numGuesses })
      .from(gameAttemptsUser)
      .where(eq(gameAttemptsUser.id, gameAttemptId));

    const next = (current?.numGuesses ?? 0) + 1;

    await db
      .update(gameAttemptsUser)
      .set({ numGuesses: next })
      .where(eq(gameAttemptsUser.id, gameAttemptId));
  }

  // Guess operations (user)
  async getGuessesByGameAttemptUser(gameAttemptId: number): Promise<GuessUser[]> {
    return await db
      .select()
      .from(guessesUser)
      .where(eq(guessesUser.gameAttemptId, gameAttemptId))
      .orderBy(guessesUser.guessedAt);
  }

  async createGuessUser(guessData: InsertGuessUser): Promise<GuessUser> {
    const [guess] = await db.insert(guessesUser).values(guessData).returning();
    return guess;
  }

  async getRecentGuessesWithAllocatedIdsUser(
    userId: string,
    since: string
  ): Promise<Array<GuessUser & { allocatedUserId: number }>> {
    const results = await db
      .select({
        id: guessesUser.id,
        gameAttemptId: guessesUser.gameAttemptId,
        guessValue: guessesUser.guessValue,
        guessedAt: guessesUser.guessedAt,
        allocatedUserId: gameAttemptsUser.allocatedUserId,
      })
      .from(guessesUser)
      .innerJoin(
        gameAttemptsUser,
        eq(guessesUser.gameAttemptId, gameAttemptsUser.id)
      )
      .innerJoin(
        questionsAllocatedUser,
        eq(gameAttemptsUser.allocatedUserId, questionsAllocatedUser.id)
      )
      .where(
        and(
          eq(gameAttemptsUser.userId, userId),
          gte(questionsAllocatedUser.puzzleDate, since)
        )
      )
      .orderBy(guessesUser.guessedAt);

    return results;
  }

  async getAllGuessesWithAllocatedIdsUser(
    userId: string
  ): Promise<Array<GuessUser & { allocatedUserId: number; result: string | null }>> {
    const results = await db
      .select({
        id: guessesUser.id,
        gameAttemptId: guessesUser.gameAttemptId,
        guessValue: guessesUser.guessValue,
        guessedAt: guessesUser.guessedAt,
        allocatedUserId: gameAttemptsUser.allocatedUserId,
        result: gameAttemptsUser.result,
      })
      .from(guessesUser)
      .innerJoin(
        gameAttemptsUser,
        eq(guessesUser.gameAttemptId, gameAttemptsUser.id)
      )
      .where(eq(gameAttemptsUser.userId, userId))
      .orderBy(guessesUser.guessedAt);

    return results;
  }

  // User stats operations (user)
  async getUserStatsUser(userId: string): Promise<UserStatsUser | undefined> {
    const [stats] = await db
      .select()
      .from(userStatsUser)
      .where(eq(userStatsUser.userId, userId));
    return stats;
  }

  async upsertUserStatsUser(statsData: InsertUserStatsUser): Promise<UserStatsUser> {
    // Check if stats already exist for this user
    const existing = await this.getUserStatsUser(statsData.userId);
    
    if (existing) {
      // Update existing stats
      const [updated] = await db
        .update(userStatsUser)
        .set({
          ...statsData,
          updatedAt: new Date(),
        })
        .where(eq(userStatsUser.userId, statsData.userId))
        .returning();
      return updated;
    } else {
      // Insert new stats
      const [inserted] = await db
        .insert(userStatsUser)
        .values(statsData)
        .returning();
      return inserted;
    }
  }

  async recalculateUserStatsUser(userId: string): Promise<UserStatsUser> {
    // Get all completed game attempts for this user in user mode
    const completedAttempts = await db
      .select({
        id: gameAttemptsUser.id,
        result: gameAttemptsUser.result,
        numGuesses: gameAttemptsUser.numGuesses,
        completedAt: gameAttemptsUser.completedAt,
        puzzleDate: questionsAllocatedUser.puzzleDate,
      })
      .from(gameAttemptsUser)
      .innerJoin(
        questionsAllocatedUser,
        eq(gameAttemptsUser.allocatedUserId, questionsAllocatedUser.id)
      )
      .where(
        and(
          eq(gameAttemptsUser.userId, userId),
          eq(gameAttemptsUser.result, 'won')
        )
      )
      .orderBy(questionsAllocatedUser.puzzleDate);

    // Get lost games
    const lostAttempts = await db
      .select({
        id: gameAttemptsUser.id,
        result: gameAttemptsUser.result,
        puzzleDate: questionsAllocatedUser.puzzleDate,
        completedAt: gameAttemptsUser.completedAt,
      })
      .from(gameAttemptsUser)
      .innerJoin(
        questionsAllocatedUser,
        eq(gameAttemptsUser.allocatedUserId, questionsAllocatedUser.id)
      )
      .where(
        and(
          eq(gameAttemptsUser.userId, userId),
          eq(gameAttemptsUser.result, 'lost')
        )
      );

    const gamesPlayed = completedAttempts.length + lostAttempts.length;
    const gamesWon = completedAttempts.length;

    // Calculate guess distribution (only for won games)
    const guessDistribution: any = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
    for (const attempt of completedAttempts) {
      const numGuesses = attempt.numGuesses || 0;
      if (numGuesses >= 1 && numGuesses <= 5) {
        guessDistribution[numGuesses.toString()] = (guessDistribution[numGuesses.toString()] || 0) + 1;
      }
    }

    // Calculate current streak
    const allCompletedAttempts = [...completedAttempts, ...lostAttempts].sort((a, b) => 
      new Date(b.puzzleDate).getTime() - new Date(a.puzzleDate).getTime()
    );

    let currentStreak = 0;
    let maxStreak = 0;
    let tempStreak = 0;
    
    const dateMap = new Map<string, string>();
    for (const attempt of allCompletedAttempts) {
      const completedDate = new Date(attempt.completedAt || '');
      const puzzleDate = new Date(attempt.puzzleDate);
      
      completedDate.setHours(0, 0, 0, 0);
      puzzleDate.setHours(0, 0, 0, 0);
      
      if (completedDate.getTime() === puzzleDate.getTime()) {
        dateMap.set(attempt.puzzleDate, attempt.result || '');
      }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let checkDate = new Date(today);
    
    const todayStr = today.toISOString().split('T')[0];
    if (!dateMap.has(todayStr)) {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      checkDate = new Date(yesterday);
    }
    
    while (true) {
      const dateStr = checkDate.toISOString().split('T')[0];
      const result = dateMap.get(dateStr);
      
      if (!result) break;
      if (result === 'won') {
        currentStreak++;
      } else {
        break;
      }
      
      checkDate.setDate(checkDate.getDate() - 1);
    }

    const sortedDates = Array.from(dateMap.keys()).sort();
    for (let i = 0; i < sortedDates.length; i++) {
      const result = dateMap.get(sortedDates[i]);
      if (result === 'won') {
        tempStreak++;
        maxStreak = Math.max(maxStreak, tempStreak);
      } else {
        tempStreak = 0;
      }
    }

    return await this.upsertUserStatsUser({
      userId,
      gamesPlayed,
      gamesWon,
      currentStreak,
      maxStreak,
      guessDistribution,
    });
  }

  async getUserPercentileRankingUser(userId: string): Promise<number> {
    const allUserStats = await db
      .select({
        userId: userStatsUser.userId,
        gamesWon: userStatsUser.gamesWon,
      })
      .from(userStatsUser)
      .orderBy(desc(userStatsUser.gamesWon));

    if (allUserStats.length === 0) {
      return 100;
    }

    const userPosition = allUserStats.findIndex(stat => stat.userId === userId);
    
    if (userPosition === -1) {
      return 100;
    }

    const percentile = ((userPosition + 1) / allUserStats.length) * 100;
    return Math.round(percentile * 10) / 10;
  }

  // ========================================================================
  // SUBSCRIPTION & PRO CATEGORY OPERATIONS
  // ========================================================================

  async getUserSubscription(userId: string): Promise<any | undefined> {
    try {
      // Query the user_subscriptions table directly via SQL
      const result = await db.execute(
        sql`SELECT * FROM user_subscriptions WHERE user_id = ${userId} LIMIT 1`
      );
      return result.rows?.[0] || undefined;
    } catch (error: any) {
      // Table might not exist yet
      if (error?.code === '42P01') {
        console.log('Note: user_subscriptions table not available yet');
        return undefined;
      }
      throw error;
    }
  }

  // Note: Legacy upsertUserSubscription removed - use createUserSubscription() instead
  // which properly uses user_tier_id FK to user_tier table

  async getAllCategories(): Promise<Category[]> {
    return await db.select().from(categories).orderBy(categories.name);
  }

  async getUserProCategories(userId: string): Promise<number[]> {
    try {
      // Read from user_category_preferences table (existing Supabase table)
      const result: any = await db.execute(
        sql`SELECT category_id FROM user_category_preferences WHERE user_id = ${userId}::uuid`
      );
      
      // Drizzle with Neon can return rows directly or in result.rows
      const rows = Array.isArray(result) ? result : (result.rows || []);
      console.log('[getUserProCategories] Found', rows.length, 'categories for user:', userId);
      return rows.map((row: any) => row.category_id);
    } catch (error: any) {
      console.error('[getUserProCategories] Error:', error);
      // Table might not exist yet
      if (error?.code === '42P01') {
        console.log('Note: user_category_preferences table not available yet');
        return [];
      }
      throw error;
    }
  }

  async saveUserProCategories(userId: string, categoryIds: number[]): Promise<void> {
    try {
      // Save to user_category_preferences table (existing Supabase table)
      // Delete existing categories
      await db.execute(sql`DELETE FROM user_category_preferences WHERE user_id = ${userId}::uuid`);
      
      // Insert new categories
      for (const categoryId of categoryIds) {
        await db.execute(
          sql`INSERT INTO user_category_preferences (user_id, category_id) VALUES (${userId}::uuid, ${categoryId})`
        );
      }
      console.log('[saveUserProCategories] Saved', categoryIds.length, 'categories for user:', userId);
    } catch (error: any) {
      console.error('[saveUserProCategories] Error:', error);
      // Table might not exist yet
      if (error?.code === '42P01') {
        console.log('Note: user_category_preferences table not available yet');
        return;
      }
      throw error;
    }
  }

  async markFirstLoginCompleted(userId: string): Promise<void> {
    // Note: first_login_completed column not yet in database
    // This is a no-op until Supabase migration is applied
    console.log(`First login completed flag would be set for user ${userId}`);
  }

  // ========================================================================
  // STREAK SAVER & HOLIDAY OPERATIONS
  // ========================================================================

  async getStreakSaverStatus(userId: string): Promise<{
    region: {
      currentStreak: number;
      streakSaversUsedMonth: number;
      missedYesterdayFlag: boolean;
    };
    user: {
      currentStreak: number;
      streakSaversUsedMonth: number;
      holidayActive: boolean;
      holidayStartDate: string | null;
      holidayEndDate: string | null;
      missedYesterdayFlag: boolean;
    };
  } | null> {
    try {
      // Calculate today's and yesterday's dates (in YYYY-MM-DD format)
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      // Get region stats
      const regionResult = await db.execute(sql`
        SELECT 
          current_streak,
          streak_savers_used_month,
          missed_yesterday_flag_region
        FROM user_stats_region
        WHERE user_id = ${userId}
      `);
      
      // Get user stats
      const userResult = await db.execute(sql`
        SELECT 
          current_streak,
          streak_savers_used_month,
          holiday_active,
          holiday_start_date,
          holiday_end_date,
          missed_yesterday_flag_user
        FROM user_stats_user
        WHERE user_id = ${userId}
      `);
      
      const regionRows = Array.isArray(regionResult) ? regionResult : (regionResult as any).rows || [];
      const userRows = Array.isArray(userResult) ? userResult : (userResult as any).rows || [];
      
      // Return null if user doesn't have any stats yet
      if (regionRows.length === 0 && userRows.length === 0) {
        console.log('[getStreakSaverStatus] No stats found for user');
        return null;
      }
      
      const regionRow = regionRows[0] || {};
      const userRow = userRows[0] || {};
      
      // Get current values
      let regionCurrentStreak = regionRow.current_streak || 0;
      let regionMissedFlag = regionRow.missed_yesterday_flag_region || false;
      let userCurrentStreak = userRow.current_streak || 0;
      let userMissedFlag = userRow.missed_yesterday_flag_user || false;
      const holidayActive = userRow.holiday_active || false;
      
      // ========================================================================
      // CHECK AND MANAGE MISSED_YESTERDAY_FLAG FOR REGION MODE
      // ========================================================================
      // Check if yesterday's REGION puzzle was played
      const regionPlayedYesterdayResult = await db.execute(sql`
        SELECT ga.id 
        FROM game_attempts_region ga
        INNER JOIN questions_allocated_region qar ON ga.allocated_region_id = qar.id
        WHERE ga.user_id = ${userId}
          AND qar.puzzle_date = ${yesterdayStr}
          AND ga.result IS NOT NULL
        LIMIT 1
      `);
      
      const regionPlayedYesterdayRows = Array.isArray(regionPlayedYesterdayResult) ? regionPlayedYesterdayResult : (regionPlayedYesterdayResult as any).rows || [];
      const didPlayRegionYesterday = regionPlayedYesterdayRows.length > 0;
      
      // Check if TODAY's REGION puzzle was played
      const regionPlayedTodayResult = await db.execute(sql`
        SELECT ga.id 
        FROM game_attempts_region ga
        INNER JOIN questions_allocated_region qar ON ga.allocated_region_id = qar.id
        WHERE ga.user_id = ${userId}
          AND qar.puzzle_date = ${todayStr}
          AND ga.result IS NOT NULL
        LIMIT 1
      `);
      
      const regionPlayedTodayRows = Array.isArray(regionPlayedTodayResult) ? regionPlayedTodayResult : (regionPlayedTodayResult as any).rows || [];
      const didPlayRegionToday = regionPlayedTodayRows.length > 0;
      
      if (didPlayRegionYesterday && regionMissedFlag) {
        // User has played yesterday but flag is still set - CLEAR it!
        await db.execute(sql`
          UPDATE user_stats_region 
          SET missed_yesterday_flag_region = false, updated_at = NOW()
          WHERE user_id = ${userId}
        `);
        regionMissedFlag = false;
      } else if (didPlayRegionToday && regionMissedFlag) {
        // User has already played TODAY - if they completed today's puzzle already,
        // the streak saver window has passed. Clear the flag.
        await db.execute(sql`
          UPDATE user_stats_region 
          SET missed_yesterday_flag_region = false, updated_at = NOW()
          WHERE user_id = ${userId}
        `);
        regionMissedFlag = false;
      } else if (!didPlayRegionYesterday && !didPlayRegionToday && regionCurrentStreak > 0 && !regionMissedFlag) {
        // User had a streak, missed yesterday, and hasn't played today yet - SET the flag!
        // This is the only case where we should show the streak saver popup
        await db.execute(sql`
          UPDATE user_stats_region 
          SET missed_yesterday_flag_region = true, updated_at = NOW()
          WHERE user_id = ${userId}
        `);
        regionMissedFlag = true;
      }
      
      // ========================================================================
      // CHECK AND MANAGE MISSED_YESTERDAY_FLAG FOR USER MODE
      // ========================================================================
      // Check if yesterday's USER puzzle was played
      const userPlayedYesterdayResult = await db.execute(sql`
        SELECT ga.id 
        FROM game_attempts_user ga
        INNER JOIN questions_allocated_user qau ON ga.allocated_user_id = qau.id
        WHERE ga.user_id = ${userId}
          AND qau.puzzle_date = ${yesterdayStr}
          AND ga.result IS NOT NULL
        LIMIT 1
      `);
      
      const userPlayedYesterdayRows = Array.isArray(userPlayedYesterdayResult) ? userPlayedYesterdayResult : (userPlayedYesterdayResult as any).rows || [];
      const didPlayUserYesterday = userPlayedYesterdayRows.length > 0;
      
      // Check if TODAY's USER puzzle was played
      const userPlayedTodayResult = await db.execute(sql`
        SELECT ga.id 
        FROM game_attempts_user ga
        INNER JOIN questions_allocated_user qau ON ga.allocated_user_id = qau.id
        WHERE ga.user_id = ${userId}
          AND qau.puzzle_date = ${todayStr}
          AND ga.result IS NOT NULL
        LIMIT 1
      `);
      
      const userPlayedTodayRows = Array.isArray(userPlayedTodayResult) ? userPlayedTodayResult : (userPlayedTodayResult as any).rows || [];
      const didPlayUserToday = userPlayedTodayRows.length > 0;
      
      if (didPlayUserYesterday && userMissedFlag) {
        // User has played yesterday but flag is still set - CLEAR it!
        await db.execute(sql`
          UPDATE user_stats_user 
          SET missed_yesterday_flag_user = false, updated_at = NOW()
          WHERE user_id = ${userId}
        `);
        userMissedFlag = false;
      } else if (didPlayUserToday && userMissedFlag) {
        // User has already played TODAY - the streak saver window has passed. Clear the flag.
        await db.execute(sql`
          UPDATE user_stats_user 
          SET missed_yesterday_flag_user = false, updated_at = NOW()
          WHERE user_id = ${userId}
        `);
        userMissedFlag = false;
      } else if (!didPlayUserYesterday && !didPlayUserToday && userCurrentStreak > 0 && !userMissedFlag && !holidayActive) {
        // User had a streak, missed yesterday, hasn't played today yet, and not on holiday - SET the flag!
        await db.execute(sql`
          UPDATE user_stats_user 
          SET missed_yesterday_flag_user = true, updated_at = NOW()
          WHERE user_id = ${userId}
        `);
        userMissedFlag = true;
      }
      
      return {
        region: {
          currentStreak: regionCurrentStreak,
          streakSaversUsedMonth: regionRow.streak_savers_used_month || 0,
          missedYesterdayFlag: regionMissedFlag,
        },
        user: {
          currentStreak: userCurrentStreak,
          streakSaversUsedMonth: userRow.streak_savers_used_month || 0,
          holidayActive: holidayActive,
          holidayStartDate: userRow.holiday_start_date || null,
          holidayEndDate: userRow.holiday_end_date || null,
          missedYesterdayFlag: userMissedFlag,
        }
      };
    } catch (error: any) {
      console.error('[getStreakSaverStatus] Error:', error);
      // Columns might not exist yet
      if (error?.code === '42703' || error?.message?.includes('does not exist')) {
        console.log('Note: Streak saver columns not available yet');
        return null;
      }
      throw error;
    }
  }

  async useStreakSaver(userId: string, gameType: 'region' | 'user', allowance: number): Promise<{ success: boolean; error?: string }> {
    try {
      const table = gameType === 'region' ? 'user_stats_region' : 'user_stats_user';
      const flagColumn = gameType === 'region' ? 'missed_yesterday_flag_region' : 'missed_yesterday_flag_user';
      
      // Check current usage
      const result = await db.execute(sql.raw(`
        SELECT streak_savers_used_month, ${flagColumn}
        FROM ${table}
        WHERE user_id = '${userId}'
      `));
      
      const rows = Array.isArray(result) ? result : (result as any).rows || [];
      if (rows.length === 0) {
        return { success: false, error: 'Stats not found for user' };
      }
      
      const currentUsage = rows[0].streak_savers_used_month || 0;
      const hasMissedFlag = rows[0][flagColumn] || false;
      
      if (!hasMissedFlag) {
        return { success: false, error: 'No missed day to save' };
      }
      
      if (currentUsage >= allowance) {
        return { success: false, error: 'No streak savers remaining this month' };
      }
      
      // Use the streak saver: increment usage and clear flag
      await db.execute(sql.raw(`
        UPDATE ${table}
        SET 
          streak_savers_used_month = streak_savers_used_month + 1,
          ${flagColumn} = false,
          updated_at = NOW()
        WHERE user_id = '${userId}'
      `));
      
      console.log(`[useStreakSaver] User ${userId} used streak saver for ${gameType}`);
      return { success: true };
    } catch (error: any) {
      console.error('[useStreakSaver] Error:', error);
      return { success: false, error: error?.message || 'Failed to use streak saver' };
    }
  }

  async startHoliday(userId: string, holidayDurationDays: number): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if holiday is already active
      const result = await db.execute(sql`
        SELECT holiday_active, holiday_start_date, holiday_end_date
        FROM user_stats_user
        WHERE user_id = ${userId}
      `);
      
      const rows = Array.isArray(result) ? result : (result as any).rows || [];
      if (rows.length === 0) {
        return { success: false, error: 'Stats not found for user' };
      }
      
      if (rows[0].holiday_active) {
        return { success: false, error: 'Holiday already active' };
      }
      
      // Calculate holiday dates
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + holidayDurationDays);
      
      // Start the holiday
      await db.execute(sql`
        UPDATE user_stats_user
        SET 
          holiday_active = true,
          holiday_start_date = ${startDate.toISOString().split('T')[0]},
          holiday_end_date = ${endDate.toISOString().split('T')[0]},
          updated_at = NOW()
        WHERE user_id = ${userId}
      `);
      
      // Record holiday event
      await this.insertHolidayEvent(userId, 'user', startDate);
      
      console.log(`[startHoliday] User ${userId} started holiday until ${endDate.toISOString().split('T')[0]}`);
      return { success: true };
    } catch (error: any) {
      console.error('[startHoliday] Error:', error);
      return { success: false, error: error?.message || 'Failed to start holiday' };
    }
  }

  async endHoliday(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if holiday is active
      const result = await db.execute(sql`
        SELECT holiday_active, holiday_start_date
        FROM user_stats_user
        WHERE user_id = ${userId}
      `);
      
      const rows = Array.isArray(result) ? result : (result as any).rows || [];
      if (rows.length === 0) {
        return { success: false, error: 'Stats not found for user' };
      }
      
      if (!rows[0].holiday_active) {
        return { success: false, error: 'No active holiday to end' };
      }
      
      // End the holiday
      await db.execute(sql`
        UPDATE user_stats_user
        SET 
          holiday_active = false,
          holiday_start_date = NULL,
          holiday_end_date = NULL,
          updated_at = NOW()
        WHERE user_id = ${userId}
      `);
      
      // Update the holiday event with end date
      const endDate = new Date();
      await db.execute(sql`
        UPDATE user_holiday_events
        SET ended_at = ${endDate}
        WHERE user_id = ${userId}
          AND ended_at IS NULL
        ORDER BY created_at DESC
        LIMIT 1
      `);
      
      console.log(`[endHoliday] User ${userId} ended holiday`);
      return { success: true };
    } catch (error: any) {
      console.error('[endHoliday] Error:', error);
      return { success: false, error: error?.message || 'Failed to end holiday' };
    }
  }

  async countHolidayEventsThisYear(userId: string): Promise<number> {
    try {
      const startOfYear = new Date();
      startOfYear.setMonth(0, 1);
      startOfYear.setHours(0, 0, 0, 0);
      
      const result = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM user_holiday_events
        WHERE user_id = ${userId}
          AND created_at >= ${startOfYear}
      `);
      
      const rows = Array.isArray(result) ? result : (result as any).rows || [];
      return parseInt(rows[0]?.count || '0', 10);
    } catch (error: any) {
      // Table might not exist yet - gracefully return 0
      if (error?.code === '42P01') {
        // Note: user_holiday_events table needs to be created in Supabase
        return 0;
      }
      console.error('[countHolidayEventsThisYear] Error:', error);
      throw error;
    }
  }

  async insertHolidayEvent(userId: string, mode: 'region' | 'user', startedAt: Date, endedAt?: Date): Promise<void> {
    try {
      await db.execute(sql`
        INSERT INTO user_holiday_events (user_id, mode, started_at, ended_at)
        VALUES (${userId}, ${mode}, ${startedAt}, ${endedAt || null})
      `);
      console.log(`[insertHolidayEvent] Recorded holiday event for user ${userId}`);
    } catch (error: any) {
      console.error('[insertHolidayEvent] Error:', error);
      // Table might not exist yet - that's okay
      if (error?.code === '42P01') {
        console.log('Note: user_holiday_events table not available yet');
        return;
      }
      throw error;
    }
  }

  // ========================================================================
  // BADGE OPERATIONS
  // ========================================================================

  async getAllBadges(): Promise<Badge[]> {
    try {
      return await db.select().from(badges).orderBy(badges.category, badges.threshold);
    } catch (error: any) {
      console.error('[getAllBadges] Error:', error);
      if (error?.code === '42P01') {
        return [];
      }
      throw error;
    }
  }

  async getBadgeById(badgeId: number): Promise<Badge | undefined> {
    try {
      const [badge] = await db.select().from(badges).where(eq(badges.id, badgeId));
      return badge;
    } catch (error: any) {
      console.error('[getBadgeById] Error:', error);
      return undefined;
    }
  }

  async getBadgeByThreshold(category: string, threshold: number): Promise<Badge | undefined> {
    try {
      const [badge] = await db
        .select()
        .from(badges)
        .where(and(eq(badges.category, category), eq(badges.threshold, threshold)));
      return badge;
    } catch (error: any) {
      console.error('[getBadgeByThreshold] Error:', error);
      return undefined;
    }
  }

  async getUserBadges(
    userId: string, 
    gameType: 'USER' | 'REGION', 
    region: string,
    onlyAwarded: boolean = true
  ): Promise<UserBadgeWithDetails[]> {
    try {
      const whereConditions = onlyAwarded
        ? and(
            eq(userBadges.userId, userId),
            eq(userBadges.gameType, gameType),
            eq(userBadges.region, region),
            eq(userBadges.isAwarded, true)
          )
        : and(
            eq(userBadges.userId, userId),
            eq(userBadges.gameType, gameType),
            eq(userBadges.region, region)
          );

      const results = await db
        .select({
          id: userBadges.id,
          userId: userBadges.userId,
          badgeId: userBadges.badgeId,
          isAwarded: userBadges.isAwarded,
          region: userBadges.region,
          gameType: userBadges.gameType,
          awardedAt: userBadges.awardedAt,
          badge: {
            id: badges.id,
            name: badges.name,
            category: badges.category,
            threshold: badges.threshold,
            iconUrl: badges.iconUrl,
            createdAt: badges.createdAt,
          },
        })
        .from(userBadges)
        .innerJoin(badges, eq(userBadges.badgeId, badges.id))
        .where(whereConditions)
        .orderBy(badges.category, desc(badges.threshold));

      return results as UserBadgeWithDetails[];
    } catch (error: any) {
      console.error('[getUserBadges] Error:', error);
      if (error?.code === '42P01') {
        return [];
      }
      throw error;
    }
  }

  async getPendingBadges(
    userId: string, 
    gameType: 'USER' | 'REGION', 
    region: string
  ): Promise<UserBadgeWithDetails[]> {
    try {
      const results = await db
        .select({
          id: userBadges.id,
          userId: userBadges.userId,
          badgeId: userBadges.badgeId,
          isAwarded: userBadges.isAwarded,
          region: userBadges.region,
          gameType: userBadges.gameType,
          awardedAt: userBadges.awardedAt,
          badge: {
            id: badges.id,
            name: badges.name,
            category: badges.category,
            threshold: badges.threshold,
            iconUrl: badges.iconUrl,
            createdAt: badges.createdAt,
          },
        })
        .from(userBadges)
        .innerJoin(badges, eq(userBadges.badgeId, badges.id))
        .where(
          and(
            eq(userBadges.userId, userId),
            eq(userBadges.gameType, gameType),
            eq(userBadges.region, region),
            eq(userBadges.isAwarded, false)
          )
        )
        .orderBy(userBadges.awardedAt);

      return results as UserBadgeWithDetails[];
    } catch (error: any) {
      console.error('[getPendingBadges] Error:', error);
      if (error?.code === '42P01') {
        return [];
      }
      throw error;
    }
  }

  async markBadgeAwarded(userBadgeId: number): Promise<void> {
    try {
      await db
        .update(userBadges)
        .set({ isAwarded: true })
        .where(eq(userBadges.id, userBadgeId));
      console.log(`[markBadgeAwarded] Marked user badge ${userBadgeId} as awarded`);
    } catch (error: any) {
      console.error('[markBadgeAwarded] Error:', error);
      throw error;
    }
  }

  async awardBadge(
    userId: string,
    badgeId: number,
    gameType: 'USER' | 'REGION',
    region: string
  ): Promise<UserBadge | null> {
    try {
      // Check if badge already exists for this user/gameType/region combination
      // The unique constraint is on (user_id, badge_id, gameType, region)
      // A user CAN have the same badge for different game types (USER vs REGION)
      // A user CAN have the same badge for different regions in REGION game type
      const existing = await db
        .select()
        .from(userBadges)
        .where(
          and(
            eq(userBadges.userId, userId),
            eq(userBadges.badgeId, badgeId),
            eq(userBadges.gameType, gameType),
            eq(userBadges.region, region)
          )
        );

      if (existing.length > 0) {
        console.log(`[awardBadge] Badge ${badgeId} already exists for user ${userId} in ${gameType}/${region}`);
        return existing[0];
      }

      const [newBadge] = await db
        .insert(userBadges)
        .values({
          userId,
          badgeId,
          gameType,
          region,
          isAwarded: false, // Will be marked true after popup shown
        })
        .returning();

      console.log(`[awardBadge] Created new badge ${badgeId} for user ${userId} in ${gameType}/${region}`);
      return newBadge;
    } catch (error: any) {
      // Handle duplicate key constraint violation gracefully
      if (error?.code === '23505') {
        console.log(`[awardBadge] Badge ${badgeId} already exists for user ${userId} in ${gameType}/${region} (duplicate key)`);
        // Return existing badge with full constraint check
        const existing = await db
          .select()
          .from(userBadges)
          .where(
            and(
              eq(userBadges.userId, userId),
              eq(userBadges.badgeId, badgeId),
              eq(userBadges.gameType, gameType),
              eq(userBadges.region, region)
            )
          );
        return existing.length > 0 ? existing[0] : null;
      }
      console.error('[awardBadge] Error:', error);
      if (error?.code === '42P01') {
        return null;
      }
      throw error;
    }
  }

  async getHighestBadgePerCategory(
    userId: string,
    gameType: 'USER' | 'REGION',
    region: string
  ): Promise<Record<string, UserBadgeWithDetails | null>> {
    try {
      const allBadges = await this.getUserBadges(userId, gameType, region, true);
      
      // Map database category names to result keys
      const categoryMap: Record<string, string> = {
        'Elementle In': 'elementle',
        'Streak': 'streak',
        'Percentile': 'percentile',
      };
      
      const result: Record<string, UserBadgeWithDetails | null> = {
        elementle: null,
        streak: null,
        percentile: null,
      };

      for (const badge of allBadges) {
        const dbCategory = badge.badge.category;
        const resultKey = categoryMap[dbCategory];
        
        if (resultKey && resultKey in result) {
          const current = result[resultKey];
          if (!current) {
            result[resultKey] = badge;
          } else {
            // For percentile, lower threshold is better (1% is better than 50%)
            // For streak and elementle, higher threshold is better (30 streak > 7 streak)
            if (resultKey === 'percentile') {
              if (badge.badge.threshold < current.badge.threshold) {
                result[resultKey] = badge;
              }
            } else {
              if (badge.badge.threshold > current.badge.threshold) {
                result[resultKey] = badge;
              }
            }
          }
        }
      }

      return result;
    } catch (error: any) {
      console.error('[getHighestBadgePerCategory] Error:', error);
      return {
        elementle: null,
        streak: null,
        percentile: null,
      };
    }
  }

  async checkAndAwardStreakBadge(
    userId: string,
    streak: number,
    gameType: 'USER' | 'REGION',
    region: string
  ): Promise<UserBadgeWithDetails | null> {
    try {
      // Streak thresholds: 7, 14, 30, 50, 100, 150, 250, 365, 500, 750, 1000
      const streakThresholds = [7, 14, 30, 50, 100, 150, 250, 365, 500, 750, 1000];
      
      // Find the highest threshold the user qualifies for
      const qualifiedThreshold = streakThresholds.filter(t => streak >= t).pop();
      
      if (!qualifiedThreshold) {
        return null; // No badge threshold reached
      }

      // Get the badge for this threshold (use exact category name from database)
      const badge = await this.getBadgeByThreshold('Streak', qualifiedThreshold);
      if (!badge) {
        console.log(`[checkAndAwardStreakBadge] No Streak badge found for threshold ${qualifiedThreshold}`);
        return null;
      }

      // Check if user already has this badge
      const existingBadges = await this.getUserBadges(userId, gameType, region, false);
      const hasBadge = existingBadges.some(ub => ub.badge.id === badge.id);
      
      if (hasBadge) {
        return null; // Already has this badge
      }

      // Award the badge
      const newBadge = await this.awardBadge(userId, badge.id, gameType, region);
      if (newBadge) {
        return {
          ...newBadge,
          badge,
        };
      }
      return null;
    } catch (error: any) {
      console.error('[checkAndAwardStreakBadge] Error:', error);
      return null;
    }
  }

  async checkAndAwardElementleBadge(
    userId: string,
    guessCount: number,
    gameType: 'USER' | 'REGION',
    region: string
  ): Promise<UserBadgeWithDetails | null> {
    try {
      // Elementle In thresholds: 1 or 2 guesses
      if (guessCount !== 1 && guessCount !== 2) {
        return null;
      }

      // Get the badge for this threshold (use exact category name from database)
      const badge = await this.getBadgeByThreshold('Elementle In', guessCount);
      if (!badge) {
        console.log(`[checkAndAwardElementleBadge] No Elementle In badge found for threshold ${guessCount}`);
        return null;
      }

      // Check if user already has this badge
      const existingBadges = await this.getUserBadges(userId, gameType, region, false);
      const hasBadge = existingBadges.some(ub => ub.badge.id === badge.id);
      
      if (hasBadge) {
        return null; // Already has this badge
      }

      // Award the badge
      const newBadge = await this.awardBadge(userId, badge.id, gameType, region);
      if (newBadge) {
        return {
          ...newBadge,
          badge,
        };
      }
      return null;
    } catch (error: any) {
      console.error('[checkAndAwardElementleBadge] Error:', error);
      return null;
    }
  }

  async checkAndAwardPercentileBadge(
    userId: string,
    gameType: 'USER' | 'REGION',
    region: string
  ): Promise<UserBadgeWithDetails | null> {
    try {
      // Get user's current percentile using existing methods
      const percentile = gameType === 'USER' 
        ? await this.getUserPercentileRankingUser(userId)
        : await this.getUserPercentileRankingRegion(userId, region);
      
      if (percentile === null) {
        return null;
      }

      // Percentile thresholds (lower is better for rankings)
      const percentileThresholds = [1, 5, 10, 20, 30, 40, 50];
      const userPercentileInt = Math.ceil(100 - percentile); // Convert to "top X%"
      
      // Find the best threshold the user qualifies for
      const qualifiedThreshold = percentileThresholds.find(t => userPercentileInt <= t);
      
      if (!qualifiedThreshold) {
        return null; // Not in top 50%
      }

      // Get the badge for this threshold (use exact category name from database)
      const badge = await this.getBadgeByThreshold('Percentile', qualifiedThreshold);
      if (!badge) {
        console.log(`[checkAndAwardPercentileBadge] No Percentile badge found for threshold ${qualifiedThreshold}`);
        return null;
      }

      // Check if user already has this badge
      const existingBadges = await this.getUserBadges(userId, gameType, region, false);
      const hasBadge = existingBadges.some(ub => ub.badge.id === badge.id);
      
      if (hasBadge) {
        return null; // Already has this badge
      }

      // Award the badge
      const newBadge = await this.awardBadge(userId, badge.id, gameType, region);
      if (newBadge) {
        return {
          ...newBadge,
          badge,
        };
      }
      return null;
    } catch (error: any) {
      console.error('[checkAndAwardPercentileBadge] Error:', error);
      return null;
    }
  }
}

export const storage = new DatabaseStorage();
