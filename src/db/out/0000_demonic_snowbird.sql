CREATE TABLE "todos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" varchar(500) NOT NULL,
	"week_number" integer,
	"done" boolean DEFAULT false NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"device_id" varchar(255)
);

CREATE INDEX IF NOT EXISTS "idx_todos_week_number" ON "todos" ("week_number");
CREATE INDEX IF NOT EXISTS "idx_todos_done" ON "todos" ("done");
CREATE INDEX IF NOT EXISTS "idx_todos_archived" ON "todos" ("archived");
CREATE INDEX IF NOT EXISTS "idx_todos_device_id" ON "todos" ("device_id");
