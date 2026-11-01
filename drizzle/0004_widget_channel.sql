ALTER TABLE "conversation" ADD COLUMN "channel" text DEFAULT 'email' NOT NULL;--> statement-breakpoint
ALTER TABLE "conversation" ADD COLUMN "visitor_session_id" text;--> statement-breakpoint
ALTER TABLE "workspace" ADD COLUMN "widget_title" text;--> statement-breakpoint
ALTER TABLE "workspace" ADD COLUMN "widget_greeting" text;--> statement-breakpoint
ALTER TABLE "workspace" ADD COLUMN "widget_accent" text;--> statement-breakpoint
ALTER TABLE "workspace" ADD COLUMN "widget_allowed_domains" text;--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_widget_session_unique" ON "conversation" USING btree ("workspace_id","visitor_session_id") WHERE "conversation"."visitor_session_id" is not null;