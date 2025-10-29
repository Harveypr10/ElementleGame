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
  uuid,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User profiles table - extends Supabase Auth users
// References auth.users(id) from Supabase Auth
export const userProfiles = pgTable("user_profiles", {
  id: uuid("id").primaryKey(),
  email: varchar("email").notNull(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  isAdmin: boolean("is_admin").default(false),

  // Current consent flags
  acceptedTerms: boolean("accepted_terms").notNull().default(false),
  adsConsent: boolean("ads_consent").notNull().default(false),

  // Audit timestamps (keep these)
  acceptedTermsAt: timestamp("accepted_terms_at", { withTimezone: true }),
  adsConsentUpdatedAt: timestamp("ads_consent_updated_at", { withTimezone: true }),

  // Email verification mirror from Supabase Auth
  emailVerified: boolean("email_verified").default(false),

  // Region and location fields
  region: text("region"), // ISO country code (e.g., 'GB', 'US')
  postcode: text("postcode"),
  location: text("location"), // Stored as text for now (will be geometry later if needed)

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserProfileSchema = createInsertSchema(userProfiles)
.omit({
  createdAt: true,
  updatedAt: true,
})
.extend({
  acceptedTermsAt: z.date().optional().nullable(),
  adsConsentUpdatedAt: z.date().optional().nullable(),
  emailVerified: z.boolean().optional(),
});


export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type UserProfile = typeof userProfiles.$inferSelect;

// Puzzles table - LEGACY - kept for backward compatibility
// New region mode uses questions_master_region and questions_allocated_region
export const puzzles = pgTable("puzzles", {
  id: serial("id").primaryKey(),
  date: date("date").notNull().unique(), // YYYY-MM-DD format - puzzle availability date
  answerDateCanonical: date("answer_date_canonical").notNull(), // Canonical historical date (YYYY-MM-DD format)
  targetDate: varchar("target_date", { length: 6 }).notNull(), // DDMMYY format - LEGACY, will be removed
  answerDate: varchar("answer_date", { length: 20 }), // DD/MM/YYYY format - LEGACY, will be removed
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

// REGION MODE TABLES - New question pipeline for region-specific daily puzzles

// Categories table for organizing questions
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
  createdAt: true,
});

export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;

// Master question bank for region mode
export const questionsMasterRegion = pgTable("questions_master_region", {
  id: serial("id").primaryKey(),
  answerDateCanonical: date("answer_date_canonical").notNull(), // Historical date (YYYY-MM-DD format)
  eventTitle: varchar("event_title", { length: 200 }).notNull(),
  eventDescription: text("event_description").notNull(),
  clue1: text("clue1"), // First clue shown after 2nd incorrect guess
  clue2: text("clue2"), // Second clue shown after 4th incorrect guess
  categoryId: integer("category_id").references(() => categories.id),
  isActive: boolean("is_active").default(true), // Can be deactivated without deletion
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertQuestionMasterRegionSchema = createInsertSchema(questionsMasterRegion).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertQuestionMasterRegion = z.infer<typeof insertQuestionMasterRegionSchema>;
export type QuestionMasterRegion = typeof questionsMasterRegion.$inferSelect;

// Daily question allocations for region mode
export const questionsAllocatedRegion = pgTable(
  "questions_allocated_region",
  {
    id: serial("id").primaryKey(),
    questionId: integer("question_id").notNull().references(() => questionsMasterRegion.id),
    region: text("region").notNull(), // ISO country code (e.g., 'GB', 'US')
    allocatedDate: date("allocated_date").notNull(), // YYYY-MM-DD format - puzzle availability date
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => {
    return {
      regionDateUnique: unique().on(table.region, table.allocatedDate),
    };
  }
);

export const insertQuestionAllocatedRegionSchema = createInsertSchema(questionsAllocatedRegion).omit({
  id: true,
  createdAt: true,
});

export type InsertQuestionAllocatedRegion = z.infer<typeof insertQuestionAllocatedRegionSchema>;
export type QuestionAllocatedRegion = typeof questionsAllocatedRegion.$inferSelect;

// User settings table - stores preferences per user
export const userSettings = pgTable("user_settings", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull().unique().references(() => userProfiles.id, { onDelete: "cascade" }),
  textSize: varchar("text_size", { length: 20 }).default("medium"), // small, medium, large
  soundsEnabled: boolean("sounds_enabled").default(true),
  darkMode: boolean("dark_mode").default(false),
  cluesEnabled: boolean("clues_enabled").default(true),
  
  // Date format preferences
  dateFormatPreference: text("date_format_preference").default("ddmmyy"), // ddmmyy, mmddyy, ddmmyyyy, mmddyyyy
  useRegionDefault: boolean("use_region_default").default(true), // Auto-detect from region
  digitPreference: varchar("digit_preference", { length: 1 }).default("6"), // '6' or '8' for 6-digit vs 8-digit dates
  
  // Category preferences (for future use)
  categoryPreferences: jsonb("category_preferences"),
  
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSettingsSchema = createInsertSchema(userSettings).omit({
  id: true,
  updatedAt: true,
});

export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;
export type UserSettings = typeof userSettings.$inferSelect;

// Game attempts table - tracks each game session
export const gameAttempts = pgTable(
  "game_attempts",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id").references(() => userProfiles.id, { onDelete: "cascade" }), // null for guest users
    puzzleId: integer("puzzle_id").notNull().references(() => puzzles.id),
    result: varchar("result", { length: 10 }), // 'won' or 'lost' - null for in-progress
    numGuesses: integer("num_guesses").default(0),
    startedAt: timestamp("started_at").defaultNow(),
    completedAt: timestamp("completed_at"), // null for in-progress games
  },
  (table) => {
    return {
      userPuzzleUnique: unique().on(table.userId, table.puzzleId),
    };
  }
);

export const insertGameAttemptSchema = createInsertSchema(gameAttempts).omit({
  id: true,
  startedAt: true,
  completedAt: true,
});

export type InsertGameAttempt = z.infer<typeof insertGameAttemptSchema>;
export type GameAttempt = typeof gameAttempts.$inferSelect;

// Guesses table - logs individual guesses for governance
export const guesses = pgTable("guesses", {
  id: serial("id").primaryKey(),
  gameAttemptId: integer("game_attempt_id").notNull().references(() => gameAttempts.id, { onDelete: "cascade" }),
  guessValue: varchar("guess_value", { length: 6 }).notNull(), // DDMMYY format - stored as date string
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
  userId: uuid("user_id").notNull().unique().references(() => userProfiles.id, { onDelete: "cascade" }),
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

// User subscriptions table - tracks Pro/Free tier status
// Note: This table may already exist in database from previous manual operations
// TODO: Align schema with existing table structure if needed
export const userSubscriptions = pgTable("user_subscriptions", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull().unique().references(() => userProfiles.id, { onDelete: "cascade" }),
  tier: varchar("tier", { length: 20 }).notNull().default("free"), // 'free' or 'pro'
  startDate: timestamp("start_date").defaultNow(),
  endDate: timestamp("end_date"), // null for free tier or active subscriptions
  autoRenew: boolean("auto_renew").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSubscriptionSchema = createInsertSchema(userSubscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUserSubscription = z.infer<typeof insertUserSubscriptionSchema>;
export type UserSubscription = typeof userSubscriptions.$inferSelect;
