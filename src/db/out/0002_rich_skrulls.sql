ALTER TABLE "todos" ADD COLUMN "user_id" uuid;--> statement-breakpoint
CREATE INDEX "idx_todos_user_id" ON "todos" USING btree ("user_id");--> statement-breakpoint
DROP INDEX IF EXISTS "idx_todos_week_number";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_todos_done";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_todos_archived";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_todos_device_id";--> statement-breakpoint
ALTER TABLE "todos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "todos" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "todos_select_own" ON "todos";--> statement-breakpoint
DROP POLICY IF EXISTS "todos_insert_own" ON "todos";--> statement-breakpoint
DROP POLICY IF EXISTS "todos_update_own" ON "todos";--> statement-breakpoint
DROP POLICY IF EXISTS "todos_delete_own" ON "todos";--> statement-breakpoint
CREATE POLICY "todos_select_own" ON "todos"
  FOR SELECT
  TO authenticated
  USING ("user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "todos_insert_own" ON "todos"
  FOR INSERT
  TO authenticated
  WITH CHECK ("user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "todos_update_own" ON "todos"
  FOR UPDATE
  TO authenticated
  USING ("user_id" = (select auth.uid()))
  WITH CHECK ("user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "todos_delete_own" ON "todos"
  FOR DELETE
  TO authenticated
  USING ("user_id" = (select auth.uid()));
