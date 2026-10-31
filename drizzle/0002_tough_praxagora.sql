ALTER TABLE "workspace" ADD COLUMN "public_key" text;--> statement-breakpoint
UPDATE "workspace" SET "public_key" = 'pk_' || replace(gen_random_uuid()::text, '-', '') WHERE "public_key" IS NULL;--> statement-breakpoint
ALTER TABLE "workspace" ALTER COLUMN "public_key" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace" ADD COLUMN "llm_provider" text;--> statement-breakpoint
ALTER TABLE "workspace" ADD COLUMN "llm_model" text;--> statement-breakpoint
ALTER TABLE "workspace" ADD COLUMN "llm_base_url" text;--> statement-breakpoint
ALTER TABLE "workspace" ADD COLUMN "llm_api_key" text;--> statement-breakpoint
ALTER TABLE "workspace" ADD CONSTRAINT "workspace_public_key_unique" UNIQUE("public_key");