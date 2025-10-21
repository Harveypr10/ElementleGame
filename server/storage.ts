import {
  userProfiles,
  puzzles,
  userSettings,
  gameAttempts,
  guesses,
  userStats,
  type UserProfile,
  type InsertUserProfile,
  type Puzzle,
  type InsertPuzzle,
  type UserSettings,
  type InsertUserSettings,
  type GameAttempt,
  type InsertGameAttempt,
  type Guess,
  type InsertGuess,
  type UserStats,
  type InsertUserStats,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, desc } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User profile operations
  getUserProfile(id: string): Promise<UserProfile | undefined>;
  upsertUserProfile(profile: InsertUserProfile): Promise<UserProfile>;

  // Puzzle operations
  getPuzzle(id: number): Promise<Puzzle | undefined>;
  getPuzzleByDate(date: string): Promise<Puzzle | undefined>;
  getAllPuzzles(): Promise<Puzzle[]>;
  getPuzzlesSince(date: string): Promise<Puzzle[]>;
  createPuzzle(puzzle: InsertPuzzle): Promise<Puzzle>;

  // User settings operations
  getUserSettings(userId: string): Promise<UserSettings | undefined>;
  upsertUserSettings(settings: InsertUserSettings): Promise<UserSettings>;

  // Game attempt operations
  getGameAttempt(id: number): Promise<GameAttempt | undefined>;
  getGameAttemptsByUser(userId: string): Promise<GameAttempt[]>;
  getGameAttemptByUserAndPuzzle(userId: string | null, puzzleId: number): Promise<GameAttempt | undefined>;
  createGameAttempt(attempt: InsertGameAttempt): Promise<GameAttempt>;
  updateGameAttempt(id: number, updateData: Partial<Omit<GameAttempt, 'id' | 'userId' | 'puzzleId' | 'startedAt'>>): Promise<GameAttempt>;

  // Guess operations
  getGuessesByGameAttempt(gameAttemptId: number): Promise<Guess[]>;
  createGuess(guess: InsertGuess): Promise<Guess>;
  getRecentGuessesWithPuzzleIds(userId: string, since: string): Promise<Array<Guess & { puzzleId: number }>>;

  // User stats operations
  getUserStats(userId: string): Promise<UserStats | undefined>;
  upsertUserStats(stats: InsertUserStats): Promise<UserStats>;
  recalculateUserStats(userId: string): Promise<UserStats>;

  // Admin export operations
  getAllGameAttemptsForExport(): Promise<any[]>;
}

export class DatabaseStorage implements IStorage {
  // User profile operations
  async getUserProfile(id: string): Promise<UserProfile | undefined> {
    const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.id, id));
    return profile;
  }

  async upsertUserProfile(profileData: InsertUserProfile): Promise<UserProfile> {
    const [profile] = await db
      .insert(userProfiles)
      .values(profileData)
      .onConflictDoUpdate({
        target: userProfiles.id,
        set: {
          ...profileData,
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

  async updateGameAttempt(
    id: number,
    updateData: Partial<Omit<GameAttempt, 'id' | 'userId' | 'puzzleId' | 'startedAt'>>
  ): Promise<GameAttempt> {
    const [attempt] = await db
      .update(gameAttempts)
      .set({
        ...updateData,
        completedAt: updateData.result ? new Date() : undefined,
      })
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
        feedbackResult: guesses.feedbackResult,
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
        target: userStats.userId,
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
    const allCompletedAttempts = [...completedAttempts, ...lostAttempts].sort((a, b) => 
      new Date(b.puzzleDate).getTime() - new Date(a.puzzleDate).getTime()
    );

    let currentStreak = 0;
    let maxStreak = 0;
    let tempStreak = 0;
    
    // Build map of dates to results
    const dateMap = new Map<string, string>();
    for (const attempt of allCompletedAttempts) {
      dateMap.set(attempt.puzzleDate, attempt.result || '');
    }

    // Calculate current streak from today backwards
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let checkDate = new Date(today);
    
    while (true) {
      const dateStr = checkDate.toISOString().split('T')[0];
      const result = dateMap.get(dateStr);
      
      if (!result) break; // No game played this day
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
}

export const storage = new DatabaseStorage();
