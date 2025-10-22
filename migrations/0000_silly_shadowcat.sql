CREATE TABLE "game_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"puzzle_id" integer NOT NULL,
	"result" varchar(10),
	"num_guesses" integer DEFAULT 0,
	"started_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	CONSTRAINT "game_attempts_user_id_puzzle_id_unique" UNIQUE("user_id","puzzle_id")
);
--> statement-breakpoint
CREATE TABLE "guesses" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_attempt_id" integer NOT NULL,
	"guess_value" varchar(6) NOT NULL,
	"feedback_result" jsonb NOT NULL,
	"guessed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "puzzles" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"target_date" varchar(6) NOT NULL,
	"answer_date" varchar(20),
	"event_title" varchar(200) NOT NULL,
	"event_description" text NOT NULL,
	"clue1" text,
	"clue2" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "puzzles_date_unique" UNIQUE("date")
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" varchar NOT NULL,
	"first_name" varchar,
	"last_name" varchar,
	"email_verified" boolean DEFAULT false,
	"is_admin" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"text_size" varchar(20) DEFAULT 'medium',
	"sounds_enabled" boolean DEFAULT true,
	"dark_mode" boolean DEFAULT false,
	"clues_enabled" boolean DEFAULT true,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "user_settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"games_played" integer DEFAULT 0,
	"games_won" integer DEFAULT 0,
	"current_streak" integer DEFAULT 0,
	"max_streak" integer DEFAULT 0,
	"guess_distribution" jsonb DEFAULT '{"1":0,"2":0,"3":0,"4":0,"5":0}'::jsonb,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "user_stats_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "game_attempts" ADD CONSTRAINT "game_attempts_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_attempts" ADD CONSTRAINT "game_attempts_puzzle_id_puzzles_id_fk" FOREIGN KEY ("puzzle_id") REFERENCES "public"."puzzles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guesses" ADD CONSTRAINT "guesses_game_attempt_id_game_attempts_id_fk" FOREIGN KEY ("game_attempt_id") REFERENCES "public"."game_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_stats" ADD CONSTRAINT "user_stats_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;