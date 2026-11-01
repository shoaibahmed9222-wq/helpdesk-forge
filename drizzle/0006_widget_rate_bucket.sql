CREATE TABLE "widget_rate_bucket" (
	"bucket_key" text PRIMARY KEY NOT NULL,
	"window_start" bigint NOT NULL,
	"count" integer NOT NULL
);
