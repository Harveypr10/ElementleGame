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
  numeric,
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

// Pro Subscription tiers (legacy enum kept for backward compatibility)
export const ProTierEnum = z.enum(['free', 'bronze', 'silver', 'gold', 'standard', 'pro_monthly', 'pro_annual', 'pro_lifetime']);
export type ProTier = z.infer<typeof ProTierEnum>;

// User Tier table - defines available subscription tiers per region
// This table is managed in Supabase and defines tier metadata
// Unique constraint: (region, tier, tier_type)
export const userTier = pgTable("user_tier", {
  id: uuid("id").primaryKey(),
  region: text("region").notNull(), // e.g., 'UK', 'US'
  tier: text("tier").notNull(), // e.g., 'Standard', 'Pro', 'Education'
  tierType: text("tier_type").notNull().default("default"), // e.g., 'default', 'monthly', 'annual', 'lifetime'
  subscriptionCost: numeric("subscription_cost", { precision: 10, scale: 2 }), // Cost in currency (e.g., 11.99)
  currency: text("currency").default("GBP"), // e.g., 'GBP', 'USD'
  subscriptionDurationMonths: integer("subscription_duration_months").default(1), // null for lifetime
  streakSavers: integer("streak_savers").default(1),
  holidaySavers: integer("holiday_savers").default(0),
  holidayDurationDays: integer("holiday_duration_days").default(14),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  active: boolean("active").default(true),
  description: text("description"),
  sortOrder: integer("sort_order"),
});

export type UserTier = typeof userTier.$inferSelect;
export type InsertUserTier = typeof userTier.$inferInsert;

// LEGACY: Type for user_active_tier_view - deprecated, use SubscriptionResponse instead
export interface UserActiveTier {
  userId: string;
  tierId: string;
  tier: string;
  region: string;
  subscriptionCost: number | null;
  currency: string | null;
  subscriptionDurationMonths: number | null;
  streakSavers: number;
  holidaySavers: number;
  holidayDurationDays: number;
  description: string | null;
  expiresAt: string | null;
  autoRenew: boolean;
  isActive: boolean;
}

// New subscription response interface - reads from user_profiles + user_tier
export interface SubscriptionResponse {
  tier: 'free' | 'pro'; // Display tier: 'pro' if tier != 'Standard', else 'free'
  tierName: string; // Canonical tier name from user_tier.tier (e.g., 'Standard', 'Pro')
  tierType: 'monthly' | 'annual' | 'lifetime' | 'default'; // Variant from user_tier.tier_type
  tierId: string | null; // FK from user_profiles.user_tier_id
  userId: string | null; // From user_profiles.id (null if no user profile found)
  endDate: string | null; // From user_profiles.subscription_end_date
  autoRenew: boolean; // From latest user_subscriptions.auto_renew
  isActive: boolean; // Derived: endDate > now() or (endDate is null and tierType is lifetime)
  isExpired: boolean; // Derived: endDate is not null and < now()
  metadata: {
    streakSavers: number;
    holidaySavers: number;
    holidayDurationDays: number;
    subscriptionCost: number | null;
    currency: string;
    subscriptionDurationMonths: number | null;
    description: string | null;
    sortOrder: number | null;
  } | null;
}

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
  region: text("region").default("UK"), // ISO country code (e.g., 'UK', 'US')
  postcode: text("postcode"), // References postcodes.name1
  location: text("location"), // Geography type stored as text
  
  // Postcode change tracking
  postcodeLastChangedAt: timestamp("postcode_last_changed_at", { withTimezone: true }),
  
  // Category change tracking (Pro users)
  categoriesLastChangedAt: timestamp("categories_last_changed_at", { withTimezone: true }),
  
  // Archive puzzle sync count
  archiveSyncedCount: integer("archive_synced_count").default(0),
  
  // Authentication method tracking
  // signup_method: how user first signed up ('password', 'magic_link', 'google', 'apple')
  signupMethod: text("signup_method"), // null until first login recorded
  // password_created: whether user has created a password (true if signed up with password or created one later)
  passwordCreated: boolean("password_created").default(false),
  // OAuth provider linking status:
  // NULL = Not signed up with this provider yet
  // TRUE = Authorized and linked
  // FALSE = Authorized but requested to be unlinked
  googleLinked: boolean("google_linked"),
  appleLinked: boolean("apple_linked"),
  
  // Foreign key to user_tier table (managed by Supabase trigger)
  userTierId: uuid("user_tier_id").references(() => userTier.id),
  
  // Subscription end date - null means Standard tier or lifetime subscription
  // Managed by Supabase trigger (sync_user_profile_user_tier_id_and_end_date)
  subscriptionEndDate: timestamp("subscription_end_date", { withTimezone: true }),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  regionIdx: index("idx_user_profiles_region").on(table.region),
}));

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

// User Subscriptions table - stores active user subscriptions
// References user_tier for tier metadata, managed by Supabase triggers
// Note: 'validity' column is GENERATED ALWAYS (tstzrange) - not in Drizzle schema
export const userSubscriptions = pgTable("user_subscriptions", {
  id: serial("id").primaryKey(), // Database uses serial integer, not UUID
  userId: uuid("user_id").notNull().references(() => userProfiles.id, { onDelete: "cascade" }),
  userTierId: uuid("user_tier_id").references(() => userTier.id), // Nullable in Supabase
  createdAt: timestamp("created_at").defaultNow(), // No timezone in Supabase
  amountPaid: numeric("amount_paid", { precision: 10, scale: 2 }), // numeric(10,2) in Supabase
  currency: text("currency").default("GBP"),
  expiresAt: timestamp("expires_at"), // No timezone in Supabase
  paymentReference: text("payment_reference"),
  source: text("source"), // e.g., 'stripe', 'apple', 'google'
  effectiveStartAt: timestamp("effective_start_at", { withTimezone: true }).defaultNow(),
  tier: text("tier"), // 'school', 'trial', 'pro' - nullable
  autoRenew: boolean("auto_renew").notNull().default(true), // Defaults true in Supabase
});

export const insertUserSubscriptionSchema = createInsertSchema(userSubscriptions).omit({
  id: true,
  createdAt: true,
});

export type InsertUserSubscription = z.infer<typeof insertUserSubscriptionSchema>;
export type UserSubscription = typeof userSubscriptions.$inferSelect;

// User Pro Categories table - stores selected categories for Pro users
// Note: This table needs to be created in Supabase SQL editor
// CREATE TABLE user_pro_categories (
//   id SERIAL PRIMARY KEY,
//   user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
//   category_id INTEGER NOT NULL,
//   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
//   UNIQUE(user_id, category_id)
// );
export const userProCategories = pgTable("user_pro_categories", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => userProfiles.id, { onDelete: "cascade" }),
  categoryId: integer("category_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  userCategoryUnique: unique().on(table.userId, table.categoryId),
}));

export const insertUserProCategorySchema = createInsertSchema(userProCategories).omit({
  id: true,
  createdAt: true,
});

export type InsertUserProCategory = z.infer<typeof insertUserProCategorySchema>;
export type UserProCategory = typeof userProCategories.$inferSelect;

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
  soundsEnabled: boolean("sounds_enabled").default(false),
  darkMode: boolean("dark_mode").default(false),
  cluesEnabled: boolean("clues_enabled").default(true),
  
  // Date format preferences
  dateFormatPreference: text("date_format_preference").default("ddmmyy"), // ddmmyy, mmddyy, ddmmyyyy, mmddyyyy
  useRegionDefault: boolean("use_region_default").default(true), // Auto-detect from region
  digitPreference: varchar("digit_preference", { length: 1 }).default("8"), // '6' or '8' for 6-digit vs 8-digit dates
  
  // Category preferences (for future use)
  categoryPreferences: jsonb("category_preferences"),
  
  // Streak saver preferences
  streakSaverActive: boolean("streak_saver_active").default(true), // Toggle for streak saver popup workflow
  holidaySaverActive: boolean("holiday_saver_active").default(true), // Toggle for holiday protection (Pro/Education only)
  
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
    streakDayStatus: integer("streak_day_status"), // 0 = holiday (maintains streak), 1 = played (increments streak), NULL = missed (breaks streak)
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
// Each user can have one stats row per region (e.g., UK, US) to preserve history when changing regions
export const userStatsRegion = pgTable("user_stats_region", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => userProfiles.id, { onDelete: "cascade" }),
  region: text("region").notNull().default("UK"), // Region code (e.g., 'UK', 'US') - defaults to UK for existing data
  gamesPlayed: integer("games_played").default(0),
  gamesWon: integer("games_won").default(0),
  currentStreak: integer("current_streak").default(0),
  maxStreak: integer("max_streak").default(0),
  guessDistribution: jsonb("guess_distribution").default({ "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 }), // JSON object tracking wins by guess count
  // Streak saver fields (managed by nightly cron and API endpoints)
  streakSaversUsedMonth: integer("streak_savers_used_month").default(0),
  missedYesterdayFlagRegion: boolean("missed_yesterday_flag_region").default(false), // Tracks missed region puzzles
  // Cumulative monthly percentile score (updated by badge check logic)
  cumulativeMonthlyPercentile: integer("cumulative_monthly_percentile"),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Unique constraint on (user_id, region) to allow one stats row per user per region
  userIdRegionIdx: unique("user_stats_region_user_id_region_unique").on(table.userId, table.region),
}));

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
    streakDayStatus: integer("streak_day_status"), // 0 = holiday (maintains streak), 1 = played (increments streak), NULL = missed (breaks streak)
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
  // Streak saver and holiday fields (managed by nightly cron and API endpoints)
  streakSaversUsedMonth: integer("streak_savers_used_month").default(0),
  holidayActive: boolean("holiday_active").default(false),
  holidayStartDate: date("holiday_start_date"),
  holidayEndDate: date("holiday_end_date"),
  holidayDaysTakenCurrentPeriod: integer("holiday_days_taken_current_period").default(0), // Days taken in current holiday period
  holidayEnded: boolean("holiday_ended").default(false), // Set by cron when max days reached (auto-ended)
  holidaysUsedYear: integer("holidays_used_year").default(0), // Number of holidays used this year
  nextHolidayResetDate: date("next_holiday_reset_date"), // Date when holiday allowance resets
  missedYesterdayFlagUser: boolean("missed_yesterday_flag_user").default(false), // Tracks missed user puzzles
  // Cumulative monthly percentile score (updated by badge check logic)
  cumulativeMonthlyPercentile: integer("cumulative_monthly_percentile"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserStatsUserSchema = createInsertSchema(userStatsUser).omit({
  id: true,
  updatedAt: true,
});

export type InsertUserStatsUser = z.infer<typeof insertUserStatsUserSchema>;
export type UserStatsUser = typeof userStatsUser.$inferSelect;

// User Holiday Events - Tracks annual holiday usage for Pro users
export const userHolidayEvents = pgTable("user_holiday_events", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => userProfiles.id, { onDelete: "cascade" }),
  mode: varchar("mode", { length: 10 }).notNull(), // 'region' or 'user'
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const insertUserHolidayEventSchema = createInsertSchema(userHolidayEvents).omit({
  id: true,
  createdAt: true,
});

export type InsertUserHolidayEvent = z.infer<typeof insertUserHolidayEventSchema>;
export type UserHolidayEvent = typeof userHolidayEvents.$inferSelect;

// Badges table - defines available badges
export const badges = pgTable("badges", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  category: varchar("category", { length: 50 }).notNull(), // 'elementle', 'streak', 'percentile'
  threshold: integer("threshold").notNull(), // numeric condition (1, 2 for elementle; 7, 14, etc. for streak; 50, 40, etc. for percentile)
  iconUrl: text("icon_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const insertBadgeSchema = createInsertSchema(badges).omit({
  id: true,
  createdAt: true,
});

export type InsertBadge = z.infer<typeof insertBadgeSchema>;
export type Badge = typeof badges.$inferSelect;

// User Badges table - tracks badges earned by users
export const userBadges = pgTable("user_badges", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => userProfiles.id, { onDelete: "cascade" }),
  badgeId: integer("badge_id").notNull().references(() => badges.id, { onDelete: "cascade" }),
  isAwarded: boolean("is_awarded").notNull().default(false), // false until shown in popup, true after
  region: varchar("region", { length: 20 }).notNull().default("GLOBAL"), // 'GLOBAL' for User game, region code for Region game
  gameType: varchar("game_type", { length: 20 }).notNull().default("USER"), // 'USER' or 'REGION'
  awardedAt: timestamp("awarded_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  userIdIdx: index("idx_user_badges_user_id").on(table.userId),
  badgeIdIdx: index("idx_user_badges_badge_id").on(table.badgeId),
}));

export const insertUserBadgeSchema = createInsertSchema(userBadges).omit({
  id: true,
  awardedAt: true,
});

export type InsertUserBadge = z.infer<typeof insertUserBadgeSchema>;
export type UserBadge = typeof userBadges.$inferSelect;

// Type for user badge with badge details joined
export interface UserBadgeWithDetails extends UserBadge {
  badge: Badge;
}

// Admin Settings table - stores configurable system settings
export const adminSettings = pgTable("admin_settings", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: uuid("updated_by").references(() => userProfiles.id),
});

export const insertAdminSettingSchema = createInsertSchema(adminSettings).omit({
  id: true,
  updatedAt: true,
});

export type InsertAdminSetting = z.infer<typeof insertAdminSettingSchema>;
export type AdminSetting = typeof adminSettings.$inferSelect;

// Demand Scheduler Config - stored in Supabase (not via Drizzle)
// This table must be created in Supabase SQL editor:
// create table public.demand_scheduler_config (
//   id uuid primary key default gen_random_uuid(),
//   start_time text not null, -- format 'HH:mm'
//   frequency_hours integer not null check (frequency_hours > 0),
//   updated_at timestamp with time zone default now(),
//   updated_by uuid references user_profiles(id)
// );
export const demandSchedulerConfigSchema = z.object({
  id: z.string().uuid(),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, "Must be in HH:mm format"),
  frequency_hours: z.number().int().positive(),
  updated_at: z.string().optional(),
  updated_by: z.string().uuid().optional().nullable(),
});

export type DemandSchedulerConfig = z.infer<typeof demandSchedulerConfigSchema>;

export const insertDemandSchedulerConfigSchema = demandSchedulerConfigSchema.omit({
  id: true,
  updated_at: true,
});

export type InsertDemandSchedulerConfig = z.infer<typeof insertDemandSchedulerConfigSchema>;
