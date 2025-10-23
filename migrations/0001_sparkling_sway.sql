ALTER TABLE "user_profiles" ADD COLUMN "accepted_terms" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "ads_consent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "email_verified";