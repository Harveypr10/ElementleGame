import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  index,
  jsonb,
  integer,
  boolean,
  date,
  serial,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// User storage table for Replit Auth
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  isAdmin: boolean("is_admin").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Puzzles table - contains historical events with dates and clues
export const puzzles = pgTable("puzzles", {
  id: serial("id").primaryKey(),
  date: date("date").notNull().unique(), // YYYY-MM-DD format
  targetDate: varchar("target_date", { length: 6 }).notNull(), // DDMMYY format
  eventTitle: varchar("event_title", { length: 200 }).notNull(),
  eventDescription: text("event_description").notNull(),
  clue1: text("clue1"), // First clue shown after 2nd incorrect guess
  clue2: text("clue2"), // Second clue shown after 4th incorrect guess
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPuzzleSchema = createInsertSchema(puzzles).omit({
  id: true,
  createdAt: true,
});

export type InsertPuzzle = z.infer<typeof insertPuzzleSchema>;
export type Puzzle = typeof puzzles.$inferSelect;

// User settings table - stores preferences per user
export const userSettings = pgTable("user_settings", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  textSize: varchar("text_size", { length: 20 }).default("medium"), // small, medium, large
  soundsEnabled: boolean("sounds_enabled").default(true),
  darkMode: boolean("dark_mode").default(false),
  cluesEnabled: boolean("clues_enabled").default(true),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSettingsSchema = createInsertSchema(userSettings).omit({
  id: true,
  updatedAt: true,
});

export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;
export type UserSettings = typeof userSettings.$inferSelect;

// Game attempts table - tracks each game session
export const gameAttempts = pgTable("game_attempts", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }), // null for guest users
  puzzleId: integer("puzzle_id").notNull().references(() => puzzles.id),
  result: varchar("result", { length: 10 }).notNull(), // 'win' or 'loss'
  numGuesses: integer("num_guesses").notNull(),
  completedAt: timestamp("completed_at").defaultNow(),
});

export const insertGameAttemptSchema = createInsertSchema(gameAttempts).omit({
  id: true,
  completedAt: true,
});

export type InsertGameAttempt = z.infer<typeof insertGameAttemptSchema>;
export type GameAttempt = typeof gameAttempts.$inferSelect;

// Guesses table - logs individual guesses for governance
export const guesses = pgTable("guesses", {
  id: serial("id").primaryKey(),
  gameAttemptId: integer("game_attempt_id").notNull().references(() => gameAttempts.id, { onDelete: "cascade" }),
  guessValue: varchar("guess_value", { length: 6 }).notNull(), // DDMMYY format
  feedbackResult: jsonb("feedback_result").notNull(), // Array of CellFeedback objects
  guessedAt: timestamp("guessed_at").defaultNow(),
});

export const insertGuessSchema = createInsertSchema(guesses).omit({
  id: true,
  guessedAt: true,
});

export type InsertGuess = z.infer<typeof insertGuessSchema>;
export type Guess = typeof guesses.$inferSelect;

// User stats table - aggregated statistics per user
export const userStats = pgTable("user_stats", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  gamesPlayed: integer("games_played").default(0),
  gamesWon: integer("games_won").default(0),
  currentStreak: integer("current_streak").default(0),
  maxStreak: integer("max_streak").default(0),
  guessDistribution: jsonb("guess_distribution").default({ "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 }), // JSON object tracking wins by guess count
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserStatsSchema = createInsertSchema(userStats).omit({
  id: true,
  updatedAt: true,
});

export type InsertUserStats = z.infer<typeof insertUserStatsSchema>;
export type UserStats = typeof userStats.$inferSelect;
