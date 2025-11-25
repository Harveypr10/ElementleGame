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

// Postcodes table - UK postcodes for autocomplete
export const postcodes = pgTable("postcodes", {
  id: serial("id").primaryKey(),
  name1: text("name1").notNull().unique(), // The postcode itself (e.g., "SW1A 1AA")
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  name1Idx: index("idx_postcodes_name1").on(table.name1),
}));

export const insertPostcodeSchema = createInsertSchema(postcodes).omit({
  id: true,
  createdAt: true,
});

export type InsertPostcode = z.infer<typeof insertPostcodeSchema>;
export type Postcode = typeof postcodes.$inferSelect;

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
  postcode: text("postcode"), // References postcodes.name1
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

// LEGACY: Puzzles table removed - use questions_master_region and questions_allocated_region instead
// Types kept for backward compatibility in frontend
export type Puzzle = {
  id: number;
  date: string;
  answerDateCanonical: string;
  eventTitle: string;
  eventDescription: string;
  clue1?: string | null;
  clue2?: string | null;
  createdAt?: Date;
};

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
  digitPreference: varchar("digit_preference", { length: 1 }).default("8"), // '6' or '8' for 6-digit vs 8-digit dates
  
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

// LEGACY: Game attempts table removed - use game_attempts_region instead
// Types kept for backward compatibility in frontend
export type GameAttempt = {
  id: number;
  userId?: string | null;
  puzzleId: number;
  result?: string | null;
  numGuesses?: number;
  startedAt?: Date;
  completedAt?: Date | null;
};

// LEGACY: Guesses table removed - use guesses_region instead
// Types kept for backward compatibility in frontend
export type Guess = {
  id: number;
  gameAttemptId: number;
  guessValue: string;
  guessedAt?: Date;
};

// LEGACY: User stats table removed - use user_stats_region instead
// Types kept for backward compatibility in frontend
export type UserStats = {
  id: number;
  userId: string;
  gamesPlayed?: number;
  gamesWon?: number;
  currentStreak?: number;
  maxStreak?: number;
  guessDistribution?: Record<string, number>;
  updatedAt?: Date;
};

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

// ============================================================================
// REGION GAME MODE TABLES
// ============================================================================

// Regions table - Available regions/countries for puzzles
export const regions = pgTable("regions", {
  code: text("code").primaryKey(), // ISO country code (e.g., 'UK', 'US')
  name: text("name").notNull(), // Display name (e.g., 'United Kingdom', 'United States')
  defaultDateFormat: text("default_date_format").notNull(), // Default date format preference (ddmmyy, mmddyy)
});

export const insertRegionSchema = createInsertSchema(regions);

export type InsertRegion = z.infer<typeof insertRegionSchema>;
export type Region = typeof regions.$inferSelect;

// Categories table - Available puzzle categories
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(), // Category name (e.g., 'Science', 'Sports', 'History')
  description: text("description"), // Full details of the category
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;

// Questions master (region) - Canonical question bank for region mode
export const questionsMasterRegion = pgTable("questions_master_region", {
  id: serial("id").primaryKey(),
  answerDateCanonical: date("answer_date_canonical").notNull(), // Canonical historical date (YYYY-MM-DD)
  eventTitle: text("event_title").notNull(),
  eventDescription: text("event_description").notNull(),
  regions: jsonb("regions"), // Regions this question is relevant for
  categories: jsonb("categories").notNull(), // Categories this question belongs to
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertQuestionMasterRegionSchema = createInsertSchema(questionsMasterRegion).omit({
  id: true,
  createdAt: true,
});

export type InsertQuestionMasterRegion = z.infer<typeof insertQuestionMasterRegionSchema>;
export type QuestionMasterRegion = typeof questionsMasterRegion.$inferSelect;

// Questions allocated (region) - Daily puzzle allocations per region
export const questionsAllocatedRegion = pgTable(
  "questions_allocated_region",
  {
    id: serial("id").primaryKey(),
    questionId: integer("question_id").notNull().references(() => questionsMasterRegion.id, { onDelete: "cascade" }),
    region: text("region").notNull(), // ISO country code (e.g., 'GB', 'US')
    puzzleDate: date("puzzle_date").notNull(), // The date this question is allocated for (YYYY-MM-DD)
  },
  (table) => {
    return {
      regionDateUnique: unique().on(table.region, table.puzzleDate),
    };
  }
);

export const insertQuestionAllocatedRegionSchema = createInsertSchema(questionsAllocatedRegion).omit({
  id: true,
});

export type InsertQuestionAllocatedRegion = z.infer<typeof insertQuestionAllocatedRegionSchema>;
export type QuestionAllocatedRegion = typeof questionsAllocatedRegion.$inferSelect;

// Game attempts (region) - User attempts for region mode puzzles
export const gameAttemptsRegion = pgTable(
  "game_attempts_region",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id").references(() => userProfiles.id, { onDelete: "cascade" }), // null for guest users
    allocatedRegionId: integer("allocated_region_id").notNull().references(() => questionsAllocatedRegion.id),
    result: varchar("result", { length: 10 }), // 'won' or 'lost' - null for in-progress
    numGuesses: integer("num_guesses").default(0),
    digits: varchar("digits", { length: 1 }), // '6' or '8' - locked on first guess
    startedAt: timestamp("started_at").defaultNow(),
    completedAt: timestamp("completed_at"), // null for in-progress games
  },
  (table) => {
    return {
      userAllocatedUnique: unique().on(table.userId, table.allocatedRegionId),
    };
  }
);

export const insertGameAttemptRegionSchema = createInsertSchema(gameAttemptsRegion).omit({
  id: true,
  startedAt: true,
  completedAt: true,
});

export type InsertGameAttemptRegion = z.infer<typeof insertGameAttemptRegionSchema>;
export type GameAttemptRegion = typeof gameAttemptsRegion.$inferSelect;

// Guesses (region) - Individual guesses for region mode
export const guessesRegion = pgTable("guesses_region", {
  id: serial("id").primaryKey(),
  gameAttemptId: integer("game_attempt_id").notNull().references(() => gameAttemptsRegion.id, { onDelete: "cascade" }),
  guessValue: varchar("guess_value", { length: 8 }).notNull(), // Date string in user's format (DDMMYY or DDMMYYYY)
  guessedAt: timestamp("guessed_at").defaultNow(),
});

export const insertGuessRegionSchema = createInsertSchema(guessesRegion).omit({
  id: true,
  guessedAt: true,
});

export type InsertGuessRegion = z.infer<typeof insertGuessRegionSchema>;
export type GuessRegion = typeof guessesRegion.$inferSelect;

// User stats (region) - Aggregated statistics for region mode
export const userStatsRegion = pgTable("user_stats_region", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull().unique().references(() => userProfiles.id, { onDelete: "cascade" }),
  gamesPlayed: integer("games_played").default(0),
  gamesWon: integer("games_won").default(0),
  currentStreak: integer("current_streak").default(0),
  maxStreak: integer("max_streak").default(0),
  guessDistribution: jsonb("guess_distribution").default({ "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 }), // JSON object tracking wins by guess count
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserStatsRegionSchema = createInsertSchema(userStatsRegion).omit({
  id: true,
  updatedAt: true,
});

export type InsertUserStatsRegion = z.infer<typeof insertUserStatsRegionSchema>;
export type UserStatsRegion = typeof userStatsRegion.$inferSelect;

// ============================================================================
// USER GAME MODE TABLES
// ============================================================================

// Populated places - Location data for Local History category
export const populatedPlaces = pgTable("populated_places", {
  id: varchar("id", { length: 50 }).primaryKey(), // String ID from external source
  name1: text("name1"), // Primary place name (e.g., "Henley-on-Thames")
});

export type PopulatedPlace = typeof populatedPlaces.$inferSelect;

// Questions master (user) - Canonical question bank for user mode
export const questionsMasterUser = pgTable("questions_master_user", {
  id: serial("id").primaryKey(),
  answerDateCanonical: date("answer_date_canonical").notNull(), // Canonical historical date (YYYY-MM-DD)
  eventTitle: text("event_title").notNull(),
  eventDescription: text("event_description").notNull(),
  regions: jsonb("regions"), // Regions this question is relevant for
  categories: jsonb("categories").notNull(), // Categories this question belongs to
  populatedPlaceId: varchar("populated_place_id", { length: 50 }), // Link to populated_places for Local History
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertQuestionMasterUserSchema = createInsertSchema(questionsMasterUser).omit({
  id: true,
  createdAt: true,
});

export type InsertQuestionMasterUser = z.infer<typeof insertQuestionMasterUserSchema>;
export type QuestionMasterUser = typeof questionsMasterUser.$inferSelect;

// Questions allocated (user) - Daily puzzle allocations per user
export const questionsAllocatedUser = pgTable(
  "questions_allocated_user",
  {
    id: serial("id").primaryKey(),
    questionId: integer("question_id").notNull().references(() => questionsMasterUser.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => userProfiles.id, { onDelete: "cascade" }),
    puzzleDate: date("puzzle_date").notNull(), // The date this question is allocated for (YYYY-MM-DD)
    categoryId: integer("category_id").notNull(), // Category ID for this puzzle
  },
  (table) => {
    return {
      userDateUnique: unique().on(table.userId, table.puzzleDate),
    };
  }
);

export const insertQuestionAllocatedUserSchema = createInsertSchema(questionsAllocatedUser).omit({
  id: true,
});

export type InsertQuestionAllocatedUser = z.infer<typeof insertQuestionAllocatedUserSchema>;
export type QuestionAllocatedUser = typeof questionsAllocatedUser.$inferSelect;

// Game attempts (user) - User attempts for user mode puzzles
export const gameAttemptsUser = pgTable(
  "game_attempts_user",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => userProfiles.id, { onDelete: "cascade" }),
    allocatedUserId: integer("allocated_user_id").notNull().references(() => questionsAllocatedUser.id),
    result: varchar("result", { length: 10 }), // 'won' or 'lost' - null for in-progress
    numGuesses: integer("num_guesses").default(0),
    digits: varchar("digits", { length: 1 }), // '6' or '8' - locked on first guess
    startedAt: timestamp("started_at").defaultNow(),
    completedAt: timestamp("completed_at"), // null for in-progress games
  },
  (table) => {
    return {
      userAllocatedUnique: unique().on(table.userId, table.allocatedUserId),
    };
  }
);

export const insertGameAttemptUserSchema = createInsertSchema(gameAttemptsUser).omit({
  id: true,
  startedAt: true,
  completedAt: true,
});

export type InsertGameAttemptUser = z.infer<typeof insertGameAttemptUserSchema>;
export type GameAttemptUser = typeof gameAttemptsUser.$inferSelect;

// Guesses (user) - Individual guesses for user mode
export const guessesUser = pgTable("guesses_user", {
  id: serial("id").primaryKey(),
  gameAttemptId: integer("game_attempt_id").notNull().references(() => gameAttemptsUser.id, { onDelete: "cascade" }),
  guessValue: varchar("guess_value", { length: 10 }).notNull(), // Date string in user's format (DDMMYY or DDMMYYYY)
  guessedAt: timestamp("guessed_at").defaultNow(),
});

export const insertGuessUserSchema = createInsertSchema(guessesUser).omit({
  id: true,
  guessedAt: true,
});

export type InsertGuessUser = z.infer<typeof insertGuessUserSchema>;
export type GuessUser = typeof guessesUser.$inferSelect;

// User stats (user) - Aggregated statistics for user mode
export const userStatsUser = pgTable("user_stats_user", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull().unique().references(() => userProfiles.id, { onDelete: "cascade" }),
  gamesPlayed: integer("games_played").default(0),
  gamesWon: integer("games_won").default(0),
  currentStreak: integer("current_streak").default(0),
  maxStreak: integer("max_streak").default(0),
  guessDistribution: jsonb("guess_distribution").default({ "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 }), // JSON object tracking wins by guess count
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserStatsUserSchema = createInsertSchema(userStatsUser).omit({
  id: true,
  updatedAt: true,
});

export type InsertUserStatsUser = z.infer<typeof insertUserStatsUserSchema>;
export type UserStatsUser = typeof userStatsUser.$inferSelect;
