import {
  users,
  puzzles,
  userSettings,
  gameAttempts,
  guesses,
  userStats,
  type User,
  type UpsertUser,
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
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

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

  // Guess operations
  getGuessesByGameAttempt(gameAttemptId: number): Promise<Guess[]>;
  createGuess(guess: InsertGuess): Promise<Guess>;

  // User stats operations
  getUserStats(userId: string): Promise<UserStats | undefined>;
  upsertUserStats(stats: InsertUserStats): Promise<UserStats>;

  // Admin export operations
  getAllGameAttemptsForExport(): Promise<any[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations (mandatory for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
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
    const [settings] = await db
      .insert(userSettings)
      .values(settingsData)
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: {
          ...settingsData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return settings;
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
