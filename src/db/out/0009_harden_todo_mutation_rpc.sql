drop policy if exists "todos_insert_own" on public.todos;--> statement-breakpoint
drop policy if exists "todos_update_own" on public.todos;--> statement-breakpoint
drop policy if exists "todos_delete_own" on public.todos;--> statement-breakpoint

create or replace function public.apply_todo_mutation(intent jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  acting_user_id uuid := auth.uid();
  mutation_kind text := coalesce(intent->>'kind', '');
  requested_mutation_id text := coalesce(intent->>'mutationId', '');
  requested_todo_id_text text := nullif(intent->>'todoId', '');
  requested_todo_id uuid;
  mutation_values jsonb := coalesce(intent->'values', '{}'::jsonb);
  requested_label text := nullif(trim(coalesce(mutation_values->>'label', '')), '');
  requested_week_number integer := case
    when mutation_values ? 'weekNumber' and jsonb_typeof(mutation_values->'weekNumber') <> 'null'
      then (mutation_values->>'weekNumber')::integer
    else null
  end;
  requested_done boolean := case
    when mutation_values ? 'done' then (mutation_values->>'done')::boolean
    else null
  end;
  requested_archived boolean := case
    when mutation_values ? 'archived' then (mutation_values->>'archived')::boolean
    else null
  end;
  requested_created_at_value jsonb := mutation_values->'createdAt';
  requested_updated_at_value jsonb := mutation_values->'updatedAt';
  requested_deleted_at_value jsonb := mutation_values->'deletedAt';
  requested_created_at bigint;
  requested_updated_at bigint;
  requested_deleted_at bigint;
  requested_device_id text := nullif(coalesce(intent->'client'->>'deviceId', ''), '');
  accepted_txid xid8 := pg_current_xact_id();
  existing_mutation public.todo_mutation_ledger%rowtype;
  max_timestamp_ms constant numeric := 253402300799999;
begin
  if acting_user_id is null then
    raise exception 'apply_todo_mutation requires an authenticated user';
  end if;

  if requested_mutation_id = '' then
    raise sqlstate 'PT400' using message = 'apply_todo_mutation requires mutationId';
  end if;

  if requested_todo_id_text is null then
    raise sqlstate 'PT400' using message = 'apply_todo_mutation requires todoId';
  end if;

  begin
    requested_todo_id := requested_todo_id_text::uuid;
  exception
    when invalid_text_representation then
      raise sqlstate 'PT400' using message = 'todoId must be a UUID';
  end;

  if mutation_values ? 'label' and (
    requested_label is null
    or char_length(requested_label) > 500
    or requested_label !~* '^[a-z0-9[:space:].,!@+#$%&*''()?-]+$'
  ) then
    raise sqlstate 'PT400'
      using message = 'label must contain 1 to 500 supported characters';
  end if;

  if requested_created_at_value is not null
    and jsonb_typeof(requested_created_at_value) <> 'null' then
    if jsonb_typeof(requested_created_at_value) <> 'number'
      or requested_created_at_value::text !~ '^[0-9]+$' then
      raise sqlstate 'PT400' using message = 'createdAt must be epoch milliseconds';
    end if;

    if requested_created_at_value::text::numeric > max_timestamp_ms then
      raise sqlstate 'PT400' using message = 'createdAt is out of range';
    end if;

    requested_created_at := requested_created_at_value::text::bigint;
  end if;

  if requested_updated_at_value is not null
    and jsonb_typeof(requested_updated_at_value) <> 'null' then
    if jsonb_typeof(requested_updated_at_value) <> 'number'
      or requested_updated_at_value::text !~ '^[0-9]+$' then
      raise sqlstate 'PT400' using message = 'updatedAt must be epoch milliseconds';
    end if;

    if requested_updated_at_value::text::numeric > max_timestamp_ms then
      raise sqlstate 'PT400' using message = 'updatedAt is out of range';
    end if;

    requested_updated_at := requested_updated_at_value::text::bigint;
  end if;

  if requested_deleted_at_value is not null
    and jsonb_typeof(requested_deleted_at_value) <> 'null' then
    if jsonb_typeof(requested_deleted_at_value) <> 'number'
      or requested_deleted_at_value::text !~ '^[0-9]+$' then
      raise sqlstate 'PT400' using message = 'deletedAt must be epoch milliseconds';
    end if;

    if requested_deleted_at_value::text::numeric > max_timestamp_ms then
      raise sqlstate 'PT400' using message = 'deletedAt is out of range';
    end if;

    requested_deleted_at := requested_deleted_at_value::text::bigint;
  end if;

  insert into public.todo_mutation_ledger (
    mutation_id,
    user_id,
    todo_id,
    txid
  )
  values (
    requested_mutation_id,
    acting_user_id,
    requested_todo_id,
    accepted_txid
  )
  on conflict do nothing;

  if not found then
    select *
    into existing_mutation
    from public.todo_mutation_ledger
    where mutation_id = requested_mutation_id
      and user_id = acting_user_id;

    if not found then
      raise exception 'mutationId % is already claimed for another user', requested_mutation_id;
    end if;

    return jsonb_build_object(
      'mutationId', existing_mutation.mutation_id,
      'todoId', existing_mutation.todo_id,
      'txid', existing_mutation.txid::text
    );
  end if;

  if mutation_kind = 'create' then
    if requested_label is null then
      raise sqlstate 'PT400' using message = 'create intent requires a non-empty label';
    end if;

    if requested_done is null or requested_archived is null then
      raise sqlstate 'PT400' using message = 'create intent requires done and archived flags';
    end if;

    if requested_created_at is null or requested_updated_at is null then
      raise sqlstate 'PT400' using message = 'create intent requires createdAt and updatedAt';
    end if;

    insert into public.todos (
      id,
      label,
      week_number,
      done,
      archived,
      created_at,
      updated_at,
      device_id,
      user_id,
      deleted_at
    )
    values (
      requested_todo_id,
      requested_label,
      requested_week_number,
      requested_done,
      requested_archived,
      requested_created_at,
      requested_updated_at,
      requested_device_id,
      acting_user_id,
      requested_deleted_at
    );

    return jsonb_build_object(
      'mutationId', requested_mutation_id,
      'todoId', requested_todo_id,
      'txid', accepted_txid::text
    );
  end if;

  if requested_updated_at is null then
    raise sqlstate 'PT400' using message = 'update and delete intents require updatedAt';
  end if;

  if mutation_kind = 'update' then
    update public.todos
    set label = case when mutation_values ? 'label' then requested_label else label end,
        week_number = case when mutation_values ? 'weekNumber' then requested_week_number else week_number end,
        done = case when mutation_values ? 'done' then requested_done else done end,
        archived = case when mutation_values ? 'archived' then requested_archived else archived end,
        deleted_at = case when mutation_values ? 'deletedAt' then requested_deleted_at else deleted_at end,
        updated_at = requested_updated_at,
        device_id = coalesce(requested_device_id, device_id)
    where id = requested_todo_id
      and user_id = acting_user_id;

    if not found then
      raise exception 'todo % was not found for the authenticated user', requested_todo_id;
    end if;

    return jsonb_build_object(
      'mutationId', requested_mutation_id,
      'todoId', requested_todo_id,
      'txid', accepted_txid::text
    );
  end if;

  if mutation_kind = 'delete' then
    if requested_deleted_at is null then
      raise sqlstate 'PT400' using message = 'delete intent requires deletedAt';
    end if;

    update public.todos
    set deleted_at = requested_deleted_at,
        updated_at = requested_updated_at,
        device_id = coalesce(requested_device_id, device_id)
    where id = requested_todo_id
      and user_id = acting_user_id;

    if not found then
      raise exception 'todo % was not found for the authenticated user', requested_todo_id;
    end if;

    return jsonb_build_object(
      'mutationId', requested_mutation_id,
      'todoId', requested_todo_id,
      'txid', accepted_txid::text
    );
  end if;

  raise sqlstate 'PT400'
    using message = format('apply_todo_mutation does not support kind %s', mutation_kind);
end;
$$;--> statement-breakpoint

revoke execute on function public.apply_todo_mutation(jsonb) from public, anon;--> statement-breakpoint
grant execute on function public.apply_todo_mutation(jsonb) to authenticated;
