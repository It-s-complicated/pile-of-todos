alter table public.todos enable row level security;--> statement-breakpoint
alter table public.todos force row level security;--> statement-breakpoint

drop policy if exists "todos_select_own" on public.todos;--> statement-breakpoint
create policy "todos_select_own" on public.todos
  for select
  to authenticated
  using (user_id = (select auth.uid()));--> statement-breakpoint

grant select on table public.todos to authenticated;--> statement-breakpoint
revoke insert, update, delete on table public.todos from authenticated, anon, public;--> statement-breakpoint

revoke execute on function public.apply_todo_mutation(jsonb) from public, anon;--> statement-breakpoint
grant execute on function public.apply_todo_mutation(jsonb) to authenticated;
