alter table public.todos enable row level security;--> statement-breakpoint
alter table public.todos force row level security;--> statement-breakpoint

drop policy if exists "todos_select_own" on public.todos;--> statement-breakpoint
drop policy if exists "todos_insert_own" on public.todos;--> statement-breakpoint
drop policy if exists "todos_update_own" on public.todos;--> statement-breakpoint
drop policy if exists "todos_delete_own" on public.todos;--> statement-breakpoint

create policy "todos_select_own" on public.todos
  for select
  to authenticated
  using (user_id = (select auth.uid()));--> statement-breakpoint

create policy "todos_insert_own" on public.todos
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));--> statement-breakpoint

create policy "todos_update_own" on public.todos
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));--> statement-breakpoint

create policy "todos_delete_own" on public.todos
  for delete
  to authenticated
  using (user_id = (select auth.uid()));
--> statement-breakpoint

alter table public.todo_mutation_ledger enable row level security;--> statement-breakpoint
alter table public.todo_mutation_ledger force row level security;--> statement-breakpoint

drop policy if exists "todo_mutation_ledger_select_own" on public.todo_mutation_ledger;--> statement-breakpoint
drop policy if exists "todo_mutation_ledger_insert_own" on public.todo_mutation_ledger;--> statement-breakpoint

create policy "todo_mutation_ledger_select_own" on public.todo_mutation_ledger
  for select
  to authenticated
  using (user_id = (select auth.uid()));--> statement-breakpoint

grant select on table public.todo_mutation_ledger to authenticated;--> statement-breakpoint
revoke insert on table public.todo_mutation_ledger from authenticated;--> statement-breakpoint
revoke all on table public.todo_mutation_ledger from anon, public;
