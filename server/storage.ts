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
  upsertUserSubscription(subscription: { userId: string; tier: string; autoRenew?: boolean; endDate?: Date | null }): Promise<any>;
  
  // Category operations
  getAllCategories(): Promise<Category[]>;
  
  // Pro category preferences
  getUserProCategories(userId: string): Promise<number[]>;
  saveUserProCategories(userId: string, categoryIds: number[]): Promise<void>;
  
  // First login tracking
  markFirstLoginCompleted(userId: string): Promise<void>;
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

    return profile;
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
  async getDemandSchedulerConfig(): Promise<DemandSchedulerConfig | undefined> {
    const result = await db.execute(sql`
      SELECT id, start_time, frequency_hours, updated_at, updated_by
      FROM demand_scheduler_config
      LIMIT 1
    `);
    
    if (result.rows.length === 0) {
      return undefined;
    }
    
    const row = result.rows[0] as any;
    return {
      id: row.id,
      start_time: row.start_time,
      frequency_hours: row.frequency_hours,
      updated_at: row.updated_at?.toISOString?.() || row.updated_at,
      updated_by: row.updated_by,
    };
  }

  async upsertDemandSchedulerConfig(config: InsertDemandSchedulerConfig & { updated_by?: string }): Promise<DemandSchedulerConfig> {
    // Check if a config already exists
    const existing = await this.getDemandSchedulerConfig();
    
    if (existing) {
      // Update existing config
      const result = await db.execute(sql`
        UPDATE demand_scheduler_config
        SET start_time = ${config.start_time},
            frequency_hours = ${config.frequency_hours},
            updated_at = NOW(),
            updated_by = ${config.updated_by || null}
        WHERE id = ${existing.id}
        RETURNING id, start_time, frequency_hours, updated_at, updated_by
      `);
      
      const row = result.rows[0] as any;
      return {
        id: row.id,
        start_time: row.start_time,
        frequency_hours: row.frequency_hours,
        updated_at: row.updated_at?.toISOString?.() || row.updated_at,
        updated_by: row.updated_by,
      };
    } else {
      // Insert new config
      const result = await db.execute(sql`
        INSERT INTO demand_scheduler_config (start_time, frequency_hours, updated_by)
        VALUES (${config.start_time}, ${config.frequency_hours}, ${config.updated_by || null})
        RETURNING id, start_time, frequency_hours, updated_at, updated_by
      `);
      
      const row = result.rows[0] as any;
      return {
        id: row.id,
        start_time: row.start_time,
        frequency_hours: row.frequency_hours,
        updated_at: row.updated_at?.toISOString?.() || row.updated_at,
        updated_by: row.updated_by,
      };
    }
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
  async getUserStatsRegion(userId: string): Promise<UserStatsRegion | undefined> {
    const [stats] = await db
      .select()
      .from(userStatsRegion)
      .where(eq(userStatsRegion.userId, userId));
    return stats;
  }

  async upsertUserStatsRegion(statsData: InsertUserStatsRegion): Promise<UserStatsRegion> {
    const [stats] = await db
      .insert(userStatsRegion)
      .values(statsData)
      .onConflictDoUpdate({
        target: [userStatsRegion.userId],
        set: {
          ...statsData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return stats;
  }

  async recalculateUserStatsRegion(userId: string): Promise<UserStatsRegion> {
    // Get all completed game attempts for this user in region mode
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
          eq(gameAttemptsRegion.result, 'won')
        )
      )
      .orderBy(questionsAllocatedRegion.puzzleDate);

    // Get lost games
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
      gamesPlayed,
      gamesWon,
      currentStreak,
      maxStreak,
      guessDistribution,
    });
  }

  async getUserPercentileRankingRegion(userId: string): Promise<number> {
    const allUserStats = await db
      .select({
        userId: userStatsRegion.userId,
        gamesWon: userStatsRegion.gamesWon,
      })
      .from(userStatsRegion)
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

  async upsertUserSubscription(subscription: { userId: string; tier: string; autoRenew?: boolean; endDate?: Date | null }): Promise<any> {
    const { userId, tier, autoRenew = true, endDate } = subscription;
    const now = new Date();
    
    try {
      const result = await db.execute(
        sql`INSERT INTO user_subscriptions (user_id, tier, auto_renew, start_date, end_date, updated_at)
            VALUES (${userId}, ${tier}, ${autoRenew}, ${now}, ${endDate}, ${now})
            ON CONFLICT (user_id) 
            DO UPDATE SET tier = ${tier}, auto_renew = ${autoRenew}, end_date = ${endDate}, updated_at = ${now}
            RETURNING *`
      );
      return result.rows?.[0];
    } catch (error: any) {
      // Table might not exist yet
      if (error?.code === '42P01') {
        console.log('Note: user_subscriptions table not available yet');
        return { userId, tier, autoRenew, startDate: now, endDate };
      }
      throw error;
    }
  }

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
}

export const storage = new DatabaseStorage();
